import { GraphqlQueryError } from "@shopify/shopify-api";
import shopify from "../../shopify.js";
import {
  COLLECT_PRODUCT_MEDIA_QUERY,
  COLLECT_PRODUCTS_QUERY,
} from "./queries.ts";
import {
  normalizeShopifyMediaImages,
  normalizeShopifyProduct,
} from "./normalize.ts";
import type {
  InternalProduct,
  InternalProductImage,
  ProductCollectionPageMeta,
  ProductCollectionResult,
  ShopifyMediaNode,
  ShopifyProductNode,
  ShopifyProductsPage,
} from "./types.ts";

export interface CollectProductsOptions {
  /** Products per Admin API page (1–250). Default 50. */
  pageSize?: number;
  /** Images per media page (1–250). Default 50. */
  mediaPageSize?: number;
  /** Optional hard cap for local testing on large catalogs. */
  maxProducts?: number;
  /**
   * When false, collected products are not retained in memory on the result.
   * Use with onPage for streaming/batch scanners. Default true.
   */
  retainProducts?: boolean;
  /** Invoked after each product page is fetched and normalized. */
  onPage?: (
    products: InternalProduct[],
    meta: ProductCollectionPageMeta
  ) => void | Promise<void>;
}

type GraphqlClient = InstanceType<typeof shopify.api.clients.Graphql>;

/** Minimal session shape required by the Shopify GraphQL client. */
export type ShopifyGraphqlSession = {
  shop: string;
  accessToken?: string;
};

function clampPageSize(value: number | undefined, fallback: number): number {
  const n = Number.isFinite(value) ? Number(value) : fallback;
  return Math.min(250, Math.max(1, Math.floor(n)));
}

function formatGraphqlError(error: unknown): Error {
  if (error instanceof GraphqlQueryError) {
    return new Error(
      `${error.message}\n${JSON.stringify(error.response, null, 2)}`
    );
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error("Unknown Shopify GraphQL error");
}

async function requestProductsPage(
  client: GraphqlClient,
  first: number,
  after: string | null,
  mediaFirst: number
): Promise<ShopifyProductsPage> {
  try {
    const response = await client.request(COLLECT_PRODUCTS_QUERY, {
      variables: {
        first,
        after,
        mediaFirst,
      },
    });

    const connection = response?.data?.products;
    if (!connection) {
      throw new Error("Shopify products response missing data.products");
    }

    return {
      nodes: Array.isArray(connection.nodes) ? connection.nodes : [],
      pageInfo: {
        hasNextPage: Boolean(connection.pageInfo?.hasNextPage),
        endCursor: connection.pageInfo?.endCursor ?? null,
      },
    };
  } catch (error) {
    throw formatGraphqlError(error);
  }
}

async function requestRemainingProductImages(
  client: GraphqlClient,
  productId: string,
  mediaPageSize: number,
  after: string | null
): Promise<{ images: InternalProductImage[]; endCursor: string | null; hasNextPage: boolean }> {
  try {
    const response = await client.request(COLLECT_PRODUCT_MEDIA_QUERY, {
      variables: {
        id: productId,
        first: mediaPageSize,
        after,
      },
    });

    const media = response?.data?.product?.media;
    const nodes = (media?.nodes || []) as Array<ShopifyMediaNode | null>;
    return {
      images: normalizeShopifyMediaImages(nodes),
      endCursor: media?.pageInfo?.endCursor ?? null,
      hasNextPage: Boolean(media?.pageInfo?.hasNextPage),
    };
  } catch (error) {
    throw formatGraphqlError(error);
  }
}

/**
 * Ensures all IMAGE media for a product are collected when the first page is truncated.
 */
async function collectAllImagesForProduct(
  client: GraphqlClient,
  node: ShopifyProductNode,
  mediaPageSize: number
): Promise<InternalProductImage[]> {
  const images = normalizeShopifyMediaImages(node.media?.nodes);
  let hasNextPage = Boolean(node.media?.pageInfo?.hasNextPage);
  let cursor = node.media?.pageInfo?.endCursor ?? null;

  while (hasNextPage && cursor) {
    const page = await requestRemainingProductImages(
      client,
      node.id,
      mediaPageSize,
      cursor
    );
    images.push(...page.images);
    hasNextPage = page.hasNextPage;
    cursor = page.endCursor;
  }

  return images;
}

async function normalizeProductWithFullMedia(
  client: GraphqlClient,
  node: ShopifyProductNode,
  mediaPageSize: number
): Promise<InternalProduct> {
  const images = await collectAllImagesForProduct(client, node, mediaPageSize);
  return normalizeShopifyProduct(node, images);
}

/**
 * Collects and normalizes the shop's product catalog via Admin GraphQL.
 * Uses the authenticated session already established by the Shopify app.
 */
export async function collectProducts(
  session: ShopifyGraphqlSession,
  options: CollectProductsOptions = {}
): Promise<ProductCollectionResult> {
  const pageSize = clampPageSize(options.pageSize, 50);
  const mediaPageSize = clampPageSize(options.mediaPageSize, 50);
  const maxProducts =
    typeof options.maxProducts === "number" && options.maxProducts > 0
      ? Math.floor(options.maxProducts)
      : null;

  const client = new shopify.api.clients.Graphql({ session });
  const products: InternalProduct[] = [];
  const retainProducts = options.retainProducts !== false;
  let totalFetched = 0;

  let after: string | null = null;
  let hasNextPage = true;
  let pageCount = 0;
  let truncated = false;

  while (hasNextPage) {
    const remaining =
      maxProducts === null ? null : maxProducts - totalFetched;
    if (remaining !== null && remaining <= 0) {
      truncated = true;
      break;
    }

    const requestSize =
      remaining === null ? pageSize : Math.min(pageSize, remaining);

    const page = await requestProductsPage(
      client,
      requestSize,
      after,
      mediaPageSize
    );
    pageCount += 1;

    const pageProducts: InternalProduct[] = [];
    for (const node of page.nodes) {
      if (!node?.id) continue;
      if (maxProducts !== null && totalFetched + pageProducts.length >= maxProducts) {
        truncated = true;
        break;
      }
      pageProducts.push(
        await normalizeProductWithFullMedia(client, node, mediaPageSize)
      );
    }

    totalFetched += pageProducts.length;
    if (retainProducts) {
      products.push(...pageProducts);
    }

    if (options.onPage) {
      await options.onPage(pageProducts, {
        pageNumber: pageCount,
        fetchedInPage: pageProducts.length,
        hasNextPage: page.pageInfo.hasNextPage && !truncated,
        endCursor: page.pageInfo.endCursor,
      });
    }

    if (truncated) {
      break;
    }

    hasNextPage = page.pageInfo.hasNextPage;
    after = page.pageInfo.endCursor;

    if (hasNextPage && !after) {
      throw new Error(
        "Shopify products pageInfo.hasNextPage is true but endCursor is missing"
      );
    }
  }

  return {
    products,
    totalFetched,
    pageCount,
    truncated,
  };
}
