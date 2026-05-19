import { App, PluginSettingTab, Setting } from "obsidian";
import { PreviewInteractionMode, ViewMode } from "./constants";
import type HtmlEditorPlugin from "./main";

export interface HtmlEditorSettings {
  defaultMode: ViewMode;
  allowScripts: boolean;
  /** @deprecated 由 previewInteractionMode 推导，保留以兼容旧 data.json */
  previewEditable: boolean;
  /** @deprecated 由 previewInteractionMode 推导 */
  previewDragMove: boolean;
  previewInteractionMode: PreviewInteractionMode;
  fontSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  autoRefresh: boolean;
  refreshDelay: number;
  /** 预览点选元素后自动在左侧选中对应起始标签 */
  autoLocateOnSelect: boolean;
}

export const DEFAULT_SETTINGS: HtmlEditorSettings = {
  defaultMode: ViewMode.Split,
  allowScripts: true,
  previewEditable: false,
  previewDragMove: false,
  previewInteractionMode: PreviewInteractionMode.Select,
  fontSize: 14,
  wordWrap: true,
  lineNumbers: true,
  autoRefresh: true,
  refreshDelay: 500,
  autoLocateOnSelect: true,
};

export function resolvePreviewInteractionMode(s: HtmlEditorSettings): PreviewInteractionMode {
  return s.previewInteractionMode;
}

export function syncLegacyPreviewFlags(s: HtmlEditorSettings): void {
  const mode = resolvePreviewInteractionMode(s);
  s.previewEditable = mode === PreviewInteractionMode.Text;
  s.previewDragMove = mode === PreviewInteractionMode.Drag;
}

/** 合并并校验设置，避免损坏的 data.json 或非法枚举导致插件 onload 崩溃 */
export function sanitizeHtmlEditorSettings(raw: unknown): HtmlEditorSettings {
  const base =
    typeof raw === "object" && raw !== null
      ? { ...DEFAULT_SETTINGS, ...(raw as Partial<HtmlEditorSettings>) }
      : { ...DEFAULT_SETTINGS };
  const validMode = (m: unknown): m is ViewMode =>
    m === ViewMode.Preview || m === ViewMode.Source || m === ViewMode.Split;
  if (!validMode(base.defaultMode)) base.defaultMode = DEFAULT_SETTINGS.defaultMode;
  if (typeof base.allowScripts !== "boolean") base.allowScripts = DEFAULT_SETTINGS.allowScripts;
  if (typeof base.wordWrap !== "boolean") base.wordWrap = DEFAULT_SETTINGS.wordWrap;
  if (typeof base.lineNumbers !== "boolean") base.lineNumbers = DEFAULT_SETTINGS.lineNumbers;
  if (typeof base.autoRefresh !== "boolean") base.autoRefresh = DEFAULT_SETTINGS.autoRefresh;
  if (typeof base.fontSize !== "number" || !Number.isFinite(base.fontSize)) base.fontSize = DEFAULT_SETTINGS.fontSize;
  base.fontSize = Math.min(48, Math.max(8, Math.round(base.fontSize)));
  if (typeof base.refreshDelay !== "number" || !Number.isFinite(base.refreshDelay)) {
    base.refreshDelay = DEFAULT_SETTINGS.refreshDelay;
  }
  base.refreshDelay = Math.min(5000, Math.max(50, Math.round(base.refreshDelay)));
  if (typeof base.autoLocateOnSelect !== "boolean") {
    base.autoLocateOnSelect = DEFAULT_SETTINGS.autoLocateOnSelect;
  }

  const validInteraction = (m: unknown): m is PreviewInteractionMode =>
    m === PreviewInteractionMode.Select ||
    m === PreviewInteractionMode.Text ||
    m === PreviewInteractionMode.Drag;

  if (!validInteraction(base.previewInteractionMode)) {
    if (typeof base.previewDragMove === "boolean" && base.previewDragMove) {
      base.previewInteractionMode = PreviewInteractionMode.Drag;
    } else if (typeof base.previewEditable === "boolean" && base.previewEditable) {
      base.previewInteractionMode = PreviewInteractionMode.Text;
    } else {
      base.previewInteractionMode = DEFAULT_SETTINGS.previewInteractionMode;
    }
  }
  syncLegacyPreviewFlags(base);
  return base;
}

