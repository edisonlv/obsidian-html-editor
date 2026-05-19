export const STYLES = `
.html-editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ── Toolbar ── */
.html-editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
  flex-shrink: 0;
  min-height: 36px;
}

.html-editor-toolbar-edit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 2px 0 4px;
  border-top: 1px solid var(--background-modifier-border);
}

.html-editor-toolbar button.toolbar-edit-btn {
  padding: 2px 8px;
  font-size: 11px;
  min-height: 24px;
}

.html-editor-toolbar button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.html-editor-toolbar button:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.html-editor-toolbar button.is-active {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
}

.html-editor-toolbar .toolbar-separator {
  width: 1px;
  height: 20px;
  background: var(--background-modifier-border);
  margin: 0 4px;
  flex-shrink: 0;
}

.html-editor-toolbar .toolbar-spacer {
  flex: 1;
}

.html-editor-toolbar .toolbar-status {
  font-size: 11px;
  color: var(--text-faint);
  padding: 0 8px;
  white-space: nowrap;
}

.html-editor-toolbar-interaction {
  display: flex;
  align-items: center;
  gap: 4px;
}

.html-editor-toolbar-interaction button {
  min-width: 52px;
}

/* ── Preview inspector bar ── */
.html-editor-inspector {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--background-modifier-border);
  background: var(--background-secondary-alt);
  flex-shrink: 0;
  font-size: 11px;
}

.html-editor-inspector-summary {
  font-weight: 600;
  color: var(--text-normal);
  flex: 0 1 auto;
}

.html-editor-inspector-path {
  flex: 1 1 180px;
  color: var(--text-muted);
  font-family: var(--font-monospace);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.html-editor-inspector-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex-shrink: 0;
}

.html-editor-inspector-actions button {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 4px;
  border: none;
  background: var(--background-modifier-hover);
  color: var(--text-muted);
  cursor: pointer;
}

.html-editor-inspector-actions button:hover {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
}

/* ── Content Area ── */
.html-editor-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.html-editor-content.mode-preview .html-editor-source-pane,
.html-editor-content.mode-preview .html-editor-resize-handle {
  display: none;
}
.html-editor-content.mode-source .html-editor-preview-pane,
.html-editor-content.mode-source .html-editor-resize-handle {
  display: none;
}

/* ── Source Pane (textarea) ── */
.html-editor-source-pane {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.html-editor-editor-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
}

.html-editor-cm-host {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.html-editor-cm-host .cm-editor {
  height: 100%;
}

.html-editor-cm-host .cm-scroller {
  min-height: 100%;
}

/* CodeMirror 选区与主题在 htmlEditorCm.ts 中通过 EditorView.theme 设置 */

/* ── Resize Handle ── */
.html-editor-resize-handle {
  width: 5px;
  cursor: col-resize;
  background: var(--background-modifier-border);
  flex-shrink: 0;
  transition: background 0.15s ease;
}
.html-editor-resize-handle:hover,
.html-editor-resize-handle.is-dragging {
  background: var(--interactive-accent);
}

/* ── Preview Pane ── */
.html-editor-preview-pane {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-width: 0;
  background: var(--background-primary);
  display: flex;
  flex-direction: column;
}

.html-editor-preview-pane iframe {
  flex: 1;
  min-height: 0;
}

.html-editor-preview-pane iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
`;
