export { imagesMissingAltRule } from "./images-missing-alt.rule.ts";
export { emptyLinksRule } from "./empty-links.rule.ts";
export { nonDescriptiveLinkTextRule } from "./non-descriptive-link-text.rule.ts";
export { buttonsMissingNameRule } from "./buttons-missing-name.rule.ts";
export { formControlsMissingLabelRule } from "./form-controls-missing-label.rule.ts";
export { missingHtmlLangRule } from "./missing-html-lang.rule.ts";
export { headingHierarchyRule } from "./heading-hierarchy.rule.ts";

import type { ScanRule } from "../../../rules/types.ts";
import type { AccessibilityRulesData } from "../types.ts";
import { imagesMissingAltRule } from "./images-missing-alt.rule.ts";
import { emptyLinksRule } from "./empty-links.rule.ts";
import { nonDescriptiveLinkTextRule } from "./non-descriptive-link-text.rule.ts";
import { buttonsMissingNameRule } from "./buttons-missing-name.rule.ts";
import { formControlsMissingLabelRule } from "./form-controls-missing-label.rule.ts";
import { missingHtmlLangRule } from "./missing-html-lang.rule.ts";
import { headingHierarchyRule } from "./heading-hierarchy.rule.ts";

export const ACCESSIBILITY_RULES: readonly ScanRule<AccessibilityRulesData>[] = [
  imagesMissingAltRule,
  emptyLinksRule,
  nonDescriptiveLinkTextRule,
  buttonsMissingNameRule,
  formControlsMissingLabelRule,
  missingHtmlLangRule,
  headingHierarchyRule,
];
