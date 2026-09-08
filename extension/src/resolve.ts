import * as path from "node:path";
import * as vscode from "vscode";
import type { SrcResolver } from "./deck/parse";

/**
 * Builds the image-src rewriter for a webview.
 *
 * The CLI serves the deck over HTTP from the Markdown file's own directory, so
 * a relative `![](diagram.png)` just works. A webview has no such document
 * base: it is served from an opaque origin and may only load local files
 * through `asWebviewUri`, and only from the panel's localResourceRoots. So
 * every relative path has to be resolved against the source file and rewritten
 * before it reaches the markup.
 */
export function makeSrcResolver(webview: vscode.Webview, source: vscode.Uri): SrcResolver {
  const baseDir = source.scheme === "file" ? path.dirname(source.fsPath) : undefined;
  const workspace = vscode.workspace.getWorkspaceFolder(source);

  return (src: string): string => {
    if (!src) {
      return src;
    }

    // Protocol-relative (//example.com/x.png) — the webview has no meaningful
    // scheme of its own to inherit, so pin it to https.
    if (src.startsWith("//")) {
      return `https:${src}`;
    }

    // A file: URL is a local path written the long way; everything else with a
    // scheme (http, https, data, blob) is already loadable as-is.
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(src);
    if (scheme) {
      if (scheme[1].toLowerCase() === "file") {
        return webview.asWebviewUri(vscode.Uri.parse(src)).toString();
      }
      return src;
    }

    if (!baseDir) {
      // An untitled or virtual document has no directory to resolve against.
      // Leaving the path alone means the image will not load, which is honest;
      // guessing a workspace root would silently show the wrong file.
      return src;
    }

    // A query or fragment is part of the URL, not the filename — strip it for
    // the filesystem lookup and put it back on the rewritten URI.
    const match = /^([^?#]*)([?#].*)?$/.exec(src);
    const rawPath = match ? match[1] : src;
    const suffix = match && match[2] ? match[2] : "";

    let decoded: string;
    try {
      decoded = decodeURIComponent(rawPath);
    } catch {
      // A stray % that is not a valid escape — take the path literally rather
      // than dropping the image.
      decoded = rawPath;
    }

    // A leading slash reads as "root of the project" to most authors, not
    // "root of the filesystem", which is what path.resolve would do with it.
    const root = decoded.startsWith("/") && workspace ? workspace.uri.fsPath : baseDir;
    const absolute = path.resolve(root, decoded.replace(/^\//, ""));

    return webview.asWebviewUri(vscode.Uri.file(absolute)).toString() + suffix;
  };
}
