import { App, Modal, Setting } from "obsidian";
import {
  INSERT_POSITION_LABELS,
  type InsertBlockPosition,
  type PreviewElementInfo,
} from "./constants";
import { PROTOTYPE_BLOCKS, type PrototypeBlock } from "./prototypeBlocks";

export interface InsertBlockModalOptions {
  selection: PreviewElementInfo;
  position: InsertBlockPosition;
  /** 画布模式：不强调源码行号 */
  canvasOnly?: boolean;
}

export function openInsertBlockModal(
  app: App,
  options: InsertBlockModalOptions,
  onSubmit: (block: PrototypeBlock, position: InsertBlockPosition) => void
): void {
  try {
    new InsertBlockModal(app, options, onSubmit).open();
  } catch (e) {
    console.error("[obsidian-html-editor] openInsertBlockModal failed:", e);
  }
}

class InsertBlockModal extends Modal {
  private position: InsertBlockPosition;

  constructor(
    app: App,
    private readonly options: InsertBlockModalOptions,
    private readonly onSubmit: (block: PrototypeBlock, position: InsertBlockPosition) => void
  ) {
    super(app);
    this.position = options.position;
    this.setTitle("插入原型块");
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("html-editor-insert-modal");

    const s = this.options.selection;
    const target = s.label || s.tag;
    const canvas = this.options.canvasOnly === true;

    const ctx = contentEl.createDiv("html-editor-insert-block-context");
    ctx.createEl("div", {
      cls: "html-editor-insert-block-context-title",
      text: "当前选中",
    });
    ctx.createEl("div", {
      cls: "html-editor-insert-block-target",
      text: canvas
        ? `【${s.moduleType ?? "元素"}】 ${target} · 层 ${s.depth + 1}/${s.depthTotal}`
        : `【${s.moduleType ?? "元素"}】 ${target} · 源码第 ${s.line > 0 ? s.line : "?"} 行 · 层 ${s.depth + 1}/${s.depthTotal}`,
    });
    if (s.path) {
      ctx.createEl("div", {
        cls: "html-editor-insert-block-path",
        text: s.path,
        attr: { title: s.path },
      });
    }

    const hintEl = contentEl.createDiv("html-editor-insert-block-hint");
    const refreshHint = () => {
      hintEl.setText(INSERT_POSITION_LABELS[this.position].hint(target));
    };
    refreshHint();

    new Setting(contentEl)
      .setName("插入位置")
      .setDesc("相对当前选中元素；预览区会用绿色示意插入位置")
      .addDropdown((d) =>
        d
          .addOption("inside", "内部末尾（子元素）")
          .addOption("after", "下方（同级在后）")
          .addOption("before", "上方（同级在前）")
          .setValue(this.position)
          .onChange((v) => {
            this.position = v as InsertBlockPosition;
            refreshHint();
          })
      );

    contentEl.createEl("div", {
      cls: "html-editor-insert-block-grid-label",
      text: "选择块类型",
    });

    const grid = contentEl.createDiv("html-editor-insert-block-grid");
    for (const block of PROTOTYPE_BLOCKS) {
      const btn = grid.createEl("button", { text: block.label });
      btn.setAttr("title", block.title);
      btn.addEventListener("click", () => {
        this.onSubmit(block, this.position);
        this.close();
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
