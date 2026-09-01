import shopify from "../../shopify.js";
import type { ShopifyGraphqlSession } from "../products/collector.ts";
import type { PageLinkRef, StorefrontTargets } from "./types.ts";

type GraphqlClient = InstanceType<typeof shopify.api.clients.Graphql>;

const DISCOVER_TARGETS_QUERY = `
  query StorefrontDiscoverTargets {
    shop {
      myshopifyDomain
      primaryDomain {
        url
      }
    }
    products(first: 5, query: "status:active") {
      nodes {
        handle
        onlineStoreUrl
        status
      }
    }
    collections(first: 5) {
      nodes {
        handle
        onlineStoreUrl
      }
    }
  }
`;

function normalizeBaseUrl(urlOrDomain: string): string {
  const trimmed = urlOrDomain.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function joinUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

function pickProductUrl(
  baseUrl: string,
  nodes: Array<{ handle?: string | null; onlineStoreUrl?: string | null }>
): string | null {
  for (const node of nodes) {
    if (node.onlineStoreUrl) return node.onlineStoreUrl;
    if (node.handle) return joinUrl(baseUrl, `/products/${node.handle}`);
  }
  return null;
}

function pickCollectionUrl(
  baseUrl: string,
  nodes: Array<{ handle?: string | null; onlineStoreUrl?: string | null }>
): string | null {
  for (const node of nodes) {
    if (node.onlineStoreUrl) return node.onlineStoreUrl;
    if (node.handle) return joinUrl(baseUrl, `/collections/${node.handle}`);
  }
  return null;
}

/**
 * Discover representative product/collection URLs from homepage links when Admin API is unavailable.
 */
export function discoverTargetsFromHomepageLinks(
  baseUrl: string,
  _shopDomain: string,
  links: PageLinkRef[]
): Pick<StorefrontTargets, "productUrl" | "collectionUrl"> {
  let productUrl: string | null = null;
  let collectionUrl: string | null = null;

  for (const link of links) {
    if (!link.href) continue;
    let absolute: string;
    try {
      absolute = new URL(link.href, baseUrl).toString();
    } catch {
      continue;
    }

    const path = new URL(absolute).pathname.toLowerCase();
    if (!productUrl && /\/products\/[^/]+\/?$/.test(path)) {
      productUrl = absolute;
    }
    if (
      !collectionUrl &&
      /\/collections\/[^/]+\/?$/.test(path) &&
      !/\/collections\/all\/?$/.test(path)
    ) {
      collectionUrl = absolute;
    }
    if (productUrl && collectionUrl) break;
  }

  if (!collectionUrl) {
    for (const link of links) {
      if (!link.href) continue;
      try {
        const absolute = new URL(link.href, baseUrl).toString();
        if (/\/collections\/all\/?$/i.test(new URL(absolute).pathname)) {
          collectionUrl = absolute;
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  return { productUrl, collectionUrl };
}

/**
 * Resolve public base URL + representative page targets for the shop.
 */
export async function resolveStorefrontTargets(
  session: ShopifyGraphqlSession,
  options: { shopDomain?: string; baseUrl?: string } = {}
): Promise<StorefrontTargets> {
  const shopDomain = options.shopDomain || session.shop;
  let baseUrl = options.baseUrl
    ? normalizeBaseUrl(options.baseUrl)
    : normalizeBaseUrl(shopDomain);

  let productUrl: string | null = null;
  let collectionUrl: string | null = null;

  try {
    const client: GraphqlClient = new shopify.api.clients.Graphql({ session });
    const response = await client.request(DISCOVER_TARGETS_QUERY);
    const shop = response?.data?.shop;
    if (shop?.primaryDomain?.url) {
      baseUrl = normalizeBaseUrl(shop.primaryDomain.url);
    } else if (shop?.myshopifyDomain) {
      baseUrl = normalizeBaseUrl(shop.myshopifyDomain);
    }

    productUrl = pickProductUrl(baseUrl, response?.data?.products?.nodes || []);
    collectionUrl = pickCollectionUrl(
      baseUrl,
      response?.data?.collections?.nodes || []
    );
  } catch (error) {
    console.warn(
      "Storefront target discovery via Admin API failed; will fall back to homepage links:",
      error instanceof Error ? error.message : error
    );
  }

  return {
    shopDomain,
    baseUrl,
    homeUrl: joinUrl(baseUrl, "/"),
    productUrl,
    collectionUrl,
    cartUrl: joinUrl(baseUrl, "/cart"),
  };
}
