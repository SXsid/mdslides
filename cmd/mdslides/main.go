// Command mdslides serves a Markdown file as a PPT-style browser deck.
// This file is deliberately thin: it only parses flags and wires
// internal/server together. If real logic starts accumulating here,
// that's the signal it belongs in a package instead.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"time"

	"mdslides/internal/server"
)

func main() {
	var port int
	var noOpen bool
	flag.IntVar(&port, "port", 8080, "port to serve on")
	flag.BoolVar(&noOpen, "no-open", false, "don't open the browser automatically")
	flag.Usage = func() {
		fmt.Fprintln(os.Stderr, `mdslides — turn a Markdown file into a live browser deck.

Usage:
  mdslides <file.md> [flags]

Example:
  mdslides notes.md -port 9000

Flags:`)
		flag.PrintDefaults()
	}
	flag.Parse()

	if flag.NArg() != 1 {
		flag.Usage()
		os.Exit(2)
	}
	path := flag.Arg(0)

	if _, err := os.Stat(path); err != nil {
		fail("%v", err)
	}

	watcher, err := server.NewFSWatcher(path)
	if err != nil {
		fail("watch %s: %v", path, err)
	}
	defer watcher.Close()

	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: server.New(path, watcher).Handler(),
	}

	// signal.NotifyContext, not a raw signal.Notify channel: Ctrl+C
	// cancels ctx, which the goroutine below turns into a graceful
	// Shutdown instead of the process just dying mid-response.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			log.Printf("mdslides: shutdown: %v", err)
		}
	}()

	url := fmt.Sprintf("http://localhost:%d/", port)
	log.Printf("serving %s at %s (Ctrl+C to stop)", path, url)
	if !noOpen {
		if err := openBrowser(url); err != nil {
			log.Printf("mdslides: could not open browser automatically: %v", err)
		}
	}

	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		fail("%v", err)
	}
}

// fail prints an error the same way every setup failure in this command
// does, always pointing at -h — someone hitting "address already in use"
// or a typo'd path should immediately see how to check their flags, not
// just get a bare Go error and have to already know -h exists.
func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "mdslides: "+format+"\n", args...)
	fmt.Fprintln(os.Stderr, "Run 'mdslides -h' for usage.")
	os.Exit(1)
}

// openBrowser shells out to the OS's "open a URL" command. There's no
// portable stdlib way to do this — every OS has its own launcher command
// — so runtime.GOOS picks the right one.
func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}
