import { TextFileView, WorkspaceLeaf, Notice } from "obsidian";
import { EditorView } from "@codemirror/view";
import {
  editBold,
  editClearFormat,
  editDeleteBlock,
  editInsertBlock,
  editInsertBlockquote,
  editInsertBr,
  editInsertCode,
  editInsertH1,
  editInsertH2,
  editInsertH3,
  editInsertHtmlSnippet,
  editInsertLinkAdvanced,
  editInsertP,
  editInsertUl,
  editItalic,
  editRedo,
  editSetStyleOnTarget,
  editStrike,
  editUnderline,
  editUndo,
  type HtmlEditContext,
  type HtmlEditTarget,
} from "./htmlEditActions";
import { openColorPickerModal } from "./colorPickerModal";
import { openDocumentMediaModal } from "./documentMediaModal";
import { openInsertLinkModal } from "./insertLinkModal";
import { openInsertMediaModal } from "./insertMediaModal";
import { cmFindAndSelect, cmLocateInSource, createHtmlCodeMirror } from "./htmlEditorCm";
import { buildSourceMapScript, injectSourceMarkers } from "./sourceMap";
import { getPreviewBaseHref, injectPreviewBaseTag } from "./vaultResources";
import { buildPreviewInjectedScript } from "./previewScripts";
import {
  INSERT_POSITION_LABELS,
  modeIsLayout,
  modeShowsInspector,
  PreviewInteractionMode,
  suggestInsertBlockPosition,
  VIEW_TYPE_HTML,
  ViewMode,
  viewModeIsCanvasOnly,
  viewModeShowsPreview,
  type InsertBlockPosition,
  type PreviewElementInfo,
} from "./constants";
import { openInsertBlockModal } from "./insertBlockModal";
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
  private insertHintBar!: HTMLElement;
  private insertHintEl!: HTMLElement;
  private insertPositionBtns: Partial<Record<InsertBlockPosition, HTMLElement>> = {};
  private locateSourceBtn!: HTMLElement;
  private selectedPreview: PreviewElementInfo | null = null;
  private insertBlockPosition: InsertBlockPosition = "after";
  /** 用户手动改过插入位置后，换选元素不再自动改位置 */
  private insertPositionManual = false;
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
    this.toolbarEl.addEventListener("mousedown", () => this.cancelPreviewDrag());
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

    if (this.currentMode === ViewMode.Preview || this.currentMode === ViewMode.Canvas) {
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
      if (e.data?.type === "html-editor-insert-done") {
        const pos = e.data.position as InsertBlockPosition | undefined;
        const anchor = String(e.data.anchorLabel ?? "元素");
        const block = String(e.data.blockLabel ?? "新块");
        const where =
          pos === "inside"
            ? "内部末尾"
            : pos === "before"
              ? "上方"
              : "下方";
        new Notice(
          `已在「${anchor}」的${where}插入 ${block}。点 Refresh 后新块可点选映射源码。`,
          5000
        );
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
    if (viewModeShowsPreview(this.currentMode)) {
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

    const modes: { mode: ViewMode; label: string; title?: string }[] = [
      { mode: ViewMode.Preview, label: "Preview", title: "仅预览（可点选定位源码）" },
      {
        mode: ViewMode.Canvas,
        label: "画布",
        title: "仅页面编辑：不显示源码、不跳转代码",
      },
      { mode: ViewMode.Source, label: "Source" },
      { mode: ViewMode.Split, label: "Split" },
    ];

    for (const { mode, label, title } of modes) {
      const btn = this.toolbarEl.createEl("button", { text: label });
      if (title) btn.setAttribute("title", title);
      if (this.currentMode === mode) btn.addClass("is-active");
      btn.addEventListener("click", () => this.switchMode(mode));
    }

    this.toolbarEl.createDiv("toolbar-separator");

    this.buildInteractionToolbar();

    this.toolbarEl.createDiv("toolbar-separator");

    const editRow = this.toolbarEl.createDiv("html-editor-toolbar-edit");
    this.buildEditToolbar(editRow);

    const protoRow = this.toolbarEl.createDiv("html-editor-toolbar-prototype");
    this.buildPrototypeToolbar(protoRow);

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
    const mode = resolvePreviewInteractionMode(this.plugin.settings);
    return {
      target: this.lastEditTarget,
      previewEditable: mode === PreviewInteractionMode.Text,
      layoutMode: mode === PreviewInteractionMode.Layout,
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
        title: "点选与切层、定位源码；不拖动",
      },
      {
        mode: PreviewInteractionMode.Layout,
        label: "布局",
        title: "原型：连点切层 → 选「内/下/上」插入位置 → 插块或拖动",
      },
      {
        mode: PreviewInteractionMode.Text,
        label: "改文字",
        title: "在预览中直接编辑文字；Alt+单击可定位左侧源码",
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
    const active = resolvePreviewInteractionMode(this.plugin.settings);
    for (const [m, btn] of Object.entries(this.interactionBtns)) {
      btn?.toggleClass("is-active", m === active);
    }
    this.selectedPreview = null;
    this.insertPositionManual = false;
    this.updateInspectorBar();
    this.refreshPreview();
  }

  private buildInspectorBar(): void {
    this.inspectorBar = this.previewPane.createDiv("html-editor-inspector");
    const info = this.inspectorBar.createDiv("html-editor-inspector-info");
    this.inspectorSummaryEl = info.createDiv("html-editor-inspector-summary");
    this.inspectorPathEl = info.createDiv("html-editor-inspector-path");
    const actions = this.inspectorBar.createDiv("html-editor-inspector-actions");

    this.locateSourceBtn = actions.createEl("button", { text: "定位源码" });
    this.locateSourceBtn.setAttribute("title", "在左侧源码中选中该元素的起始标签（画布模式不可用）");
    this.locateSourceBtn.addEventListener("click", () => {
      if (viewModeIsCanvasOnly(this.currentMode)) {
        new Notice("画布模式不显示源码。请切换到 Split 或 Source 查看代码。");
        return;
      }
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

    this.insertHintBar = this.previewPane.createDiv("html-editor-insert-hint");
    const insertRow = this.insertHintBar.createDiv("html-editor-insert-hint-row");
    insertRow.createSpan({ text: "插入位置", cls: "html-editor-insert-hint-label" });
    const posGroup = insertRow.createDiv("html-editor-insert-position-group");
    for (const pos of ["inside", "after", "before"] as InsertBlockPosition[]) {
      const meta = INSERT_POSITION_LABELS[pos];
      const btn = posGroup.createEl("button", { text: meta.short });
      btn.setAttribute("title", meta.title);
      btn.addEventListener("click", () => this.setInsertBlockPosition(pos, true));
      this.insertPositionBtns[pos] = btn;
    }
    this.insertHintEl = this.insertHintBar.createDiv("html-editor-insert-hint-text");

    this.updateInspectorBar();
  }

  private setInsertBlockPosition(pos: InsertBlockPosition, manual: boolean): void {
    this.insertBlockPosition = pos;
    if (manual) this.insertPositionManual = true;
    for (const [p, btn] of Object.entries(this.insertPositionBtns)) {
      btn?.toggleClass("is-active", p === pos);
    }
    this.updateInsertHintBar();
    this.syncInsertPositionPreview();
  }

  private syncInsertPositionPreview(): void {
    if (!modeIsLayout(resolvePreviewInteractionMode(this.plugin.settings))) return;
    this.previewFrame?.contentWindow?.postMessage(
      { type: "html-editor-insert-position", position: this.insertBlockPosition },
      "*"
    );
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
      moduleType: data.moduleType ?? "元素",
      label: data.label,
      path: data.path,
      depth: data.depth,
      depthTotal: data.depthTotal,
      sourceId: data.sourceId,
      from: data.from,
      to: data.to,
    };
    this.lastEditTarget = "preview";
    if (!this.insertPositionManual) {
      this.insertBlockPosition = suggestInsertBlockPosition(data.tag);
    }
    this.updateInspectorBar();
    this.syncInsertPositionPreview();
    if (
      this.plugin.settings.autoLocateOnSelect &&
      !viewModeIsCanvasOnly(this.currentMode)
    ) {
      this.locateSelectedInSource();
    }
  }

  private locateSelectedInSource(): void {
    const s = this.selectedPreview;
    if (!s || !this.cmView) return;
    if (viewModeIsCanvasOnly(this.currentMode)) return;
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
    const inPreview = viewModeShowsPreview(this.currentMode);
    const canvas = viewModeIsCanvasOnly(this.currentMode);
    const show =
      modeShowsInspector(mode) && this.selectedPreview !== null && inPreview;
    this.inspectorBar.style.display = show ? "" : "none";
    if (this.locateSourceBtn) {
      this.locateSourceBtn.style.display = canvas ? "none" : "";
    }
    this.updateInsertHintBar();
    if (!show || !this.selectedPreview) return;
    const s = this.selectedPreview;
    const typeBadge = `【${s.moduleType}】`;
    const summary = canvas
      ? `${typeBadge} ${s.label} · 层级 ${s.depth + 1}/${s.depthTotal}`
      : `${typeBadge} ${s.label} · 源码第 ${s.line > 0 ? s.line : "?"} 行 · 层级 ${s.depth + 1}/${s.depthTotal}`;
    const path = s.path || s.label;
    this.inspectorSummaryEl.setText(summary);
    this.inspectorPathEl.setText(path);
    this.inspectorSummaryEl.setAttr("title", summary);
    this.inspectorPathEl.setAttr("title", path);
  }

  private updateInsertHintBar(): void {
    if (!this.insertHintBar) return;
    const mode = resolvePreviewInteractionMode(this.plugin.settings);
    const inPreview = viewModeShowsPreview(this.currentMode);
    const show =
      modeIsLayout(mode) && this.selectedPreview !== null && inPreview;
    this.insertHintBar.style.display = show ? "" : "none";
    if (!show || !this.selectedPreview) return;
    for (const [p, btn] of Object.entries(this.insertPositionBtns)) {
      btn?.toggleClass("is-active", p === this.insertBlockPosition);
    }
    const target = this.selectedPreview.label || this.selectedPreview.tag;
    const hint = INSERT_POSITION_LABELS[this.insertBlockPosition].hint(target);
    this.insertHintEl.setText(hint);
    this.insertHintEl.setAttr("title", hint);
  }

  private postPreviewCmd(command: string, value?: string): void {
    this.previewFrame?.contentWindow?.postMessage({ type: "html-editor-cmd", command, value }, "*");
  }

  /** 在工具栏/弹窗操作后释放 iframe 内可能卡住的拖动状态 */
  private cancelPreviewDrag(): void {
    this.previewFrame?.contentWindow?.postMessage({ type: "html-editor-cancel-drag" }, "*");
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
        e.stopPropagation();
        try {
          run();
        } catch (err) {
          console.error("[obsidian-html-editor] toolbar action failed:", err);
          new Notice("操作失败，请查看开发者控制台");
        }
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

    add("链接", "网页 / 库内文件 / 页内锚点", () => this.openLinkDialog());
    add("媒体", "插入图片、视频或音频（网址或库内文件）", () => this.openMediaDialog());
    add("本文媒体", "查看并复制当前 HTML 中的媒体路径", () => this.openDocumentMediaList());
    add("H1", "标题 <h1>", () => editInsertH1(ctx()));
    add("H2", "标题 <h2>", () => editInsertH2(ctx()));
    add("H3", "标题 <h3>", () => editInsertH3(ctx()));
    add("段落", "段落 <p>", () => editInsertP(ctx()));
    add("列表", "无序列表 <ul><li>", () => editInsertUl(ctx()));
    add("引用", "引用 <blockquote>", () => editInsertBlockquote(ctx()));
    add("代码", "行内 <code>", () => editInsertCode(ctx()));
    add("换行", "插入 <br>", () => editInsertBr(ctx()));
    parent.createDiv("toolbar-separator");

    add("删块", "删除当前块级元素（预览）或当前行（源码）", () => editDeleteBlock(ctx()));
  }

  private buildPrototypeToolbar(parent: HTMLElement): void {
    const ctx = () => this.getEditContext();
    const add = (label: string, title: string, run: () => void) => {
      const btn = parent.createEl("button", { text: label });
      btn.addClass("toolbar-edit-btn");
      btn.setAttribute("title", title);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        run();
      });
    };

    const requireLayout = (run: () => void) => {
      if (!ctx().layoutMode) {
        new Notice("请切换到「布局」模式后再使用原型工具（插块 / 设色）");
        return;
      }
      if (ctx().target !== "preview") {
        new Notice("请先在右侧预览中点击选中一个元素");
        return;
      }
      run();
    };

    add("字色", "设置选中元素或选区文字颜色", () => {
      this.cancelPreviewDrag();
      openColorPickerModal(this.app, { title: "文字颜色", initial: "#333333" }, (hex) => {
        editSetStyleOnTarget(ctx(), "color", hex);
      });
    });
    add("底色", "设置选中元素背景色", () => {
      this.cancelPreviewDrag();
      openColorPickerModal(this.app, { title: "背景颜色", initial: "#f3f4f6" }, (hex) => {
        editSetStyleOnTarget(ctx(), "backgroundColor", hex);
      });
    });
    parent.createDiv("toolbar-separator");

    add("插块…", "选择插入位置与块类型（需先在预览中选中元素）", () => {
      this.cancelPreviewDrag();
      requireLayout(() => this.openInsertBlockDialog());
    });
  }

  private openInsertBlockDialog(): void {
    if (!this.selectedPreview) {
      new Notice("请先在右侧预览中点击选中一个元素");
      return;
    }
    openInsertBlockModal(
      this.app,
      {
        selection: this.selectedPreview,
        position: this.insertBlockPosition,
        canvasOnly: viewModeIsCanvasOnly(this.currentMode),
      },
      (block, position) => {
        this.setInsertBlockPosition(position, true);
        editInsertBlock(this.getEditContext(), block.html, position);
      }
    );
  }

  private openLinkDialog(): void {
    const cm = this.cmView;
    const defaultText = cm
      ? cm.state.sliceDoc(cm.state.selection.main.from, cm.state.selection.main.to)
      : "";
    openInsertLinkModal(this.app, this.file, defaultText, (result) => {
      editInsertLinkAdvanced(this.getEditContext(), result);
    });
  }

  private openMediaDialog(): void {
    openInsertMediaModal(this.app, this.file, (result) => {
      editInsertHtmlSnippet(this.getEditContext(), result.html);
    });
  }

  private openDocumentMediaList(): void {
    openDocumentMediaModal(
      this.app,
      this.file,
      () => this.data ?? "",
      (src) => {
        if (viewModeIsCanvasOnly(this.currentMode)) {
          new Notice("画布模式不显示源码。请切换到 Split 或 Source 后在左侧查找。");
          return;
        }
        if (this.currentMode === ViewMode.Preview) this.switchMode(ViewMode.Split);
        if (this.cmView && !cmFindAndSelect(this.cmView, src)) {
          new Notice("源码中未找到该路径");
        }
      }
    );
  }

  switchMode(mode: ViewMode): void {
    this.currentMode = mode;
    this.updateContentMode();
    this.buildToolbar();

    this.resizeHandle.style.display = mode === ViewMode.Split ? "" : "none";

    if (viewModeShowsPreview(mode)) {
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
      !viewModeShowsPreview(this.currentMode)
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

    let withLineTracking = this.injectLineTracking(
      htmlToRender,
      resolvePreviewInteractionMode(this.plugin.settings)
    );

    if (this.file) {
      const baseHref = getPreviewBaseHref(this.app, this.file);
      if (baseHref) {
        withLineTracking = injectPreviewBaseTag(withLineTracking, baseHref);
      }
    }

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
    html = html.replace(/\s*data-he-proto="[^"]*"/gi, "");
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
    if (viewModeIsCanvasOnly(this.currentMode)) return;
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
    if (viewModeShowsPreview(this.currentMode)) {
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
