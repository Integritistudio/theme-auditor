import type { PageScanResult } from "../../collectors/storefront/types.ts";
import type {
  A11yButtonFinding,
  A11yFormControlFinding,
  A11yImageFinding,
  A11yLinkFinding,
  A11yPageSnapshot,
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

function hasAttr(tag: string, name: string): boolean {
  const re = new RegExp(
    `\\b${name}\\b\\s*(=\\s*(["'][^"']*["']|[^\\s>]+))?`,
    "i"
  );
  return re.test(tag);
}

function attrTrue(tag: string, name: string): boolean {
  const value = (getAttr(tag, name) || "").toLowerCase();
  if (!hasAttr(tag, name)) return false;
  return value === "" || value === name || value === "true";
}

function preview(tag: string, max = 180): string {
  return tag.replace(/\s+/g, " ").trim().slice(0, max);
}

export function extractHtmlLang(html: string): string | null {
  const match = html.match(/<html\b([^>]*)>/i);
  if (!match) return null;
  return getAttr(`<html ${match[1]}>`, "lang");
}

function extractImages(html: string): A11yImageFinding[] {
  const images: A11yImageFinding[] = [];
  const re = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    const altPresent = hasAttr(tag, "alt");
    images.push({
      src: getAttr(tag, "src") || getAttr(tag, "data-src"),
      altAttributePresent: altPresent,
      altValue: altPresent ? getAttr(tag, "alt") ?? "" : null,
      role: getAttr(tag, "role"),
      ariaHidden: attrTrue(tag, "aria-hidden"),
    });
  }
  return images;
}

function linkHasImageWithAlt(innerHtml: string): boolean {
  const imgRe = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRe.exec(innerHtml)) !== null) {
    const tag = match[0];
    if (hasAttr(tag, "alt") && (getAttr(tag, "alt") || "").trim().length > 0) {
      return true;
    }
  }
  return false;
}

function extractLinks(html: string): A11yLinkFinding[] {
  const links: A11yLinkFinding[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const openTag = `<a ${match[1] || ""}>`;
    const inner = match[2] || "";
    const text = stripTags(inner);
    const ariaLabel = getAttr(openTag, "aria-label");
    const ariaLabelledBy = getAttr(openTag, "aria-labelledby");
    const title = getAttr(openTag, "title");
    const hasImageWithAlt = linkHasImageWithAlt(inner);
    const accessibleName =
      (ariaLabel || "").trim() ||
      (ariaLabelledBy ? `[labelledby:${ariaLabelledBy}]` : "") ||
      text ||
      (hasImageWithAlt ? "[image-alt]" : "") ||
      (title || "").trim();

    links.push({
      href: getAttr(openTag, "href"),
      text,
      ariaLabel,
      ariaLabelledBy,
      title,
      hasImageWithAlt,
      accessibleName,
      rawTagPreview: preview(match[0]),
    });
  }
  return links;
}

function extractButtons(html: string): A11yButtonFinding[] {
  const buttons: A11yButtonFinding[] = [];

  const buttonRe = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let match: RegExpExecArray | null;
  while ((match = buttonRe.exec(html)) !== null) {
    const openTag = `<button ${match[1] || ""}>`;
    const text = stripTags(match[2] || "");
    const ariaLabel = getAttr(openTag, "aria-label");
    const ariaLabelledBy = getAttr(openTag, "aria-labelledby");
    const title = getAttr(openTag, "title");
    buttons.push({
      tagName: "button",
      type: getAttr(openTag, "type"),
      text,
      ariaLabel,
      ariaLabelledBy,
      title,
      accessibleName:
        (ariaLabel || "").trim() ||
        (ariaLabelledBy ? `[labelledby:${ariaLabelledBy}]` : "") ||
        text ||
        (title || "").trim(),
      rawTagPreview: preview(match[0]),
    });
  }

  // input buttons
  const inputRe = /<input\b[^>]*>/gi;
  while ((match = inputRe.exec(html)) !== null) {
    const tag = match[0];
    const type = (getAttr(tag, "type") || "text").toLowerCase();
    if (!["button", "submit", "reset"].includes(type)) continue;
    const ariaLabel = getAttr(tag, "aria-label");
    const ariaLabelledBy = getAttr(tag, "aria-labelledby");
    const title = getAttr(tag, "title");
    const value = getAttr(tag, "value") || "";
    buttons.push({
      tagName: "input",
      type,
      text: value,
      ariaLabel,
      ariaLabelledBy,
      title,
      accessibleName:
        (ariaLabel || "").trim() ||
        (ariaLabelledBy ? `[labelledby:${ariaLabelledBy}]` : "") ||
        value ||
        (title || "").trim(),
      rawTagPreview: preview(tag),
    });
  }

  return buttons;
}

