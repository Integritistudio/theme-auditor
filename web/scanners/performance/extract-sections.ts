import type { PageScanResult } from "../../collectors/storefront/types.ts";
import type {
  ExtractedSection,
  PageKindLabel,
  SectionImageFactor,
  SectionOffendingPart,
  SectionPerformanceData,
  SectionScriptFactor,
} from "./types.ts";

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

function isShopifySectionOpenTag(tag: string): boolean {
  const id = (getAttr(tag, "id") || "").toLowerCase();
  const className = (getAttr(tag, "class") || "").toLowerCase();
  return (
    id.startsWith("shopify-section-") ||
    /(^|\s)shopify-section(\s|$)/.test(className)
  );
}

/**
 * Derive a readable section type from Shopify DOM attributes / id.
 */
export function deriveSectionType(
  sectionDomId: string,
  dataSectionType: string | null,
  className: string | null
): string {
  if (dataSectionType?.trim()) {
    return dataSectionType.trim();
  }

  const classMatch = (className || "").match(
    /(?:^|\s)(?:section-|shopify-section--)([a-z0-9_-]+)/i
  );
  if (classMatch?.[1]) {
    return classMatch[1];
  }

  const id = sectionDomId.replace(/^shopify-section-/i, "");
  const parts = id.split("__");
  if (parts.length >= 2) {
    return parts[parts.length - 1].replace(/_/g, "-");
  }
  return id || "unknown-section";
}

function shortenUrl(url: string | null, max = 120): string | null {
  if (!url) return null;
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

function basenameFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const path = new URL(url, "https://example.com").pathname;
    const base = path.split("/").filter(Boolean).pop() || path;
    return base || url;
  } catch {
    return url.split("?")[0].split("/").pop() || url;
  }
}

function extractImages(html: string): SectionImageFactor[] {
  const images: SectionImageFactor[] = [];
  const imgRe = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRe.exec(html)) !== null) {
    const tag = match[0];
    const loading = (getAttr(tag, "loading") || "").toLowerCase();
    const width = getAttr(tag, "width");
    const height = getAttr(tag, "height");
    images.push({
      src: getAttr(tag, "src") || getAttr(tag, "data-src"),
      hasLazy: loading === "lazy",
      hasDimensions: Boolean(width && height),
    });
  }
  return images;
}

function extractScripts(html: string): SectionScriptFactor[] {
  const scripts: SectionScriptFactor[] = [];
  const scriptRe =
    /<script\b([^>]*)>([\s\S]*?)<\/script>|<script\b([^>]*)\s*\/>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html)) !== null) {
    const attrs = match[1] || match[3] || "";
    const tag = `<script ${attrs}>`;
    const src = getAttr(tag, "src");
    const body = (match[2] || "").replace(/\s+/g, " ").trim();
    scripts.push({
      src,
      inline: !src,
      async: hasBooleanAttr(tag, "async"),
      defer: hasBooleanAttr(tag, "defer"),
      inlinePreview: src
        ? null
        : body
          ? shortenUrl(body, 80)
          : "(empty inline script)",
    });
  }
  return scripts;
}

function extractIframeSrcs(html: string): string[] {
  const srcs: string[] = [];
  const iframeRe = /<iframe\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = iframeRe.exec(html)) !== null) {
    const src = getAttr(match[0], "src");
    if (src) srcs.push(src);
  }
  return srcs;
}

function countTags(html: string, tagName: string): number {
  const re = new RegExp(`<${tagName}\\b`, "gi");
  return (html.match(re) || []).length;
}

