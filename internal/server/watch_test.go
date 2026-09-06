package server

import (
	"bufio"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// fakeWatcher lets a test decide exactly when a "file changed" signal
// fires, without touching a real filesystem or waiting on real fsnotify
// timing. This is the entire reason SourceWatcher is an interface: with a
// concrete fsnotify type here, testing handleEvents would mean writing to
// a real temp file and hoping the OS delivers the event before a timeout.
type fakeWatcher struct {
	ch chan struct{}
}

func newFakeWatcher() *fakeWatcher              { return &fakeWatcher{ch: make(chan struct{}, 1)} }
func (f *fakeWatcher) Changes() <-chan struct{} { return f.ch }
func (f *fakeWatcher) Close() error             { return nil }
func (f *fakeWatcher) trigger()                 { f.ch <- struct{}{} }

func TestHandleEvents_PushesOnChange(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sample.md")
	if err := os.WriteFile(path, []byte("# Title\nBody.\n"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	fw := newFakeWatcher()
	srv := New(path, fw)
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/events")
	if err != nil {
		t.Fatalf("GET /events: %v", err)
	}
	defer resp.Body.Close()

	fw.trigger()

	line := make(chan string, 1)
	go func() {
		text, _ := bufio.NewReader(resp.Body).ReadString('\n')
		line <- text
	}()

	select {
	case got := <-line:
		if !strings.Contains(got, "data: reload") {
			t.Errorf("got line %q, want it to contain %q", got, "data: reload")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for an SSE event after triggering the fake watcher")
	}
}
