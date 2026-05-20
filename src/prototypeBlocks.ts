/** 原型用 HTML 块模板（插入后需 Refresh 以更新源码映射） */
export interface PrototypeBlock {
  id: string;
  label: string;
  title: string;
  html: string;
}

export const PROTOTYPE_BLOCKS: PrototypeBlock[] = [
  {
    id: "motion.div",
    label: "容器",
    title: "空块（motion.div，与常见原型页一致）",
    html: '<motion.div class="proto-block" style="min-height:48px;padding:12px;border:1px dashed #ccc;">块内容</motion.div>',
  },
  {
    id: "card",
    label: "卡片",
    title: "带圆角与内边距的卡片",
    html: '<motion.div class="proto-card" style="padding:16px;border-radius:8px;background:#f4f4f5;box-shadow:0 1px 3px rgba(0,0,0,.08);"><p style="margin:0;">卡片标题</p><p style="margin:8px 0 0;font-size:13px;opacity:.8;">说明文字</p></motion.div>',
  },
  {
    id: "button",
    label: "按钮",
    title: "按钮元素",
    html: '<button type="button" class="proto-btn" style="padding:8px 16px;border-radius:6px;border:none;background:#6366f1;color:#fff;cursor:pointer;">按钮</button>',
  },
  {
    id: "text",
    label: "文本",
    title: "段落文本块",
    html: '<p class="proto-text" style="margin:0;">新文本段落</p>',
  },
  {
    id: "section",
    label: "分区",
    title: "section 布局区",
    html: '<section class="proto-section" style="padding:20px;margin:8px 0;"><h3 style="margin:0 0 8px;">分区标题</h3><p style="margin:0;">分区内容</p></section>',
  },
  {
    id: "spacer",
    label: "留白",
    title: "固定高度留白",
    html: '<motion.div class="proto-spacer" style="height:24px;" aria-hidden="true"></motion.div>',
  },
];
