/** 源码中每个可点选起始标签的精确位置 */
export interface SourceTagEntry {
  id: number;
  line: number;
  from: number;
  to: number;
  tag: string;
}

const SKIP_TAGS = new Set(["script", "style"]);
const OPEN_TAG_RE = /<([a-zA-Z][\w.-]*)([\s>\/])/g;

export function buildSourceTagMap(source: string): SourceTagEntry[] {
  const map: SourceTagEntry[] = [];
  let m: RegExpExecArray | null;
  OPEN_TAG_RE.lastIndex = 0;
  while ((m = OPEN_TAG_RE.exec(source)) !== null) {
    const tag = m[1].toLowerCase();
    if (SKIP_TAGS.has(tag)) continue;
    const offset = m.index;
    const line = source.slice(0, offset).split("\n").length;
    const rest = source.slice(offset);
    const closeGt = rest.indexOf(">");
    const to = closeGt >= 0 ? offset + closeGt + 1 : offset + m[0].length;
    map.push({ id: map.length, line, from: offset, to, tag });
  }
  return map;
}

/** 为每个起始标签注入 data-source-id / data-source-line，并返回位置表 */
export function injectSourceMarkers(source: string): { html: string; map: SourceTagEntry[] } {
  const map: SourceTagEntry[] = [];
  const html = source.replace(OPEN_TAG_RE, (match, tag: string, after: string, offset: number) => {
    const t = tag.toLowerCase();
    if (SKIP_TAGS.has(t)) return match;
    const line = source.slice(0, offset).split("\n").length;
    const rest = source.slice(offset);
    const closeGt = rest.indexOf(">");
    const to = closeGt >= 0 ? offset + closeGt + 1 : offset + match.length;
    const id = map.length;
    map.push({ id, line, from: offset, to, tag: t });
    return `<${tag} data-source-id="${id}" data-source-line="${line}"${after}`;
  });
  return { html, map };
}

export function buildSourceMapScript(map: SourceTagEntry[]): string {
  const json = JSON.stringify(map).replace(/</g, "\\u003c");
  return `<script data-injected="html-editor-map" type="application/json">${json}</script>`;
}
