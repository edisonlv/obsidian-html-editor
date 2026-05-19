import { App, Modal, Setting, TFile } from "obsidian";
import { pickVaultFile } from "./filePickerModal";
import { type LinkKind, resolveLinkHref, vaultRelativePath } from "./vaultResources";

export interface InsertLinkResult {
  href: string;
  text?: string;
  newTab: boolean;
}

export function openInsertLinkModal(
  app: App,
  htmlFile: TFile | null,
  defaultText: string,
  onSubmit: (result: InsertLinkResult) => void
): void {
  try {
    new InsertLinkModal(app, htmlFile, defaultText, onSubmit).open();
  } catch (e) {
    console.error("[obsidian-html-editor] openInsertLinkModal failed:", e);
  }
}

class InsertLinkModal extends Modal {
  private kind: LinkKind = "web";
  private hrefInput = "";
  private textInput: string;
  private newTab = true;
  private hrefTextComponent: import("obsidian").TextComponent | null = null;
  private browseRowEl: HTMLElement | null = null;

  constructor(
    app: App,
    private readonly htmlFile: TFile | null,
    defaultText: string,
    private readonly onSubmit: (result: InsertLinkResult) => void
  ) {
    super(app);
    this.textInput = defaultText;
    this.setTitle("插入链接");
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("html-editor-insert-modal");

    new Setting(contentEl)
      .setName("链接类型")
      .setDesc("网页地址、库内 HTML/文件，或当前页内锚点")
      .addDropdown((d) =>
        d
          .addOption("web", "网页 / 邮箱")
          .addOption("vault", "库内文件")
          .addOption("anchor", "页内锚点 (#id)")
          .setValue(this.kind)
          .onChange((v) => {
            this.kind = v as LinkKind;
            this.syncHrefFieldUi();
          })
      );

    new Setting(contentEl)
      .setName("地址")
      .setDesc(this.hrefDesc())
      .addText((t) => {
        this.hrefTextComponent = t;
        t.inputEl.addClass("html-editor-modal-input");
        t.setPlaceholder(this.placeholder()).setValue(this.hrefInput).onChange((v) => {
          this.hrefInput = v;
        });
      });

    this.browseRowEl = contentEl.createDiv("html-editor-modal-browse-row");
    this.syncHrefFieldUi();

    new Setting(contentEl)
      .setName("显示文字")
      .setDesc("留空则使用选中文字或链接地址")
      .addText((t) =>
        t.setValue(this.textInput).onChange((v) => {
          this.textInput = v;
        })
      );

    new Setting(contentEl)
      .setName("新标签页打开")
      .addToggle((t) =>
        t.setValue(this.newTab).onChange((v) => {
          this.newTab = v;
        })
      );

    new Setting(contentEl)
      .addButton((b) =>
        b
          .setButtonText("插入")
          .setCta()
          .onClick(() => {
            const href = resolveLinkHref(this.kind, this.hrefInput, this.htmlFile);
            if (!href) return;
            this.onSubmit({
              href,
              text: this.textInput.trim() || undefined,
              newTab: this.newTab,
            });
            this.close();
          })
      )
      .addButton((b) => b.setButtonText("取消").onClick(() => this.close()));
  }

  private syncHrefFieldUi(): void {
    if (this.hrefTextComponent) {
      this.hrefTextComponent.setPlaceholder(this.placeholder());
    }
    if (!this.browseRowEl) return;
    this.browseRowEl.empty();
    if (this.kind !== "vault") return;
    new Setting(this.browseRowEl)
      .setName("库内选择")
      .setDesc("从 Obsidian 库中挑选目标文件，自动填入相对路径")
      .addButton((b) =>
        b.setButtonText("浏览库文件…").onClick(() => void this.browseVault())
      );
  }

  private hrefDesc(): string {
    if (this.kind === "web") return "例如 https://example.com 或 example.com";
    if (this.kind === "vault") return "相对路径会写入源码；也可用下方「浏览库文件」";
    return "对应元素 id，例如 section-intro";
  }

  private placeholder(): string {
    if (this.kind === "web") return "https://";
    if (this.kind === "vault") return "notes/other.html";
    return "section-id";
  }

  private async browseVault(): Promise<void> {
    const file = await pickVaultFile(this.app, {
      title: "选择链接目标",
      extensions: ["html", "htm", "md", "pdf", "png", "jpg", "jpeg", "gif", "webp"],
    });
    if (!file) return;
    const href = this.htmlFile
      ? vaultRelativePath(this.htmlFile.path, file.path)
      : file.path;
    this.hrefInput = href;
    this.hrefTextComponent?.setValue(href);
  }
}
