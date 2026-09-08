// Copies the viewer's stylesheets out of the Go module into the extension's
// media/ directory. The CLI and the extension render the same markup, so they
// must share the same CSS — copying at build time (rather than keeping a second
// hand-maintained copy) means a change to the deck's look in internal/render/web
// lands in the extension on the next build, with no chance of the two drifting.
//
// Only CSS is synced. The viewer's JS is deliberately NOT copied: the CLI's
// modules talk to a local HTTP server (ES module imports, /events SSE), none of
// which exists in a webview. See media/webview.js for the adapted version.
import { mkdirSync, readdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..", "internal", "render", "web", "css");
const dest = join(here, "..", "media", "css");

if (!existsSync(src)) {
  console.error(
    `sync-assets: cannot find ${src}\n` +
      `The extension must live inside the mdslides repo — it reads the viewer CSS from the Go module.`
  );
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith(".css"));
for (const file of files) {
  copyFileSync(join(src, file), join(dest, file));
}
console.log(`sync-assets: copied ${files.length} stylesheet(s) -> media/css/`);
