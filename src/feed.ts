import type { Ballad } from "./client";
import { joinUrl } from "./text";
import type { Collection, PostSummary } from "./types";

/** Escape for XML text and attributes. */
export function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RSS <pubDate> wants RFC 822; toUTCString() satisfies it. */
export function rfc822(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toUTCString();
}

function mimeForImage(url: string): string {
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    case "svg":
      return "image/svg+xml";
    default:
      return "image/png";
  }
}

export type FeedOptions = {
  /** Feed title; defaults to the collection's name. */
  title?: string;
  /** Feed description; defaults to the collection's tagline or theme. */
  description?: string;
  /** Path of the feed on your site (for atom:link rel=self). */
  feedPath?: string;
  /** Most recent N items (default 30). */
  limit?: number;
  language?: string;
};

/**
 * An RSS 2.0 document for a collection, built from the feed alone — title,
 * excerpt, author, image and date per item — so no per-item fetches. A
 * summary feed: readers click through to your site.
 */
export function rssFeed(
  collection: Pick<Collection, "name" | "theme" | "tagline" | "slug">,
  items: PostSummary[],
  ballad: Pick<Ballad, "permalink" | "basePath" | "siteUrl">,
  opts: FeedOptions = {},
): string {
  const site = ballad.siteUrl ?? "";
  const indexUrl = site ? joinUrl(site, ballad.basePath) : ballad.basePath;
  const feedPath = opts.feedPath ?? `${ballad.basePath}/rss.xml`;
  const selfUrl = site ? joinUrl(site, feedPath) : feedPath;
  const title = opts.title ?? collection.name;
  const description = opts.description ?? collection.tagline ?? collection.theme ?? title;
  const limit = opts.limit ?? 30;
  const entries = items.slice(0, limit).map((it) => {
    const link = ballad.permalink(it.slug, it.url);
    const date = rfc822(it.publishedAt);
    return [
      "    <item>",
      `      <title>${xml(it.title ?? it.slug)}</title>`,
      `      <link>${xml(link)}</link>`,
      `      <guid isPermaLink="true">${xml(link)}</guid>`,
      date ? `      <pubDate>${date}</pubDate>` : null,
      it.excerpt ? `      <description>${xml(it.excerpt)}</description>` : null,
      it.author ? `      <dc:creator>${xml(it.author)}</dc:creator>` : null,
      it.image
        ? `      <enclosure url="${xml(it.image)}" type="${mimeForImage(it.image)}" length="0" />`
        : null,
      "    </item>",
    ]
      .filter(Boolean)
      .join("\n");
  });
  const newest = items.map((i) => rfc822(i.publishedAt)).find(Boolean);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    "  <channel>",
    `    <title>${xml(title)}</title>`,
    `    <link>${xml(indexUrl)}</link>`,
    `    <description>${xml(description)}</description>`,
    `    <language>${xml(opts.language ?? "en")}</language>`,
    newest ? `    <lastBuildDate>${newest}</lastBuildDate>` : null,
    `    <atom:link href="${xml(selfUrl)}" rel="self" type="application/rss+xml" />`,
    ...entries,
    "  </channel>",
    "</rss>",
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export type SitemapEntry = {
  url: string;
  lastModified?: string | Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

/** Sitemap entries: the index plus every post, for `app/sitemap.ts`. */
export function sitemapEntries(
  items: PostSummary[],
  ballad: Pick<Ballad, "permalink" | "basePath" | "siteUrl">,
  opts: { index?: boolean; priority?: number } = {},
): SitemapEntry[] {
  const site = ballad.siteUrl ?? "";
  const out: SitemapEntry[] = [];
  if (opts.index !== false)
    out.push({
      url: site ? joinUrl(site, ballad.basePath) : ballad.basePath,
      changeFrequency: "daily",
      priority: 0.8,
    });
  for (const it of items)
    out.push({
      url: ballad.permalink(it.slug, it.url),
      ...(it.publishedAt ? { lastModified: it.publishedAt } : {}),
      changeFrequency: "monthly",
      priority: opts.priority ?? 0.7,
    });
  return out;
}
