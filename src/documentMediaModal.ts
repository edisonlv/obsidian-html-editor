import { App, Modal, Setting, TFile } from "obsidian";
import { extractMediaFromHtml, type DocumentMediaRef } from "./vaultResources";

/** 列出当前 HTML 中的 img/video/audio，便于查看与复制路径 */
export function openDocumentMediaModal(
  app: App,
  htmlFile: TFile | null,
  getHtml: () => string,
  onFindInSource?: (src: string) => void
): void {
  new DocumentMediaModal(app, htmlFile, getHtml, onFindInSource).open();
}

class DocumentMediaModal extends Modal {
  constructor(
    app: App,
    private readonly htmlFile: TFile | null,
    private readonly getHtml: () => string,
    private readonly onFindInSource?: (src: string) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("html-editor-insert-modal");
    this.setTitle("本文媒体");

    const refs = extractMediaFromHtml(this.getHtml());
    if (!refs.length) {
      contentEl.createEl("p", {
        text: "当前 HTML 中未找到 img / video / audio 的 src。",
        cls: "html-editor-modal-hint",
      });
      new Setting(contentEl).addButton((b) => b.setButtonText("关闭").onClick(() => this.close()));
      return;
    }

    contentEl.createEl("p", {
      text: `共 ${refs.length} 处媒体引用。路径相对于当前文件：${this.htmlFile?.path ?? "（未保存）"}`,
      cls: "html-editor-modal-hint",
    });

    const list = contentEl.createDiv("html-editor-media-list");
    refs.forEach((ref, i) => {
      this.renderRef(list, ref, i + 1);
    });

    new Setting(contentEl).addButton((b) => b.setButtonText("关闭").onClick(() => this.close()));
  }

  private renderRef(container: HTMLElement, ref: DocumentMediaRef, index: number): void {
    const row = container.createDiv("html-editor-media-row");
    row.createEl("span", {
      text: `${index}. [${ref.kind}] `,
      cls: "html-editor-media-kind",
    });
    const code = row.createEl("code", { text: ref.src });
    code.addClass("html-editor-media-src");

    new Setting(row)
      .addButton((b) =>
        b.setButtonText("复制路径").onClick(() => {
          void navigator.clipboard.writeText(ref.src);
        })
      )
      .addButton((b) =>
        b
          .setButtonText("在源码中查找")
          .setDisabled(!this.onFindInSource)
          .onClick(() => {
            this.onFindInSource?.(ref.src);
            this.close();
          })
      );
  }
}
