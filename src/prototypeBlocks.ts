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
    html: '<motion.div class="proto-block" style="min-height:48px;padding:12px;border:1px dashed #ccc;margin:8px 0;">块内容</motion.div>',
  },
  {
    id: "grid2",
    label: "双栏",
    title: "双栏并排布局容器",
    html: '<motion.div class="proto-block" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 0;"><motion.div style="min-height:48px;border:1px dashed #ccc;padding:12px;">左栏</motion.div><motion.div style="min-height:48px;border:1px dashed #ccc;padding:12px;">右栏</motion.div></motion.div>',
  },
  {
    id: "grid3",
    label: "三栏",
    title: "三栏并排布局容器",
    html: '<motion.div class="proto-block" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:12px 0;"><motion.div style="min-height:48px;border:1px dashed #ccc;padding:8px;">栏 1</motion.div><motion.div style="min-height:48px;border:1px dashed #ccc;padding:8px;">栏 2</motion.div><motion.div style="min-height:48px;border:1px dashed #ccc;padding:8px;">栏 3</motion.div></motion.div>',
  },
  {
    id: "card",
    label: "卡片",
    title: "带圆角与内边距的卡片",
    html: '<motion.div class="proto-card" style="padding:16px;border-radius:8px;background:#f4f4f5;border:1px solid #e4e4e7;box-shadow:0 1px 3px rgba(0,0,0,.05);margin:12px 0;"><p style="margin:0;font-weight:600;">卡片标题</p><p style="margin:8px 0 0;font-size:13px;opacity:.8;">说明文字</p></motion.div>',
  },
  {
    id: "alert_info",
    label: "提示框",
    title: "带蓝色边框的提示信息框",
    html: '<motion.div class="proto-alert" style="padding:12px 16px;border-left:4px solid #3b82f6;background:#eff6ff;border-radius:0 8px 8px 0;margin:12px 0;"><p style="margin:0;font-weight:600;color:#1e3a8a;">提示</p><p style="margin:4px 0 0;font-size:13px;color:#1e40af;line-height:1.4;">这是一个提示说明框。</p></motion.div>',
  },
  {
    id: "alert_warn",
    label: "警告框",
    title: "带橙色边框的警告框",
    html: '<motion.div class="proto-alert" style="padding:12px 16px;border-left:4px solid #f59e0b;background:#fffbeb;border-radius:0 8px 8px 0;margin:12px 0;"><p style="margin:0;font-weight:600;color:#78350f;">警告</p><p style="margin:4px 0 0;font-size:13px;color:#78350f;line-height:1.4;">请注意：这是一个警告信息。</p></motion.div>',
  },
  {
    id: "button",
    label: "按钮",
    title: "按钮元素",
    html: '<button type="button" class="proto-btn" style="padding:8px 16px;border-radius:6px;border:none;background:#6366f1;color:#fff;cursor:pointer;font-weight:500;">按钮</button>',
  },
  {
    id: "badge",
    label: "标签",
    title: "徽章式小标签",
    html: '<span class="proto-tag" style="display:inline-block;padding:2px 8px;font-size:11px;font-weight:600;border-radius:999px;background:#e0e7ff;color:#4f46e5;margin-right:4px;">标签</span>',
  },
  {
    id: "text",
    label: "文本",
    title: "段落文本块",
    html: '<p class="proto-text" style="margin:8px 0;line-height:1.5;">新文本段落</p>',
  },
  {
    id: "section",
    label: "分区",
    title: "section 布局区",
    html: '<section class="proto-section" style="padding:24px 20px;border-top:1px solid #e4e4e7;border-bottom:1px solid #e4e4e7;margin:16px 0;"><h3 style="margin:0 0 8px;font-size:16px;">分区标题</h3><p style="margin:0;font-size:14px;color:#4b5563;">分区内容描述文字。</p></section>',
  },
  {
    id: "table",
    label: "表格",
    title: "简易原型数据表",
    html: '<table class="proto-table" style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;"><thead style="background:#f4f4f5;"><tr><th style="border:1px solid #e4e4e7;padding:8px;text-align:left;font-weight:600;">表头 1</th><th style="border:1px solid #e4e4e7;padding:8px;text-align:left;font-weight:600;">表头 2</th></tr></thead><tbody><tr><td style="border:1px solid #e4e4e7;padding:8px;">内容 A</td><td style="border:1px solid #e4e4e7;padding:8px;">内容 B</td></tr></tbody></table>',
  },
  {
    id: "spacer",
    label: "留白",
    title: "固定高度留白",
    html: '<motion.div class="proto-spacer" style="height:24px;" aria-hidden="true"></motion.div>',
  },
  {
    id: "divider",
    label: "分割线",
    title: "水平分割线",
    html: '<hr class="proto-divider" style="border:0;height:1px;background:#e4e4e7;margin:24px 0;" />',
  },
];
