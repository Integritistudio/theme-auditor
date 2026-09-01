import { buildIssueFingerprint } from "./fingerprint.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("fingerprint is stable across scans without relying on issue UUID", () => {
  const a = buildIssueFingerprint({
    ruleId: "product.no-images",
    title: "Product has no images",
    affectedResource: "gid://shopify/Product/1",
    affectedResourceType: "product",
    metadata: { pageType: "PRODUCT" },
  });
  const b = buildIssueFingerprint({
    ruleId: "product.no-images",
    title: "Product has no images",
    affectedResource: "gid://shopify/Product/1",
    affectedResourceType: "product",
    metadata: { pageType: "PRODUCT" },
  });
  assert.equal(a, b);
  assert.match(a, /^product\.no-images\|/);
});

test("different resources produce different fingerprints", () => {
  const a = buildIssueFingerprint({
    ruleId: "product.no-images",
    title: "Product has no images",
    affectedResource: "gid://shopify/Product/1",
  });
  const b = buildIssueFingerprint({
    ruleId: "product.no-images",
    title: "Product has no images",
    affectedResource: "gid://shopify/Product/2",
  });
  assert.notEqual(a, b);
});