export class HtmlEditorSettingTab extends PluginSettingTab {
  plugin: HtmlEditorPlugin;

  constructor(app: App, plugin: HtmlEditorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "HTML Editor Settings" });

    new Setting(containerEl)
      .setName("Default view mode")
      .setDesc("Choose how HTML files open by default")
      .addDropdown((dropdown) =>
        dropdown
          .addOption(ViewMode.Preview, "Preview")
          .addOption(ViewMode.Source, "Source Code")
          .addOption(ViewMode.Split, "Split (Editor + Preview)")
          .setValue(this.plugin.settings.defaultMode)
          .onChange(async (value) => {
            this.plugin.settings.defaultMode = value as ViewMode;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Allow scripts")
      .setDesc(
        "When enabled, JavaScript in HTML files will execute in preview. " +
          "When disabled, <script> tags are stripped for safety."
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.allowScripts).onChange(async (value) => {
          this.plugin.settings.allowScripts = value;
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h3", { text: "Editor" });

    new Setting(containerEl)
      .setName("Font size")
      .setDesc("Editor font size in pixels")
      .addSlider((slider) =>
        slider
          .setLimits(10, 24, 1)
          .setValue(this.plugin.settings.fontSize)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.fontSize = value;
            await this.plugin.saveSettings();
            this.plugin.rebuildAllHtmlEditorChrome();
          })
      );

    new Setting(containerEl)
      .setName("Word wrap")
      .setDesc("Enable word wrap in the source editor")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.wordWrap).onChange(async (value) => {
          this.plugin.settings.wordWrap = value;
          await this.plugin.saveSettings();
          this.plugin.rebuildAllHtmlEditorChrome();
        })
      );

    new Setting(containerEl)
      .setName("Line numbers")
      .setDesc("Show line numbers in the source editor")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.lineNumbers).onChange(async (value) => {
          this.plugin.settings.lineNumbers = value;
          await this.plugin.saveSettings();
          this.plugin.rebuildAllHtmlEditorChrome();
        })
      );

    containerEl.createEl("h3", { text: "Preview" });

    new Setting(containerEl)
      .setName("Default preview interaction")
      .setDesc(
        "选择：点选元素并看清层级；改文字：右侧直接编辑；拖动：移动块级元素。三种模式互斥，避免操作冲突。"
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption(PreviewInteractionMode.Select, "选择元素（推荐）")
          .addOption(PreviewInteractionMode.Text, "改文字")
          .addOption(PreviewInteractionMode.Drag, "拖动布局")
          .setValue(this.plugin.settings.previewInteractionMode)
          .onChange(async (value) => {
            this.plugin.settings.previewInteractionMode = value as PreviewInteractionMode;
            syncLegacyPreviewFlags(this.plugin.settings);
            await this.plugin.saveSettings();
            this.plugin.rebuildAllHtmlEditorChrome();
          })
      );

    new Setting(containerEl)
      .setName("Auto locate in source")
      .setDesc(
        "在「选择」模式下单击元素，或在「改文字」模式下 Alt+单击时，自动在左侧源码中选中对应起始标签"
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoLocateOnSelect).onChange(async (value) => {
          this.plugin.settings.autoLocateOnSelect = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Auto refresh")
      .setDesc("Automatically refresh preview when editing source code")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoRefresh).onChange(async (value) => {
          this.plugin.settings.autoRefresh = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Refresh delay")
      .setDesc("Delay in milliseconds before auto-refreshing preview (ms)")
      .addSlider((slider) =>
        slider
          .setLimits(100, 2000, 100)
          .setValue(this.plugin.settings.refreshDelay)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.refreshDelay = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
