import { TextFileView, WorkspaceLeaf, Notice } from "obsidian";
import { EditorView } from "@codemirror/view";
import {
  editBold,
  editClearFormat,
  editDeleteBlock,
  editInsertBlockquote,
  editInsertBr,
  editInsertCode,
  editInsertH1,
  editInsertH2,
  editInsertH3,
  editInsertImage,
  editInsertP,
  editInsertUl,
  editItalic,
  editLink,
  editRedo,
  editStrike,
  editUnderline,
  editUndo,
  type HtmlEditContext,
  type HtmlEditTarget,
} from "./htmlEditActions";
import { cmLocateInSource, createHtmlCodeMirror } from "./htmlEditorCm";
import { buildSourceMapScript, injectSourceMarkers } from "./sourceMap";
import { buildPreviewInjectedScript } from "./previewScripts";
import {
  PreviewInteractionMode,
  VIEW_TYPE_HTML,
  ViewMode,
  type PreviewElementInfo,
} from "./constants";
import { resolvePreviewInteractionMode, syncLegacyPreviewFlags } from "./settings";
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
  private interactionBtns: Partial<Record<PreviewInteractionMode, HTMLElement>> = {};
  private inspectorBar!: HTMLElement;
  private inspectorSummaryEl!: HTMLElement;
  private inspectorPathEl!: HTMLElement;
  private locateSourceBtn!: HTMLElement;
  private selectedPreview: PreviewElementInfo | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private previewSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private isDragging = false;
  private sourcePane!: HTMLElement;
  private previewPane!: HTMLElement;
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  /** 从预览反写 CM 时跳过 updateListener 里的「刷新 iframe」 */
  private pushingFromPreview = false;
  /** 最近一次点击的编辑区：决定撤销/格式按钮作用在左侧还是预览 */
  private lastEditTarget: HtmlEditTarget = "source";

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
    this.buildInspectorBar();
    this.sourcePane.addEventListener("mousedown", () => {
      this.lastEditTarget = "source";
    });
    this.previewPane.addEventListener("mousedown", () => {
      this.lastEditTarget = "preview";
    });

    if (this.currentMode === ViewMode.Preview) {
      this.resizeHandle.style.display = "none";
    }

    this.messageHandler = (e: MessageEvent) => {
      if (e.data?.type === "html-editor-select") {
        this.handlePreviewSelect(e.data as PreviewElementInfo);
      }
      if (e.data?.type === "html-editor-locate-line" && typeof e.data.line === "number") {
        this.scrollToLine(e.data.line);
      }
      if (e.data?.type === "html-editor-dom-changed") {
        this.schedulePreviewSyncFromIframe();
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

    this.buildInteractionToolbar();

    this.toolbarEl.createDiv("toolbar-separator");

    const editRow = this.toolbarEl.createDiv("html-editor-toolbar-edit");
    this.buildEditToolbar(editRow);

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

  private getEditContext(): HtmlEditContext {
    return {
      target: this.lastEditTarget,
      previewEditable:
        resolvePreviewInteractionMode(this.plugin.settings) === PreviewInteractionMode.Text,
      cmView: this.cmView,
      postPreviewCmd: (command, value) => this.postPreviewCmd(command, value),
    };
  }

  private buildInteractionToolbar(): void {
    const row = this.toolbarEl.createDiv("html-editor-toolbar-interaction");
    const modes: { mode: PreviewInteractionMode; label: string; title: string }[] = [
      {
        mode: PreviewInteractionMode.Select,
        label: "选择",
        title: "悬停高亮；单击选中最内层；同位置连点或「下一层」切外层；Shift+单击直接选最外层",
      },
      {
        mode: PreviewInteractionMode.Text,
        label: "改文字",
        title: "在预览中直接编辑文字；Alt+单击（Shift=选外层）可定位左侧源码",
      },
      {
        mode: PreviewInteractionMode.Drag,
        label: "拖动",
        title: "拖动块级元素，会写入 position/transform",
      },
    ];
    this.interactionBtns = {};
    const current = resolvePreviewInteractionMode(this.plugin.settings);
    for (const { mode, label, title } of modes) {
      const btn = row.createEl("button", { text: label });
      btn.setAttribute("title", title);
      if (current === mode) btn.addClass("is-active");
      btn.addEventListener("click", () => void this.setPreviewInteractionMode(mode));
      this.interactionBtns[mode] = btn;
    }
  }

  private async setPreviewInteractionMode(mode: PreviewInteractionMode): Promise<void> {
    if (this.plugin.settings.previewInteractionMode === mode) return;
    this.plugin.settings.previewInteractionMode = mode;
    syncLegacyPreviewFlags(this.plugin.settings);
    await this.plugin.saveSettings();
    for (const [m, btn] of Object.entries(this.interactionBtns)) {
      btn?.toggleClass("is-active", m === mode);
    }
    this.selectedPreview = null;
    this.updateInspectorBar();
    this.refreshPreview();
  }

  private buildInspectorBar(): void {
    this.inspectorBar = this.previewPane.createDiv("html-editor-inspector");
    this.inspectorSummaryEl = this.inspectorBar.createDiv("html-editor-inspector-summary");
    this.inspectorPathEl = this.inspectorBar.createDiv("html-editor-inspector-path");
    const actions = this.inspectorBar.createDiv("html-editor-inspector-actions");

    this.locateSourceBtn = actions.createEl("button", { text: "定位源码" });
    this.locateSourceBtn.setAttribute("title", "在左侧源码中选中该元素的起始标签");
    this.locateSourceBtn.addEventListener("click", () => {
      if (this.selectedPreview) this.locateSelectedInSource();
    });

    const parentBtn = actions.createEl("button", { text: "父级" });
    parentBtn.setAttribute("title", "选中上一级带源码标记的元素");
    parentBtn.addEventListener("click", () => this.postInspectorCmd("parent"));

    const childBtn = actions.createEl("button", { text: "子级" });
    childBtn.setAttribute("title", "选中第一个子元素");
    childBtn.addEventListener("click", () => this.postInspectorCmd("child"));

    const cycleBtn = actions.createEl("button", { text: "下一层" });
    cycleBtn.setAttribute(
      "title",
      "在同一点击位置切换到更外层元素（等同在预览里连点）"
    );
    cycleBtn.addEventListener("click", () => this.postInspectorCmd("cycle"));

    this.updateInspectorBar();
  }

  private postInspectorCmd(command: string): void {
    this.previewFrame?.contentWindow?.postMessage(
      { type: "html-editor-inspector-cmd", command },
      "*"
    );
  }

  private handlePreviewSelect(data: PreviewElementInfo): void {
    this.selectedPreview = {
      line: data.line,
      tag: data.tag,
      label: data.label,
      path: data.path,
      depth: data.depth,
      depthTotal: data.depthTotal,
      sourceId: data.sourceId,
      from: data.from,
      to: data.to,
    };
    this.lastEditTarget = "preview";
    this.updateInspectorBar();
    if (this.plugin.settings.autoLocateOnSelect) {
      this.locateSelectedInSource();
    }
  }

  private locateSelectedInSource(): void {
    const s = this.selectedPreview;
    if (!s || !this.cmView) return;
    if (this.currentMode === ViewMode.Preview) {
      this.switchMode(ViewMode.Split);
    }
    cmLocateInSource(this.cmView, {
      line: s.line,
      tag: s.tag,
      from: s.from,
      to: s.to,
    });
  }

  private updateInspectorBar(): void {
    if (!this.inspectorBar) return;
    const mode = resolvePreviewInteractionMode(this.plugin.settings);
    const show =
      mode === PreviewInteractionMode.Select &&
      this.selectedPreview !== null &&
      (this.currentMode === ViewMode.Preview || this.currentMode === ViewMode.Split);
    this.inspectorBar.style.display = show ? "" : "none";
    if (!show || !this.selectedPreview) return;
    const s = this.selectedPreview;
    this.inspectorSummaryEl.setText(
      `${s.label} · 源码第 ${s.line} 行 · 层级 ${s.depth + 1}/${s.depthTotal}`
    );
    this.inspectorPathEl.setText(s.path || s.label);
  }

  private postPreviewCmd(command: string, value?: string): void {
    this.previewFrame?.contentWindow?.postMessage({ type: "html-editor-cmd", command, value }, "*");
  }

  /** 供命令面板调用 */
  performUndo(): void {
    editUndo(this.getEditContext());
  }

  performRedo(): void {
    editRedo(this.getEditContext());
  }

  private buildEditToolbar(parent: HTMLElement): void {
    const ctx = () => this.getEditContext();
    const add = (label: string, title: string, run: () => void) => {
      const btn = parent.createEl("button", { text: label });
      btn.addClass("toolbar-edit-btn");
      btn.setAttribute("title", title);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        run();
      });
    };

    add("撤销", "撤销（左侧 Ctrl+Z；改文字模式下需先点预览再撤销）", () => editUndo(ctx()));
    add("重做", "重做（左侧 Ctrl+Shift+Z）", () => editRedo(ctx()));
    parent.createDiv("toolbar-separator");

    add("粗体", "粗体 <strong>", () => editBold(ctx()));
    add("斜体", "斜体 <em>", () => editItalic(ctx()));
    add("下划线", "下划线", () => editUnderline(ctx()));
    add("删除线", "删除线", () => editStrike(ctx()));
    add("清格式", "清除行内格式", () => editClearFormat(ctx()));
    parent.createDiv("toolbar-separator");

    add("链接", "插入/编辑链接", () => {
      const url = window.prompt("链接 URL", "https://");
      if (url) editLink(ctx(), url);
    });
    add("H1", "标题 <h1>", () => editInsertH1(ctx()));
    add("H2", "标题 <h2>", () => editInsertH2(ctx()));
    add("H3", "标题 <h3>", () => editInsertH3(ctx()));
    add("段落", "段落 <p>", () => editInsertP(ctx()));
    add("列表", "无序列表 <ul><li>", () => editInsertUl(ctx()));
    add("引用", "引用 <blockquote>", () => editInsertBlockquote(ctx()));
    add("代码", "行内 <code>", () => editInsertCode(ctx()));
    add("换行", "插入 <br>", () => editInsertBr(ctx()));
    add("图片", "插入 <img>", () => {
      const url = window.prompt("图片 URL", "https://");
      if (url) editInsertImage(ctx(), url);
    });
    parent.createDiv("toolbar-separator");

    add("删块", "删除当前块级元素（预览）或当前行（源码）", () => editDeleteBlock(ctx()));
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
    this.selectedPreview = null;
    this.updateInspectorBar();

    let htmlToRender = content;
    if (!this.plugin.settings.allowScripts) {
      htmlToRender = this.stripScripts(content);
    }

    const withLineTracking = this.injectLineTracking(
      htmlToRender,
      resolvePreviewInteractionMode(this.plugin.settings)
    );

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

    if (resolvePreviewInteractionMode(this.plugin.settings) === PreviewInteractionMode.Text) {
      try {
        doc.designMode = "on";
      } catch {
        /* 部分沙箱环境可能禁止 */
      }
      doc.addEventListener("input", () => this.schedulePreviewSyncFromIframe());
    } else {
      try {
        doc.designMode = "off";
      } catch {
        /* ignore */
      }
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
    html = html.replace(/<script[^>]*data-injected="html-editor-map"[^>]*>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<script[^>]*data-injected="html-editor"[\s\S]*?<\/script>/gi, "");
    html = html.replace(/\s*data-source-(?:id|line)="[^"]*"/gi, "");
    html = html.replace(/\s*html-editor-(?:drag-active|drag-hover|hover|selected)/g, "");
    return html;
  }

  private stripScripts(html: string): string {
    return html.replace(/<script[\s\S]*?<\/script>/gi, "");
  }

  private injectLineTracking(source: string, interactionMode: PreviewInteractionMode): string {
    const { html: marked, map } = injectSourceMarkers(source);
    const clickScript = buildPreviewInjectedScript(interactionMode);
    const inject = buildSourceMapScript(map) + "\n" + clickScript;

    if (marked.includes("</body>")) {
      return marked.replace("</body>", inject + "\n</body>");
    }
    return marked + "\n" + inject;
  }

  private scrollToLine(line: number): void {
    if (this.currentMode === ViewMode.Preview) {
      this.switchMode(ViewMode.Split);
    }
    if (!this.cmView) return;
    cmLocateInSource(this.cmView, { line });
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
