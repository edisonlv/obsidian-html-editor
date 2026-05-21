export const STYLES = `
.html-editor-container {
  --he-radius-sm: 6px;
  --he-radius: 10px;
  --he-radius-lg: 14px;
  --he-panel: var(--background-secondary);
  --he-panel-border: var(--background-modifier-border);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--background-primary);
}

/* ── Compact toolbar（默认单行，工具可折叠） ── */
.html-editor-toolbar,
.html-editor-compact-toolbar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-bottom: 1px solid var(--he-panel-border);
  background: var(--background-secondary);
}

.html-editor-toolbar-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  min-height: 34px;
  flex-wrap: wrap;
}

.html-editor-toolbar-spacer {
  flex: 1;
  min-width: 8px;
}

.html-editor-toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--he-panel-border);
  flex-shrink: 0;
  margin: 0 2px;
}

.html-editor-toolbar-divider.is-inline {
  height: 16px;
  align-self: center;
}

.html-editor-toolbar-divider.is-vertical {
  width: 100%;
  height: 1px;
  margin: 2px 0;
}

.html-editor-view-mode-segment {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  gap: 1px;
  border-radius: 999px;
  border: 1px solid var(--he-panel-border);
  background: var(--background-primary);
  flex-shrink: 0;
}

.html-editor-interaction-segment.is-inline {
  display: inline-flex;
  flex-direction: row;
  gap: 2px;
  flex-shrink: 0;
}

.html-editor-toolbar-tools {
  display: none;
  flex-direction: column;
  gap: 4px;
  padding: 4px 8px 6px;
  border-top: 1px solid color-mix(in srgb, var(--he-panel-border) 80%, transparent);
  max-height: 96px;
  overflow-y: auto;
  background: color-mix(in srgb, var(--background-primary) 50%, var(--background-secondary));
}

.html-editor-toolbar-tools.is-expanded {
  display: flex;
}

.html-editor-toolbar-tools-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
}

.html-editor-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border: 1px solid transparent;
  border-radius: var(--he-radius-sm);
  background: color-mix(in srgb, var(--background-primary) 50%, transparent);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.html-editor-toolbar button:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
  border-color: var(--he-panel-border);
}

.html-editor-toolbar button.is-active {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}

.html-editor-view-mode-segment button {
  min-width: 40px;
  border-radius: 999px;
  padding: 4px 10px;
  background: transparent;
  border-color: transparent;
  font-size: 11px;
}

.html-editor-view-mode-segment button:hover {
  background: var(--background-modifier-hover);
}

.html-editor-interaction-segment.is-inline button {
  min-width: 44px;
  padding: 4px 8px;
  font-size: 11px;
}

.html-editor-toolbar button.toolbar-edit-btn {
  padding: 3px 7px;
  font-size: 10px;
  min-height: 24px;
}

.html-editor-tools-toggle,
.html-editor-ghost-btn,
.html-editor-script-toggle {
  min-height: 26px;
  padding: 4px 8px;
  font-size: 11px;
}

.html-editor-toolbar-status {
  font-size: 10px;
  color: var(--text-muted);
  padding: 5px 10px;
  border: 1px solid var(--he-panel-border);
  border-radius: 999px;
  background: var(--background-primary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.html-editor-modal-input {
  width: 100%;
  min-width: 220px;
}

.html-editor-modal-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0 0 8px;
}

.html-editor-media-list {
  max-height: 320px;
  overflow-y: auto;
  margin-bottom: 8px;
}

.html-editor-media-row {
  padding: 8px 0;
  border-bottom: 1px solid var(--background-modifier-border);
}

.html-editor-media-row code.html-editor-media-src {
  font-size: 11px;
  word-break: break-all;
  display: block;
  margin: 4px 0;
}

.html-editor-media-kind {
  font-size: 11px;
  color: var(--text-accent);
  font-weight: 600;
}

.html-editor-color-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.html-editor-color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--he-panel-border);
  cursor: pointer;
  padding: 0;
}

.html-editor-color-swatch:hover {
  transform: scale(1.06);
}

.html-editor-color-native-wrap input[type="color"] {
  width: 100%;
  height: 32px;
  border: none;
  cursor: pointer;
}

/* ── Preview：画布占满，属性浮层仅选中时出现 ── */
.html-editor-preview-pane {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-width: 0;
  background: var(--background-primary);
  display: flex;
  flex-direction: column;
}

.html-editor-preview-workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.html-editor-preview-canvas-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 6px;
  background: color-mix(in srgb, var(--background-primary) 96%, var(--background-secondary));
}

.html-editor-preview-canvas-wrap iframe {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  border: 1px solid var(--he-panel-border);
  border-radius: var(--he-radius-sm);
  display: block;
  background: white;
  box-shadow: none;
}

.html-editor-inspector-float {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 99;
  width: min(300px, calc(100% - 20px));
  max-height: calc(100% - 20px);
  overflow-y: auto;
  display: none;
  padding: 10px;
  border-radius: var(--he-radius-lg);
  border: 1px solid var(--he-panel-border);
  background: color-mix(in srgb, var(--background-primary) 72%, transparent);
  backdrop-filter: blur(18px) saturate(120%);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.html-editor-inspector-float-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--he-panel-border) 60%, transparent);
}

.html-editor-inspector-float-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-normal);
}

.html-editor-inspector-close {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
}

.html-editor-inspector-close:hover {
  background: var(--background-modifier-error-hover);
  color: var(--text-on-accent);
}

/* ── Tabs inside Float Inspector ── */
.html-editor-inspector-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid color-mix(in srgb, var(--he-panel-border) 60%, transparent);
  margin: 6px 0 12px;
  padding-bottom: 4px;
}

.html-editor-inspector-tab-btn {
  flex: 1;
  padding: 4px 0;
  font-size: 10px;
  font-weight: 600;
  text-align: center;
  border: none;
  border-radius: var(--he-radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.html-editor-inspector-tab-btn:hover {
  color: var(--text-normal);
  background: var(--background-modifier-hover);
}

.html-editor-inspector-tab-btn.is-active {
  background: var(--background-modifier-hover);
  color: var(--text-accent);
  box-shadow: inset 0 -1.5px 0 var(--interactive-accent);
  border-radius: var(--he-radius-sm) var(--he-radius-sm) 0 0;
}

.html-editor-inspector-tab-content {
  display: none;
}

.html-editor-inspector-tab-content.is-active {
  display: block;
}

/* ── DOM Form Control 美化 ── */
.html-editor-inspector-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.html-editor-inspector-field-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
}

.html-editor-inspector-field-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.html-editor-inspector-input {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  font-size: 11px;
  border: 1px solid var(--he-panel-border);
  border-radius: var(--he-radius-sm);
  background: var(--background-primary);
  color: var(--text-normal);
  transition: border-color 0.15s ease;
}

.html-editor-inspector-input:focus {
  border-color: var(--interactive-accent);
  outline: none;
}

.html-editor-inspector-select {
  width: 100%;
  padding: 4px 6px;
  font-size: 11px;
  border: 1px solid var(--he-panel-border);
  border-radius: var(--he-radius-sm);
  background: var(--background-primary);
  color: var(--text-normal);
}

.html-editor-inspector-btn {
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--he-radius-sm);
  border: 1px solid var(--he-panel-border);
  background: var(--background-secondary);
  color: var(--text-normal);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.12s ease;
}

.html-editor-inspector-btn:hover {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}

.html-editor-inspector-btn-danger {
  background: color-mix(in srgb, var(--text-error) 12%, transparent);
  color: var(--text-error);
  border-color: color-mix(in srgb, var(--text-error) 25%, transparent);
}

.html-editor-inspector-btn-danger:hover {
  background: var(--text-error);
  color: var(--text-on-accent);
  border-color: var(--text-error);
}

/* ── Inline Styles List ── */
.html-editor-inspector-style-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  max-height: 120px;
  overflow-y: auto;
  padding-right: 2px;
  border: 1px solid color-mix(in srgb, var(--he-panel-border) 40%, transparent);
  border-radius: var(--he-radius-sm);
  background: color-mix(in srgb, var(--background-secondary) 30%, transparent);
  padding: 4px;
}

.html-editor-inspector-style-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 6px;
  font-family: var(--font-monospace);
  font-size: 10px;
  border-radius: 4px;
  background: var(--background-primary);
  border: 1px solid var(--he-panel-border);
}

.html-editor-inspector-style-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.html-editor-inspector-style-del {
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.html-editor-inspector-style-del:hover {
  color: var(--text-error);
}

.html-editor-inspector-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.html-editor-inspector-color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid var(--he-panel-border);
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s ease;
}

.html-editor-inspector-color-swatch:hover {
  transform: scale(1.15);
}

/* ── Inline Components Grid ── */
.html-editor-inspector-blocks-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 8px;
}

.html-editor-inspector-block-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 4px;
  font-size: 10px;
  font-weight: 600;
  border-radius: var(--he-radius-sm);
  border: 1px solid var(--he-panel-border);
  background: var(--background-primary);
  color: var(--text-normal);
  cursor: pointer;
  transition: all 0.12s ease;
}

.html-editor-inspector-block-btn:hover {
  border-color: var(--interactive-accent);
  background: var(--background-modifier-hover);
  transform: translateY(-1px);
}

.html-editor-inspector-card {
  padding: 0;
  border: none;
  background: transparent;
}

.html-editor-insert-card {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--he-panel-border) 70%, transparent);
}

.html-editor-inspector-header {
  margin-bottom: 8px;
}

.html-editor-inspector-module {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 999px;
  margin-bottom: 6px;
  color: var(--text-on-accent);
  background: var(--interactive-accent);
}

.html-editor-inspector-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-normal);
  line-height: 1.3;
  word-break: break-word;
}

.html-editor-inspector-meta {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.35;
}

.html-editor-inspector-path-block {
  margin-bottom: 10px;
}

.html-editor-inspector-path-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-faint);
  margin-bottom: 4px;
}

.html-editor-inspector-path {
  font-family: var(--font-monospace);
  font-size: 10px;
  line-height: 1.4;
  color: var(--text-muted);
  padding: 8px;
  border-radius: var(--he-radius-sm);
  background: color-mix(in srgb, var(--background-secondary) 80%, transparent);
  border: 1px solid color-mix(in srgb, var(--he-panel-border) 70%, transparent);
  max-height: 72px;
  overflow: auto;
  word-break: break-all;
  white-space: pre-wrap;
}

.html-editor-inspector-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}

.html-editor-inspector-actions button {
  padding: 6px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--he-radius-sm);
  border: 1px solid var(--he-panel-border);
  background: var(--background-secondary);
  color: var(--text-muted);
  cursor: pointer;
}

.html-editor-inspector-actions button:hover {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}

.html-editor-insert-card-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-normal);
  margin-bottom: 8px;
}

.html-editor-insert-position-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.html-editor-insert-position-group button {
  padding: 6px 4px;
  font-size: 11px;
  font-weight: 700;
  border-radius: var(--he-radius-sm);
  border: 1px solid var(--he-panel-border);
  background: var(--background-secondary);
  color: var(--text-muted);
  cursor: pointer;
}

.html-editor-insert-position-group button.is-active {
  background: color-mix(in srgb, #22c55e 22%, var(--background-primary));
  border-color: color-mix(in srgb, #22c55e 55%, var(--he-panel-border));
  color: var(--text-normal);
}

.html-editor-insert-hint-text {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
  word-break: break-word;
}

.html-editor-insert-block-context {
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: var(--he-radius);
  background: var(--background-secondary);
  border: 1px solid var(--he-panel-border);
}

.html-editor-insert-block-context-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.html-editor-insert-block-target {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-normal);
}

.html-editor-insert-block-path {
  margin-top: 4px;
  font-family: var(--font-monospace);
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.html-editor-insert-block-hint {
  margin: 8px 0 12px;
  padding: 10px 12px;
  border-radius: var(--he-radius-sm);
  background: color-mix(in srgb, #22c55e 12%, transparent);
  border: 1px solid color-mix(in srgb, #22c55e 35%, transparent);
  font-size: 12px;
  color: var(--text-normal);
}

.html-editor-insert-block-grid-label {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-muted);
}

.html-editor-insert-block-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.html-editor-insert-block-grid button {
  padding: 11px 9px;
  border-radius: var(--he-radius-sm);
  border: 1px solid var(--he-panel-border);
  background: var(--background-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
}

.html-editor-insert-block-grid button:hover {
  border-color: var(--interactive-accent);
  background: var(--background-modifier-hover);
}

/* ── Content Area ── */
.html-editor-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
  background: var(--background-primary);
}

.html-editor-content.mode-preview .html-editor-source-pane,
.html-editor-content.mode-preview .html-editor-resize-handle,
.html-editor-content.mode-canvas .html-editor-source-pane,
.html-editor-content.mode-canvas .html-editor-resize-handle {
  display: none;
}
.html-editor-content.mode-source .html-editor-preview-pane,
.html-editor-content.mode-source .html-editor-resize-handle {
  display: none;
}

.html-editor-source-pane {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--background-primary);
  border-right: 1px solid var(--he-panel-border);
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

.html-editor-resize-handle {
  width: 6px;
  cursor: col-resize;
  background: var(--he-panel-border);
  flex-shrink: 0;
  transition: background 0.12s ease;
}
.html-editor-resize-handle:hover,
.html-editor-resize-handle.is-dragging {
  background: var(--interactive-accent);
}

/* ── Button icon styles ── */
.html-editor-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.html-editor-btn-icon svg {
  width: 14px;
  height: 14px;
  stroke-width: 2.2px;
}
.html-editor-btn-text {
  margin-left: 4px;
  pointer-events: none;
}
.html-editor-tool-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: var(--background-primary);
  border: 1px solid var(--he-panel-border);
  border-radius: var(--he-radius-sm);
  padding: 2px;
  margin-right: 4px;
}
.html-editor-tool-group button {
  padding: 4px !important;
  min-width: 24px !important;
  min-height: 24px !important;
  border-radius: 4px !important;
  background: transparent !important;
  border: none !important;
}
.html-editor-tool-group button:hover {
  background: var(--background-modifier-hover) !important;
}
.html-editor-tool-group button.is-active {
  background: var(--interactive-accent) !important;
  color: var(--text-on-accent) !important;
}
`;
