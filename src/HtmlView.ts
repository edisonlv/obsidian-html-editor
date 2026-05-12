import { TextFileView, WorkspaceLeaf, Notice } from "obsidian";
import { VIEW_TYPE_HTML, ViewMode } from "./constants";
import type HtmlEditorPlugin from "./main";

import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter, foldKeymap } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { html } from "@codemirror/lang-html";

export class HtmlView extends TextFileView {
  plugin: HtmlEditorPlugin;
  private currentMode: ViewMode;
  private cmView: EditorView | null = null;
  private previewFrame: HTMLIFrameElement | null = null;
  private toolbarEl: HTMLElement;
  private contentArea: HTMLElement;
  private resizeHandle: HTMLElement;
  private statusEl: HTMLElement;
  private scriptToggleBtn: HTMLElement;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private isDragging = false;
  private sourcePane: HTMLElement;
  private previewPane: HTMLElement;
  private wordWrapCompartment = new Compartment();
  private lineNumbersCompartment = new Compartment();
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  private data_: string = "";

  constructor(leaf: WorkspaceLeaf, plugin: HtmlEditorPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentMode = plugin.settings.defaultMode;
  }

  getViewType(): string {
    return VIEW_TYPE_HTML;
  }

  getDisplayText(): string {
    return this.file?.basename ?? "HTML";
  }

  getIcon(): string {
    return "code";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("html-editor-container");

    this.toolbarEl = container.createDiv("html-editor-toolbar");
    this.buildToolbar();

    this.contentArea = container.createDiv("html-editor-content");
    this.updateContentMode();

    this.sourcePane = this.contentArea.createDiv("html-editor-source-pane");
    this.initCodeMirror();

    this.resizeHandle = this.contentArea.createDiv("html-editor-resize-handle");
    this.setupResize();

    this.previewPane = this.contentArea.createDiv("html-editor-preview-pane");

    if (this.currentMode === ViewMode.Preview) {
      this.resizeHandle.style.display = "none";
    }

    this.messageHandler = (e: MessageEvent) => {
      if (e.data?.type === "html-editor-locate-line" && typeof e.data.line === "number") {
        this.scrollToLine(e.data.line);
      }
    };
    window.addEventListener("message", this.messageHandler);
  }

