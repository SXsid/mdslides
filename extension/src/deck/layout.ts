// Port of internal/layout/layout.go. Same shapes, same names, same clamping
// behaviour — layouts.css keys off these strings, and that stylesheet is
// shared verbatim with the CLI, so the names are not free to drift.

export type LayoutKind = "text" | "split" | "stack" | "bento-3" | "bento-4";

/**
 * The most images a single screen ever gets a shape for. A page with more than
 * this is not this module's problem: splitting it into continuation screens
 * happens in render.ts, the only place that knows about both a Page and this
 * limit. Keeping the split out of here keeps classify a pure function of a
 * count.
 */
export const MAX_PER_PAGE = 4;

/**
 * Maps an image count to a grid shape:
 *   0 — text only, content fills the screen
 *   1 — split: two columns, text and image side by side
 *   2 — stack: two images in one column, text filling the other
 *   3 — bento-3: one large image plus two small, text as a card
 *   4+ — bento-4: a 2x2 image grid with text as a header strip
 *
 * Counts above MAX_PER_PAGE clamp to bento-4; the renderer is expected to
 * chunk overflow into continuation screens before it ever gets here.
 *
 * classify only decides the shape, never the order — Page.imagesFirst decides
 * which column is which.
 */
export function classify(n: number): LayoutKind {
  if (n <= 0) {
    return "text";
  }
  if (n === 1) {
    return "split";
  }
  if (n === 2) {
    return "stack";
  }
  if (n === 3) {
    return "bento-3";
  }
  return "bento-4";
}
