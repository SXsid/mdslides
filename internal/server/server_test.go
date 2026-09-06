package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestHandleIndex_RendersFile is the one test that exercises the whole
// pipeline together (parse -> layout -> render -> HTTP response) rather
// than one package in isolation — a sanity check that the wiring itself
// is correct, on top of each package's own unit tests.
func TestHandleIndex_RendersFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sample.md")
	if err := os.WriteFile(path, []byte("# Hello\nWorld.\n"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	srv := New(path, newFakeWatcher())
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/")
	if err != nil {
		t.Fatalf("GET /: %v", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if !strings.Contains(string(body), "World.") {
		t.Errorf("response missing slide content, got: %s", body)
	}
	if !strings.Contains(string(body), "/static/viewer.css") {
		t.Errorf("response missing static asset link, got: %s", body)
	}
}

func TestStaticAssetsServed(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sample.md")
	if err := os.WriteFile(path, []byte("# Hello\n"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	srv := New(path, newFakeWatcher())
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/static/viewer.js")
	if err != nil {
		t.Fatalf("GET /static/viewer.js: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
}
