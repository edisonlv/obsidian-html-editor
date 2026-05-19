import type { EditorView } from "@codemirror/view";
import { cmInsertAtCursor, cmUndo, cmRedo, cmWrapSelection } from "./htmlEditorCm";
import { escapeHtmlAttr } from "./vaultResources";
import type { InsertLinkResult } from "./insertLinkModal";

export type HtmlEditTarget = "source" | "preview";

export interface HtmlEditContext {
  target: HtmlEditTarget;
  previewEditable: boolean;
  cmView: EditorView | null;
  postPreviewCmd: (command: string, value?: string) => void;
}

function usePreview(ctx: HtmlEditContext): boolean {
  return ctx.target === "preview" && ctx.previewEditable;
}

export function editUndo(ctx: HtmlEditContext): boolean {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("undo");
    return true;
  }
  if (ctx.cmView && cmUndo(ctx.cmView)) {
    return true;
  }
  return false;
}

export function editRedo(ctx: HtmlEditContext): boolean {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("redo");
    return true;
  }
  if (ctx.cmView && cmRedo(ctx.cmView)) {
    return true;
  }
  return false;
}

export function editBold(ctx: HtmlEditContext): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("bold");
    return;
  }
  if (ctx.cmView) cmWrapSelection(ctx.cmView, "<strong>", "</strong>");
}

export function editItalic(ctx: HtmlEditContext): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("italic");
    return;
  }
  if (ctx.cmView) cmWrapSelection(ctx.cmView, "<em>", "</em>");
}

export function editUnderline(ctx: HtmlEditContext): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("underline");
    return;
  }
  if (ctx.cmView) cmWrapSelection(ctx.cmView, '<span style="text-decoration:underline">', "</span>");
}

export function editStrike(ctx: HtmlEditContext): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("strikeThrough");
    return;
  }
  if (ctx.cmView) cmWrapSelection(ctx.cmView, "<s>", "</s>");
}

export function editClearFormat(ctx: HtmlEditContext): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("removeFormat");
    return;
  }
  if (ctx.cmView) {
    const { from, to } = ctx.cmView.state.selection.main;
    const text = ctx.cmView.state.sliceDoc(from, to);
    if (text) {
      ctx.cmView.dispatch({ changes: { from, to, insert: text.replace(/<[^>]+>/g, "") } });
    }
  }
}

export function editLink(ctx: HtmlEditContext, url: string): void {
  editInsertLinkAdvanced(ctx, { href: url, newTab: /^https?:/i.test(url) });
}

export function editInsertLinkAdvanced(ctx: HtmlEditContext, result: InsertLinkResult): void {
  const href = escapeHtmlAttr(result.href);
  const target = result.newTab ? ' target="_blank" rel="noopener noreferrer"' : "";

  if (usePreview(ctx)) {
    ctx.postPreviewCmd("createLink", result.href);
    return;
  }
  if (ctx.cmView) {
    const { from, to } = ctx.cmView.state.selection.main;
    const rawLabel = result.text ?? (ctx.cmView.state.sliceDoc(from, to) || result.href);
    const label = rawLabel.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html = `<a href="${href}"${target}>${label}</a>`;
    ctx.cmView.dispatch({ changes: { from, to, insert: html } });
  }
}

/** 插入任意 HTML 片段（图片/视频/音频等） */
export function editInsertHtmlSnippet(ctx: HtmlEditContext, html: string): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("insertHTML", html);
    return;
  }
  if (ctx.cmView) cmInsertAtCursor(ctx.cmView, html);
}

export function editInsertBr(ctx: HtmlEditContext): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("insertHTML", "<br>");
    return;
  }
  if (ctx.cmView) cmInsertAtCursor(ctx.cmView, "<br>");
}

export function editInsertP(ctx: HtmlEditContext): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("wrapTag", "<p>|</p>");
    return;
  }
  if (ctx.cmView) cmWrapSelection(ctx.cmView, "<p>", "</p>");
}

export function editInsertH1(ctx: HtmlEditContext): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("wrapTag", "<h1>|</h1>");
    return;
  }
  if (ctx.cmView) cmWrapSelection(ctx.cmView, "<h1>", "</h1>");
}

export function editInsertH2(ctx: HtmlEditContext): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("wrapTag", "<h2>|</h2>");
    return;
  }
  if (ctx.cmView) cmWrapSelection(ctx.cmView, "<h2>", "</h2>");
}

export function editInsertH3(ctx: HtmlEditContext): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("wrapTag", "<h3>|</h3>");
    return;
  }
  if (ctx.cmView) cmWrapSelection(ctx.cmView, "<h3>", "</h3>");
}

export function editInsertUl(ctx: HtmlEditContext): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("wrapTag", "<ul><li>|</li></ul>");
    return;
  }
  if (ctx.cmView) cmWrapSelection(ctx.cmView, "<ul><li>", "</li></ul>");
}

export function editInsertBlockquote(ctx: HtmlEditContext): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("wrapTag", "<blockquote><p>|</p></blockquote>");
    return;
  }
  if (ctx.cmView) cmWrapSelection(ctx.cmView, "<blockquote><p>", "</p></blockquote>");
}

export function editInsertCode(ctx: HtmlEditContext): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("wrapTag", "<code>|</code>");
    return;
  }
  if (ctx.cmView) cmWrapSelection(ctx.cmView, "<code>", "</code>");
}

export function editInsertImage(ctx: HtmlEditContext, url: string): void {
  const safe = escapeHtmlAttr(url);
  editInsertHtmlSnippet(ctx, `<img src="${safe}" alt="" />`);
}

export function editDeleteBlock(ctx: HtmlEditContext): void {
  if (usePreview(ctx)) {
    ctx.postPreviewCmd("deleteBlock");
    return;
  }
  if (ctx.cmView) {
    const { from, to } = ctx.cmView.state.selection.main;
    const line = ctx.cmView.state.doc.lineAt(from);
    const start = line.from;
    const end = Math.min(ctx.cmView.state.doc.length, line.to + 1);
    ctx.cmView.dispatch({ changes: { from: start, to: end, insert: "" } });
  }
}
