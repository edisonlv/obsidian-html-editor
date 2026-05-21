import { TextFileView, WorkspaceLeaf, Notice, setIcon } from "obsidian";
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
import { pickVaultFile } from "./filePickerModal";
import { cmFindAndSelect, cmLocateInSource, createHtmlCodeMirror } from "./htmlEditorCm";
import { buildSourceMapScript, injectSourceMarkers } from "./sourceMap";
import { getPreviewBaseHref, injectPreviewBaseTag, vaultRelativePath } from "./vaultResources";
import { buildPreviewInjectedScript } from "./previewScripts";
import { PROTOTYPE_BLOCKS } from "./prototypeBlocks";
import {
  INSERT_POSITION_LABELS,
  modeIsLayout,
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
  private previewWorkspaceEl!: HTMLElement;
  private previewCanvasWrapEl!: HTMLElement;
  private inspectorFloatEl!: HTMLElement;
  private toolbarEl!: HTMLElement;
  private toolbarToolsEl!: HTMLElement;
  private toolsToggleBtn!: HTMLElement;
  private toolsExpanded = false;
  private contentArea!: HTMLElement;
  private resizeHandle!: HTMLElement;
  private statusEl!: HTMLElement;
  private scriptToggleBtn!: HTMLElement;
  private interactionBtns: Partial<Record<PreviewInteractionMode, HTMLElement>> = {};
  private inspectorBar!: HTMLElement;
  private inspectorModuleEl!: HTMLElement;
  private inspectorSummaryEl!: HTMLElement;
  private inspectorMetaEl!: HTMLElement;
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
  
  // NEW Fields for Tabs
  private activeInspectorTab: "structure" | "attr" | "style" | "components" = "structure";
  private inspectorTabBtns: Record<string, HTMLElement> = {};
  private inspectorTabContents: Record<string, HTMLElement> = {};
  private attrIdInput!: HTMLInputElement;
  private attrClassInput!: HTMLInputElement;
  private attrDynamicFieldsContainer!: HTMLElement;
  private styleDisplaySelect!: HTMLSelectElement;
  private styleWidthInput!: HTMLInputElement;
  private styleHeightInput!: HTMLInputElement;
  private styleMarginInput!: HTMLInputElement;
  private stylePaddingInput!: HTMLInputElement;
  private styleCustomListContainer!: HTMLElement;
  private styleCustomNameInput!: HTMLInputElement;
  private styleCustomValueInput!: HTMLInputElement;
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
    this.setupPreviewWorkspace();
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

  private createToolbarBtn(
    parent: HTMLElement,
    options: { icon?: string; text?: string; title?: string; className?: string }
  ): HTMLButtonElement {
    const btn = parent.createEl("button");
    if (options.className) btn.addClass(options.className);
    if (options.title) btn.setAttribute("title", options.title);
    
    if (options.icon) {
      const iconSpan = btn.createSpan({ cls: "html-editor-btn-icon" });
      setIcon(iconSpan, options.icon);
    }
    if (options.text) {
      btn.createSpan({ text: options.text, cls: "html-editor-btn-text" });
    }
    return btn as HTMLButtonElement;
  }

  private buildToolbar(): void {
    this.toolbarEl.empty();
    this.toolbarEl.addClass("html-editor-compact-toolbar");

    const bar = this.toolbarEl.createDiv("html-editor-toolbar-bar");

    const viewSeg = bar.createDiv("html-editor-view-mode-segment");
    const modes: { mode: ViewMode; label: string; icon: string; title?: string }[] = [
      { mode: ViewMode.Preview, label: "预览", icon: "eye", title: "仅预览（可点选定位源码）" },
      { mode: ViewMode.Canvas, label: "画布", icon: "layout", title: "仅页面编辑：不显示源码、不跳转代码" },
      { mode: ViewMode.Source, label: "源码", icon: "code" },
      { mode: ViewMode.Split, label: "分栏", icon: "columns" },
    ];
    for (const { mode, label, icon, title } of modes) {
      const btn = this.createToolbarBtn(viewSeg, {
        icon,
        text: label,
        title,
        className: "html-editor-view-mode-btn"
      });
      if (this.currentMode === mode) btn.addClass("is-active");
      btn.addEventListener("click", () => this.switchMode(mode));
    }

    bar.createDiv("html-editor-toolbar-divider");

    this.buildInteractionToolbar(bar);

    bar.createDiv("html-editor-toolbar-spacer");

    this.toolsToggleBtn = this.createToolbarBtn(bar, {
      icon: "sliders",
      text: "工具 ▾",
      title: "展开或收起编辑与原型工具",
      className: "html-editor-tools-toggle"
    });
    this.toolsToggleBtn.addEventListener("click", () => this.toggleToolsPanel());

    const refreshBtn = this.createToolbarBtn(bar, {
      icon: "refresh-cw",
      text: "刷新",
      title: "刷新预览",
      className: "html-editor-ghost-btn"
    });
    refreshBtn.addEventListener("click", () => this.refreshPreview());

    const openBtn = this.createToolbarBtn(bar, {
      icon: "globe",
      text: "浏览器",
      title: "在系统浏览器中打开",
      className: "html-editor-ghost-btn"
    });
    openBtn.addEventListener("click", () => this.openInBrowser());

    const allowScripts = this.plugin.settings.allowScripts;
    this.scriptToggleBtn = this.createToolbarBtn(bar, {
      icon: "play",
      text: allowScripts ? "JS" : "JS×",
      title: "允许预览内执行脚本",
      className: "html-editor-script-toggle"
    });
    if (allowScripts) {
      this.scriptToggleBtn.addClass("is-active");
    }
    this.scriptToggleBtn.addEventListener("click", async () => {
      this.plugin.settings.allowScripts = !this.plugin.settings.allowScripts;
      await this.plugin.saveSettings();
      const currentAllow = this.plugin.settings.allowScripts;
      const textSpan = this.scriptToggleBtn.querySelector(".html-editor-btn-text");
      if (textSpan) textSpan.textContent = currentAllow ? "JS" : "JS×";
      this.scriptToggleBtn.toggleClass("is-active", currentAllow);
      this.refreshPreview();
    });

    this.statusEl = bar.createDiv("html-editor-toolbar-status");
    this.updateStatus();

    this.toolbarToolsEl = this.toolbarEl.createDiv("html-editor-toolbar-tools");
    const editStrip = this.toolbarToolsEl.createDiv("html-editor-toolbar-tools-strip");
    this.buildEditToolbar(editStrip);
    editStrip.createDiv("html-editor-toolbar-divider is-vertical");
    const protoStrip = this.toolbarToolsEl.createDiv("html-editor-toolbar-tools-strip");
    this.buildPrototypeToolbar(protoStrip);

    this.syncToolsPanelUi();
  }

  private toggleToolsPanel(): void {
    this.toolsExpanded = !this.toolsExpanded;
    this.syncToolsPanelUi();
  }

  private syncToolsPanelUi(): void {
    if (!this.toolbarToolsEl || !this.toolsToggleBtn) return;
    this.toolbarToolsEl.toggleClass("is-expanded", this.toolsExpanded);
    this.toolsToggleBtn.toggleClass("is-active", this.toolsExpanded);
    const textSpan = this.toolsToggleBtn.querySelector(".html-editor-btn-text");
    if (textSpan) textSpan.textContent = this.toolsExpanded ? "工具 ▴" : "工具 ▾";
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

  private buildInteractionToolbar(parent: HTMLElement): void {
    const row = parent.createDiv("html-editor-interaction-segment is-inline");
    const modes: { mode: PreviewInteractionMode; label: string; icon: string; title: string }[] = [
      {
        mode: PreviewInteractionMode.Select,
        label: "选择",
        icon: "mouse-pointer",
        title: "点选与切层、定位源码；不拖动",
      },
      {
        mode: PreviewInteractionMode.Layout,
        label: "布局",
        icon: "grid",
        title: "原型：连点切层 → 选「内/下/上」插入位置 → 插块或拖动",
      },
      {
        mode: PreviewInteractionMode.Text,
        label: "改文字",
        icon: "type",
        title: "在预览中直接编辑文字；Alt+单击可定位左侧源码",
      },
    ];
    this.interactionBtns = {};
    const current = resolvePreviewInteractionMode(this.plugin.settings);
    for (const { mode, label, icon, title } of modes) {
      const btn = this.createToolbarBtn(row, {
        icon,
        text: label,
        title,
        className: "html-editor-interaction-btn"
      });
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

  private setupPreviewWorkspace(): void {
    this.previewWorkspaceEl = this.previewPane.createDiv("html-editor-preview-workspace");
    this.previewCanvasWrapEl = this.previewWorkspaceEl.createDiv(
      "html-editor-preview-canvas-wrap"
    );
    this.buildInspectorFloat();
  }

  private buildInspectorFloat(): void {
    this.inspectorFloatEl = this.previewCanvasWrapEl.createDiv("html-editor-inspector-float");

    const floatHeader = this.inspectorFloatEl.createDiv("html-editor-inspector-float-header");
    floatHeader.createSpan({ text: "元素检查器", cls: "html-editor-inspector-float-label" });
    const closeBtn = floatHeader.createEl("button", { text: "×" });
    closeBtn.addClass("html-editor-inspector-close");
    closeBtn.setAttribute("title", "取消选中并关闭");
    closeBtn.addEventListener("click", () => {
      this.selectedPreview = null;
      this.updateInspectorBar();
      this.postInspectorCmd("clear");
    });

    // ── Build Tabs Header ──
    const tabsContainer = this.inspectorFloatEl.createDiv("html-editor-inspector-tabs");
    const tabModes: Array<{ id: "structure" | "attr" | "style" | "components"; name: string }> = [
      { id: "structure", name: "结构" },
      { id: "attr", name: "属性" },
      { id: "style", name: "样式" },
      { id: "components", name: "组件" },
    ];
    for (const tab of tabModes) {
      const btn = tabsContainer.createEl("button", { text: tab.name });
      btn.addClass("html-editor-inspector-tab-btn");
      btn.addEventListener("click", () => this.switchInspectorTab(tab.id));
      this.inspectorTabBtns[tab.id] = btn;

      const content = this.inspectorFloatEl.createDiv("html-editor-inspector-tab-content");
      this.inspectorTabContents[tab.id] = content;
    }

    // ── Tab 1: 结构 ──
    const structureContent = this.inspectorTabContents["structure"];
    this.inspectorBar = structureContent.createDiv("html-editor-inspector-card");
    const header = this.inspectorBar.createDiv("html-editor-inspector-header");
    this.inspectorModuleEl = header.createDiv("html-editor-inspector-module");
    this.inspectorSummaryEl = header.createDiv("html-editor-inspector-title");
    this.inspectorMetaEl = header.createDiv("html-editor-inspector-meta");

    const pathBlock = this.inspectorBar.createDiv("html-editor-inspector-path-block");
    pathBlock.createDiv({ cls: "html-editor-inspector-path-label", text: "DOM 路径" });
    this.inspectorPathEl = pathBlock.createDiv("html-editor-inspector-path");

    const actions = this.inspectorBar.createDiv("html-editor-inspector-actions");
    this.locateSourceBtn = actions.createEl("button", { text: "定位源码" });
    this.locateSourceBtn.setAttribute(
      "title",
      "在左侧源码中选中该元素的起始标签（画布模式不可用）"
    );
    this.locateSourceBtn.addEventListener("click", () => {
      if (viewModeIsCanvasOnly(this.currentMode)) {
        new Notice("画布模式不显示源码。请切换到分栏或源码模式查看代码。");
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

    const dangerZone = structureContent.createDiv({ attr: { style: "margin-top: 10px;" } });
    const delBtn = dangerZone.createEl("button", { text: "🗑️ 删除此块", cls: "html-editor-inspector-btn html-editor-inspector-btn-danger" });
    delBtn.setAttribute("style", "width: 100%; justify-content: center;");
    delBtn.addEventListener("click", () => {
      if (this.selectedPreview) {
        editDeleteBlock(this.getEditContext());
        this.selectedPreview = null;
        this.updateInspectorBar();
      }
    });

    // ── Tab 2: 属性 ──
    const attrContent = this.inspectorTabContents["attr"];

    const idField = attrContent.createDiv("html-editor-inspector-field");
    idField.createDiv({ text: "ID (唯一标识)", cls: "html-editor-inspector-field-label" });
    this.attrIdInput = idField.createEl("input");
    this.attrIdInput.addClass("html-editor-inspector-input");
    this.attrIdInput.addEventListener("change", () => {
      const val = this.attrIdInput.value.trim();
      this.postPreviewCmd("setAttribute", JSON.stringify({ name: "id", value: val }));
    });

    const classField = attrContent.createDiv("html-editor-inspector-field");
    classField.createDiv({ text: "Class (类名，空格分隔)", cls: "html-editor-inspector-field-label" });
    this.attrClassInput = classField.createEl("input");
    this.attrClassInput.addClass("html-editor-inspector-input");
    this.attrClassInput.addEventListener("change", () => {
      const val = this.attrClassInput.value.trim();
      this.postPreviewCmd("setAttribute", JSON.stringify({ name: "class", value: val }));
    });

    this.attrDynamicFieldsContainer = attrContent.createDiv("html-editor-inspector-dynamic-attrs");

    // ── Tab 3: 样式 ──
    const styleContent = this.inspectorTabContents["style"];

    // Color Preset Swatches
    styleContent.createDiv({ text: "文字颜色", cls: "html-editor-inspector-field-label" });
    const textColorsContainer = styleContent.createDiv("html-editor-inspector-colors");
    const presets = ["", "#000000", "#ffffff", "#4f46e5", "#2563eb", "#059669", "#dc2626", "#d97706", "#f3f4f6"];
    presets.forEach(color => {
      const swatch = textColorsContainer.createEl("button");
      swatch.addClass("html-editor-inspector-color-swatch");
      if (color) {
        swatch.style.backgroundColor = color;
        swatch.setAttribute("title", color);
      } else {
        swatch.style.background = "linear-gradient(45deg, transparent 45%, red 45%, red 55%, transparent 55%)";
        swatch.setAttribute("title", "清除颜色");
      }
      swatch.addEventListener("click", () => {
        this.postPreviewCmd("setStyle", JSON.stringify({ prop: "color", value: color }));
      });
    });

    styleContent.createDiv({ text: "背景颜色", cls: "html-editor-inspector-field-label" });
    const bgColorsContainer = styleContent.createDiv("html-editor-inspector-colors");
    presets.forEach(color => {
      const swatch = bgColorsContainer.createEl("button");
      swatch.addClass("html-editor-inspector-color-swatch");
      if (color) {
        swatch.style.backgroundColor = color;
        swatch.setAttribute("title", color);
      } else {
        swatch.style.background = "linear-gradient(45deg, transparent 45%, red 45%, red 55%, transparent 55%)";
        swatch.setAttribute("title", "清除背景色");
      }
      swatch.addEventListener("click", () => {
        this.postPreviewCmd("setStyle", JSON.stringify({ prop: "background-color", value: color }));
      });
    });

    const displayField = styleContent.createDiv("html-editor-inspector-field");
    displayField.createDiv({ text: "布局模式 (Display)", cls: "html-editor-inspector-field-label" });
    this.styleDisplaySelect = displayField.createEl("select");
    this.styleDisplaySelect.addClass("html-editor-inspector-select");
    const displays = ["", "block", "inline-block", "flex", "grid", "inline", "none"];
    displays.forEach(d => {
      const opt = this.styleDisplaySelect.createEl("option", { text: d || "默认 (无)" });
      opt.value = d;
    });
    this.styleDisplaySelect.addEventListener("change", () => {
      this.postPreviewCmd("setStyle", JSON.stringify({ prop: "display", value: this.styleDisplaySelect.value }));
    });

    const sizeField = styleContent.createDiv("html-editor-inspector-field");
    sizeField.createDiv({ text: "尺寸 (宽 / 高)", cls: "html-editor-inspector-field-label" });
    const sizeRow = sizeField.createDiv("html-editor-inspector-field-row");
    this.styleWidthInput = sizeRow.createEl("input");
    this.styleWidthInput.addClass("html-editor-inspector-input");
    this.styleWidthInput.setAttribute("placeholder", "宽 (e.g. 100%, 200px)");
    this.styleWidthInput.addEventListener("change", () => {
      this.postPreviewCmd("setStyle", JSON.stringify({ prop: "width", value: this.styleWidthInput.value.trim() }));
    });

    this.styleHeightInput = sizeRow.createEl("input");
    this.styleHeightInput.addClass("html-editor-inspector-input");
    this.styleHeightInput.setAttribute("placeholder", "高 (e.g. auto, 150px)");
    this.styleHeightInput.addEventListener("change", () => {
      this.postPreviewCmd("setStyle", JSON.stringify({ prop: "height", value: this.styleHeightInput.value.trim() }));
    });

    const spacingField = styleContent.createDiv("html-editor-inspector-field");
    spacingField.createDiv({ text: "外边距 (Margin) / 内边距 (Padding)", cls: "html-editor-inspector-field-label" });
    const spacingRow = spacingField.createDiv("html-editor-inspector-field-row");
    this.styleMarginInput = spacingRow.createEl("input");
    this.styleMarginInput.addClass("html-editor-inspector-input");
    this.styleMarginInput.setAttribute("placeholder", "Margin (e.g. 12px 0)");
    this.styleMarginInput.addEventListener("change", () => {
      this.postPreviewCmd("setStyle", JSON.stringify({ prop: "margin", value: this.styleMarginInput.value.trim() }));
    });

    this.stylePaddingInput = spacingRow.createEl("input");
    this.stylePaddingInput.addClass("html-editor-inspector-input");
    this.stylePaddingInput.setAttribute("placeholder", "Padding (e.g. 8px 16px)");
    this.stylePaddingInput.addEventListener("change", () => {
      this.postPreviewCmd("setStyle", JSON.stringify({ prop: "padding", value: this.stylePaddingInput.value.trim() }));
    });

    styleContent.createDiv({ text: "自定义样式", cls: "html-editor-inspector-field-label", attr: { style: "margin-top: 8px;" } });
    this.styleCustomListContainer = styleContent.createDiv("html-editor-inspector-style-list");

    const addStyleRow = styleContent.createDiv("html-editor-inspector-field-row");
    addStyleRow.setAttribute("style", "margin-top: 4px;");
    this.styleCustomNameInput = addStyleRow.createEl("input");
    this.styleCustomNameInput.addClass("html-editor-inspector-input");
    this.styleCustomNameInput.setAttribute("placeholder", "属性名 (e.g. border-radius)");
    this.styleCustomValueInput = addStyleRow.createEl("input");
    this.styleCustomValueInput.addClass("html-editor-inspector-input");
    this.styleCustomValueInput.setAttribute("placeholder", "值 (e.g. 8px)");

    const addStyleBtn = addStyleRow.createEl("button", { text: "+", cls: "html-editor-inspector-btn" });
    const doAddStyle = () => {
      const prop = this.styleCustomNameInput.value.trim();
      const value = this.styleCustomValueInput.value.trim();
      if (prop && value) {
        this.postPreviewCmd("setStyle", JSON.stringify({ prop, value }));
        this.styleCustomNameInput.value = "";
        this.styleCustomValueInput.value = "";
      }
    };
    addStyleBtn.addEventListener("click", doAddStyle);
    this.styleCustomValueInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") doAddStyle();
    });

    // ── Tab 4: 组件 ──
    const compContent = this.inspectorTabContents["components"];

    this.insertHintBar = compContent.createDiv("html-editor-insert-card");
    this.insertHintBar.createDiv({
      cls: "html-editor-insert-card-title",
      text: "插入位置",
    });
    const posGroup = this.insertHintBar.createDiv("html-editor-insert-position-group");
    for (const pos of ["inside", "after", "before"] as InsertBlockPosition[]) {
      const meta = INSERT_POSITION_LABELS[pos];
      const btn = posGroup.createEl("button", { text: meta.short });
      btn.setAttribute("title", meta.title);
      btn.addEventListener("click", () => this.setInsertBlockPosition(pos, true));
      this.insertPositionBtns[pos] = btn;
    }
    this.insertHintEl = this.insertHintBar.createDiv("html-editor-insert-hint-text");

    compContent.createDiv({ text: "选择原型块插入", cls: "html-editor-insert-card-title", attr: { style: "margin-top: 12px; margin-bottom: 6px;" } });
    const compGridEl = compContent.createDiv("html-editor-inspector-blocks-grid");
    
    PROTOTYPE_BLOCKS.forEach(block => {
      const btn = compGridEl.createEl("button");
      btn.addClass("html-editor-inspector-block-btn");
      btn.setAttribute("title", block.title);
      btn.createSpan({ text: block.label });
      btn.addEventListener("click", () => {
        if (this.selectedPreview) {
          editInsertBlock(this.getEditContext(), block.html, this.insertBlockPosition);
        }
      });
    });

    this.switchInspectorTab("structure");
    this.updateInspectorBar();
  }

  private switchInspectorTab(tab: "structure" | "attr" | "style" | "components"): void {
    this.activeInspectorTab = tab;
    for (const [t, btn] of Object.entries(this.inspectorTabBtns)) {
      btn.toggleClass("is-active", t === tab);
    }
    for (const [t, content] of Object.entries(this.inspectorTabContents)) {
      content.toggleClass("is-active", t === tab);
    }
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
      attributes: data.attributes || {},
      inlineStyles: data.inlineStyles || {},
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
    if (!this.inspectorFloatEl) return;
    const inPreview = viewModeShowsPreview(this.currentMode);
    const canvas = viewModeIsCanvasOnly(this.currentMode);
    const show = this.selectedPreview !== null && inPreview;

    this.inspectorFloatEl.style.display = show ? "" : "none";
    this.previewCanvasWrapEl?.toggleClass("has-inspector", show);
    if (this.locateSourceBtn) {
      this.locateSourceBtn.style.display = canvas ? "none" : "";
    }

    // Toggle Components Tab visibility
    const isLayoutMode = modeIsLayout(resolvePreviewInteractionMode(this.plugin.settings));
    if (this.inspectorTabBtns["components"]) {
      this.inspectorTabBtns["components"].style.display = isLayoutMode ? "" : "none";
    }
    if (!isLayoutMode && this.activeInspectorTab === "components") {
      this.switchInspectorTab("structure");
    }

    this.updateInsertHintBar();
    if (!show || !this.selectedPreview) return;
    
    const s = this.selectedPreview;
    
    // Tab 1: Structure Update
    const meta = canvas
      ? `层级 ${s.depth + 1} / ${s.depthTotal}`
      : `源码第 ${s.line > 0 ? s.line : "?"} 行 · 层级 ${s.depth + 1} / ${s.depthTotal}`;
    const path = s.path || s.label;
    this.inspectorModuleEl.setText(s.moduleType);
    this.inspectorSummaryEl.setText(s.label);
    this.inspectorMetaEl.setText(meta);
    this.inspectorPathEl.setText(path);
    this.inspectorSummaryEl.setAttr("title", s.label);
    this.inspectorMetaEl.setAttr("title", meta);
    this.inspectorPathEl.setAttr("title", path);

    // Tab 2: Attributes Update
    const attrs = s.attributes || {};
    this.attrIdInput.value = attrs.id || "";
    this.attrClassInput.value = attrs.class || "";

    this.attrDynamicFieldsContainer.empty();
    const tag = s.tag.toLowerCase();
    if (["img", "video", "audio", "iframe", "source"].includes(tag)) {
      const field = this.attrDynamicFieldsContainer.createDiv("html-editor-inspector-field");
      field.createDiv({ text: "资源路径 (src)", cls: "html-editor-inspector-field-label" });
      const row = field.createDiv("html-editor-inspector-field-row");
      const srcInput = row.createEl("input");
      srcInput.addClass("html-editor-inspector-input");
      srcInput.value = attrs.src || "";
      srcInput.addEventListener("change", () => {
        this.postPreviewCmd("setAttribute", JSON.stringify({ name: "src", value: srcInput.value.trim() }));
      });
      
      const browseBtn = row.createEl("button", { text: "📂 浏览", cls: "html-editor-inspector-btn" });
      browseBtn.addEventListener("click", async () => {
        const file = await pickVaultFile(this.app, {
          title: "选择媒体资源",
          extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "mp4", "webm", "mp3", "wav", "m4a", "html"],
        });
        if (file) {
          const relPath = this.file ? vaultRelativePath(this.file.path, file.path) : file.path;
          this.postPreviewCmd("setAttribute", JSON.stringify({ name: "src", value: relPath }));
        }
      });
    } else if (tag === "a") {
      const field = this.attrDynamicFieldsContainer.createDiv("html-editor-inspector-field");
      field.createDiv({ text: "链接地址 (href)", cls: "html-editor-inspector-field-label" });
      const row = field.createDiv("html-editor-inspector-field-row");
      const hrefInput = row.createEl("input");
      hrefInput.addClass("html-editor-inspector-input");
      hrefInput.value = attrs.href || "";
      hrefInput.addEventListener("change", () => {
        this.postPreviewCmd("setAttribute", JSON.stringify({ name: "href", value: hrefInput.value.trim() }));
      });

      const browseBtn = row.createEl("button", { text: "📂 浏览", cls: "html-editor-inspector-btn" });
      browseBtn.addEventListener("click", async () => {
        const file = await pickVaultFile(this.app, {
          title: "选择跳转链接文件",
          extensions: ["html", "htm", "md", "pdf"],
        });
        if (file) {
          const relPath = this.file ? vaultRelativePath(this.file.path, file.path) : file.path;
          this.postPreviewCmd("setAttribute", JSON.stringify({ name: "href", value: relPath }));
        }
      });

      const targetField = this.attrDynamicFieldsContainer.createDiv("html-editor-inspector-field-row");
      targetField.setAttribute("style", "margin-top: 6px;");
      const targetCheck = targetField.createEl("input");
      targetCheck.type = "checkbox";
      targetCheck.id = "he-attr-target-blank";
      targetCheck.checked = attrs.target === "_blank";
      const targetLabel = targetField.createEl("label", { text: "在新窗口打开链接 (target=\"_blank\")" });
      targetLabel.setAttribute("for", "he-attr-target-blank");
      
      targetCheck.addEventListener("change", () => {
        this.postPreviewCmd("setAttribute", JSON.stringify({ 
          name: "target", 
          value: targetCheck.checked ? "_blank" : "" 
        }));
      });
    }

    // Tab 3: Styles Update
    const styles = s.inlineStyles || {};
    this.styleDisplaySelect.value = styles.display || "";
    this.styleWidthInput.value = styles.width || "";
    this.styleHeightInput.value = styles.height || "";
    this.styleMarginInput.value = styles.margin || "";
    this.stylePaddingInput.value = styles.padding || "";

    this.styleCustomListContainer.empty();
    const staticStyles = ["display", "width", "height", "margin", "padding", "color", "background-color"];
    let customStylesCount = 0;
    for (const [propName, propValue] of Object.entries(styles)) {
      if (staticStyles.includes(propName)) continue;
      customStylesCount++;
      const item = this.styleCustomListContainer.createDiv("html-editor-inspector-style-item");
      const textSpan = item.createSpan();
      textSpan.setText(`${propName}: ${propValue}`);
      textSpan.setAttribute("title", `${propName}: ${propValue}`);
      
      const delBtn = item.createEl("button", { text: "×", cls: "html-editor-inspector-style-del" });
      delBtn.setAttribute("title", "删除此样式");
      delBtn.addEventListener("click", () => {
        this.postPreviewCmd("setStyle", JSON.stringify({ prop: propName, value: "" }));
      });
    }
    if (customStylesCount === 0) {
      this.styleCustomListContainer.createDiv({ 
        text: "暂无自定义样式", 
        attr: { style: "font-size: 10px; color: var(--text-faint); text-align: center; padding: 12px 0;" }
      });
    }
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

    const addIconOnly = (group: HTMLElement, icon: string, title: string, run: () => void, className?: string) => {
      const btn = group.createEl("button");
      btn.addClass("toolbar-edit-btn");
      if (className) btn.addClass(className);
      btn.setAttribute("title", title);
      const iconSpan = btn.createSpan({ cls: "html-editor-btn-icon" });
      setIcon(iconSpan, icon);
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

    const addIconText = (group: HTMLElement, icon: string, label: string, title: string, run: () => void) => {
      const btn = group.createEl("button");
      btn.addClass("toolbar-edit-btn");
      btn.setAttribute("title", title);
      const iconSpan = btn.createSpan({ cls: "html-editor-btn-icon" });
      setIcon(iconSpan, icon);
      btn.createSpan({ text: label, cls: "html-editor-btn-text" });
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          run();
        } catch (err) {
          console.error("[obsidian-html-editor] toolbar action failed:", err);
        }
      });
    };

    // Group 1: History
    const gHistory = parent.createDiv("html-editor-tool-group");
    addIconOnly(gHistory, "undo", "撤销（Ctrl+Z）", () => editUndo(ctx()));
    addIconOnly(gHistory, "redo", "重做（Ctrl+Shift+Z）", () => editRedo(ctx()));

    // Group 2: Inline Styles
    const gStyles = parent.createDiv("html-editor-tool-group");
    addIconOnly(gStyles, "bold", "粗体", () => editBold(ctx()));
    addIconOnly(gStyles, "italic", "斜体", () => editItalic(ctx()));
    addIconOnly(gStyles, "underline", "下划线", () => editUnderline(ctx()));
    addIconOnly(gStyles, "strikethrough", "删除线", () => editStrike(ctx()));
    addIconOnly(gStyles, "code", "行内代码", () => editInsertCode(ctx()));
    addIconOnly(gStyles, "eraser", "清除行内格式", () => editClearFormat(ctx()));

    // Group 3: Headings & Blocks
    const gBlocks = parent.createDiv("html-editor-tool-group");
    addIconOnly(gBlocks, "heading-1", "标题 H1", () => editInsertH1(ctx()));
    addIconOnly(gBlocks, "heading-2", "标题 H2", () => editInsertH2(ctx()));
    addIconOnly(gBlocks, "heading-3", "标题 H3", () => editInsertH3(ctx()));
    addIconOnly(gBlocks, "pilcrow", "段落 P", () => editInsertP(ctx()));
    addIconOnly(gBlocks, "list", "无序列表 UL", () => editInsertUl(ctx()));
    addIconOnly(gBlocks, "quote", "引用 Blockquote", () => editInsertBlockquote(ctx()));
    addIconOnly(gBlocks, "corner-down-left", "软换行 BR", () => editInsertBr(ctx()));

    // Group 4: Insert Elements (Icon + Text)
    const gInsert = parent.createDiv("html-editor-tool-group");
    addIconText(gInsert, "link", "链接", "插入超链接", () => this.openLinkDialog());
    addIconText(gInsert, "image", "媒体", "插入外部或本地媒体", () => this.openMediaDialog());
    addIconText(gInsert, "images", "本文媒体", "查看并管理文中已用媒体", () => this.openDocumentMediaList());

    // Group 5: Delete (Icon Only)
    const gDelete = parent.createDiv("html-editor-tool-group");
    addIconOnly(gDelete, "trash-2", "删除当前选中块", () => editDeleteBlock(ctx()), "html-editor-inspector-btn-danger");
  }

  private buildPrototypeToolbar(parent: HTMLElement): void {
    const ctx = () => this.getEditContext();
    const add = (icon: string, label: string, title: string, run: () => void) => {
      const btn = parent.createEl("button");
      btn.addClass("toolbar-edit-btn");
      btn.setAttribute("title", title);
      const iconSpan = btn.createSpan({ cls: "html-editor-btn-icon" });
      setIcon(iconSpan, icon);
      btn.createSpan({ text: label, cls: "html-editor-btn-text" });
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

    const gProto = parent.createDiv("html-editor-tool-group");
    add("baseline", "字色", "设置选中元素或选区文字颜色", () => {
      this.cancelPreviewDrag();
      openColorPickerModal(this.app, { title: "文字颜色", initial: "#333333" }, (hex) => {
        editSetStyleOnTarget(ctx(), "color", hex);
      });
    });
    add("palette", "底色", "设置选中元素背景色", () => {
      this.cancelPreviewDrag();
      openColorPickerModal(this.app, { title: "背景颜色", initial: "#f3f4f6" }, (hex) => {
        editSetStyleOnTarget(ctx(), "backgroundColor", hex);
      });
    });
    add("plus-circle", "插块…", "选择插入位置与块类型（需先在预览中选中元素）", () => {
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
    this.updateInspectorBar();

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

    const frameParent = this.previewCanvasWrapEl ?? this.previewPane;
    this.previewFrame = frameParent.createEl("iframe", {
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