  private initCodeMirror(): void {
    const s = this.plugin.settings;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        this.data_ = update.state.doc.toString();
        this.requestSave();
        this.schedulePreviewRefresh();
        this.updateStatus();
      }
    });

    const state = EditorState.create({
      doc: this.data_,
      extensions: [
        this.lineNumbersCompartment.of(s.lineNumbers ? lineNumbers() : []),
        highlightActiveLineGutter(),
        history(),
        foldGutter(),
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        this.wordWrapCompartment.of(s.wordWrap ? EditorView.lineWrapping : []),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        html(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          indentWithTab,
        ]),
        updateListener,
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: `${s.fontSize}px`,
          },
          ".cm-scroller": {
            overflow: "auto",
            fontFamily: "var(--font-monospace)",
          },
          ".cm-content": {
            padding: "8px 0",
          },
          ".cm-gutters": {
            background: "var(--background-secondary)",
            color: "var(--text-faint)",
            border: "none",
            borderRight: "1px solid var(--background-modifier-border)",
          },
          ".cm-activeLineGutter": {
            background: "var(--background-modifier-hover)",
          },
          ".cm-activeLine": {
            background: "var(--background-secondary-alt, rgba(0,0,0,0.04))",
          },
          "&.cm-focused .cm-cursor": {
            borderLeftColor: "var(--text-normal)",
          },
          "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
            background: "var(--text-selection, rgba(100, 100, 255, 0.2))",
          },
          ".cm-foldGutter .cm-gutterElement": {
            padding: "0 4px",
          },
        }),
      ],
    });

    this.cmView = new EditorView({
      state,
      parent: this.sourcePane,
    });
  }

  private buildToolbar(): void {
    this.toolbarEl.empty();

    const modes: { mode: ViewMode; label: string }[] = [
      { mode: ViewMode.Preview, label: "Preview" },
      { mode: ViewMode.Source, label: "Source" },
      { mode: ViewMode.Split, label: "Split" },
    ];

    for (const { mode, label } of modes) {
      const btn = this.toolbarEl.createEl("button", { text: label });
      if (this.currentMode === mode) btn.addClass("is-active");
      btn.addEventListener("click", () => this.switchMode(mode));
    }

    this.toolbarEl.createDiv("toolbar-separator");

    const refreshBtn = this.toolbarEl.createEl("button", { text: "Refresh" });
    refreshBtn.addEventListener("click", () => this.refreshPreview());

    const openBtn = this.toolbarEl.createEl("button", { text: "Open in Browser" });
    openBtn.addEventListener("click", () => this.openInBrowser());

    this.toolbarEl.createDiv("toolbar-spacer");

    this.scriptToggleBtn = this.toolbarEl.createEl("button", {
      text: this.plugin.settings.allowScripts ? "JS: ON" : "JS: OFF",
    });
    if (this.plugin.settings.allowScripts) {
      this.scriptToggleBtn.addClass("is-active");
    }
    this.scriptToggleBtn.addEventListener("click", async () => {
      this.plugin.settings.allowScripts = !this.plugin.settings.allowScripts;
      await this.plugin.saveSettings();
      this.scriptToggleBtn.textContent = this.plugin.settings.allowScripts ? "JS: ON" : "JS: OFF";
      this.scriptToggleBtn.toggleClass("is-active", this.plugin.settings.allowScripts);
      this.refreshPreview();
    });

    this.toolbarEl.createDiv("toolbar-separator");

    this.statusEl = this.toolbarEl.createDiv("toolbar-status");
    this.updateStatus();
  }

  switchMode(mode: ViewMode): void {
    this.currentMode = mode;
    this.updateContentMode();
    this.buildToolbar();

    this.resizeHandle.style.display = mode === ViewMode.Split ? "" : "none";

    if (mode === ViewMode.Preview || mode === ViewMode.Split) {
      this.refreshPreview();
    }

    if (mode === ViewMode.Source || mode === ViewMode.Split) {
      setTimeout(() => this.cmView?.focus(), 50);
    }
  }

  private updateContentMode(): void {
    this.contentArea.removeClass("mode-preview", "mode-source", "mode-split");
    this.contentArea.addClass(`mode-${this.currentMode}`);
  }

  private setupResize(): void {
    let startX = 0;
    let startWidth = 0;

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - startX;
      const newWidth = Math.max(200, startWidth + dx);
      const totalWidth = this.contentArea.clientWidth - 5;
      const ratio = Math.min(0.8, Math.max(0.2, newWidth / totalWidth));
      this.sourcePane.style.flex = `0 0 ${ratio * 100}%`;
      this.previewPane.style.flex = "1";
    };

    const onMouseUp = () => {
      this.isDragging = false;
      this.resizeHandle.removeClass("is-dragging");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    this.resizeHandle.addEventListener("mousedown", (e: MouseEvent) => {
      this.isDragging = true;
      startX = e.clientX;
      startWidth = this.sourcePane.clientWidth;
      this.resizeHandle.addClass("is-dragging");
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      e.preventDefault();
    });
  }

  private schedulePreviewRefresh(): void {
    if (
      !this.plugin.settings.autoRefresh ||
      (this.currentMode !== ViewMode.Split && this.currentMode !== ViewMode.Preview)
    ) {
      return;
    }
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshPreview();
    }, this.plugin.settings.refreshDelay);
  }

  private updateStatus(): void {
    if (!this.statusEl) return;
    const doc = this.cmView?.state.doc;
    if (!doc) return;
    const lines = doc.lines;
    const chars = doc.length;
    this.statusEl.textContent = `${lines} lines · ${chars} chars`;
  }

  refreshPreview(): void {
    const content = this.data_;

    if (this.previewFrame) {
      this.previewFrame.remove();
      this.previewFrame = null;
    }

    let htmlToRender = content;
    if (!this.plugin.settings.allowScripts) {
      htmlToRender = this.stripScripts(content);
    }

    const withLineTracking = this.injectLineTracking(htmlToRender);

    const sandboxAttr = this.plugin.settings.allowScripts
      ? "allow-scripts allow-same-origin allow-forms allow-popups"
      : "allow-same-origin";

    this.previewFrame = this.previewPane.createEl("iframe", {
      attr: { sandbox: sandboxAttr },
    });

    this.previewFrame.srcdoc = withLineTracking;
  }

  private stripScripts(html: string): string {
    return html.replace(/<script[\s\S]*?<\/script>/gi, "");
  }

  /**
   * Inject data-source-line attributes on each opening HTML tag,
   * plus a click handler script that posts a message with the line number.
   */
  private injectLineTracking(source: string): string {
    const lines = source.split("\n");
    const tagged: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      tagged.push(
        lines[i].replace(
          /<([a-zA-Z][a-zA-Z0-9]*)([\s>\/])/g,
          (match, tag, after) => {
            if (tag.toLowerCase() === "script" || tag.toLowerCase() === "style" || tag.toLowerCase() === "!doctype") {
              return match;
            }
            return `<${tag} data-source-line="${i + 1}"${after}`;
          }
        )
      );
    }

    const clickScript = `
<script data-injected="html-editor">
document.addEventListener('click', function(e) {
  var el = e.target;
  while (el && el !== document.body && !el.dataset.sourceLine) {
    el = el.parentElement;
  }
  if (el && el.dataset && el.dataset.sourceLine) {
    e.preventDefault();
    window.parent.postMessage({
      type: 'html-editor-locate-line',
      line: parseInt(el.dataset.sourceLine, 10)
    }, '*');
  }
}, true);

document.addEventListener('mouseover', function(e) {
  document.querySelectorAll('[data-source-line]').forEach(function(el) {
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
  });
  var el = e.target;
  while (el && el !== document.body && !el.dataset.sourceLine) {
    el = el.parentElement;
  }
  if (el && el.dataset && el.dataset.sourceLine) {
    el.style.outline = '2px solid rgba(99, 102, 241, 0.5)';
    el.style.outlineOffset = '2px';
  }
});
</script>`;

    let result = tagged.join("\n");

    if (result.includes("</body>")) {
      result = result.replace("</body>", clickScript + "\n</body>");
    } else {
      result += "\n" + clickScript;
    }

    return result;
  }

  private scrollToLine(line: number): void {
    if (!this.cmView) return;

    if (this.currentMode === ViewMode.Preview) {
      this.switchMode(ViewMode.Split);
    }

    const doc = this.cmView.state.doc;
    if (line < 1 || line > doc.lines) return;

    const lineInfo = doc.line(line);
    this.cmView.dispatch({
      selection: { anchor: lineInfo.from },
      effects: EditorView.scrollIntoView(lineInfo.from, { y: "center" }),
    });
    this.cmView.focus();
  }

  private async openInBrowser(): Promise<void> {
    if (!this.file) return;
    const adapter = this.app.vault.adapter as any;
    if (typeof adapter.getFullPath === "function") {
      const fullPath = adapter.getFullPath(this.file.path);
      window.open(`file://${fullPath}`, "_blank");
    } else {
      new Notice("Cannot determine full file path on this platform");
    }
  }

  getViewData(): string {
    return this.data_;
  }

  setViewData(data: string, clear: boolean): void {
    this.data_ = data;

    if (this.cmView) {
      const currentDoc = this.cmView.state.doc.toString();
      if (currentDoc !== data) {
        this.cmView.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: data },
        });
      }
    }

    this.updateStatus();

    if (this.currentMode === ViewMode.Preview || this.currentMode === ViewMode.Split) {
      this.refreshPreview();
    }
  }

  clear(): void {
    this.data_ = "";
    if (this.cmView) {
      const len = this.cmView.state.doc.length;
      if (len > 0) {
        this.cmView.dispatch({ changes: { from: 0, to: len, insert: "" } });
      }
    }
    if (this.previewFrame) {
      this.previewFrame.remove();
      this.previewFrame = null;
    }
  }

  async onClose(): Promise<void> {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = null;
    }
    if (this.cmView) {
      this.cmView.destroy();
      this.cmView = null;
    }
  }

  canAcceptExtension(extension: string): boolean {
    return extension === "html" || extension === "htm";
  }
}
