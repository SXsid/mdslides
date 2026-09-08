// Port of internal/markdown/parse.go.
//
// The Go version walks a goldmark AST; markdown-it produces a flat token
// stream instead, so the traversal differs — but the rules it implements are
// the same ones, and parse_test.go's cases are the contract both satisfy:
// every H1 starts a Slide, a thematic break starts a Page, an image-only
// paragraph is pulled out of the text flow, everything else renders through
// the Markdown renderer untouched.

import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import type Token from "markdown-it/lib/token.mjs";
import type { Deck, Image, Page, Slide } from "./model";

/** Rewrites an image src (e.g. a relative path into a webview-safe URI). */
export type SrcResolver = (src: string) => string;

export interface ParseOptions {
  /**
   * Applied to every image src, both standalone images and images left inline
   * in the text. Defaults to identity, which is what plain rendering wants.
   */
  resolveSrc?: SrcResolver;
}

/**
 * Bare markdown-it implements CommonMark, which has no tables, strikethrough,
 * bare-URL autolinking or task lists — those are GitHub Flavored Markdown.
 * This is the equivalent of goldmark's extension.GFM in parse.go; without it a
 * table renders as a literal paragraph of pipe characters.
 *
 * html: true matches goldmark's default of passing raw HTML blocks through.
 * The source is a file the user opened in their own editor, so this extends no
 * more trust than the editor already does.
 */
function newRenderer(): MarkdownIt {
  const instance = MarkdownIt({ html: true, linkify: true, typographer: false }).use(taskLists, {
    // goldmark emits a bare <input> inside the <li>; the plugin's <label>
    // wrapper would be the one structural difference between the two
    // renderers' output, and it buys nothing when the boxes are disabled.
    label: false,
  });

  // markdown-it renders ~~struck~~ as <s>, goldmark as <del>. Same meaning to a
  // browser, but the two implementations are meant to produce the same markup,
  // and <del> is the tag GFM specifies.
  instance.renderer.rules.s_open = () => "<del>";
  instance.renderer.rules.s_close = () => "</del>";

  return instance;
}

const md = newRenderer();

/**
 * Parse turns Markdown source into a Deck. Content before the first H1 has no
 * slide to belong to and is skipped rather than inventing an untitled slide
 * for it — the same call the Go version makes.
 */
export function parse(source: string, options: ParseOptions = {}): Deck {
  const resolveSrc = options.resolveSrc ?? ((s: string) => s);
  const env: Record<string, unknown> = {};
  const tokens = md.parse(source, env);
  const renderer = rendererWith(resolveSrc);

  const deck: Deck = { title: "", slides: [] };

  let current: Slide | null = null;
  let pages: Page[] = [];
  let body = "";
  let pageImages: Image[] = [];
  let pageImagesFirst = false;
  let pageContentStarted = false; // true once a non-image block has rendered into body
  let pageLine = 0;

  // Deliberately a no-op when there is neither text nor images yet, so a
  // thematic break with nothing before it (right after a heading, or right
  // after another break) does not manufacture a blank page.
  const flushPage = () => {
    if (body.length === 0 && pageImages.length === 0) {
      return;
    }
    pages.push({
      contentHtml: body,
      images: pageImages,
      imagesFirst: pageImagesFirst,
      line: pageLine,
    });
    body = "";
    pageImages = [];
    pageImagesFirst = false;
    pageContentStarted = false;
  };

  // Unlike flushPage, this guarantees at least one Page even for an empty
  // slide — a heading the author just started should still appear in the deck,
  // not silently vanish because there is nothing under it yet.
  const flushSlide = () => {
    if (!current) {
      return;
    }
    flushPage();
    if (pages.length === 0) {
      pages = [{ contentHtml: "", images: [], imagesFirst: false, line: current.line }];
    }
    current.pages = pages;
    deck.slides.push(current);
    pages = [];
  };

  for (const block of topLevelBlocks(tokens)) {
    const open = tokens[block.start];
    const line = open.map ? open.map[0] : 0;

    if (open.type === "heading_open" && open.tag === "h1") {
      flushSlide();
      const inline = tokens[block.start + 1];
      const children = inline?.children ?? [];
      const heading = plainText(children);
      if (deck.title === "") {
        deck.title = heading;
      }
      current = {
        heading,
        headingHtml: renderer.renderInline(children, md.options, env),
        pages: [],
        line,
      };
      pageLine = line;
      continue;
    }

    if (open.type === "hr") {
      flushPage();
      pageLine = line;
      continue;
    }

    if (!current) {
      continue;
    }

    if (isImageOnlyParagraph(tokens, block)) {
      const images = extractImages(tokens[block.start + 1].children ?? [], resolveSrc);
      if (pageImages.length === 0) {
        // Only the very first image of the page decides imagesFirst — later
        // image-only paragraphs just add more images, they do not revisit the
        // ordering decision that was already made.
        pageImagesFirst = !pageContentStarted;
        if (!pageContentStarted) {
          pageLine = line;
        }
      }
      pageImages.push(...images);
      continue;
    }

    if (!pageContentStarted && pageImages.length === 0) {
      pageLine = line;
    }
    pageContentStarted = true;
    body += renderer.render(tokens.slice(block.start, block.end), md.options, env);
  }
  flushSlide();

  return deck;
}

