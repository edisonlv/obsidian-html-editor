import { App, Modal, Setting } from "obsidian";

const PRESETS = [
  "#000000",
  "#374151",
  "#6366f1",
  "#2563eb",
  "#059669",
  "#dc2626",
  "#d97706",
  "#ffffff",
  "#f3f4f6",
  "#fef3c7",
];

export function openColorPickerModal(
  app: App,
  options: { title: string; initial: string },
  onPick: (hex: string) => void
): void {
  new ColorPickerModal(app, options, onPick).open();
}

class ColorPickerModal extends Modal {
  private value: string;

  constructor(
    app: App,
    private readonly options: { title: string; initial: string },
    private readonly onPick: (hex: string) => void
  ) {
    super(app);
    this.value = options.initial;
    this.setTitle(options.title);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("html-editor-insert-modal");

    const presets = contentEl.createDiv("html-editor-color-presets");
    for (const hex of PRESETS) {
      const swatch = presets.createEl("button", { attr: { type: "button" } });
      swatch.addClass("html-editor-color-swatch");
      swatch.style.backgroundColor = hex;
      swatch.setAttr("title", hex);
      swatch.addEventListener("click", () => {
        this.value = hex;
        this.onPick(hex);
        this.close();
      });
    }

    new Setting(contentEl)
      .setName("自定义颜色")
      .addText((t) =>
        t.setValue(this.value).onChange((v) => {
          this.value = v;
        })
      );

    const pickerWrap = contentEl.createDiv("html-editor-color-native-wrap");
    const input = pickerWrap.createEl("input", { attr: { type: "color" } });
    input.value = this.normalizeHex(this.value);
    input.addEventListener("input", () => {
      this.value = input.value;
    });

    new Setting(contentEl)
      .addButton((b) =>
        b
          .setButtonText("应用")
          .setCta()
          .onClick(() => {
            this.onPick(this.normalizeHex(this.value));
            this.close();
          })
      )
      .addButton((b) => b.setButtonText("取消").onClick(() => this.close()));
  }

  private normalizeHex(v: string): string {
    const t = v.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
    if (/^#[0-9a-fA-F]{3}$/.test(t)) return t;
    return "#333333";
  }
}
