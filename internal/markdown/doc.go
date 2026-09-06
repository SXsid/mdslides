// Package markdown is the only place in this program that knows Markdown
// syntax exists. It reads a source file and hands back a Deck — plain Go
// structs — so every other package works with slides and pages, never with
// headings, thematic breaks, or AST nodes.
package markdown
