import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateIssuePenalty,
  calculateOverallScore,
  calculateScanScores,
  calculateCategoryScore,
  resolveScoreCategory,
  SEVERITY_WEIGHTS,
  OVERALL_WEIGHTS,
} from "./engine.ts";

describe("scoring engine determinism", () => {
  it("returns identical scores for the same shuffled inputs", () => {
    const issues = [
      {
        id: "b",
        category: "seo",
        rule_id: "seo.missing-page-title",
        severity: "high",
        impact_score: 80,
        confidence_score: 90,
        affected_resource: "https://a/1",
      },
      {
        id: "a",
        category: "product",
        rule_id: "product.no-images",
        severity: "high",
        impact_score: 80,
        confidence_score: 90,
        affected_resource: "gid://shopify/Product/1",
      },
      {
        id: "c",
        category: "accessibility",
        rule_id: "a11y.empty-links",
        severity: "medium",
        impact_score: 55,
        confidence_score: 90,
        affected_resource: "https://a/2",
      },
    ];

    const forward = calculateScanScores(issues);
    const reverse = calculateScanScores([...issues].reverse());
    assert.deepEqual(forward, reverse);
  });

  it("clamps category and overall scores to 0–100", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: `x${i}`,
      category: "seo",
      rule_id: "seo.missing-page-title",
      severity: "critical",
      impact_score: 100,
      confidence_score: 100,
      affected_resource: `res-${i}`,
    }));
    const scores = calculateScanScores(many);
    assert.equal(scores.seoScore, 0);
    assert.ok(scores.overallScore >= 0 && scores.overallScore <= 100);
  });
});

describe("issue penalty formula", () => {
  it("uses severity × impact × confidence", () => {
    const penalty = calculateIssuePenalty({
      category: "seo",
      rule_id: "seo.x",
      severity: "high",
      impact_score: 50,
      confidence_score: 100,
    });
    assert.equal(penalty, SEVERITY_WEIGHTS.high * 0.5 * 1);
  });

  it("applies defaults when impact/confidence are zero", () => {
    const penalty = calculateIssuePenalty({
      category: "seo",
      rule_id: "seo.x",
      severity: "medium",
      impact_score: 0,
      confidence_score: 0,
    });
    assert.equal(penalty, SEVERITY_WEIGHTS.medium * 0.55 * 0.7);
  });
});

describe("category mapping", () => {
  it("maps rule prefixes and categories", () => {
    assert.equal(
      resolveScoreCategory({ category: "performance", rule_id: "theme.large-javascript" }),
      "theme"
    );
    assert.equal(
      resolveScoreCategory({ category: "seo", rule_id: "seo.missing-h1" }),
      "seo"
    );
    assert.equal(
      resolveScoreCategory({ category: "image", rule_id: "product.images-missing-alt" }),
      "product"
    );
    assert.equal(
      resolveScoreCategory({ category: "accessibility", rule_id: "a11y.missing-html-lang" }),
      "accessibility"
    );
  });

  it("scores product catalog SEO issues under SEO to match the issues UI", () => {
    assert.equal(
      resolveScoreCategory({
        category: "seo",
        rule_id: "product.missing-seo-title",
      }),
      "seo"
    );
    assert.equal(
      resolveScoreCategory({
        category: "accessibility",
        rule_id: "product.images-missing-alt",
      }),
      "accessibility"
    );
  });

  it("lowers SEO score when product catalog SEO issues are present", () => {
    const scores = calculateScanScores([
      {
        id: "p1",
        category: "seo",
        rule_id: "product.missing-seo-title",
        severity: "medium",
        impact_score: 55,
        confidence_score: 90,
        affected_resource: "gid://shopify/Product/1",
      },
    ]);
    assert.ok(scores.seoScore < 100);
    assert.equal(scores.productScore, 100);
  });

  it("maps performance.section rules to performance", () => {
    assert.equal(
      resolveScoreCategory({
        category: "performance",
        rule_id: "performance.section-load-risk",
      }),
      "performance"
    );
  });
});

describe("category + overall scores", () => {
  it("returns 100 for empty categories", () => {
    const breakdown = calculateCategoryScore("product", []);
    assert.equal(breakdown.score, 100);
    assert.equal(breakdown.issueCount, 0);
  });

  it("adds breadth penalty from unique resources", () => {
    const oneResource = calculateCategoryScore("seo", [
      {
        id: "1",
        category: "seo",
        rule_id: "seo.x",
        severity: "low",
        impact_score: 100,
        confidence_score: 100,
        affected_resource: "same",
      },
      {
        id: "2",
        category: "seo",
        rule_id: "seo.y",
        severity: "low",
        impact_score: 100,
        confidence_score: 100,
        affected_resource: "same",
      },
    ]);
    const twoResources = calculateCategoryScore("seo", [
      {
        id: "1",
        category: "seo",
        rule_id: "seo.x",
        severity: "low",
        impact_score: 100,
        confidence_score: 100,
        affected_resource: "a",
      },
      {
        id: "2",
        category: "seo",
        rule_id: "seo.y",
        severity: "low",
        impact_score: 100,
        confidence_score: 100,
        affected_resource: "b",
      },
    ]);
    assert.ok(twoResources.breadthPenalty > oneResource.breadthPenalty);
    assert.ok(twoResources.score <= oneResource.score);
  });

  it("computes overall as weighted average of category scores", () => {
    const overall = calculateOverallScore({
      performance: 100,
      seo: 80,
      accessibility: 60,
      theme: 40,
      product: 20,
    });
    const expected = Math.round(
      100 * OVERALL_WEIGHTS.performance +
        80 * OVERALL_WEIGHTS.seo +
        60 * OVERALL_WEIGHTS.accessibility +
        40 * OVERALL_WEIGHTS.theme +
        20 * OVERALL_WEIGHTS.product
    );
    assert.equal(overall, expected);
  });

  it("feeds theme performance rules into both theme and performance", () => {
    const scores = calculateScanScores([
      {
        id: "t1",
        category: "performance",
        rule_id: "theme.large-javascript",
        severity: "medium",
        impact_score: 55,
        confidence_score: 90,
        affected_resource: "assets/app.js",
      },
    ]);
    assert.ok(scores.themeScore < 100);
    assert.ok(scores.performanceScore < 100);
    assert.equal(scores.seoScore, 100);
  });
});
