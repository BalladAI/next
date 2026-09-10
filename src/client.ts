import { joinUrl, newestFirst } from "./text";
import { BalladApiError, type Collection, type Post } from "./types";

/**
 * The typed client. One instance per site, usually from `createBallad()`
 * with no arguments — it reads its configuration from the environment:
 *
 *   BALLAD_API_KEY      the content API key (Settings › Site › Content API key)
 *   BALLAD_API_URL      Ballad's origin (default https://app.balladlabs.com)
 *   BALLAD_COLLECTION   the collection slug (default "blog")
 *   NEXT_PUBLIC_SITE_URL / BALLAD_SITE_URL   your site's origin, for permalinks
 *
 * Every fetch is tagged (`ballad`, `ballad:collection:<slug>`,
 * `ballad:post:<slug>`) so the revalidate handler can refresh exactly what a
 * publish touched, and cached for `revalidate` seconds (default 300) as a
 * floor under that. Unconfigured (no key) the client is inert: reads return
 * empty results so builds and previews succeed before the key exists.
 */
export type BalladConfig = {
  apiKey?: string;
  baseUrl?: string;
  /** Default collection for calls that don't name one. */
  collection?: string;
  /** Your site's origin, for permalinks when the API can't supply one. */
  siteUrl?: string;
  /** Where the blog lives on your site (permalink fallback). */
  basePath?: string;
  /** Fetch cache lifetime in seconds; 0 = never cache. */
  revalidate?: number;
  /** Override the fetch (tests, custom agents). */
  fetch?: typeof fetch;
};

export type ListOptions = { limit?: number; cursor?: string };

export type Ballad = {
  readonly configured: boolean;
  readonly collectionSlug: string;
  readonly basePath: string;
  readonly siteUrl: string | null;
  /** One page of a collection (the API's default page size unless `limit`). */
  collection(slug?: string, opts?: ListOptions): Promise<Collection | null>;
  /** Every published post in a collection, newest first, following cursors. */
  posts(slug?: string): Promise<{ collection: Collection; items: Collection["items"] } | null>;
  /** One post with its blocks and SEO, or null. */
  post(slug: string): Promise<Post | null>;
  /** Absolute permalink for a post on your site. */
  permalink(slug: string, apiUrl?: string | null): string;
  /** The tags a fetch for this collection / post carries. */
  tags(kind: "collection" | "post", slug: string): string[];
};

export const DEFAULT_BASE_URL = "https://app.balladlabs.com";
export const DEFAULT_COLLECTION = "blog";
export const DEFAULT_REVALIDATE = 300;
const PAGE_SIZE = 100;
const MAX_PAGES = 25;

function env(name: string): string | undefined {
  const v = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return v?.trim() || undefined;
}

export function createBallad(config: BalladConfig = {}): Ballad {
  const apiKey = config.apiKey ?? env("BALLAD_API_KEY") ?? env("BALLAD_CONTENT_KEY");
  const baseUrl = (config.baseUrl ?? env("BALLAD_API_URL") ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const collectionSlug = config.collection ?? env("BALLAD_COLLECTION") ?? DEFAULT_COLLECTION;
  const siteUrl = (config.siteUrl ?? env("BALLAD_SITE_URL") ?? env("NEXT_PUBLIC_SITE_URL") ?? null)?.replace(/\/+$/, "") ?? null;
  const basePath = `/${(config.basePath ?? "/blog").replace(/^\/+|\/+$/g, "")}`;
  const revalidate = config.revalidate ?? DEFAULT_REVALIDATE;
  const doFetch = config.fetch ?? fetch;
  const configured = !!apiKey;

  const tags = (kind: "collection" | "post", slug: string) => [
    "ballad",
    `ballad:${kind}:${slug}`,
  ];

  async function get<T>(path: string, fetchTags: string[]): Promise<T | null> {
    if (!configured) return null;
    const init: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      ...(revalidate === 0
        ? { cache: "no-store" as const }
        : { next: { revalidate, tags: fetchTags } }),
    };
    const res = await doFetch(joinUrl(baseUrl, path), init);
    if (res.status === 404) return null;
    if (!res.ok) throw new BalladApiError(`Ballad content API ${res.status} for ${path}`, res.status);
    return (await res.json()) as T;
  }

  async function collection(slug = collectionSlug, opts: ListOptions = {}) {
    const qs = new URLSearchParams();
    if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
    if (opts.cursor) qs.set("cursor", opts.cursor);
    const q = qs.toString();
    return get<Collection>(
      `/api/content/collections/${encodeURIComponent(slug)}${q ? `?${q}` : ""}`,
      tags("collection", slug),
    );
  }

  async function posts(slug = collectionSlug) {
    // The feed is always paginated: anything that must be complete (the
    // index, static params, the sitemap) pages to the end. Bounded, so a
    // cursor that never nulls or repeats can't spin.
    const first = await collection(slug, { limit: PAGE_SIZE });
    if (!first) return null;
    const items = [...first.items];
    const seen = new Set<string>();
    let cursor = first.nextCursor;
    for (let page = 1; cursor && page < MAX_PAGES; page++) {
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const next = await collection(slug, { limit: PAGE_SIZE, cursor });
      if (!next) break;
      items.push(...next.items);
      cursor = next.nextCursor;
    }
    return { collection: { ...first, items, nextCursor: null }, items: newestFirst(items) };
  }

  const permalink = (slug: string, apiUrl?: string | null) =>
    apiUrl ?? joinUrl(siteUrl ?? "", `${basePath}/${slug}`);

  return {
    configured,
    collectionSlug,
    basePath,
    siteUrl,
    collection,
    posts,
    post: (slug) => get<Post>(`/api/content/items/${encodeURIComponent(slug)}`, tags("post", slug)),
    permalink,
    tags,
  };
}
