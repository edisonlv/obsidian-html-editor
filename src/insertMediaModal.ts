import { App, Modal, Notice, Setting, TFile } from "obsidian";
import { pickVaultFile } from "./filePickerModal";
import {
  buildMediaHtml,
  type MediaKind,
  mediaKindFromPath,
  resolveMediaSrc,
  vaultRelativePath,
} from "./vaultResources";

export interface InsertMediaResult {
  html: string;
}

export function openInsertMediaModal(
  app: App,
  htmlFile: TFile | null,
  onSubmit: (result: InsertMediaResult) => void
): void {
  try {
    new InsertMediaModal(app, htmlFile, onSubmit).open();
  } catch (e) {
    console.error("[obsidian-html-editor] openInsertMediaModal failed:", e);
  }
}

const MEDIA_PICK_EXT = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "avif",
  "mp4",
  "webm",
  "ogg",
  "mov",
  "mp3",
  "wav",
  "m4a",
];

class InsertMediaModal extends Modal {
  private kind: MediaKind = "image";
  private srcInput = "";
  private altInput = "";
  private widthInput = "";
  private fromVault = false;
  private srcTextComponent: import("obsidian").TextComponent | null = null;

  constructor(
    app: App,
    private readonly htmlFile: TFile | null,
    private readonly onSubmit: (result: InsertMediaResult) => void
  ) {
    super(app);
    this.setTitle("插入媒体");
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("html-editor-insert-modal");

    new Setting(contentEl)
      .setName("媒体类型")
      .addDropdown((d) =>
        d
          .addOption("image", "图片")
          .addOption("video", "视频")
          .addOption("audio", "音频")
          .setValue(this.kind)
          .onChange((v) => {
            this.kind = v as MediaKind;
          })
      );

    new Setting(contentEl)
      .setName("地址")
      .setDesc("https 网址，或库内相对路径")
      .addText((t) => {
        this.srcTextComponent = t;
        t.inputEl.addClass("html-editor-modal-input");
        t.setPlaceholder("https://… 或 attachments/photo.png")
          .setValue(this.srcInput)
          .onChange((v) => {
            this.srcInput = v;
            this.fromVault = false;
          });
      });

    new Setting(contentEl)
      .setName("库内选择")
      .setDesc("从库中挑选图片 / 视频 / 音频文件")
      .addButton((b) =>
        b.setButtonText("浏览库文件…").onClick(() => void this.browse())
      );

    new Setting(contentEl)
      .setName("替代文字 / 说明")
      .addText((t) =>
        t.setValue(this.altInput).onChange((v) => {
          this.altInput = v;
        })
      );

    new Setting(contentEl)
      .setName("宽度（可选）")
      .setDesc("例如 320 或 50%，仅图片/视频")
      .addText((t) =>
        t.setValue(this.widthInput).onChange((v) => {
          this.widthInput = v;
        })
      );

    new Setting(contentEl)
      .addButton((b) =>
        b
          .setButtonText("插入")
          .setCta()
          .onClick(() => {
            const src = resolveMediaSrc(this.kind, this.srcInput, this.htmlFile, this.fromVault);
            if (!src) {
              new Notice("请填写网址或从库中选择文件");
              return;
            }
            const html = buildMediaHtml(this.kind, src, {
              alt: this.altInput,
              title: this.altInput.trim() || undefined,
              width: this.widthInput.trim() || undefined,
              controls: true,
            });
            this.onSubmit({ html });
            this.close();
          })
      )
      .addButton((b) => b.setButtonText("取消").onClick(() => this.close()));
  }

  private async browse(): Promise<void> {
    const file = await pickVaultFile(this.app, {
      title: "选择媒体文件",
      extensions: MEDIA_PICK_EXT,
    });
    if (!file) return;
    const detected = mediaKindFromPath(file.path);
    if (detected) this.kind = detected;
    const rel = this.htmlFile
      ? vaultRelativePath(this.htmlFile.path, file.path)
      : file.path;
    this.srcInput = rel;
    this.fromVault = true;
    this.srcTextComponent?.setValue(rel);
    if (!this.altInput) this.altInput = file.basename;
  }
}
