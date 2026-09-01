import type {
  InternalScriptReference,
  InternalThemeAsset,
  InternalThemeData,
  ShopifyThemeFileNode,
  ThemeAssetKind,
} from "./types.ts";

const SHOPIFY_HOST_RE =
  /(^|\.)myshopify\.com$|(^|\.)shopify\.com$|(^|\.)shopifycdn\.com$|(^|\.)shopifycloud\.com$/i;

function parseSizeBytes(size: string | number | null | undefined): number | null {
  if (size === null || size === undefined || size === "") return null;
  const n = typeof size === "number" ? size : Number(size);
  return Number.isFinite(n) ? n : null;
}

export function classifyThemeAssetKind(filename: string): ThemeAssetKind {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "javascript";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".liquid")) return "liquid";
  return "other";
}

function extractTextContent(node: ShopifyThemeFileNode): string | null {
  const body = node.body;
  if (!body) return null;
  if (typeof body.content === "string") return body.content;
  return null;
}

export function normalizeThemeAsset(
  node: ShopifyThemeFileNode
): InternalThemeAsset | null {
  const filename = node.filename?.trim();
  if (!filename) return null;

  const kind = classifyThemeAssetKind(filename);
  const textContent =
    kind === "liquid" ? extractTextContent(node) : extractTextContent(node);

  return {
    filename,
    contentType: node.contentType || "application/octet-stream",
    sizeBytes: parseSizeBytes(node.size),
    checksumMd5: node.checksumMd5 || null,
    kind,
    // Keep liquid text for script extraction; skip huge binary bodies.
    textContent: kind === "liquid" ? textContent : null,
  };
}

export function isShopifyHostedUrl(url: string): boolean {
  try {
    if (url.startsWith("//")) {
      return isShopifyHostedUrl(`https:${url}`);
    }
    if (!/^https?:\/\//i.test(url)) {
      // Theme-relative / asset_url style references are first-party.
      return true;
    }
    const host = new URL(url).hostname;
    return SHOPIFY_HOST_RE.test(host);
  } catch {
    return false;
  }
}

export function isExternalScriptUrl(src: string): boolean {
  const trimmed = src.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("//")) return true;
  return /^https?:\/\//i.test(trimmed);
}

/**
 * Normalizes script URLs for duplicate detection (host lowercased, hash stripped).
 */
export function normalizeScriptUrl(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) return "";

  try {
    if (trimmed.startsWith("//")) {
      return normalizeScriptUrl(`https:${trimmed}`);
    }
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      url.hash = "";
      url.hostname = url.hostname.toLowerCase();
      return url.toString();
    }
  } catch {
    // fall through
  }

  return trimmed.replace(/\s+/g, "").toLowerCase();
}

function parseBooleanAttr(attrs: string, name: string): boolean {
  const re = new RegExp(`\\b${name}\\b\\s*(=\\s*(["'][^"']*["']|[^\\s>]+))?`, "i");
  return re.test(attrs);
}

function parseAttrValue(attrs: string, name: string): string | null {
  const re = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  );
  const match = attrs.match(re);
  if (!match) return null;
  return (match[1] ?? match[2] ?? match[3] ?? "").trim() || null;
}

/**
 * Extracts <script src="..."> references from Liquid/HTML text.
 * Only tags with a src attribute are returned (inline unused analysis is out of scope).
 */
export function extractScriptReferences(
  sourceFile: string,
  content: string
): InternalScriptReference[] {
  const refs: InternalScriptReference[] = [];
  const isLayout = sourceFile.toLowerCase().startsWith("layout/");

  // Track crude <head> region for layout files only.
  const headOpen = content.search(/<head\b[^>]*>/i);
  const headClose = content.search(/<\/head>/i);
  const headStart = headOpen >= 0 ? headOpen : -1;
  const headEnd = headClose >= 0 ? headClose : -1;

  const scriptRe = /<script\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRe.exec(content)) !== null) {
    const attrs = match[1] || "";
    const src = parseAttrValue(attrs, "src");
    if (!src) continue;

    const type = parseAttrValue(attrs, "type");
    const isModule = (type || "").toLowerCase() === "module";
    const index = match.index;
    const inHead =
      isLayout && headStart >= 0 && headEnd > headStart
        ? index > headStart && index < headEnd
        : false;

    const external = isExternalScriptUrl(src);

    refs.push({
      src,
      normalizedUrl: normalizeScriptUrl(src),
      sourceFile,
      async: parseBooleanAttr(attrs, "async"),
      defer: parseBooleanAttr(attrs, "defer"),
      type,
      inHead,
      isExternal: external,
      isShopifyHosted: isShopifyHostedUrl(src),
      isModule,
      rawTag: match[0],
    });
  }

  return refs;
}

export function buildInternalThemeData(input: {
  themeId: string;
  themeName: string;
  themeRole: string;
  shopDomain: string | null;
  fileNodes: ShopifyThemeFileNode[];
}): InternalThemeData {
  const assets: InternalThemeAsset[] = [];
  for (const node of input.fileNodes) {
    const asset = normalizeThemeAsset(node);
    if (asset) assets.push(asset);
  }

  const scriptReferences: InternalScriptReference[] = [];
  for (const asset of assets) {
    if (asset.kind !== "liquid" || !asset.textContent) continue;
    // Focus on layout/snippets/sections where storefront scripts are typically declared.
    const lower = asset.filename.toLowerCase();
    if (
      !(
        lower.startsWith("layout/") ||
        lower.startsWith("snippets/") ||
        lower.startsWith("sections/")
      )
    ) {
      continue;
    }
    scriptReferences.push(
      ...extractScriptReferences(asset.filename, asset.textContent)
    );
  }

  return {
    themeId: input.themeId,
    themeName: input.themeName,
    themeRole: input.themeRole,
    shopDomain: input.shopDomain,
    assets,
    scriptReferences,
  };
}
