export const VIEW_TYPE_HTML = "html-editor-view";

export enum ViewMode {
  Preview = "preview",
  Source = "source",
  Split = "split",
}

/** 预览区交互模式（互斥，避免点击/拖动/改字冲突） */
export enum PreviewInteractionMode {
  /** 点选元素、悬停高亮、连续点击在同一位置可切换到父级 */
  Select = "select",
  /** designMode 直接改文字 */
  Text = "text",
  /** 拖动块级元素 */
  Drag = "drag",
}

export const SUPPORTED_EXTENSIONS = ["html", "htm"];

export interface PreviewElementInfo {
  line: number;
  tag: string;
  path: string;
  label: string;
  depth: number;
  depthTotal: number;
}
