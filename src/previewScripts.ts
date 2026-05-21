import { PreviewInteractionMode, normalizePreviewInteractionMode } from "./constants";

/** 注入预览 iframe 的脚本（元素检查器 + 改字 / 布局拖动 / 设色 / 插块） */
export function buildPreviewInjectedScript(mode: PreviewInteractionMode): string {
  const normalized = normalizePreviewInteractionMode(mode);
  const isSelect = normalized === PreviewInteractionMode.Select;
  const isLayout = normalized === PreviewInteractionMode.Layout;
  const isText = normalized === PreviewInteractionMode.Text;
  const isInspect = isSelect || isLayout;

  return `
<script data-injected="html-editor">
(function() {
  window.__heMode = ${JSON.stringify(normalized)};

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

  function __hePickable(el) {
    if (__heSkipTag(el)) return false;
    if (${isLayout}) return true;
    return __heHasLine(el);
  }

  function __heStackAt(x, y) {
    var list = document.elementsFromPoint(x, y);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!__hePickable(el)) continue;
      out.push(el);
    }
    return out;
  }

  function __heMarkProtoEl(el) {
    if (!el || el.nodeType !== 1) return;
    if (!__heHasLine(el)) el.setAttribute('data-he-proto', '1');
  }

  function __heModuleType(el) {
    var tag = (el.tagName || '').toLowerCase();
    var cls = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : '';
    if (tag === 'button' || cls.indexOf('proto-btn') >= 0 || (cls.indexOf('btn') >= 0 && tag !== 'div')) return '按钮';
    if (tag === 'img' || tag === 'picture' || tag === 'svg') return '图片';
    if (tag === 'video' || tag === 'audio') return '媒体';
    if (/^h[1-6]$/.test(tag)) return '标题';
    if (tag === 'p' || tag === 'span' || cls.indexOf('proto-text') >= 0) return '文本';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return '表单';
    if (tag === 'ul' || tag === 'ol' || tag === 'li') return '列表';
    if (tag === 'table' || tag === 'tr' || tag === 'td' || tag === 'th') return '表格';
    if (tag === 'a') return cls.indexOf('btn') >= 0 ? '按钮' : '链接';
    if (cls.indexOf('proto-card') >= 0 || cls.indexOf('card') >= 0) return '卡片';
    if (cls.indexOf('proto-spacer') >= 0) return '留白';
    if (cls.indexOf('proto-block') >= 0 || cls.indexOf('proto-section') >= 0) return '容器';
    if (tag.indexOf('motion') >= 0 || tag === 'motion.div') return '容器';
    if (tag === 'motion.div' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main' || tag === 'header' || tag === 'footer' || tag === 'aside' || tag === 'nav') return '容器';
    return '元素';
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
      if (!__heSkipTag(cur) && __hePickable(cur)) parts.unshift(__heDescribe(cur));
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
    var attrs = {};
    if (el.attributes) {
      for (var ai = 0; ai < el.attributes.length; ai++) {
        var a = el.attributes[ai];
        attrs[a.name] = a.value;
      }
    }
    var inlineStyles = {};
    if (el.style) {
      for (var si = 0; si < el.style.length; si++) {
        var prop = el.style[si];
        inlineStyles[prop] = el.style.getPropertyValue(prop);
      }
    }
    window.parent.postMessage({
      type: 'html-editor-select',
      sourceId: sid >= 0 ? sid : undefined,
      from: entry ? entry.from : undefined,
      to: entry ? entry.to : undefined,
      tag: el.tagName.toLowerCase(),
      moduleType: __heModuleType(el),
      label: __heDescribe(el),
      path: __hePath(el),
      line: entry ? entry.line : (el.dataset.sourceLine ? parseInt(el.dataset.sourceLine, 10) : 0),
      depth: depth,
      depthTotal: depthTotal,
      attributes: attrs,
      inlineStyles: inlineStyles
    }, '*');
  }

  var hoverEl = null;
  var selectedEl = null;
  var labelEl = null;
  var lastClickX = 0, lastClickY = 0, lastClickT = 0, cycleIdx = 0, lastStack = [];

  /** 同位置连点切层；Shift=最外层 */
  function __hePickFromPointer(e) {
    var stack = __heStackAt(e.clientX, e.clientY);
    if (!stack.length) return null;
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
    return { el: stack[cycleIdx], depth: cycleIdx, total: stack.length };
  }

  var css = document.createElement('style');
  css.textContent = [
    '.html-editor-hover {',
    '  outline: 1px dashed rgba(14, 165, 233, 0.9) !important;',
    '  outline-offset: 2px;',
    '  box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.08) !important;',
    '}',
    '.html-editor-selected {',
    '  outline: 2px solid #4f46e5 !important;',
    '  outline-offset: 3px;',
    '  box-shadow: 0 0 0 7px rgba(79, 70, 229, 0.14), 0 10px 28px rgba(15, 23, 42, 0.12) !important;',
    '  cursor: move !important;',
    '}',
    '.html-editor-insert-inside {',
    '  box-shadow: inset 0 0 0 3px rgba(34, 197, 94, 0.9), 0 0 0 7px rgba(34, 197, 94, 0.12) !important;',
    '}',
    '.html-editor-insert-after {',
    '  box-shadow: 0 0 0 2px #4f46e5, 0 12px 0 -3px rgba(34, 197, 94, 0.95), 0 18px 26px rgba(34, 197, 94, 0.18) !important;',
    '}',
    '.html-editor-insert-before {',
    '  box-shadow: 0 0 0 2px #4f46e5, 0 -12px 0 -3px rgba(34, 197, 94, 0.95), 0 -18px 26px rgba(34, 197, 94, 0.18) !important;',
    '}',
    '.html-editor-insert-flash {',
    '  animation: html-editor-flash 2s ease-out;',
    '}',
    '@keyframes html-editor-flash {',
    '  0%, 18% { outline: 3px solid #22c55e !important; outline-offset: 4px; box-shadow: 0 0 0 9px rgba(34, 197, 94, 0.16) !important; }',
    '  100% { outline: none; }',
    '}',
    '#html-editor-float-label {',
    '  position: fixed; z-index: 2147483647; pointer-events: none;',
    '  font: 11px/1.3 var(--font-monospace, monospace);',
    '  padding: 5px 8px; border-radius: 999px;',
    '  background: rgba(15, 23, 42, 0.94); color: #f8fafc;',
    '  border: 1px solid rgba(148, 163, 184, 0.38);',
    '  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.24);',
    '  max-width: 560px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
    '}'
  ].join('\\n');
  document.head.appendChild(css);

  labelEl = document.createElement("div");
  labelEl.id = "html-editor-float-label";
  labelEl.style.display = 'none';
  document.body.appendChild(labelEl);

  function setHover(el) {
    if (hoverEl && hoverEl !== selectedEl) hoverEl.classList.remove('html-editor-hover');
    hoverEl = el;
    if (el && el !== selectedEl) {
      el.classList.add('html-editor-hover');
      var lineHint = el.dataset.sourceLine ? ('L' + el.dataset.sourceLine) : (el.dataset.heProto ? '未映射' : '?');
      labelEl.textContent = '【' + __heModuleType(el) + '】 ' + __heDescribe(el) + ' · ' + lineHint;
      var r = el.getBoundingClientRect();
      labelEl.style.left = Math.max(4, r.left) + 'px';
      labelEl.style.top = Math.max(4, r.top - 22) + 'px';
      labelEl.style.display = 'block';
    } else if (!selectedEl) {
      labelEl.style.display = 'none';
    }
  }

  window.__heInsertPos = 'after';

  function __heClearInsertMarker() {
    if (!selectedEl) return;
    selectedEl.classList.remove('html-editor-insert-inside', 'html-editor-insert-after', 'html-editor-insert-before');
  }

  function __heSyncInsertMarker(pos) {
    window.__heInsertPos = pos || 'after';
    __heClearInsertMarker();
    if (!selectedEl || !${isLayout}) return;
    var cls = window.__heInsertPos === 'inside'
      ? 'html-editor-insert-inside'
      : (window.__heInsertPos === 'before' ? 'html-editor-insert-before' : 'html-editor-insert-after');
    selectedEl.classList.add(cls);
  }

  function setSelected(el, depth, depthTotal) {
    if (selectedEl) {
      selectedEl.classList.remove('html-editor-selected');
      __heClearInsertMarker();
    }
    selectedEl = el;
    if (el) {
      el.classList.add('html-editor-selected');
      __hePostSelect(el, depth, depthTotal);
      var hint = ${isLayout ? "' · 拖动移动'" : "''"};
      var lineHint2 = el.dataset.sourceLine ? ('L' + el.dataset.sourceLine) : (el.dataset.heProto ? '未映射' : '?');
      labelEl.textContent = '【' + __heModuleType(el) + '】 ' + __heDescribe(el) + ' · ' + lineHint2 + ' · 层 ' + (depth + 1) + '/' + depthTotal + ' · 连点切层' + hint;
      var r = el.getBoundingClientRect();
      labelEl.style.left = Math.max(4, r.left) + 'px';
      labelEl.style.top = Math.max(4, r.top - 22) + 'px';
      labelEl.style.display = 'block';
      __heSyncInsertMarker(window.__heInsertPos);
    } else {
      labelEl.style.display = 'none';
    }
  }

  ${isInspect ? `
  document.addEventListener('mousemove', function(e) {
    if (window.__htmlEditorDragging) return;
    var stack = __heStackAt(e.clientX, e.clientY);
    setHover(stack.length ? stack[0] : null);
  }, true);

  document.addEventListener('click', function(e) {
    if (window.__htmlEditorDragging) return;
    ${isLayout ? "return;" : ""}
    var picked = __hePickFromPointer(e);
    if (!picked) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(picked.el, picked.depth, picked.total);
  }, true);
  ` : ""}

  ${isText ? `
  document.addEventListener('click', function(e) {
    if (!e.altKey || window.__htmlEditorDragging) return;
    var picked = __hePickFromPointer(e);
    if (!picked) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(picked.el, 0, 1);
  }, true);
  ` : ""}

  window.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.data.type === 'html-editor-insert-position') {
      __heSyncInsertMarker(e.data.position);
      return;
    }
    if (e.data.type === 'html-editor-cancel-drag') {
      if (typeof window.__heEndDrag === 'function') window.__heEndDrag();
      return;
    }
    if (e.data.type === 'html-editor-inspector-cmd') {
      var cmd = e.data.command;
      if (cmd === 'clear') {
        setSelected(null, 0, 1);
        return;
      }
      if (!selectedEl) return;
      if (cmd === 'parent' && selectedEl.parentElement) {
        var p = selectedEl.parentElement;
        while (p && !__hePickable(p)) p = p.parentElement;
        if (p) setSelected(p, 0, 1);
      }
      if (cmd === 'child') {
        var c = selectedEl.firstElementChild;
        while (c && !__hePickable(c)) c = c.nextElementSibling;
        if (!c) {
          var kids = selectedEl.querySelectorAll('*');
          for (var ki = 0; ki < kids.length; ki++) {
            if (__hePickable(kids[ki])) { c = kids[ki]; break; }
          }
        }
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
    if (e.data.type === 'html-editor-cmd') {
      var cmd = e.data.command;
      var val = e.data.value || '';
      try {
        if (cmd === 'setStyle' && selectedEl) {
          var styleObj = JSON.parse(val);
          if (styleObj && styleObj.prop) {
            if (styleObj.value) {
              selectedEl.style[styleObj.prop] = styleObj.value;
            } else {
              selectedEl.style.removeProperty(styleObj.prop);
            }
          }
          __heNotifyChanged();
          __hePostSelect(selectedEl, cycleIdx, lastStack.length || 1);
          return;
        }
        if (cmd === 'setAttribute' && selectedEl) {
          var attrObj = JSON.parse(val);
          if (attrObj && attrObj.name) {
            if (attrObj.value) {
              selectedEl.setAttribute(attrObj.name, attrObj.value);
            } else {
              selectedEl.removeAttribute(attrObj.name);
            }
            __heNotifyChanged();
            __hePostSelect(selectedEl, cycleIdx, lastStack.length || 1);
          }
          return;
        }
        if (cmd === 'insertBlock') {
          var html = val;
          var position = window.__heInsertPos || 'after';
          try {
            if (val && String(val).trim().charAt(0) === '{') {
              var payload = JSON.parse(val);
              html = payload.html || '';
              position = payload.position || position;
            }
          } catch (parseErr) { /* 纯 HTML 字符串 */ }
          if (!html) return;
          var anchor = selectedEl;
          var newEl = null;
          if (anchor) {
            if (position === 'inside') {
              anchor.insertAdjacentHTML('beforeend', html);
              newEl = anchor.lastElementChild;
            } else if (position === 'before') {
              anchor.insertAdjacentHTML('beforebegin', html);
              newEl = anchor.previousElementSibling;
            } else {
              anchor.insertAdjacentHTML('afterend', html);
              newEl = anchor.nextElementSibling;
            }
          } else {
            document.body.insertAdjacentHTML('beforeend', html);
            newEl = document.body.lastElementChild;
            position = 'after';
          }
          if (newEl && newEl.nodeType === 1) {
            __heMarkProtoEl(newEl);
            newEl.classList.add('html-editor-insert-flash');
            setTimeout(function() {
              newEl.classList.remove('html-editor-insert-flash');
            }, 2200);
            setSelected(newEl, 0, 1);
            lastClickX = 0;
            lastClickY = 0;
            cycleIdx = 0;
            lastStack = [];
          }
          window.parent.postMessage({
            type: 'html-editor-insert-done',
            position: position,
            anchorLabel: anchor ? __heDescribe(anchor) : 'body',
            blockLabel: newEl ? __heDescribe(newEl) : ''
          }, '*');
          __heNotifyChanged();
          return;
        }
      } catch (err) { console.error('[html-editor]', err); }
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
        if (cmd === 'foreColor') { doc.execCommand('foreColor', false, val); __heNotifyChanged(); return; }
        if (cmd === 'backColor' || cmd === 'hiliteColor') { doc.execCommand('hiliteColor', false, val); __heNotifyChanged(); return; }
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

  ${isLayout ? `
  (function() {
    var TH = 4, dragEl = null, startX = 0, startY = 0, baseX = 0, baseY = 0, moved = false;
    function parseTranslate(el) {
      var t = el.style.transform || '';
      var m = t.match(/translate\\(([-0-9.]+)px,\\s*([-0-9.]+)px\\)/);
      if (m) return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
      return { x: 0, y: 0 };
    }
    window.__heEndDrag = function() {
      if (!dragEl) return;
      if (moved) __heNotifyChanged();
      dragEl = null;
      moved = false;
      window.__htmlEditorDragging = false;
    };
    document.addEventListener('mousedown', function(e) {
      if (e.button !== 0 || window.__htmlEditorDragging) return;
      var picked = __hePickFromPointer(e);
      if (!picked && selectedEl && selectedEl.contains(e.target)) {
        picked = { el: selectedEl, depth: 0, total: 1 };
      }
      if (!picked) return;
      e.preventDefault();
      e.stopPropagation();
      setSelected(picked.el, picked.depth, picked.total);
      dragEl = picked.el;
      moved = false;
      startX = e.clientX; startY = e.clientY;
      var tr = parseTranslate(dragEl);
      baseX = tr.x; baseY = tr.y;
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
      window.__heEndDrag();
    }, true);
  })();
  ` : ""}
})();
</script>`;
}
