import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePageScriptUrl } from "../../performance/rules/duplicate-page-script.rule.ts";
import { duplicateScriptReferenceRule } from "./duplicate-script-reference.rule.ts";
import type { InternalThemeData } from "../../../collectors/themes/types.ts";

function makeTheme(scriptReferences: InternalThemeData["scriptReferences"]): InternalThemeData {
  return {
    themeId: "gid://shopify/Theme/1",
    themeName: "Test",
    themeRole: "MAIN",
    shopDomain: "example.myshopify.com",
    assets: [],
    scriptReferences,
  };
}

function ref(partial: Partial<InternalThemeData["scriptReferences"][number]> & { src: string; sourceFile: string }) {
  return {
    normalizedUrl: partial.src,
    async: false,
    defer: false,
    type: null,
    inHead: false,
    isExternal: false,
    isShopifyHosted: true,
    isModule: false,
    rawTag: `<script src="${partial.src}">`,
    ...partial,
  };
}

describe("same-file duplicate script rule", () => {
  it("flags duplicates only within the same Liquid file", () => {
    const theme = makeTheme([
      ref({ src: "theme.js", sourceFile: "layout/theme.liquid" }),
      ref({ src: "theme.js", sourceFile: "layout/theme.liquid" }),
      ref({ src: "theme.js", sourceFile: "sections/header.liquid" }),
    ]);

    const result = duplicateScriptReferenceRule.evaluate({ theme });
    const issues = Array.isArray(result) ? result : result.issues;
    assert.equal(issues.length, 1);
    assert.equal(issues[0].metadata?.sourceFile, "layout/theme.liquid");
    assert.equal(issues[0].metadata?.occurrenceCount, 2);
    assert.equal(issues[0].metadata?.scope, "same_file");
  });

  it("does not flag the same script across different files only", () => {
    const theme = makeTheme([
      ref({ src: "app.js", sourceFile: "layout/theme.liquid" }),
      ref({ src: "app.js", sourceFile: "sections/header.liquid" }),
    ]);

    const result = duplicateScriptReferenceRule.evaluate({ theme });
    const issues = Array.isArray(result) ? result : result.issues;
    assert.equal(issues.length, 0);
  });
});

describe("page script url normalization", () => {
  it("ignores hash and common cache busters", () => {
    assert.equal(
      normalizePageScriptUrl("https://CDN.Example.com/a.js?v=1#x"),
      "https://cdn.example.com/a.js"
    );
  });
});
