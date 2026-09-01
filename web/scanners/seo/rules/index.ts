export { missingPageTitleRule } from "./missing-page-title.rule.ts";
export { missingMetaDescriptionRule } from "./missing-meta-description.rule.ts";
export { missingH1Rule } from "./missing-h1.rule.ts";
export { multipleH1Rule } from "./multiple-h1.rule.ts";
export { missingCanonicalRule } from "./missing-canonical.rule.ts";
export { duplicatePageTitlesRule } from "./duplicate-page-titles.rule.ts";
export { duplicateMetaDescriptionsRule } from "./duplicate-meta-descriptions.rule.ts";
export { missingOpenGraphRule } from "./missing-open-graph.rule.ts";

import type { ScanRule } from "../../../rules/types.ts";
import type { SeoRulesData } from "../types.ts";
import { missingPageTitleRule } from "./missing-page-title.rule.ts";
import { missingMetaDescriptionRule } from "./missing-meta-description.rule.ts";
import { missingH1Rule } from "./missing-h1.rule.ts";
import { multipleH1Rule } from "./multiple-h1.rule.ts";
import { missingCanonicalRule } from "./missing-canonical.rule.ts";
import { duplicatePageTitlesRule } from "./duplicate-page-titles.rule.ts";
import { duplicateMetaDescriptionsRule } from "./duplicate-meta-descriptions.rule.ts";
import { missingOpenGraphRule } from "./missing-open-graph.rule.ts";

export const SEO_RULES: readonly ScanRule<SeoRulesData>[] = [
  missingPageTitleRule,
  missingMetaDescriptionRule,
  missingH1Rule,
  multipleH1Rule,
  missingCanonicalRule,
  duplicatePageTitlesRule,
  duplicateMetaDescriptionsRule,
  missingOpenGraphRule,
];
