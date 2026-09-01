import type {
  PageHeading,
  PageImageRef,
  PageLinkRef,
  PageOpenGraph,
  PageScriptRef,
  PageStylesheetRef,
} from "./types.ts";

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeBasicEntities(html.replace(/<[^>]+>/g, " "));
}

function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  );
  const match = tag.match(re);
  if (!match) return null;
  const value = match[1] ?? match[2] ?? match[3] ?? "";
  return value.trim() || null;
}

function hasBooleanAttr(tag: string, name: string): boolean {
  const re = new RegExp(
    `\\b${name}\\b\\s*(=\\s*(["'][^"']*["']|[^\\s>]+))?`,
    "i"
  );
  return re.test(tag);
}

export function extractTitle(html: string): string | null {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const title = stripTags(match[1]);
  return title || null;
}

export function extractMetaDescription(html: string): string | null {
  const metaRe = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaRe.exec(html)) !== null) {
    const tag = match[0];
    const name = (getAttr(tag, "name") || "").toLowerCase();
    if (name === "description") {
      const content = getAttr(tag, "content");
      if (content) return decodeBasicEntities(content);
    }
  }
  return null;
}

export function extractOpenGraph(html: string): PageOpenGraph {
  const og: PageOpenGraph = {
    title: null,
    description: null,
    image: null,
    url: null,
    type: null,
  };

  const metaRe = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaRe.exec(html)) !== null) {
    const tag = match[0];
    const property = (getAttr(tag, "property") || getAttr(tag, "name") || "").toLowerCase();
    const content = getAttr(tag, "content");
    if (!content) continue;
    const value = decodeBasicEntities(content);

    switch (property) {
      case "og:title":
        og.title = value;
        break;
      case "og:description":
        og.description = value;
        break;
      case "og:image":
        if (!og.image) og.image = value;
        break;
      case "og:url":
        og.url = value;
        break;
      case "og:type":
        og.type = value;
        break;
      default:
        break;
    }
  }

  return og;
}

export function extractCanonicalUrl(html: string): string | null {
  const linkRe = /<link\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html)) !== null) {
    const tag = match[0];
    const rel = (getAttr(tag, "rel") || "").toLowerCase();
    if (rel.split(/\s+/).includes("canonical")) {
      return getAttr(tag, "href");
    }
  }
  return null;
}

export function extractHeadings(html: string): PageHeading[] {
  const headings: PageHeading[] = [];
  const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const level = Number(match[1]) as PageHeading["level"];
    const text = stripTags(match[2]);
    if (!text) continue;
    headings.push({ level, text });
  }
  return headings;
}

export function extractImages(html: string): PageImageRef[] {
  const images: PageImageRef[] = [];
  const re = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    images.push({
      src: getAttr(tag, "src") || getAttr(tag, "data-src"),
      alt: getAttr(tag, "alt"),
    });
  }
  return images;
}

export function extractScripts(html: string): PageScriptRef[] {
  const scripts: PageScriptRef[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>|<script\b([^>]*)\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const attrs = match[1] ?? match[3] ?? "";
    const src = getAttr(`<script ${attrs}>`, "src");
    scripts.push({
      src,
      inline: !src,
      async: hasBooleanAttr(`<script ${attrs}>`, "async"),
      defer: hasBooleanAttr(`<script ${attrs}>`, "defer"),
      type: getAttr(`<script ${attrs}>`, "type"),
    });
  }
  return scripts;
}

export function extractStylesheets(html: string): PageStylesheetRef[] {
  const stylesheets: PageStylesheetRef[] = [];

  const linkRe = /<link\b[^>]*>/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRe.exec(html)) !== null) {
    const tag = linkMatch[0];
    const rel = (getAttr(tag, "rel") || "").toLowerCase();
    if (!rel.split(/\s+/).includes("stylesheet")) continue;
    stylesheets.push({
      href: getAttr(tag, "href"),
      inline: false,
      media: getAttr(tag, "media"),
    });
  }

  const styleRe = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
  let styleMatch: RegExpExecArray | null;
  while ((styleMatch = styleRe.exec(html)) !== null) {
    stylesheets.push({
      href: null,
      inline: true,
      media: getAttr(styleMatch[0], "media"),
    });
  }

  return stylesheets;
}

export function extractLinks(html: string): PageLinkRef[] {
  const links: PageLinkRef[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const attrs = match[1] || "";
    const tag = `<a ${attrs}>`;
    links.push({
      href: getAttr(tag, "href"),
      text: stripTags(match[2]).slice(0, 300),
      rel: getAttr(tag, "rel"),
    });
  }
  return links;
}

/**
 * Detect Shopify storefront password gate / non-public interstitial pages.
 */
export function detectNonPublicPage(html: string, finalUrl: string): {
  passwordProtected: boolean;
  nonPublic: boolean;
  reason: string | null;
} {
  const lowerHtml = html.toLowerCase();
  const lowerUrl = finalUrl.toLowerCase();

  const passwordProtected =
    lowerUrl.includes("/password") ||
    (lowerHtml.includes("name=\"password\"") &&
      (lowerHtml.includes("storefront_password") ||
        lowerHtml.includes("enter store password") ||
        lowerHtml.includes("password for"))) ||
    lowerHtml.includes("id=\"password\"");

  if (passwordProtected) {
    return {
      passwordProtected: true,
      nonPublic: true,
      reason: "Storefront password page detected",
    };
  }

  // Common non-storefront admin / account walls mistakenly hit as "public"
  if (
    lowerUrl.includes("/admin") ||
    lowerUrl.includes("/account/login") ||
    lowerHtml.includes("name=\"checkout[email]\"") &&
      lowerUrl.includes("/login")
  ) {
    return {
      passwordProtected: false,
      nonPublic: true,
      reason: "Non-public admin/account page detected",
    };
  }

  return { passwordProtected: false, nonPublic: false, reason: null };
}

export interface ParsedPageContent {
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  openGraph: PageOpenGraph;
  headings: PageHeading[];
  images: PageImageRef[];
  scripts: PageScriptRef[];
  stylesheets: PageStylesheetRef[];
  links: PageLinkRef[];
}

export function parsePageHtml(html: string): ParsedPageContent {
  return {
    title: extractTitle(html),
    metaDescription: extractMetaDescription(html),
    canonicalUrl: extractCanonicalUrl(html),
    openGraph: extractOpenGraph(html),
    headings: extractHeadings(html),
    images: extractImages(html),
    scripts: extractScripts(html),
    stylesheets: extractStylesheets(html),
    links: extractLinks(html),
  };
}
