// Package render is the only place in this program that knows HTML exists.
// It turns a markdown.Deck, plus a layout decision per page, into a single
// self-contained HTML document string. It has no idea how that document
// reaches a browser — that's the server package's job.
package render
