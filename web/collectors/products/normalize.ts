import type {
  InternalProduct,
  InternalProductImage,
  InternalProductStatus,
  ShopifyMediaNode,
  ShopifyProductNode,
} from "./types.ts";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStatus(status: string | null | undefined): InternalProductStatus {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "ACTIVE";
    case "ARCHIVED":
      return "ARCHIVED";
    case "DRAFT":
      return "DRAFT";
    default:
      return "UNKNOWN";
  }
}

function normalizeTags(tags: ShopifyProductNode["tags"]): string[] {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }
  if (typeof tags === "string" && tags.trim()) {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeDescription(node: ShopifyProductNode): string {
  const plain = node.description?.trim();
  if (plain) {
    return plain;
  }
  const html = node.descriptionHtml?.trim();
  if (html) {
    return stripHtml(html);
  }
  return "";
}

/**
 * Maps a Shopify MediaImage node to the internal image type.
 * Non-image media nodes (or incomplete payloads) are skipped by returning null.
 */
export function normalizeShopifyMediaImage(
  node: ShopifyMediaNode | null | undefined
): InternalProductImage | null {
  if (!node?.id) {
    return null;
  }

  const url = node.image?.url ?? null;
  const altText = node.alt ?? node.image?.altText ?? null;

  return {
    id: node.id,
    url,
    altText,
  };
}

export function normalizeShopifyMediaImages(
  nodes: Array<ShopifyMediaNode | null> | null | undefined
): InternalProductImage[] {
  if (!Array.isArray(nodes)) {
    return [];
  }

  const images: InternalProductImage[] = [];
  for (const node of nodes) {
    const image = normalizeShopifyMediaImage(node);
    if (image) {
      images.push(image);
    }
  }
  return images;
}

/**
 * Converts one Shopify product GraphQL node into InternalProduct.
 */
export function normalizeShopifyProduct(
  node: ShopifyProductNode,
  images?: InternalProductImage[]
): InternalProduct {
  return {
    id: node.id,
    title: node.title?.trim() || "",
    description: normalizeDescription(node),
    productType: node.productType?.trim() || "",
    tags: normalizeTags(node.tags),
    seoTitle: node.seo?.title?.trim() || null,
    seoDescription: node.seo?.description?.trim() || null,
    status: normalizeStatus(node.status),
    images: images ?? normalizeShopifyMediaImages(node.media?.nodes),
  };
}

export function normalizeShopifyProducts(
  nodes: ShopifyProductNode[]
): InternalProduct[] {
  return nodes.filter((node) => Boolean(node?.id)).map((node) =>
    normalizeShopifyProduct(node)
  );
}
