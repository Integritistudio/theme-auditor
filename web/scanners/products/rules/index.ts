export { noImagesRule } from "./no-images.rule.ts";
export { imagesMissingAltRule } from "./images-missing-alt.rule.ts";
export { missingSeoTitleRule } from "./missing-seo-title.rule.ts";
export { missingSeoDescriptionRule } from "./missing-seo-description.rule.ts";
export { shortDescriptionRule } from "./short-description.rule.ts";
export { missingProductTypeRule } from "./missing-product-type.rule.ts";
export { duplicateTitleRule } from "./duplicate-title.rule.ts";

import type { ScanRule } from "../../../rules/types.ts";
import type { ProductBatchData } from "../types.ts";
import { noImagesRule } from "./no-images.rule.ts";
import { imagesMissingAltRule } from "./images-missing-alt.rule.ts";
import { missingSeoTitleRule } from "./missing-seo-title.rule.ts";
import { missingSeoDescriptionRule } from "./missing-seo-description.rule.ts";
import { shortDescriptionRule } from "./short-description.rule.ts";
import { missingProductTypeRule } from "./missing-product-type.rule.ts";

/** Rules evaluated against each product batch. */
export const PRODUCT_BATCH_RULES: readonly ScanRule<ProductBatchData>[] = [
  noImagesRule,
  imagesMissingAltRule,
  missingSeoTitleRule,
  missingSeoDescriptionRule,
  shortDescriptionRule,
  missingProductTypeRule,
];