function extractFormControls(html: string): A11yFormControlFinding[] {
  const labelFors = new Set<string>();
  const labelRe = /<label\b([^>]*)>/gi;
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = labelRe.exec(html)) !== null) {
    const forId = getAttr(`<label ${labelMatch[1] || ""}>`, "for");
    if (forId) labelFors.add(forId);
  }

  // Labels wrapping controls are hard to parse reliably → treated via MANUAL_REVIEW when uncertain.
  const controls: A11yFormControlFinding[] = [];
  const controlRe =
    /<(input|select|textarea)\b([^>]*)>(?:[\s\S]*?<\/\1>)?/gi;
  let match: RegExpExecArray | null;
  while ((match = controlRe.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    const attrs = match[2] || "";
    const openTag = `<${tagName} ${attrs}>`;
    const type = (getAttr(openTag, "type") || (tagName === "input" ? "text" : null))?.toLowerCase() || null;

    if (tagName === "input" && type === "hidden") continue;
    if (tagName === "input" && ["button", "submit", "reset", "image"].includes(type || "")) {
      continue; // handled as buttons
    }

    const id = getAttr(openTag, "id");
    const ariaLabel = getAttr(openTag, "aria-label");
    const ariaLabelledBy = getAttr(openTag, "aria-labelledby");
    const title = getAttr(openTag, "title");
    const placeholder = getAttr(openTag, "placeholder");
    const hasLabelFor = Boolean(id && labelFors.has(id));

    controls.push({
      tagName,
      type,
      id,
      name: getAttr(openTag, "name"),
      hasLabelFor,
      ariaLabel,
      ariaLabelledBy,
      title,
      placeholder,
      accessibleName:
        (ariaLabel || "").trim() ||
        (ariaLabelledBy ? `[labelledby:${ariaLabelledBy}]` : "") ||
        (hasLabelFor ? `[label-for:${id}]` : "") ||
        (title || "").trim(),
      rawTagPreview: preview(match[0]),
    });
  }

  return controls;
}

function extractHeadingLevels(html: string): number[] {
  const levels: number[] = [];
  const re = /<h([1-6])\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    levels.push(Number(match[1]));
  }
  return levels;
}

/**
 * Builds accessibility analysis snapshots from successfully fetched pages.
 */
export function buildA11yPageSnapshots(
  pages: PageScanResult[]
): A11yPageSnapshot[] {
  const snapshots: A11yPageSnapshot[] = [];

  for (const page of pages) {
    if (page.status !== "OK" || !page.html) continue;
    snapshots.push({
      page,
      lang: extractHtmlLang(page.html),
      images: extractImages(page.html),
      links: extractLinks(page.html),
      buttons: extractButtons(page.html),
      formControls: extractFormControls(page.html),
      headingLevels: extractHeadingLevels(page.html),
    });
  }

  return snapshots;
}

/** Generic / non-descriptive link texts that warrant review, not automatic failure. */
export const NON_DESCRIPTIVE_LINK_TEXTS = new Set([
  "click here",
  "here",
  "read more",
  "learn more",
  "more",
  "link",
  "details",
  "info",
  "this link",
]);
