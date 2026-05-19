import { App, FuzzySuggestModal, TFile } from "obsidian";

export interface FilePickerOptions {
  title: string;
  /** 为空则显示全部文件 */
  extensions?: string[];
}

export function pickVaultFile(app: App, options: FilePickerOptions): Promise<TFile | null> {
  return new Promise((resolve) => {
    new VaultFileSuggestModal(app, options, resolve).open();
  });
}

class VaultFileSuggestModal extends FuzzySuggestModal<TFile> {
  private readonly files: TFile[];
  private resolved = false;

  constructor(
    app: App,
    options: FilePickerOptions,
    private readonly finish: (file: TFile | null) => void
  ) {
    super(app);
    this.setPlaceholder(options.title);
    const extSet = options.extensions?.map((e) => e.toLowerCase().replace(/^\./, ""));

    this.files = app.vault
      .getFiles()
      .filter((f) => {
        if (!extSet?.length) return true;
        const ext = f.extension.toLowerCase();
        return extSet.includes(ext);
      })
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  getItems(): TFile[] {
    return this.files;
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    if (!this.resolved) {
      this.resolved = true;
      this.finish(item);
    }
    super.close();
  }

  onClose(): void {
    if (!this.resolved) {
      this.resolved = true;
      this.finish(null);
    }
    super.onClose();
  }
}
