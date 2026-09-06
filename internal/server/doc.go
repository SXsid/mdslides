// Package server is the only place in this program that knows HTTP,
// Server-Sent Events, and filesystem watching exist. It composes
// markdown.ParseFile and render.HTML to answer requests, and its own
// SourceWatcher to know when to tell the browser to reload. Nothing else
// in this module imports net/http.
package server
