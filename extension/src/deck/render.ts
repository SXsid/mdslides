// Port of internal/render/render.go plus the <section> half of
// web/page.html.tmpl. The markup is byte-for-byte the shape the shared CSS
// expects: .screen.layout-<kind>[.images-first] > .screen-heading +
// .screen-body > .screen-content + .screen-images.

import { classify, MAX_PER_PAGE, type LayoutKind } from "./layout";
import type { Deck, Image, Page } from "./model";

/** One screen the viewer shows: the unit nav.js pages through. */
export interface Screen {
  /** Heading HTML, inline formatting preserved. */
  heading: string;
  contentHtml: string;
  images: Image[];
  layout: LayoutKind;
  imagesFirst: boolean;
  /** 0-based source line, for mapping the editor cursor onto a screen. */
  line: number;
}

export interface RenderedDeck {
  title: string;
  screens: Screen[];
  html: string;
}

/**
 * Flattens a Deck into screens and renders them. Every Slide's Pages become
 * one or more screens; a Page with more images than MAX_PER_PAGE is split into
 * extra images-only continuation screens rather than overflowing one grid.
 */
export function renderDeck(deck: Deck): RenderedDeck {
  const screens: Screen[] = [];
  for (const slide of deck.slides) {
    for (const page of slide.pages) {
      screens.push(...screensForPage(slide.headingHtml, page));
    }
  }
  return {
    title: deck.title,
    screens,
    html: screens.map(renderScreen).join("\n"),
  };
}

/**
 * Turns one Page into one or more screens. A page within MAX_PER_PAGE images
 * is exactly one screen; beyond that the extra images become their own
 * images-only continuation screens, heading repeated with " (cont.)" and no
 * text — repeating the same paragraph on every continuation screen was more
 * confusing than just showing more images under the same heading.
 */
function screensForPage(heading: string, page: Page): Screen[] {
  let chunks = chunkImages(page.images, MAX_PER_PAGE);
  if (chunks.length === 0) {
    chunks = [[]];
  }

  return chunks.map((images, i) => ({
    heading: i === 0 ? heading : `${heading} (cont.)`,
    contentHtml: i === 0 ? page.contentHtml : "",
    images,
    layout: classify(images.length),
    imagesFirst: page.imagesFirst,
    line: page.line,
  }));
}

/** Splits images into groups of at most size, preserving order. */
function chunkImages(images: Image[], size: number): Image[][] {
  if (images.length === 0 || size <= 0) {
    return [];
  }
  const chunks: Image[][] = [];
  for (let i = 0; i < images.length; i += size) {
    chunks.push(images.slice(i, i + size));
  }
  return chunks;
}

function renderScreen(screen: Screen, index: number): string {
  const classes = `screen layout-${screen.layout}${screen.imagesFirst ? " images-first" : ""}`;
  const parts: string[] = [];
  parts.push(`<section class="${classes}" data-index="${index}" data-line="${screen.line}">`);
  if (screen.heading) {
    parts.push(`<h1 class="screen-heading">${screen.heading}</h1>`);
  }
  parts.push('<div class="screen-body">');
  if (screen.contentHtml) {
    parts.push(`<div class="screen-content">${screen.contentHtml}</div>`);
  }
  if (screen.images.length > 0) {
    const imgs = screen.images
      .map((img) => `<img src="${attr(safeUrl(img.src))}" alt="${attr(img.alt)}">`)
      .join("");
    parts.push(`<div class="screen-images">${imgs}</div>`);
  }
  parts.push("</div>");
  parts.push("</section>");
  return parts.join("\n");
}

function attr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Blanks out URL schemes that execute code. Go's html/template does this for
 * free when it sees a value land in an href/src attribute; building the markup
 * by hand here means doing it explicitly, and a deck is rendered from whatever
 * Markdown happens to be open in the editor.
 */
function safeUrl(src: string): string {
  if (/^\s*(javascript|vbscript):/i.test(src)) {
    return "";
  }
  return src;
}
