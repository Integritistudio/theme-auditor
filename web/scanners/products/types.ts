import type { InternalProduct } from "../../collectors/products/types.ts";

/**
 * Input for per-batch product rules.
 * Rules operate on normalized InternalProduct values only.
 */
export interface ProductBatchData {
  products: InternalProduct[];
}

/**
 * Input for catalog-level rules (e.g. duplicate titles).
 * Built incrementally while batches are collected.
 */
export interface ProductCatalogIndex {
  /** Lowercased trimmed title → product GIDs that share it. */
  titleIndex: Map<string, string[]>;
  /** Optional title display string for issue copy. */
  titleLabels: Map<string, string>;
}

export const SHORT_DESCRIPTION_THRESHOLD = 50;

export function normalizeProductTitleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}
