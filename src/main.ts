import { Notice, Plugin } from "obsidian";
import { VIEW_TYPE_HTML, SUPPORTED_EXTENSIONS, ViewMode } from "./constants";
import { HtmlView } from "./HtmlView";
import {
  HtmlEditorSettings,
  HtmlEditorSettingTab,
  sanitizeHtmlEditorSettings,
} from "./settings";
import { STYLES } from "./styles";

export default class HtmlEditorPlugin extends Plugin {
  settings!: HtmlEditorSettings;
  private styleEl: HTMLStyleElement | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.injectStyles();

    this.app.workspace.onLayoutReady(() => {
      this.registerView(VIEW_TYPE_HTML, (leaf) => new HtmlView(leaf, this));
      try {
        this.registerExtensions(SUPPORTED_EXTENSIONS, VIEW_TYPE_HTML);
      } catch (e) {
        console.error("[obsidian-html-editor] registerExtensions failed:", e);
        new Notice(
          "HTML Editor：无法注册 .html/.htm（可能与其它插件冲突）。请查看控制台日志；仍可尝试从命令面板使用本插件相关命令。"
        );
      }
      this.addSettingTab(new HtmlEditorSettingTab(this.app, this));
      this.registerCommands();
    });
  }

  private registerCommands(): void {
    this.addCommand({
      id: "toggle-view-mode",
      name: "Toggle view mode (Preview / Canvas / Source / Split)",
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(HtmlView);
        if (!view) return false;
        if (checking) return true;
        const modes = [
          ViewMode.Preview,
          ViewMode.Canvas,
          ViewMode.Source,
          ViewMode.Split,
        ];
        const current = view.currentMode;
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
      id: "undo",
      name: "HTML Editor: Undo",
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(HtmlView);
        if (!view) return false;
        if (checking) return true;
        view.performUndo();
        return true;
      },
    });

    this.addCommand({
      id: "redo",
      name: "HTML Editor: Redo",
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(HtmlView);
        if (!view) return false;
        if (checking) return true;
        view.performRedo();
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
    let raw: unknown;
    try {
      raw = await this.loadData();
    } catch (e) {
      console.error("[obsidian-html-editor] loadData failed, using defaults:", e);
      raw = undefined;
    }
    this.settings = sanitizeHtmlEditorSettings(raw ?? {});
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** 所有已打开的 HTML 视图重建源码区（行号开关等） */
  rebuildAllHtmlEditorChrome(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_HTML)) {
      const view = leaf.view;
      if (view instanceof HtmlView) {
        view.rebuildEditorChrome();
      }
    }
  }
}
