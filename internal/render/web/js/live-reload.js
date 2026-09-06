// Server-Sent Events client: the server pushes a message on /events
// whenever server.SourceWatcher reports the source Markdown file changed
// (see internal/server/watch.go). The payload doesn't matter — any
// message means "something changed," so just reload.
export function init() {
  if (typeof EventSource === "undefined") return;
  const source = new EventSource("/events");
  source.onmessage = function () {
    location.reload();
  };
}
