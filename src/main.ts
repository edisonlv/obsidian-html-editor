import { Plugin } from "obsidian";
import { VIEW_TYPE_HTML, SUPPORTED_EXTENSIONS, ViewMode } from "./constants";
import { HtmlView } from "./HtmlView";
import { HtmlEditorSettings, DEFAULT_SETTINGS, HtmlEditorSettingTab } from "./settings";
import { STYLES } from "./styles";

export default class HtmlEditorPlugin extends Plugin {
  settings: HtmlEditorSettings;
  private styleEl: HTMLStyleElement | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.injectStyles();

    this.registerView(VIEW_TYPE_HTML, (leaf) => new HtmlView(leaf, this));
    this.registerExtensions(SUPPORTED_EXTENSIONS, VIEW_TYPE_HTML);
    this.addSettingTab(new HtmlEditorSettingTab(this.app, this));

    this.addCommand({
      id: "toggle-view-mode",
      name: "Toggle view mode (Preview / Source / Split)",
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(HtmlView);
        if (!view) return false;
        if (checking) return true;
        const modes = [ViewMode.Preview, ViewMode.Source, ViewMode.Split];
        const current = (view as any).currentMode as ViewMode;
        const idx = modes.indexOf(current);
        const next = modes[(idx + 1) % modes.length];
        view.switchMode(next);
        return true;
      },
    });

    this.addCommand({
      id: "refresh-preview",
      name: "Refresh HTML preview",
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(HtmlView);
        if (!view) return false;
        if (checking) return true;
        view.refreshPreview();
        return true;
      },
    });

    this.addCommand({
      id: "toggle-scripts",
      name: "Toggle JavaScript execution in preview",
      callback: async () => {
        this.settings.allowScripts = !this.settings.allowScripts;
        await this.saveSettings();
        const view = this.app.workspace.getActiveViewOfType(HtmlView);
        if (view) {
          view.refreshPreview();
        }
      },
    });
  }

  onunload(): void {
    if (this.styleEl) {
      this.styleEl.remove();
    }
  }

  private injectStyles(): void {
    this.styleEl = document.createElement("style");
    this.styleEl.id = "html-editor-styles";
    this.styleEl.textContent = STYLES;
    document.head.appendChild(this.styleEl);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
