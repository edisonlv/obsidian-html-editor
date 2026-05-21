export const VIEW_TYPE_HTML = "html-editor-view";

export enum ViewMode {
  Preview = "preview",
  Source = "source",
  Split = "split",
  /** 仅页面编辑：全屏预览，不显示源码、不自动定位源码 */
  Canvas = "canvas",
}

export function viewModeShowsPreview(mode: ViewMode): boolean {
  return (
    mode === ViewMode.Preview || mode === ViewMode.Split || mode === ViewMode.Canvas
  );
}

export function viewModeShowsSource(mode: ViewMode): boolean {
  return mode === ViewMode.Source || mode === ViewMode.Split;
}

export function viewModeIsCanvasOnly(mode: ViewMode): boolean {
  return mode === ViewMode.Canvas;
}

/** 预览区交互模式（互斥，避免点击/拖动/改字冲突） */
export enum PreviewInteractionMode {
  /** 点选元素、悬停高亮、连续点击在同一位置可切换到父级 */
  Select = "select",
  /** designMode 直接改文字 */
  Text = "text",
  /** 选择 + 连点切层 + 拖动（原型布局） */
  Layout = "layout",
  /** @deprecated 请用 Layout；读取设置时自动迁移 */
  Drag = "drag",
}

/** 归一化交互模式（旧版「拖动」→ 布局） */
export function normalizePreviewInteractionMode(
  mode: PreviewInteractionMode
): PreviewInteractionMode {
  return mode === PreviewInteractionMode.Drag ? PreviewInteractionMode.Layout : mode;
}

/** 显示元素检查栏（摘要 / 父级 / 下一层） */
export function modeShowsInspector(mode: PreviewInteractionMode): boolean {
  const m = normalizePreviewInteractionMode(mode);
  return m === PreviewInteractionMode.Select || m === PreviewInteractionMode.Layout;
}

/** 布局/原型：点选、切层、拖动、插块、设色 */
export function modeIsLayout(mode: PreviewInteractionMode): boolean {
  return normalizePreviewInteractionMode(mode) === PreviewInteractionMode.Layout;
}

export const SUPPORTED_EXTENSIONS = ["html", "htm"];

export interface PreviewElementInfo {
  line: number;
  tag: string;
  /** 模块类型：按钮、文本、容器等 */
  moduleType: string;
  path: string;
  label: string;
  depth: number;
  depthTotal: number;
  /** 与 injectSourceMarkers 生成的表一致 */
  sourceId?: number;
  /** 源码中起始标签字节范围（含 `<...>`） */
  from?: number;
  to?: number;
  attributes?: Record<string, string>;
  inlineStyles?: Record<string, string>;
}

/** 原型块插入相对当前选中元素的位置 */
export type InsertBlockPosition = "inside" | "after" | "before";

export const INSERT_POSITION_LABELS: Record<
  InsertBlockPosition,
  { short: string; title: string; hint: (target: string) => string }
> = {
  inside: {
    short: "内",
    title: "插入到选中元素内部末尾（作为最后一个子元素）",
    hint: (t) => `新块将出现在「${t}」的内部末尾`,
  },
  after: {
    short: "下",
    title: "插入到选中元素正下方（同级，排在后面）",
    hint: (t) => `新块将紧挨在「${t}」的下方（同级）`,
  },
  before: {
    short: "上",
    title: "插入到选中元素正上方（同级，排在前面）",
    hint: (t) => `新块将紧挨在「${t}」的上方（同级）`,
  },
};

/** 根据标签猜测默认插入位置 */
export function suggestInsertBlockPosition(tag: string): InsertBlockPosition {
  const t = tag.toLowerCase();
  if (/^(div|section|article|main|header|footer|aside|nav|ul|ol|motion\.div)$/.test(t)) {
    return "inside";
  }
  if (/^(p|h[1-6]|button|img|input|span|a|li|label|blockquote)$/.test(t)) {
    return "after";
  }
  return "after";
}
