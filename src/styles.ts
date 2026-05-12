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
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
  flex-shrink: 0;
  min-height: 36px;
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

/* ── Source Pane (CodeMirror) ── */
.html-editor-source-pane {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-width: 0;
}

.html-editor-source-pane .cm-editor {
  height: 100%;
}

.html-editor-source-pane .cm-editor.cm-focused {
  outline: none;
}

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
}

.html-editor-preview-pane iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
`;
