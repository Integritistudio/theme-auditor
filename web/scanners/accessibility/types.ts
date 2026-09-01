import type { PageScanResult } from "../../collectors/storefront/types.ts";

/** Certainty classification for accessibility findings. */
export type A11yClassification = "CONFIRMED" | "POTENTIAL" | "MANUAL_REVIEW";

export interface A11yImageFinding {
  src: string | null;
  altAttributePresent: boolean;
  altValue: string | null;
  role: string | null;
  ariaHidden: boolean;
}

export interface A11yLinkFinding {
  href: string | null;
  text: string;
  ariaLabel: string | null;
  ariaLabelledBy: string | null;
  title: string | null;
  hasImageWithAlt: boolean;
  accessibleName: string;
  rawTagPreview: string;
}

export interface A11yButtonFinding {
  tagName: string;
  type: string | null;
  text: string;
  ariaLabel: string | null;
  ariaLabelledBy: string | null;
  title: string | null;
  accessibleName: string;
  rawTagPreview: string;
}

export interface A11yFormControlFinding {
  tagName: string;
  type: string | null;
  id: string | null;
  name: string | null;
  hasLabelFor: boolean;
  ariaLabel: string | null;
  ariaLabelledBy: string | null;
  title: string | null;
  placeholder: string | null;
  accessibleName: string;
  rawTagPreview: string;
}

export interface A11yPageSnapshot {
  page: PageScanResult;
  lang: string | null;
  images: A11yImageFinding[];
  links: A11yLinkFinding[];
  buttons: A11yButtonFinding[];
  formControls: A11yFormControlFinding[];
  headingLevels: number[];
}

export interface AccessibilityRulesData {
  pages: A11yPageSnapshot[];
}

export function classificationToConfidence(
  classification: A11yClassification
): "HIGH" | "MEDIUM" | "LOW" {
  switch (classification) {
    case "CONFIRMED":
      return "HIGH";
    case "POTENTIAL":
      return "MEDIUM";
    case "MANUAL_REVIEW":
    default:
      return "LOW";
  }
}