interface Block {
  start: number;
  /** exclusive */
  end: number;
}

/**
 * Groups a flat token stream into top-level blocks, the equivalent of ranging
 * over an AST document's direct children. markdown-it nests by emitting
 * open/close pairs, so a block at the document root is one that opens and runs
 * to the close that brings the depth back to zero.
 */
function topLevelBlocks(tokens: Token[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i].nesting === 1) {
      let depth = 0;
      let j = i;
      for (; j < tokens.length; j++) {
        depth += tokens[j].nesting;
        if (depth === 0) {
          break;
        }
      }
      // An unbalanced stream would run j off the end; clamping keeps the slice
      // valid rather than producing an out-of-range block.
      const end = Math.min(j + 1, tokens.length);
      blocks.push({ start: i, end });
      i = end;
      continue;
    }
    blocks.push({ start: i, end: i + 1 });
    i++;
  }
  return blocks;
}

/**
 * Reports whether a block is a paragraph of nothing but image(s) — no
 * surrounding sentence — so it should be pulled out for the layout engine
 * instead of staying inline in the text.
 *
 * Images typed on consecutive lines with no blank line between them are a very
 * natural way to write "here are 3 photos", and they land in one paragraph
 * separated by softbreak tokens, so a softbreak is still "image only".
 * Anything else — a link wrapping the image, emphasis, real words — is treated
 * as real content rather than guessed to be decorative.
 */
function isImageOnlyParagraph(tokens: Token[], block: Block): boolean {
  if (tokens[block.start].type !== "paragraph_open") {
    return false;
  }
  const inline = tokens[block.start + 1];
  if (!inline || inline.type !== "inline") {
    return false;
  }
  let sawImage = false;
  for (const child of inline.children ?? []) {
    switch (child.type) {
      case "image":
        sawImage = true;
        break;
      case "softbreak":
      case "hardbreak":
        break;
      case "text":
        if (child.content.trim().length > 0) {
          return false;
        }
        break;
      default:
        return false;
    }
  }
  return sawImage;
}

function extractImages(children: Token[], resolveSrc: SrcResolver): Image[] {
  const images: Image[] = [];
  for (const child of children) {
    if (child.type !== "image") {
      continue;
    }
    images.push({
      src: resolveSrc(child.attrGet("src") ?? ""),
      // markdown-it puts the alt text in content, already flattened to plain
      // text — exactly what the Go version builds by walking the alt node.
      alt: child.content,
    });
  }
  return images;
}

/** Collects inline text content, discarding emphasis and other markup. */
function plainText(children: Token[]): string {
  let out = "";
  for (const child of children) {
    if (child.type === "text" || child.type === "code_inline") {
      out += child.content;
    } else if (child.children) {
      out += plainText(child.children);
    }
  }
  return out;
}

/**
 * Builds a renderer whose image rule rewrites src through resolveSrc. This has
 * to happen at render time rather than as a post-pass over the HTML string: a
 * regex over rendered markup cannot tell an <img> the author wrote in a raw
 * HTML block from one inside a code sample, and would happily rewrite both.
 */
function rendererWith(resolveSrc: SrcResolver): MarkdownIt["renderer"] {
  const instance = newRenderer();
  const base =
    instance.renderer.rules.image ??
    ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));

  instance.renderer.rules.image = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet("src");
    if (src !== null) {
      token.attrSet("src", resolveSrc(src));
    }
    return base(tokens, idx, opts, env, self);
  };

  return instance.renderer;
}
