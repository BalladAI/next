# @balladlabs/next

A Ballad-powered blog for Next.js, on your domain. Ballad writes and publishes the articles; this package fetches them, renders them, handles SEO, RSS, the sitemap, and refresh-on-publish — with a few lines of code, and a way to override every piece.

Written in TypeScript, shipped as JavaScript with types. App Router only.

## Install

```bash
npm install @balladlabs/next
```

Two values from Ballad, under **Settings → Site**, in your environment:

```bash
BALLAD_API_KEY=blc_your_key_here          # Content API key
BALLAD_REVALIDATE_SECRET=your-shared-secret   # for refresh on publish
NEXT_PUBLIC_SITE_URL=https://your-site.com    # your origin, for permalinks
```

## The short version

One client, one call, five tiny files.

```ts
// lib/ballad.ts
import { createBallad } from "@balladlabs/next";
import { createBlogPages } from "@balladlabs/next/pages";

export const ballad = createBallad();            // reads BALLAD_* from the environment
export const blog = createBlogPages(ballad, {    // /blog, /blog/[slug], rss, sitemap, revalidate
  basePath: "/blog",
  publisher: { "@type": "Organization", name: "Acme", url: "https://acme.com" },
});
```

```ts
// app/blog/page.tsx
import { blog } from "@/lib/ballad";
export const generateMetadata = blog.index.generateMetadata;
export default blog.index.Page;
```

```ts
// app/blog/[slug]/page.tsx
import { blog } from "@/lib/ballad";
export const generateStaticParams = blog.post.generateStaticParams;
export const generateMetadata = blog.post.generateMetadata;
export default blog.post.Page;
```

```ts
// app/blog/rss.xml/route.ts
import { blog } from "@/lib/ballad";
export const GET = blog.rss.GET;
```

```ts
// app/api/revalidate/route.ts
import { blog } from "@/lib/ballad";
export const POST = blog.revalidate.POST;
```

```ts
// app/sitemap.ts
import { blog } from "@/lib/ballad";
export default async function sitemap() {
  return [{ url: "https://acme.com" }, ...(await blog.sitemap())];
}
```

Optionally, the default styles:

```ts
import "@balladlabs/next/styles.css";
```

Then in Ballad, under Settings → Site, set your site URL and the same revalidate secret. New posts appear within seconds of approval, with no redeploy.

## Make it yours

Every layer can be replaced without giving up the ones above it.

**Swap a block renderer.** Keep the pages; change how one kind of block draws.

```tsx
createBlogPages(ballad, {
  components: {
    PullQuote: ({ block }) => <aside className="callout">{block.payload.text}</aside>,
    markdown: { a: MyLink, h2: MyHeading },   // elements inside prose
  },
});
```

**Draw the pages yourself.** Keep the data loading, metadata, static params, feed and revalidation; render from the loaded data.

```tsx
import { Article, PostList } from "@balladlabs/next/react";

createBlogPages(ballad, {
  render: {
    index: ({ collection, posts, hrefFor }) => (
      <main>
        <h1>{collection.name}</h1>
        <PostList posts={posts} hrefFor={hrefFor} renderItem={(p, href) => <MyCard post={p} href={href} />} />
      </main>
    ),
    post: ({ post, summary }) => (
      <main>
        <Article post={post} author={summary?.author} header={<MyHeader post={post} />}>
          <Newsletter />
        </Article>
      </main>
    ),
  },
  layout: (content) => <Shell>{content}</Shell>,
});
```

**Or skip the page factories.** The client and the components stand on their own.

```tsx
import { createBallad, postMetadata } from "@balladlabs/next";
import { Article, JsonLd } from "@balladlabs/next/react";

const ballad = createBallad();
const { items } = (await ballad.posts()) ?? { items: [] };   // every published post, newest first
const post = await ballad.post(slug);                         // blocks + SEO, or null
export const generateMetadata = async ({ params }) => postMetadata(await ballad.post((await params).slug), ballad);
```

## What's in the box

| Import | What |
| --- | --- |
| `@balladlabs/next` | `createBallad`, `postMetadata`, `collectionMetadata`, `articleJsonLd`, `breadcrumbJsonLd`, `rssFeed`, `sitemapEntries`, `formatDate`, `readingTime`, types |
| `@balladlabs/next/react` | `Article`, `Blocks`, `PostList`, `PostCard`, `JsonLd`, the default block components |
| `@balladlabs/next/pages` | `createBlogPages`, `createRevalidateHandler` |
| `@balladlabs/next/styles.css` | optional default styles, `ballad-*` classes |

## How caching works

Every fetch is tagged (`ballad`, `ballad:collection:<slug>`, `ballad:post:<slug>`) and cached for five minutes by default. When Ballad publishes, it POSTs `{ secret, collection, slug }` to your revalidate route; the handler checks the secret in constant time and revalidates exactly those tags and the pages for that post, the index and the feed. Set `revalidate: 0` on the client to never cache, or `revalidatePaths: ["/"]` in `createBlogPages` if your home page lists posts.

## Options

```ts
createBallad({
  apiKey,         // BALLAD_API_KEY
  baseUrl,        // BALLAD_API_URL, default https://app.balladlabs.com
  collection,     // BALLAD_COLLECTION, default "blog"
  siteUrl,        // NEXT_PUBLIC_SITE_URL / BALLAD_SITE_URL
  basePath,       // "/blog"
  revalidate,     // seconds, default 300; 0 = no-store
});

createBlogPages(ballad, {
  basePath, collection, prefix,
  components,           // block renderers + markdown elements
  render: { index, post },
  layout,
  index: { title, description },
  feed: { title, limit } | false,
  publisher, jsonLd,
  revalidatePaths, revalidateSecret,
});
```

Unconfigured (no key), the client is inert and the pages render their empty states, so builds and previews succeed before the key exists.

## Requirements

Next.js 15 or later on the App Router, React 18 or later. Content arrives as data, never as raw HTML: markdown renders to React nodes and anything that looks like markup in it is escaped.

## License

MIT
