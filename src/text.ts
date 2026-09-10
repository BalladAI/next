import type { ContentBlock, Post } from "./types";

/** "March 4, 2026" (long) or "Mar 4, 2026" (short). Empty for a bad date. */
export function formatDate(
  iso: string | null | undefined,
  style: "long" | "short" = "long",
  locale = "en-US",
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: style === "long" ? "long" : "short",
    day: "numeric",
  });
}

/** The article's prose, joined — for reading time, search, excerpts. */
export function proseText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is Extract<ContentBlock, { type: "prose" }> => b.type === "prose")
    .map((b) => String(b.payload.markdown ?? ""))
    .join("\n\n")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Minutes to read, at ~220 words a minute, never under one. */
export function readingTime(post: Pick<Post, "blocks">): number {
  const words = proseText(post.blocks).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Blocks in reading order. */
export function orderBlocks<T extends { position: number }>(blocks: T[]): T[] {
  return [...blocks].sort((a, b) => a.position - b.position);
}

/** The opening image, if the article has one. */
export function heroOf(post: Pick<Post, "blocks">) {
  const hero = post.blocks.find((b) => b.type === "hero_image");
  return hero && hero.type === "hero_image" ? hero.payload : null;
}

/** Newest first, by publish date. */
export function newestFirst<T extends { publishedAt: string | null }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""),
  );
}

/** Join a base URL and a path without doubling slashes. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