function buildOffendingParts(input: {
  images: SectionImageFactor[];
  scripts: SectionScriptFactor[];
  iframeSrcs: string[];
  videoCount: number;
  htmlByteSize: number;
  approxNodeCount: number;
}): SectionOffendingPart[] {
  const parts: SectionOffendingPart[] = [];

  const noLazy = input.images.filter((i) => !i.hasLazy && i.src);
  for (const img of noLazy.slice(0, 5)) {
    parts.push({
      part: "image",
      detail: `Image missing lazy-loading: ${basenameFromUrl(img.src) || img.src}`,
    });
  }
  if (noLazy.length > 5) {
    parts.push({
      part: "image",
      detail: `…and ${noLazy.length - 5} more images without lazy-loading`,
    });
  }

  for (const script of input.scripts.slice(0, 8)) {
    if (script.src) {
      const flags = [
        script.async ? "async" : null,
        script.defer ? "defer" : null,
      ]
        .filter(Boolean)
        .join(", ");
      parts.push({
        part: "script",
        detail: `Script file: ${basenameFromUrl(script.src) || script.src}${
          flags ? ` (${flags})` : " (no defer/async)"
        } — ${shortenUrl(script.src)}`,
      });
    } else {
      parts.push({
        part: "inline_script",
        detail: `Inline script in section: ${script.inlinePreview || "…"}`,
      });
    }
  }
  if (input.scripts.length > 8) {
    parts.push({
      part: "script",
      detail: `…and ${input.scripts.length - 8} more scripts in this section`,
    });
  }

  for (const src of input.iframeSrcs.slice(0, 5)) {
    parts.push({
      part: "iframe",
      detail: `Embed iframe: ${shortenUrl(src)}`,
    });
  }

  if (input.videoCount > 0) {
    parts.push({
      part: "video",
      detail: `${input.videoCount} <video> element(s) inside this section`,
    });
  }

  if (input.htmlByteSize >= 20_000) {
    parts.push({
      part: "markup",
      detail: `Large section markup (~${Math.round(input.htmlByteSize / 1024)}KB, ~${input.approxNodeCount} DOM nodes)`,
    });
  }

  return parts;
}

/**
 * Weighted estimate of how likely a section is to slow first paint / load.
 */
export function scoreSectionWeight(input: {
  htmlByteSize: number;
  approxNodeCount: number;
  images: SectionImageFactor[];
  scriptCount: number;
  inlineScriptCount: number;
  externalScriptCount: number;
  iframeCount: number;
  videoCount: number;
}): { weightScore: number; weightFactors: string[] } {
  let weight = 0;
  const factors: string[] = [];

  const { images } = input;
  const missingLazy = images.filter((i) => !i.hasLazy).length;
  const missingDims = images.filter((i) => !i.hasDimensions).length;

  if (images.length > 0) {
    weight += images.length * 2;
    factors.push(`images:${images.length}`);
  }
  if (missingLazy > 0) {
    weight += missingLazy * 2;
    factors.push(`images_missing_lazy:${missingLazy}`);
  }
  if (missingDims > 0) {
    weight += Math.min(6, missingDims);
    factors.push(`images_missing_dimensions:${missingDims}`);
  }
  if (images.length >= 6) {
    weight += 4;
    factors.push("many_images");
  }

  if (input.iframeCount > 0) {
    weight += input.iframeCount * 8;
    factors.push(`iframes:${input.iframeCount}`);
  }
  if (input.videoCount > 0) {
    weight += input.videoCount * 8;
    factors.push(`videos:${input.videoCount}`);
  }

  if (input.inlineScriptCount > 0) {
    weight += input.inlineScriptCount * 3;
    factors.push(`inline_scripts:${input.inlineScriptCount}`);
  }
  if (input.externalScriptCount > 0) {
    weight += input.externalScriptCount * 5;
    factors.push(`external_scripts:${input.externalScriptCount}`);
  }

  if (input.htmlByteSize >= 40_000) {
    weight += Math.floor(input.htmlByteSize / 10_000);
    factors.push(`large_html_bytes:${input.htmlByteSize}`);
  } else if (input.htmlByteSize >= 20_000) {
    weight += 3;
    factors.push(`html_bytes:${input.htmlByteSize}`);
  }

  if (input.approxNodeCount >= 200) {
    weight += Math.min(10, Math.floor(input.approxNodeCount / 50));
    factors.push(`dense_dom:${input.approxNodeCount}`);
  }

  return { weightScore: weight, weightFactors: factors };
}

