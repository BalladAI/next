import type { Metadata } from "next";
import { revalidatePath, revalidateTag } from "next/cache";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { Ballad } from "../client";
import { rssFeed, type SitemapEntry, sitemapEntries } from "../feed";
import { Article, JsonLd, PostList } from "../react/Article";
import type { BlockComponents } from "../react/blocks";
import { articleJsonLd, breadcrumbJsonLd, collectionMetadata, postMetadata } from "../seo";
import { joinUrl } from "../text";
import type { Collection, Post, PostSummary } from "../types";

/**
 * Everything an App Router blog needs, from one call:
 *
 *   const blog = createBlogPages(ballad, { basePath: "/blog" });
 *
 *   app/blog/page.tsx            export const generateMetadata = blog.index.generateMetadata;
 *                                export default blog.index.Page;
 *   app/blog/[slug]/page.tsx     export const { generateStaticParams, generateMetadata } = blog.post;
 *                                export default blog.post.Page;
 *   app/blog/rss.xml/route.ts    export const GET = blog.rss.GET;
 *   app/api/revalidate/route.ts  export const POST = blog.revalidate.POST;
 *   app/sitemap.ts               return [...yours, ...(await blog.sitemap())];
 *
 * Each page renders plain, classed markup by default; pass `render.index` /
 * `render.post` to draw the page yourself from the same data, `components`
 * to swap block renderers, `layout` to wrap. The data, metadata, static
 * params, feed and refresh-on-publish stay handled.
 */
export type IndexRenderProps = {
  collection: Collection;
  posts: PostSummary[];
  basePath: string;
  hrefFor: (post: PostSummary) => string;
  ballad: Ballad;
};
export type PostRenderProps = {
  post: Post;
  summary: PostSummary | null;
  collection: Collection | null;
  basePath: string;
  permalink: string;
  ballad: Ballad;
};

export type BlogPagesOptions = {
  /** Where the blog lives (default: the client's basePath, "/blog"). */
  basePath?: string;
  /** Collection slug (default: the client's). */
  collection?: string;
  /** Block renderers and markdown element overrides. */
  components?: BlockComponents;
  /** Class-name prefix (default "ballad"). */
  prefix?: string;
  /** Draw the pages yourself from the loaded data. */
  render?: {
    index?: (props: IndexRenderProps) => ReactNode;
    post?: (props: PostRenderProps) => ReactNode;
  };
  /** Wrap whichever markup renders (yours or the default). */
  layout?: (content: ReactNode, page: "index" | "post") => ReactNode;
  /** Index title/description overrides; default from the collection. */
  index?: { title?: string; description?: string };
  /** Feed title/limit; `feed: false` disables RSS links in metadata. */
  feed?: { title?: string; limit?: number } | false;
  /** schema.org publisher for Article JSON-LD (your organization). */
  publisher?: Record<string, unknown>;
  /** Emit JSON-LD on post pages (default true). */
  jsonLd?: boolean;
  /** Extra paths to revalidate on publish (e.g. "/" when the home page lists posts). */
  revalidatePaths?: string[];
  /** Shared secret for the revalidate handler (default BALLAD_REVALIDATE_SECRET). */
  revalidateSecret?: string;
  /**
   * What a content-API failure (a 5xx, a network error) does to a page.
   * "throw" (default): the error surfaces — a build fails loudly and the
   * last good deploy stays live; an ISR regeneration keeps the last good
   * page. "empty": the page renders as if nothing were published. An
   * unconfigured client (no key) always renders empty; that's not an error.
   */
  errors?: "throw" | "empty";
};

type Params = { params: Promise<{ slug: string }> };

