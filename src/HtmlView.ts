import { TextFileView, WorkspaceLeaf, Notice } from "obsidian";
import { EditorView } from "@codemirror/view";
import { cmScrollToLine, createHtmlCodeMirror } from "./htmlEditorCm";
import { VIEW_TYPE_HTML, ViewMode } from "./constants";
import type HtmlEditorPlugin from "./main";

export class HtmlView extends TextFileView {
  plugin: HtmlEditorPlugin;
  currentMode: ViewMode;
  private cmHostEl!: HTMLElement;
  private cmView: EditorView | null = null;
  private editorWrapEl!: HTMLElement;
  private previewFrame: HTMLIFrameElement | null = null;
  private toolbarEl!: HTMLElement;
  private contentArea!: HTMLElement;
  private resizeHandle!: HTMLElement;
  private statusEl!: HTMLElement;
  private scriptToggleBtn!: HTMLElement;
  private previewEditBtn!: HTMLElement;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private previewSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private isDragging = false;
  private sourcePane!: HTMLElement;
  private previewPane!: HTMLElement;
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  /** 从预览反写 CM 时跳过 updateListener 里的「刷新 iframe」 */
  private pushingFromPreview = false;

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
    this.editorWrapEl = this.sourcePane.createDiv("html-editor-editor-wrap");
    this.buildEditorSurface();

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

