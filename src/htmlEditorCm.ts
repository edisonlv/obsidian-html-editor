import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from "@codemirror/commands";
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { html } from "@codemirror/lang-html";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorSelection, EditorState, type Extension } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";

export interface HtmlCodeMirrorOptions {
  doc: string;
  fontSize: number;
  wordWrap: boolean;
  showLineNumbers: boolean;
  onDocChange: (text: string) => void;
  onSaveRequest: () => void;
}

/** 全部打入 bundle，避免 Obsidian 解析不到 @codemirror / @lezer */
export function createHtmlCodeMirror(parent: HTMLElement, opts: HtmlCodeMirrorOptions): EditorView {
  const theme = EditorView.theme({
    "&": { height: "100%" },
    ".cm-scroller": {
      fontFamily: "var(--font-monospace)",
      fontSize: `${opts.fontSize}px`,
    },
    ".cm-content": {
      caretColor: "var(--text-accent)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--background-secondary)",
      borderColor: "var(--background-modifier-border)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      color: "var(--text-faint)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--background-modifier-hover)",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--background-modifier-hover)",
    },
    ".cm-selectionBackground": {
      backgroundColor: "color-mix(in srgb, var(--interactive-accent) 22%, var(--background-primary)) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "color-mix(in srgb, var(--interactive-accent) 28%, var(--background-primary)) !important",
    },
  });

  const wrap: Extension[] = [];
  if (opts.wordWrap) {
    wrap.push(EditorView.lineWrapping);
  }

  const gutters: Extension[] = [highlightActiveLineGutter()];
  if (opts.showLineNumbers) {
    gutters.push(lineNumbers());
  }
  gutters.push(foldGutter());

  const state = EditorState.create({
    doc: opts.doc,
    extensions: [
      theme,
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      ...gutters,
      bracketMatching(),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      html(),
      history(),
      highlightSelectionMatches(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
        {
          key: "Mod-s",
          run: () => {
            opts.onSaveRequest();
            return true;
          },
        },
      ]),
      ...wrap,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          opts.onDocChange(u.state.doc.toString());
        }
      }),
    ],
  });

  return new EditorView({
    state,
    parent,
  });
}

export function cmUndo(view: EditorView): boolean {
  return undo(view);
}

export function cmRedo(view: EditorView): boolean {
  return redo(view);
}

export function cmWrapSelection(view: EditorView, before: string, after: string): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: EditorSelection.cursor(from + before.length + selected.length),
  });
}

export function cmInsertAtCursor(view: EditorView, text: string): void {
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: EditorSelection.cursor(from + text.length),
  });
}

export function cmScrollToLine(view: EditorView, line1: number): void {
  const doc = view.state.doc;
  if (line1 < 1 || line1 > doc.lines) return;
  const line = doc.line(line1);
  view.dispatch({
    selection: EditorSelection.cursor(line.from),
    effects: EditorView.scrollIntoView(line.from, { y: "center" }),
  });
  view.focus();
}
