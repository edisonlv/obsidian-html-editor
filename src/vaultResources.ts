import type { App, TFile } from "obsidian";

/** 属性值转义 */
export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** 当前 HTML 文件所在目录，到库内另一文件的相对路径（写入源码，便于迁移） */
export function vaultRelativePath(fromFilePath: string, toFilePath: string): string {
  const fromDir = fromFilePath.includes("/")
    ? fromFilePath.slice(0, fromFilePath.lastIndexOf("/") + 1)
    : "";
  const fromParts = fromDir.split("/").filter(Boolean);
  const toParts = toFilePath.split("/");

  let common = 0;
  const toDirParts = toParts.slice(0, -1);
  while (
    common < fromParts.length &&
    common < toDirParts.length &&
    fromParts[common] === toDirParts[common]
  ) {
    common++;
  }

  const ups = fromParts.length - common;
  const down = toParts.slice(common);
  if (ups === 0) {
    return down.length ? `./${down.join("/")}` : toParts[toParts.length - 1] ?? "";
  }
  return `${"../".repeat(ups)}${down.join("/")}`;
}

/** 预览 iframe 用的 base URL，使相对 src/href 指向 HTML 所在文件夹 */
export function getPreviewBaseHref(app: App, htmlFile: TFile): string | null {
  try {
    const resource = app.vault.getResourcePath(htmlFile);
    const slash = resource.lastIndexOf("/");
    if (slash < 0) return null;
    return resource.slice(0, slash + 1);
  } catch {
    return null;
  }
}

export function injectPreviewBaseTag(html: string, baseHref: string): string {
  const tag = `<base href="${escapeHtmlAttr(baseHref)}">`;
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n${tag}`);
  }
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1>\n<head>${tag}</head>`);
  }
  return `${tag}\n${html}`;
}

export type LinkKind = "web" | "vault" | "anchor";

/** 将用户输入或库内路径规范为可写入 HTML 的 href */
export function resolveLinkHref(
  kind: LinkKind,
  input: string,
  htmlFile: TFile | null
): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  if (kind === "anchor") {
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  }

  if (kind === "web") {
    if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("//")) return `https:${trimmed}`;
    return `https://${trimmed}`;
  }

  if (!htmlFile) return trimmed;
  if (/^(https?:|mailto:|#)/i.test(trimmed)) return trimmed;
  const vaultPath = trimmed.replace(/^\.\//, "");
  return vaultRelativePath(htmlFile.path, vaultPath);
}

export type MediaKind = "image" | "video" | "audio";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "ico"]);
const VIDEO_EXT = new Set(["mp4", "webm", "ogg", "mov"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac"]);

export function mediaKindFromPath(path: string): MediaKind | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  return null;
}

export function resolveMediaSrc(
  kind: MediaKind,
  input: string,
  htmlFile: TFile | null,
  fromVaultPick: boolean
): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!fromVaultPick && /^(data:|blob:)/i.test(trimmed)) return trimmed;
  if (!htmlFile) return trimmed;
  const vaultPath = trimmed.replace(/^\.\//, "");
  return vaultRelativePath(htmlFile.path, vaultPath);
}

export function buildMediaHtml(
  kind: MediaKind,
  src: string,
  opts: { alt?: string; width?: string; controls?: boolean; title?: string }
): string {
  const safeSrc = escapeHtmlAttr(src);
  if (kind === "image") {
    const alt = opts.alt != null ? ` alt="${escapeHtmlAttr(opts.alt)}"` : ' alt=""';
    const w = opts.width ? ` width="${escapeHtmlAttr(opts.width)}"` : "";
    return `<img src="${safeSrc}"${alt}${w} />`;
  }
  if (kind === "video") {
    const c = opts.controls !== false ? " controls" : "";
    const w = opts.width ? ` width="${escapeHtmlAttr(opts.width)}"` : "";
    const title = opts.title ? ` title="${escapeHtmlAttr(opts.title)}"` : "";
    return `<video src="${safeSrc}"${c}${w}${title}></video>`;
  }
  const c = opts.controls !== false ? " controls" : "";
  const title = opts.title ? ` title="${escapeHtmlAttr(opts.title)}"` : "";
  return `<audio src="${safeSrc}"${c}${title}></audio>`;
}

/** 从 HTML 源码中提取媒体引用，供「本文媒体」列表 */
export interface DocumentMediaRef {
  kind: MediaKind;
  src: string;
  index: number;
}

const MEDIA_SRC_RE =
  /<(img|video|audio|source)\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

export function extractMediaFromHtml(html: string): DocumentMediaRef[] {
  const out: DocumentMediaRef[] = [];
  let m: RegExpExecArray | null;
  MEDIA_SRC_RE.lastIndex = 0;
  while ((m = MEDIA_SRC_RE.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const src = m[2];
    let kind: MediaKind = "image";
    if (tag === "video") kind = "video";
    else if (tag === "audio" || tag === "source") {
      kind = mediaKindFromPath(src) ?? (tag === "audio" ? "audio" : "image");
    } else if (tag === "img") kind = "image";
    out.push({ kind, src, index: m.index });
  }
  return out;
}