/**
 * Walk HTML and extract top-level shopify-section wrappers with nested content.
 */
export function extractShopifySectionsFromHtml(
  html: string,
  pageKind: PageKindLabel,
  pageUrl: string
): ExtractedSection[] {
  if (!html) return [];

  const sections: ExtractedSection[] = [];
  const openRe = /<div\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = openRe.exec(html)) !== null) {
    const openTag = match[0];
    if (!isShopifySectionOpenTag(openTag)) continue;

    const startIndex = match.index;
    const afterOpen = startIndex + openTag.length;

    let depth = 1;
    const tokenRe = /<\/?div\b[^>]*>/gi;
    tokenRe.lastIndex = afterOpen;
    let token: RegExpExecArray | null;
    let endIndex = -1;

    while ((token = tokenRe.exec(html)) !== null) {
      const tok = token[0];
      if (/^<\//.test(tok)) {
        depth -= 1;
        if (depth === 0) {
          endIndex = token.index + tok.length;
          break;
        }
      } else if (!/\/>$/.test(tok)) {
        depth += 1;
      }
    }

    if (endIndex < 0) {
      endIndex = Math.min(html.length, afterOpen + 200_000);
    }

    const outerHtml = html.slice(startIndex, endIndex);
    const sectionDomId =
      getAttr(openTag, "id") ||
      `shopify-section-unknown-${sections.length + 1}`;
    const sectionId = getAttr(openTag, "data-section-id");
    const dataSectionType = getAttr(openTag, "data-section-type");
    const className = getAttr(openTag, "class");
    const sectionType = deriveSectionType(
      sectionDomId,
      dataSectionType,
      className
    );

    const images = extractImages(outerHtml);
    const scripts = extractScripts(outerHtml);
    const iframeSrcs = extractIframeSrcs(outerHtml);
    const videoCount = countTags(outerHtml, "video");
    const approxNodeCount = (outerHtml.match(/<[a-zA-Z][\w:-]*/g) || []).length;
    const htmlByteSize = Buffer.byteLength(outerHtml, "utf8");
    const inlineScriptCount = scripts.filter((s) => s.inline).length;
    const externalScriptCount = scripts.filter((s) => !s.inline).length;

    const { weightScore, weightFactors } = scoreSectionWeight({
      htmlByteSize,
      approxNodeCount,
      images,
      scriptCount: scripts.length,
      inlineScriptCount,
      externalScriptCount,
      iframeCount: iframeSrcs.length,
      videoCount,
    });

    const offendingParts = buildOffendingParts({
      images,
      scripts,
      iframeSrcs,
      videoCount,
      htmlByteSize,
      approxNodeCount,
    });

    sections.push({
      sectionDomId,
      sectionId,
      sectionType,
      pageKind,
      pageUrl,
      htmlByteSize,
      approxNodeCount,
      images,
      imageCount: images.length,
      imagesMissingLazy: images.filter((i) => !i.hasLazy).length,
      imagesMissingDimensions: images.filter((i) => !i.hasDimensions).length,
      scripts,
      scriptCount: scripts.length,
      inlineScriptCount,
      externalScriptCount,
      iframeCount: iframeSrcs.length,
      iframeSrcs,
      videoCount,
      weightScore,
      weightFactors,
      offendingParts,
    });

    openRe.lastIndex = endIndex;
  }

  return sections;
}

/**
 * Build section performance data from storefront page fetch results.
 */
export function buildSectionPerformanceData(
  pages: PageScanResult[]
): SectionPerformanceData {
  const sections: ExtractedSection[] = [];

  for (const page of pages) {
    if (page.status !== "OK" || !page.html) continue;
    const pageUrl = page.finalUrl || page.requestedUrl;
    const extracted = extractShopifySectionsFromHtml(
      page.html,
      page.kind as PageKindLabel,
      pageUrl
    );
    sections.push(...extracted);
  }

  return { sections };
}
