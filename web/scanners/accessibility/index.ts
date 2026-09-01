export type {
  A11yClassification,
  A11yPageSnapshot,
  AccessibilityRulesData,
} from "./types.ts";
export { classificationToConfidence } from "./types.ts";
export { buildA11yPageSnapshots } from "./extract.ts";

export {
  ACCESSIBILITY_RULES,
  imagesMissingAltRule,
  emptyLinksRule,
  nonDescriptiveLinkTextRule,
  buttonsMissingNameRule,
  formControlsMissingLabelRule,
  missingHtmlLangRule,
  headingHierarchyRule,
} from "./rules/index.ts";

export {
  runAccessibilityScanner,
  type AccessibilityScannerOptions,
  type AccessibilityScannerResult,
} from "./scanner.ts";
