// Package layout decides how many images fit which CSS grid shape. It has
// no idea a Markdown file, HTML, or an HTTP request exists — Classify is a
// pure function of an integer, nothing else. That's deliberate: it makes
// every case exhaustively testable, and it's the reason no other package
// needs to depend on this one just to ask "how do I lay out N images" —
// only the renderer does.
package layout
