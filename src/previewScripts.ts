import { PreviewInteractionMode } from "./constants";

/** 注入预览 iframe 的脚本（元素检查器 + 可选改字/拖动） */
export function buildPreviewInjectedScript(mode: PreviewInteractionMode): string {
  const isSelect = mode === PreviewInteractionMode.Select;
  const isText = mode === PreviewInteractionMode.Text;
  const isDrag = mode === PreviewInteractionMode.Drag;

  return `
<script data-injected="html-editor">
(function() {
  window.__heMode = ${JSON.stringify(mode)};

  function __heSkipTag(el) {
    if (!el || !el.tagName) return true;
    var t = el.tagName;
    return t === 'HTML' || t === 'BODY' || t === 'HEAD' || t === 'SCRIPT' || t === 'STYLE';
  }

  function __heHasLine(el) {
    return el && el.dataset && (el.dataset.sourceId != null || el.dataset.sourceLine);
  }

  var __heMap = [];
  try {
    var __heMapEl = document.querySelector('script[data-injected="html-editor-map"]');
    if (__heMapEl && __heMapEl.textContent) __heMap = JSON.parse(__heMapEl.textContent);
  } catch (e) { __heMap = []; }

  function __heStackAt(x, y) {
    var list = document.elementsFromPoint(x, y);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (__heSkipTag(el) || !__heHasLine(el)) continue;
      out.push(el);
    }
    return out;
  }

  function __heDescribe(el) {
    var tag = el.tagName.toLowerCase();
    var id = el.id ? '#' + el.id : '';
    var cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.')
      : '';
    return tag + id + cls;
  }

  function __hePath(el) {
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (__heHasLine(cur) && !__heSkipTag(cur)) parts.unshift(__heDescribe(cur));
      cur = cur.parentElement;
    }
    return parts.join(' › ');
  }

  function __heNotifyChanged() {
    window.parent.postMessage({ type: 'html-editor-dom-changed' }, '*');
  }

  function __hePostSelect(el, depth, depthTotal) {
    var sid = el.dataset.sourceId != null ? parseInt(el.dataset.sourceId, 10) : -1;
    var entry = sid >= 0 && __heMap[sid] ? __heMap[sid] : null;
    window.parent.postMessage({
      type: 'html-editor-select',
      line: entry ? entry.line : parseInt(el.dataset.sourceLine, 10),
      sourceId: sid >= 0 ? sid : undefined,
      from: entry ? entry.from : undefined,
      to: entry ? entry.to : undefined,
      tag: el.tagName.toLowerCase(),
      label: __heDescribe(el),
      path: __hePath(el),
      depth: depth,
      depthTotal: depthTotal
    }, '*');
  }

  function __hePickAt(x, y, preferOuter) {
    var stack = __heStackAt(x, y);
    if (!stack.length) return null;
    return preferOuter ? stack[stack.length - 1] : stack[0];
  }

  var hoverEl = null;
  var selectedEl = null;
  var labelEl = null;
  var lastClickX = 0, lastClickY = 0, lastClickT = 0, cycleIdx = 0, lastStack = [];

  var css = document.createElement('style');
  css.textContent = [
    '[data-source-line].html-editor-hover {',
    '  outline: 1px dashed rgba(99, 102, 241, 0.75) !important;',
    '  outline-offset: 2px;',
    '}',
    '[data-source-line].html-editor-selected {',
    '  outline: 2px solid #6366f1 !important;',
    '  outline-offset: 2px;',
    '  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);',
    '}',
    '#html-editor-float-label {',
    '  position: fixed; z-index: 2147483647; pointer-events: none;',
    '  font: 11px/1.3 var(--font-monospace, monospace);',
    '  padding: 2px 6px; border-radius: 4px;',
    '  background: rgba(15, 23, 42, 0.92); color: #e2e8f0;',
    '  border: 1px solid rgba(99, 102, 241, 0.5);',
    '  max-width: 420px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
    '}'
  ].join('\\n');
  document.head.appendChild(css);

  labelEl = document.createElement("div");
  labelEl.id = 'html-editor-float-label';
  labelEl.style.display = 'none';
  document.body.appendChild(labelEl);

  function setHover(el) {
    if (hoverEl && hoverEl !== selectedEl) hoverEl.classList.remove('html-editor-hover');
    hoverEl = el;
    if (el && el !== selectedEl) {
      el.classList.add('html-editor-hover');
      labelEl.textContent = __heDescribe(el) + ' · L' + (el.dataset.sourceLine || '?');
      var r = el.getBoundingClientRect();
      labelEl.style.left = Math.max(4, r.left) + 'px';
      labelEl.style.top = Math.max(4, r.top - 22) + 'px';
      labelEl.style.display = 'block';
    } else if (!selectedEl) {
      labelEl.style.display = 'none';
    }
  }

  function setSelected(el, depth, depthTotal) {
    if (selectedEl) selectedEl.classList.remove('html-editor-selected');
    selectedEl = el;
    if (el) {
      el.classList.add('html-editor-selected');
      __hePostSelect(el, depth, depthTotal);
      labelEl.textContent = __heDescribe(el) + ' · L' + (el.dataset.sourceLine || '?') + ' · 层 ' + (depth + 1) + '/' + depthTotal + ' · 连点切层';
      var r = el.getBoundingClientRect();
      labelEl.style.left = Math.max(4, r.left) + 'px';
      labelEl.style.top = Math.max(4, r.top - 22) + 'px';
      labelEl.style.display = 'block';
    }
  }

  ${isSelect ? `
  document.addEventListener('mousemove', function(e) {
    if (window.__htmlEditorDragging) return;
    var stack = __heStackAt(e.clientX, e.clientY);
    setHover(stack.length ? stack[0] : null);
  }, true);

  document.addEventListener('click', function(e) {
    if (window.__htmlEditorDragging) return;
    var stack = __heStackAt(e.clientX, e.clientY);
    if (!stack.length) return;
    var now = Date.now();
    var sameSpot = Math.abs(e.clientX - lastClickX) < 6 && Math.abs(e.clientY - lastClickY) < 6 && (now - lastClickT) < 600;
    if (e.shiftKey) {
      cycleIdx = stack.length - 1;
    } else if (sameSpot && lastStack.length === stack.length) {
      cycleIdx = (cycleIdx + 1) % stack.length;
    } else {
      cycleIdx = 0;
      lastStack = stack;
    }
    lastClickX = e.clientX;
    lastClickY = e.clientY;
    lastClickT = now;
    var el = stack[cycleIdx];
    e.preventDefault();
    e.stopPropagation();
    setSelected(el, cycleIdx, stack.length);
  }, true);
  ` : ""}

  ${isText ? `
  document.addEventListener('click', function(e) {
    if (!e.altKey || window.__htmlEditorDragging) return;
    var el = __hePickAt(e.clientX, e.clientY, e.shiftKey);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(el, 0, 1);
  }, true);
  ` : ""}

  window.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.data.type === 'html-editor-inspector-cmd' && selectedEl) {
      var cmd = e.data.command;
      if (cmd === 'parent' && selectedEl.parentElement) {
        var p = selectedEl.parentElement;
        while (p && (__heSkipTag(p) || !__heHasLine(p))) p = p.parentElement;
        if (p) setSelected(p, 0, 1);
      }
      if (cmd === 'child') {
        var c = selectedEl.querySelector('[data-source-line]');
        if (c) setSelected(c, 0, 1);
      }
      if (cmd === 'cycle') {
        var stack = __heStackAt(lastClickX, lastClickY);
        if (stack.length) {
          cycleIdx = (cycleIdx + 1) % stack.length;
          setSelected(stack[cycleIdx], cycleIdx, stack.length);
        }
      }
      return;
    }
    ${isText ? `
    if (e.data.type === 'html-editor-cmd') {
      var cmd = e.data.command;
      var val = e.data.value || '';
      var doc = document;
      try {
        if (cmd === 'undo') { doc.execCommand('undo'); __heNotifyChanged(); return; }
        if (cmd === 'redo') { doc.execCommand('redo'); __heNotifyChanged(); return; }
        if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline' || cmd === 'strikeThrough' || cmd === 'removeFormat') {
          doc.execCommand(cmd); __heNotifyChanged(); return;
        }
        if (cmd === 'createLink') { if (val) doc.execCommand('createLink', false, val); __heNotifyChanged(); return; }
        if (cmd === 'insertHTML') { doc.execCommand('insertHTML', false, val); __heNotifyChanged(); return; }
        if (cmd === 'wrapTag') {
          var sel = window.getSelection();
          if (!sel || !sel.rangeCount) return;
          var text = sel.toString() || '文本';
          var open = val.indexOf('|');
          var before = open >= 0 ? val.slice(0, open) : val;
          var after = open >= 0 ? val.slice(open + 1) : '';
          doc.execCommand('insertHTML', false, before + text + after);
          __heNotifyChanged();
          return;
        }
        if (cmd === 'deleteBlock') {
          var sel = window.getSelection();
          var node = sel && sel.rangeCount ? sel.anchorNode : null;
          var block = node ? (node.nodeType === 1 ? node : node.parentElement) : null;
          while (block && block !== document.body && !__heHasLine(block)) block = block.parentElement;
          if (block && block.parentElement) { block.remove(); __heNotifyChanged(); }
          return;
        }
      } catch (err) { console.error('[html-editor]', err); }
    }
    ` : ""}
  });

  ${isDrag ? `
  (function() {
    var TH = 4, dragEl = null, startX = 0, startY = 0, baseX = 0, baseY = 0, moved = false;
    function parseTranslate(el) {
      var t = el.style.transform || '';
      var m = t.match(/translate\\(([-0-9.]+)px,\\s*([-0-9.]+)px\\)/);
      if (m) return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
      return { x: 0, y: 0 };
    }
    document.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return;
      var stack = __heStackAt(e.clientX, e.clientY);
      if (!stack.length) return;
      dragEl = stack[0];
      window.__htmlEditorDragging = false;
      moved = false;
      startX = e.clientX; startY = e.clientY;
      var tr = parseTranslate(dragEl);
      baseX = tr.x; baseY = tr.y;
      dragEl.classList.add('html-editor-selected');
      e.preventDefault();
    }, true);
    document.addEventListener('mousemove', function(e) {
      if (!dragEl) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (!moved && Math.abs(dx) < TH && Math.abs(dy) < TH) return;
      moved = true;
      window.__htmlEditorDragging = true;
      e.preventDefault();
      if (!dragEl.style.position || dragEl.style.position === 'static') dragEl.style.position = 'relative';
      dragEl.style.transform = 'translate(' + (baseX + dx) + 'px, ' + (baseY + dy) + 'px)';
    }, true);
    document.addEventListener('mouseup', function() {
      if (!dragEl) return;
      if (moved) __heNotifyChanged();
      dragEl.classList.remove('html-editor-selected');
      dragEl = null;
      window.__htmlEditorDragging = false;
    }, true);
  })();
  ` : ""}
})();
</script>`;
}
