package server

import (
	"fmt"
	"net/http"

	"mdslides/internal/markdown"
	"mdslides/internal/render"
)

// Server serves a live-rendered view of one Markdown file.
type Server struct {
	path    string
	watcher SourceWatcher
}

// New creates a Server for path, using watcher to know when to push a
// reload to connected browsers. watcher is accepted as the SourceWatcher
// interface — not the concrete fsnotify type — specifically so tests can
// pass a fake and control exactly when a "file changed" event fires.
func New(path string, watcher SourceWatcher) *Server {
	return &Server{path: path, watcher: watcher}
}

// Handler returns the complete set of routes as one http.Handler, ready
// to hand to http.Server or httptest.NewServer.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleIndex)
	mux.HandleFunc("/events", s.handleEvents)
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.FS(render.StaticAssets))))
	return mux
}

// handleIndex re-parses and re-renders the source file on every request.
// That's wasteful for a heavily-trafficked site; it's the right call here
// because this tool only ever has one viewer on localhost, and it makes
// live-reload trivially correct — there's no cache to invalidate when the
// file changes, the next request just sees the new content.
func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	deck, err := markdown.ParseFile(s.path)
	if err != nil {
		http.Error(w, fmt.Sprintf("parse %s: %v", s.path, err), http.StatusInternalServerError)
		return
	}
	html, err := render.HTML(deck)
	if err != nil {
		http.Error(w, fmt.Sprintf("render: %v", err), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(html))
}

// handleEvents is a Server-Sent Events stream: one "data: reload" message
// each time s.watcher reports the source file changed. viewer.js just
// reloads the page on any message, so the payload doesn't need to carry
// anything beyond "something changed."
func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	flusher.Flush() // open the connection immediately, don't wait for the first event

	for {
		select {
		case <-r.Context().Done():
			return
		case _, ok := <-s.watcher.Changes():
			if !ok {
				return
			}
			fmt.Fprintf(w, "data: reload\n\n")
			flusher.Flush()
		}
	}
}