export function createBlogPages(ballad: Ballad, options: BlogPagesOptions = {}) {
  const basePath = `/${(options.basePath ?? ballad.basePath).replace(/^\/+|\/+$/g, "")}`;
  const collectionSlug = options.collection ?? ballad.collectionSlug;
  const prefix = options.prefix ?? "ballad";
  const feed = options.feed === false ? null : (options.feed ?? {});
  const feedPath = feed ? `${basePath}/rss.xml` : null;
  const hrefFor = (p: PostSummary) => `${basePath}/${p.slug}`;
  const permalink = (p: Pick<PostSummary, "slug" | "url">) => ballad.permalink(p.slug, p.url);
  const wrap = (node: ReactNode, page: "index" | "post") =>
    options.layout ? options.layout(node, page) : node;

  async function load() {
    if (options.errors === "empty") {
      try {
        return await ballad.posts(collectionSlug);
      } catch {
        return null;
      }
    }
    return ballad.posts(collectionSlug);
  }
  /** The feed never throws: a reader wants a status, not an error page. */
  async function loadForFeed() {
    try {
      return await load();
    } catch {
      return null;
    }
  }

  /* ---- index ---- */
  async function IndexPage() {
    const data = await load();
    const collection: Collection = data?.collection ?? {
      slug: collectionSlug,
      name: options.index?.title ?? "Blog",
      theme: null,
      tagline: null,
      items: [],
      nextCursor: null,
    };
    const posts = data?.items ?? [];
    const props: IndexRenderProps = { collection, posts, basePath, hrefFor, ballad };
    const content = options.render?.index ? (
      options.render.index(props)
    ) : (
      <section className={`${prefix}-index`}>
        <header className={`${prefix}-index-header`}>
          <h1 className={`${prefix}-index-title`}>{options.index?.title ?? collection.name}</h1>
          {(options.index?.description ?? collection.tagline ?? collection.theme) && (
            <p className={`${prefix}-index-lede`}>
              {options.index?.description ?? collection.tagline ?? collection.theme}
            </p>
          )}
          {feedPath && (
            <a className={`${prefix}-index-rss`} href={feedPath}>
              RSS
            </a>
          )}
        </header>
        <PostList posts={posts} hrefFor={hrefFor} prefix={prefix} />
      </section>
    );
    return <>{wrap(content, "index")}</>;
  }
  async function indexMetadata(): Promise<Metadata> {
    const data = await load();
    return collectionMetadata(data?.collection ?? null, { basePath, siteUrl: ballad.siteUrl }, {
      ...(options.index?.title ? { title: options.index.title } : {}),
      ...(options.index?.description ? { description: options.index.description } : {}),
      feedPath,
    });
  }

  /* ---- post ---- */
  async function generateStaticParams() {
    const data = await load();
    return (data?.items ?? []).map((p) => ({ slug: p.slug }));
  }
  async function generateMetadata({ params }: Params): Promise<Metadata> {
    const { slug } = await params;
    const post = await ballad.post(slug);
    if (!post) return {};
    return postMetadata(post, { permalink: ballad.permalink, basePath }, {
      feedTitle: feed?.title ?? null,
      feedPath,
    });
  }
  async function PostPage({ params }: Params) {
    const { slug } = await params;
    const [post, data] = await Promise.all([ballad.post(slug), load()]);
    if (!post) notFound();
    const summary = data?.items.find((p) => p.slug === slug) ?? null;
    const url = ballad.permalink(post.slug, post.seo.canonical ?? summary?.url);
    const props: PostRenderProps = {
      post,
      summary,
      collection: data?.collection ?? null,
      basePath,
      permalink: url,
      ballad,
    };
    const ld =
      options.jsonLd === false
        ? null
        : [
            articleJsonLd(post, { url, ...(options.publisher ? { publisher: options.publisher } : {}) }),
            ...(ballad.siteUrl
              ? [
                  breadcrumbJsonLd([
                    { name: "Home", url: ballad.siteUrl },
                    { name: data?.collection.name ?? "Blog", url: joinUrl(ballad.siteUrl, basePath) },
                    { name: post.title ?? post.slug, url },
                  ]),
                ]
              : []),
          ];
    const content = options.render?.post ? (
      options.render.post(props)
    ) : (
      <Article
        post={post}
        author={summary?.author ?? null}
        prefix={prefix}
        {...(options.components ? { components: options.components } : {})}
      />
    );
    return (
      <>
        {ld && <JsonLd data={ld} />}
        {wrap(content, "post")}
      </>
    );
  }

  /* ---- feed, sitemap, refresh ---- */
  async function rssGET() {
    const data = await loadForFeed();
    if (!data)
      return new Response("Feed not available", { status: 503, headers: { "content-type": "text/plain" } });
    const body = rssFeed(data.collection, data.items, { permalink: ballad.permalink, basePath, siteUrl: ballad.siteUrl }, {
      ...(feed?.title ? { title: feed.title } : {}),
      ...(feed?.limit ? { limit: feed.limit } : {}),
      feedPath: `${basePath}/rss.xml`,
    });
    return new Response(body, {
      headers: {
        "content-type": "application/rss+xml; charset=utf-8",
        "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  }
  /** Sitemap entries: the index and every post. Pass `{ index: false }`
   * when your own list already names the blog index, or it appears twice. */
  async function sitemap(opts: { index?: boolean } = {}): Promise<SitemapEntry[]> {
    const data = await load();
    return sitemapEntries(
      data?.items ?? [],
      { permalink: ballad.permalink, basePath, siteUrl: ballad.siteUrl },
      { index: opts.index !== false },
    );
  }
  const revalidate = createRevalidateHandler({
    ...(options.revalidateSecret ? { secret: options.revalidateSecret } : {}),
    basePath,
    collection: collectionSlug,
    paths: [...(feedPath ? [feedPath] : []), ...(options.revalidatePaths ?? [])],
  });

  return {
    basePath,
    index: { Page: IndexPage, generateMetadata: indexMetadata },
    post: { Page: PostPage, generateMetadata, generateStaticParams },
    rss: { GET: rssGET },
    sitemap,
    revalidate,
    hrefFor,
    permalink,
  };
}

/* ---------------------------------------------------------------------- */

function secretMatches(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string" || provided.length !== expected.length) return false;
  // Constant-time compare without Node's crypto, so the handler runs on
  // any runtime.
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export type RevalidateOptions = {
  /** Shared secret; default `process.env.BALLAD_REVALIDATE_SECRET`. */
  secret?: string;
  /** The blog's path, for path revalidation (default "/blog"). */
  basePath?: string;
  /** The collection this site renders (others are ignored). */
  collection?: string;
  /** Extra paths to revalidate every time. */
  paths?: string[];
  /** Called after a successful revalidation. */
  onRevalidate?: (info: { collection: string | null; slug: string | null; paths: string[]; tags: string[] }) => void | Promise<void>;
};

/**
 * The refresh-on-publish endpoint. Ballad POSTs `{ secret, collection,
 * slug }` when it publishes; this validates the secret and revalidates the
 * fetch tags and the pages for that collection and post. Set the site's
 * URL and the same secret under Settings › Site in Ballad.
 */
export function createRevalidateHandler(options: RevalidateOptions = {}) {
  const basePath = `/${(options.basePath ?? "/blog").replace(/^\/+|\/+$/g, "")}`;
  async function POST(request: Request): Promise<Response> {
    const expected = options.secret ?? process.env.BALLAD_REVALIDATE_SECRET;
    if (!expected) return Response.json({ error: "not configured" }, { status: 503 });
    let body: { secret?: unknown; collection?: unknown; slug?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return Response.json({ error: "invalid json" }, { status: 400 });
    }
    if (!secretMatches(body.secret, expected))
      return Response.json({ error: "unauthorized" }, { status: 401 });

    const collection = typeof body.collection === "string" ? body.collection : null;
    const slug = typeof body.slug === "string" ? body.slug : null;
    if (options.collection && collection && collection !== options.collection)
      return Response.json({ revalidated: [], tags: [], ignored: collection });

    const tags = ["ballad", ...(collection ? [`ballad:collection:${collection}`] : []), ...(slug ? [`ballad:post:${slug}`] : [])];
    const paths = [basePath, ...(slug ? [`${basePath}/${slug}`] : []), ...(options.paths ?? [])];
    for (const t of tags) revalidateTag(t, "max");
    for (const p of paths) revalidatePath(p);
    await options.onRevalidate?.({ collection, slug, paths, tags });
    return Response.json({ revalidated: paths, tags, at: Date.now() });
  }
  return { POST };
}
