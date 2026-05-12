import { App, PluginSettingTab, Setting } from "obsidian";
import { ViewMode } from "./constants";
import type HtmlEditorPlugin from "./main";

export interface HtmlEditorSettings {
  defaultMode: ViewMode;
  allowScripts: boolean;
  fontSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  autoRefresh: boolean;
  refreshDelay: number;
}

export const DEFAULT_SETTINGS: HtmlEditorSettings = {
  defaultMode: ViewMode.Split,
  allowScripts: true,
  fontSize: 14,
  wordWrap: true,
  lineNumbers: true,
  autoRefresh: true,
  refreshDelay: 500,
};

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
          })
      );

    new Setting(containerEl)
      .setName("Word wrap")
      .setDesc("Enable word wrap in the source editor")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.wordWrap).onChange(async (value) => {
          this.plugin.settings.wordWrap = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Line numbers")
      .setDesc("Show line numbers in the source editor")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.lineNumbers).onChange(async (value) => {
          this.plugin.settings.lineNumbers = value;
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h3", { text: "Preview" });

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
