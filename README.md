# Obsidian HTML Editor

在 Obsidian 中查看和编辑 HTML 文件的插件。支持实时预览、源码编辑、画布模式与分栏视图；可在预览中点选元素、改文字、原型布局（插块/拖动/设色）。

📖 **[详细使用说明（中文）](docs/使用说明.md)** — 界面布局、交互模式、属性浮层、工具栏与常见问题。

## 功能

- **四种视图**：预览、画布（仅页面）、源码、分栏
- **三种预览交互**（互斥）：选择定位、布局/原型、改文字
- **紧凑工具栏**：默认单行；「工具 ▾」展开编辑与原型按钮
- **属性浮层**：选中元素后在预览右上角显示类型、路径与操作（不占常驻侧栏）
- **实时预览** — 编辑源码时自动刷新，可配置延迟
- **脚本开关** — 可关闭预览内 JavaScript（剥离 `<script>`）
- **可拖拽分栏** — 调整源码与预览宽度
- **主题适配** — 跟随 Obsidian 亮/暗色
- **在浏览器中打开** — 系统浏览器查看当前文件

## 安装

### 手动安装

1. 下载 `main.js`、`manifest.json` 到你的 Obsidian 插件目录：
   ```
   <你的vault>/.obsidian/plugins/obsidian-html-editor/
   ```

2. 在 Obsidian 设置 → 社区插件中启用 "HTML Editor"

### 开发安装

```bash
git clone <repo-url>
cd obsidian-html-editor
npm install
npm run dev
```

然后将插件目录软链接到 Obsidian vault：
```bash
ln -s $(pwd) /path/to/vault/.obsidian/plugins/obsidian-html-editor
```

## 使用（简要）

1. 将 `.html` 或 `.htm` 放入库中，点击打开
2. 顶栏切换 **预览 / 画布 / 源码 / 分栏**，以及 **选择 / 布局 / 改文字**
3. 需要格式化、插块等时点击 **工具 ▾** 展开
4. 在预览中点击元素查看 **属性浮层**（改文字模式用 Alt+单击）
5. 更多说明见 [docs/使用说明.md](docs/使用说明.md)

## 命令

| 命令 | 说明 |
|------|------|
| Toggle view mode | 预览 → 画布 → 源码 → 分栏 循环切换 |
| Refresh HTML preview | 手动刷新预览 |
| HTML Editor: Undo / Redo | 撤销 / 重做 |
| Toggle JavaScript execution in preview | 切换脚本开关 |

## 设置

在 Obsidian 设置 → HTML Editor 中可配置：

- 默认视图模式（含画布）
- 默认预览交互（选择 / 布局 / 改文字）
- 点选后自动定位源码
- 允许脚本、字体、换行、行号
- 自动刷新及延迟

## 开发

```bash
npm run dev    # 监听模式，自动编译
npm run build  # 生产构建
```

## License

MIT
