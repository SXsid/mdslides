package server

import (
	"fmt"
	"path/filepath"

	"github.com/fsnotify/fsnotify"
)

// SourceWatcher reports when the underlying Markdown file has changed.
// Server depends on this interface, not on fsnotify directly, so the
// SSE/reload wiring in handleEvents can be tested without touching a real
// filesystem — see the fakeWatcher in watch_test.go. This is the only
// interface in this codebase: everywhere else there's exactly one
// implementation of a thing, which is a reason to keep it a concrete
// type, not a reason to add an interface "for flexibility."
type SourceWatcher interface {
	// Changes delivers a value each time the watched file changes.
	// handleEvents treats a closed channel as "stop serving events."
	Changes() <-chan struct{}
	Close() error
}

// NewFSWatcher watches path for changes using the OS's real filesystem
// notification API. It returns the SourceWatcher interface rather than
// its own concrete type on purpose — callers should only ever depend on
// "can report changes," never on anything fsnotify-specific.
func NewFSWatcher(path string) (SourceWatcher, error) {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("create watcher: %w", err)
	}

	// Watch the containing directory, not the file itself. Many editors
	// (vim among them) save by writing a new temp file and renaming it
	// over the original — that replaces the inode the watch descriptor
	// points at, so a watch on the file path directly goes silently dead
	// after the very first save. Watching the directory survives that,
	// at the cost of filtering every event in it down to this one path.
	dir := filepath.Dir(path)
	if err := w.Add(dir); err != nil {
		w.Close()
		return nil, fmt.Errorf("watch %s: %w", dir, err)
	}

	fw := &fsWatcher{w: w, ch: make(chan struct{}, 1)}
	go fw.run(filepath.Clean(path))
	return fw, nil
}

type fsWatcher struct {
	w  *fsnotify.Watcher
	ch chan struct{}
}

func (f *fsWatcher) run(target string) {
	for {
		select {
		case event, ok := <-f.w.Events:
			if !ok {
				return
			}
			if filepath.Clean(event.Name) != target {
				continue // some other file in the same directory changed
			}
			if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Rename) == 0 {
				continue
			}
			select {
			case f.ch <- struct{}{}:
			default: // a reload is already pending; no need to queue more
			}
		case _, ok := <-f.w.Errors:
			if !ok {
				return
			}
		}
	}
}

func (f *fsWatcher) Changes() <-chan struct{} { return f.ch }
func (f *fsWatcher) Close() error             { return f.w.Close() }
