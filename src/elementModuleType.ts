/** 预览元素模块类型（与 iframe 内 __heModuleType 逻辑保持一致） */
export function inferElementModuleType(tag: string, className?: string): string {
  const t = tag.toLowerCase();
  const cls = (className ?? "").toLowerCase();

  if (t === "button" || cls.includes("proto-btn") || cls.includes("btn")) return "按钮";
  if (t === "img" || t === "picture" || t === "svg") return "图片";
  if (t === "video" || t === "audio") return "媒体";
  if (/^h[1-6]$/.test(t)) return "标题";
  if (t === "p" || t === "span" || cls.includes("proto-text")) return "文本";
  if (t === "input" || t === "textarea" || t === "select") return "表单";
  if (t === "ul" || t === "ol" || t === "li") return "列表";
  if (t === "table" || t === "tr" || t === "td" || t === "th") return "表格";
  if (t === "a") return cls.includes("btn") ? "按钮" : "链接";
  if (cls.includes("proto-card") || cls.includes("card")) return "卡片";
  if (cls.includes("proto-spacer")) return "留白";
  if (cls.includes("proto-block") || cls.includes("proto-section")) return "容器";
  if (t.includes("motion") || t === "div" || t === "section" || t === "article" || t === "main") {
    return "容器";
  }
  return "元素";
}
