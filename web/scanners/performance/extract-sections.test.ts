import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveSectionType,
  extractShopifySectionsFromHtml,
  scoreSectionWeight,
} from "./extract-sections.ts";

describe("section extraction", () => {
  it("derives section type from id suffix", () => {
    assert.equal(
      deriveSectionType("shopify-section-template--1__image_banner", null, null),
      "image-banner"
    );
  });

  it("extracts shopify-section blocks with weight factors", () => {
    const html = `
      <div id="shopify-section-template--1__slideshow" class="shopify-section" data-section-type="slideshow">
        <img src="/a.jpg" />
        <img src="/b.jpg" />
        <img src="/c.jpg" />
        <img src="/d.jpg" />
        <img src="/e.jpg" />
        <img src="/f.jpg" />
        <iframe src="https://www.youtube.com/embed/x"></iframe>
        <script>console.log(1)</script>
      </div>
      <div id="shopify-section-template--1__rich-text" class="shopify-section" data-section-type="rich-text">
        <p>Hello</p>
      </div>
    `;

    const sections = extractShopifySectionsFromHtml(html, "HOME", "https://x.com/");
    assert.equal(sections.length, 2);
    assert.equal(sections[0].sectionType, "slideshow");
    assert.ok(sections[0].imageCount >= 6);
    assert.ok(sections[0].iframeCount === 1);
    assert.ok(sections[0].scripts.length >= 1);
    assert.ok(sections[0].offendingParts.length > 0);
    assert.ok(sections[0].weightScore >= 10);
    assert.ok(sections[0].weightScore > sections[1].weightScore);
  });
});

describe("section weight scoring", () => {
  it("scores embeds and images higher than empty markup", () => {
    const light = scoreSectionWeight({
      htmlByteSize: 500,
      approxNodeCount: 10,
      images: [],
      scriptCount: 0,
      inlineScriptCount: 0,
      externalScriptCount: 0,
      iframeCount: 0,
      videoCount: 0,
    });
    const heavy = scoreSectionWeight({
      htmlByteSize: 5000,
      approxNodeCount: 40,
      images: [
        { src: "a", hasLazy: false, hasDimensions: false },
        { src: "b", hasLazy: false, hasDimensions: false },
      ],
      scriptCount: 1,
      inlineScriptCount: 0,
      externalScriptCount: 1,
      iframeCount: 1,
      videoCount: 0,
    });
    assert.equal(light.weightScore, 0);
    assert.ok(heavy.weightScore >= 10);
  });
});
