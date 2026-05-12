# Obsidian HTML Editor

在 Obsidian 中查看和编辑 HTML 文件的插件。支持实时预览、源码编辑和分栏视图。

## 功能

- **三种视图模式**：预览、源码编辑、分栏（编辑 + 实时预览）
- **三级安全模式**：
  - Restricted — 仅允许基础 HTML 标签，过滤所有脚本和样式
  - Balanced — 允许 CSS 样式和 SVG，过滤脚本（推荐）
  - Unrestricted — 允许所有内容包括 JavaScript
- **实时预览** — 编辑时自动刷新预览，可配置延迟
- **可拖拽分栏** — 分栏模式下拖拽分割线调整编辑器和预览的比例
- **主题适配** — 自动适配 Obsidian 亮色/暗色主题
- **快捷键** — Tab 缩进、Ctrl/Cmd+S 保存
- **在浏览器中打开** — 一键在系统默认浏览器中查看

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

## 使用

1. 将 `.html` 或 `.htm` 文件放入你的 Obsidian vault
2. 在文件列表中点击 HTML 文件即可打开
3. 使用顶部工具栏切换视图模式
4. 使用命令面板（Cmd/Ctrl+P）搜索 "HTML Editor" 相关命令

## 命令

| 命令 | 说明 |
|------|------|
| Toggle view mode | 在预览/源码/分栏模式间切换 |
| Refresh HTML preview | 手动刷新预览 |

## 设置

在 Obsidian 设置 → HTML Editor 中可配置：

- 默认视图模式
- 安全级别
- 编辑器字体大小
- 自动换行
- 自动刷新及延迟

## 开发

```bash
npm run dev    # 监听模式，自动编译
npm run build  # 生产构建
```

## License

MIT