    this.updateStatus();
  }

  rebuildEditorChrome(): void {
    if (!this.editorWrapEl) return;
    const text = this.cmView?.state.doc.toString() ?? this.data ?? "";
    const hadFocus = this.cmView?.hasFocus ?? false;
    this.data = text;
    this.destroyCm();
    this.buildEditorSurface();
    if (hadFocus) this.cmView?.focus();
    this.updateStatus();
    if (this.currentMode === ViewMode.Preview || this.currentMode === ViewMode.Split) {
      this.refreshPreview();
    }
  }

  private destroyCm(): void {
    if (this.cmView) {
      this.cmView.destroy();
      this.cmView = null;
    }
  }

  private buildEditorSurface(): void {
    this.editorWrapEl.empty();
    this.cmHostEl = this.editorWrapEl.createDiv("html-editor-cm-host");
    const s = this.plugin.settings;
    this.cmView = createHtmlCodeMirror(this.cmHostEl, {
      doc: this.data ?? "",
      fontSize: s.fontSize,
      wordWrap: s.wordWrap,
      showLineNumbers: s.lineNumbers,
      onDocChange: (t) => this.onCmDocChange(t),
      onSaveRequest: () => this.requestSave(),
    });
  }

  private onCmDocChange(text: string): void {
    if (this.pushingFromPreview) return;
    this.data = text;
    this.requestSave();
    this.schedulePreviewRefresh();
    this.updateStatus();
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

    this.previewEditBtn = this.toolbarEl.createEl("button", {
      text: this.plugin.settings.previewEditable ? "预览编辑: ON" : "预览编辑: OFF",
    });
    if (this.plugin.settings.previewEditable) this.previewEditBtn.addClass("is-active");
    this.previewEditBtn.setAttribute(
      "title",
      this.plugin.settings.previewEditable
        ? "右侧可直接改文字；拖选文字可定位左侧；或 Alt+单击元素定位"
        : "关闭后右侧只读；单击元素可跳到左侧对应行"
    );
    this.previewEditBtn.addEventListener("click", async () => {
      this.plugin.settings.previewEditable = !this.plugin.settings.previewEditable;
      await this.plugin.saveSettings();
      this.previewEditBtn.textContent = this.plugin.settings.previewEditable ? "预览编辑: ON" : "预览编辑: OFF";
      this.previewEditBtn.toggleClass("is-active", this.plugin.settings.previewEditable);
      this.previewEditBtn.setAttribute(
        "title",
        this.plugin.settings.previewEditable
          ? "右侧可直接改文字；拖选文字可定位左侧；或 Alt+单击元素定位"
          : "关闭后右侧只读；单击元素可跳到左侧对应行"
      );
      this.refreshPreview();
    });

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
    if (!this.statusEl || !this.cmView) return;
    const doc = this.cmView.state.doc;
    this.statusEl.textContent = `${doc.lines} lines · ${doc.length} chars`;
  }

  refreshPreview(): void {
    const content = this.data ?? "";

    if (this.previewFrame) {
      this.previewFrame.remove();
      this.previewFrame = null;
    }

    let htmlToRender = content;
    if (!this.plugin.settings.allowScripts) {
      htmlToRender = this.stripScripts(content);
    }

    const withLineTracking = this.injectLineTracking(htmlToRender, this.plugin.settings.previewEditable);

    // 必须含 allow-scripts，否则 srcdoc 内注入的定位脚本无法执行（JS:OFF 时已先 strip 用户 script）
    const sandboxAttr = this.plugin.settings.allowScripts
      ? "allow-scripts allow-same-origin allow-forms allow-popups"
      : "allow-scripts allow-same-origin";

    this.previewFrame = this.previewPane.createEl("iframe", {
      attr: { sandbox: sandboxAttr },
    });

    this.previewFrame.srcdoc = withLineTracking;
    this.previewFrame.addEventListener(
      "load",
      () => {
        this.onPreviewFrameLoaded();
      },
      { once: true }
    );
  }

  private onPreviewFrameLoaded(): void {
    const doc = this.previewFrame?.contentDocument;
    if (!doc) return;

    if (this.plugin.settings.previewEditable) {
      try {
        doc.designMode = "on";
      } catch {
        /* 部分沙箱环境可能禁止 */
      }
      doc.addEventListener("input", () => this.schedulePreviewSyncFromIframe());
    }
  }

  private schedulePreviewSyncFromIframe(): void {
    if (this.previewSyncTimer) clearTimeout(this.previewSyncTimer);
    this.previewSyncTimer = setTimeout(() => {
      this.syncFromPreviewIframe();
    }, 400);
  }

  /** 将 iframe 内当前 DOM 序列化回左侧源码（不整页重刷预览，避免打断在右侧的编辑） */
  private syncFromPreviewIframe(): void {
    const doc = this.previewFrame?.contentDocument;
    if (!doc || !this.cmView) return;
    const serialized = this.serializePreviewDocument(doc);
    if (serialized === this.data) return;
    this.pushingFromPreview = true;
    try {
      this.cmView.dispatch({
        changes: { from: 0, to: this.cmView.state.doc.length, insert: serialized },
      });
      this.data = serialized;
      this.requestSave();
      this.updateStatus();
    } finally {
      this.pushingFromPreview = false;
    }
  }

  private serializePreviewDocument(doc: Document): string {
    let html = doc.documentElement.outerHTML;
    html = html.replace(/<script[^>]*data-injected="html-editor"[\s\S]*?<\/script>/gi, "");
    html = html.replace(/\s*data-source-line="[^"]*"/gi, "");
    return html;
  }

  private stripScripts(html: string): string {
    return html.replace(/<script[\s\S]*?<\/script>/gi, "");
  }

  private injectLineTracking(source: string, previewEditable: boolean): string {
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

    const altGuard = previewEditable ? "if (!e.altKey) return;" : "";

    const selectionLocate = previewEditable
      ? `
document.addEventListener('mouseup', function() {
  var sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  var node = sel.anchorNode;
  if (!node) return;
  var el = node.nodeType === 1 ? node : node.parentElement;
  while (el && el !== document.body && (!el.dataset || !el.dataset.sourceLine)) {
    el = el.parentElement;
  }
  if (el && el.dataset && el.dataset.sourceLine) {
    window.parent.postMessage({
      type: 'html-editor-locate-line',
      line: parseInt(el.dataset.sourceLine, 10)
    }, '*');
  }
});
`
      : "";

    const clickScript = `
<script data-injected="html-editor">
document.addEventListener('click', function(e) {
  ${altGuard}
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
${selectionLocate}
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
    if (this.currentMode === ViewMode.Preview) {
      this.switchMode(ViewMode.Split);
    }
    if (!this.cmView) return;
    cmScrollToLine(this.cmView, line);
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
    return this.data;
  }

  setViewData(data: string, clear: boolean): void {
    this.data = data;
    if (this.cmView) {
      this.pushingFromPreview = true;
      try {
        this.cmView.dispatch({
          changes: { from: 0, to: this.cmView.state.doc.length, insert: data },
        });
      } finally {
        this.pushingFromPreview = false;
      }
    }
    this.updateStatus();
    if (this.currentMode === ViewMode.Preview || this.currentMode === ViewMode.Split) {
      this.refreshPreview();
    }
  }

  clear(): void {
    this.data = "";
    if (this.cmView) {
      this.cmView.dispatch({
        changes: { from: 0, to: this.cmView.state.doc.length, insert: "" },
      });
    }
    this.updateStatus();
    if (this.previewFrame) {
      this.previewFrame.remove();
      this.previewFrame = null;
    }
  }

  async onClose(): Promise<void> {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (this.previewSyncTimer) clearTimeout(this.previewSyncTimer);
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = null;
    }
    this.destroyCm();
  }

  canAcceptExtension(extension: string): boolean {
    return extension === "html" || extension === "htm";
  }
}
