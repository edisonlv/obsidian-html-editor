import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from "@codemirror/commands";
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { html } from "@codemirror/lang-html";
import { highlightSelectionMatches, searchKeymap, SearchQuery, setSearchQuery } from "@codemirror/search";
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
  cmLocateInSource(view, { line: line1 });
}

export interface SourceLocateTarget {
  line: number;
  tag?: string;
  from?: number;
  to?: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 在源码中选中对应起始标签（优先用精确偏移，否则按行+标签名匹配） */
export function cmLocateInSource(view: EditorView, loc: SourceLocateTarget): void {
  const doc = view.state.doc;
  let from: number;
  let to: number;

  if (
    typeof loc.from === "number" &&
    typeof loc.to === "number" &&
    loc.from >= 0 &&
    loc.to > loc.from &&
    loc.from < doc.length
  ) {
    from = loc.from;
    to = Math.min(doc.length, loc.to);
  } else {
    const lineNo = Math.max(1, Math.min(loc.line, doc.lines));
    const line = doc.line(lineNo);
    if (loc.tag) {
      const re = new RegExp(`<${escapeRegExp(loc.tag)}(?:[\\s/>]|$)`, "i");
      const m = line.text.match(re);
      if (m && m.index !== undefined) {
        from = line.from + m.index;
        const gt = line.text.indexOf(">", m.index);
        to = gt >= 0 ? line.from + gt + 1 : from + m[0].length;
      } else {
        from = line.from;
        to = Math.min(line.to, from + 1);
      }
    } else {
      from = line.from;
      to = Math.min(line.to, from + 1);
    }
  }

  view.dispatch({
    selection: EditorSelection.range(from, to),
    effects: EditorView.scrollIntoView(from, { y: "center" }),
  });
  view.focus();
}

/** 在源码中查找字符串并选中第一处 */
export function cmFindAndSelect(view: EditorView, needle: string): boolean {
  if (!needle) return false;
  const doc = view.state.doc.toString();
  const idx = doc.indexOf(needle);
  if (idx < 0) return false;
  const to = idx + needle.length;
  view.dispatch({
    selection: EditorSelection.range(idx, to),
    effects: [
      EditorView.scrollIntoView(idx, { y: "center" }),
      setSearchQuery.of(new SearchQuery({ search: needle })),
    ],
  });
  view.focus();
  return true;
}
