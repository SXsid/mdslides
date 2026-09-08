import * as path from "node:path";
import * as vscode from "vscode";
import { exportDeck } from "./export";
import { DeckPreview } from "./preview";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("mdslides.openPreviewToSide", (uri?: vscode.Uri) =>
      openPreview(context, uri, vscode.ViewColumn.Beside)
    ),
    vscode.commands.registerCommand("mdslides.openPreview", (uri?: vscode.Uri) =>
      openPreview(context, uri, vscode.ViewColumn.Active)
    ),
    vscode.commands.registerCommand("mdslides.exportHtml", (uri?: vscode.Uri) =>
      runExport(context, uri)
    )
  );

  // Lets VS Code bring previews back after a window reload instead of
  // restoring them as blank panels.
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(DeckPreview.viewType, {
      async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: unknown) {
        const source = (state as { uri?: string } | undefined)?.uri;
        if (!source) {
          panel.dispose();
          return;
        }
        DeckPreview.restore(context, panel, vscode.Uri.parse(source));
      },
    })
  );
}

export function deactivate(): void {
  // Every disposable is registered on the extension context, which VS Code
  // tears down for us.
}

/**
 * Resolves which document a command should act on. An invocation from the
 * explorer context menu passes a URI; from the palette or the editor title bar
 * it does not, and the active editor is what the user means.
 */
function targetUri(uri: vscode.Uri | undefined): vscode.Uri | undefined {
  if (uri) {
    return uri;
  }
  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.languageId === "markdown") {
    return editor.document.uri;
  }
  return undefined;
}

async function openPreview(
  context: vscode.ExtensionContext,
  uri: vscode.Uri | undefined,
  column: vscode.ViewColumn
): Promise<void> {
  const target = targetUri(uri);
  if (!target) {
    vscode.window.showInformationMessage("Open a Markdown file to preview it as a deck.");
    return;
  }
  await DeckPreview.show(context, target, column);
}

async function runExport(
  context: vscode.ExtensionContext,
  uri: vscode.Uri | undefined
): Promise<void> {
  const source = targetUri(uri);
  if (!source) {
    vscode.window.showInformationMessage("Open a Markdown file to export it as a deck.");
    return;
  }

  const suggestion = source.with({
    path: source.path.replace(/\.[^./]*$/, "") + ".html",
  });
  const target = await vscode.window.showSaveDialog({
    defaultUri: suggestion,
    filters: { HTML: ["html"] },
    saveLabel: "Export Deck",
  });
  if (!target) {
    return;
  }

  try {
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Exporting deck..." },
      () => exportDeck(context, source, target)
    );

    const name = path.basename(target.fsPath);
    const slides = `${result.slides} slide${result.slides === 1 ? "" : "s"}`;
    const message =
      result.external.length > 0
        ? `Exported ${slides} to ${name}. ${result.external.length} image(s) were too large to embed and are still referenced by relative path: ${result.external.join(", ")}`
        : `Exported ${slides} to ${name}.`;

    const open = "Open File";
    const choice = await vscode.window.showInformationMessage(message, open);
    if (choice === open) {
      await vscode.env.openExternal(target);
    }
  } catch (err) {
    vscode.window.showErrorMessage(
      `mdslides: export failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
