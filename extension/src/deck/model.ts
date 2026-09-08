// A TypeScript mirror of internal/markdown/model.go. The field names and the
// reasoning behind them are kept identical on purpose: the two implementations
// render the same markup from the same source, so a change to one is meant to
// be obviously portable to the other.

/** Deck is the whole presentation: one H1 heading becomes one Slide. */
export interface Deck {
  title: string;
  slides: Slide[];
}

/**
 * Slide is the content under one H1 heading. It usually renders as a single
 * screen, but an author can split it with a thematic break (---), or the
 * renderer can split it when there are too many images to fit one screen.
 */
export interface Slide {
  /** Plain text, no markup — for the document title and aria labels. */
  heading: string;
  /** The same heading with inline formatting preserved, for display. */
  headingHtml: string;
  pages: Page[];
  /** 0-based source line of the H1, used to sync the editor cursor to a slide. */
  line: number;
}

/**
 * Page is exactly one screen the viewer will show. `contentHtml` holds every
 * "normal" Markdown block already rendered; `images` is only the *standalone*
 * images (a paragraph containing nothing but images), pulled out so the layout
 * engine can arrange them instead of leaving them stuck inline in the text.
 */
export interface Page {
  contentHtml: string;
  images: Image[];
  /**
   * True when the images appeared before contentHtml's blocks in the source, so
   * the renderer can preserve the author's intended reading order instead of
   * always forcing text-then-image.
   */
  imagesFirst: boolean;
  /** 0-based source line this page's first block starts on. */
  line: number;
}

/** Image is a single standalone image pulled out of the text flow. */
export interface Image {
  src: string;
  alt: string;
}
