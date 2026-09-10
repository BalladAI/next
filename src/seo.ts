import type { Metadata } from "next";
import type { Ballad } from "./client";
import type { Collection, Post } from "./types";

/**
 * Next.js `Metadata` for a post: title, description, canonical on your
 * domain, Open Graph article and Twitter card. Pass the result straight out
 * of `generateMetadata`, or spread it and add your own.
 */
export function postMetadata(
  post: Post,
  ballad: Pick<Ballad, "permalink" | "basePath">,
  opts: { feedTitle?: string | null; feedPath?: string | null } = {},
): Metadata {
  const { seo } = post;
  const canonical = ballad.permalink(post.slug, seo.canonical);
  const feedPath = opts.feedPath === undefined ? `${ballad.basePath}/rss.xml` : opts.feedPath;
  return {
    title: seo.title,
    description: seo.description ?? undefined,
    alternates: {
      canonical,
      ...(feedPath
        ? { types: { "application/rss+xml": [{ url: feedPath, title: opts.feedTitle ?? "Blog" }] } }
        : {}),
    },
    openGraph: {
      type: "article",
      title: seo.title,
      description: seo.description ?? undefined,
      url: canonical,
      publishedTime: post.publishedAt ?? undefined,
      images: seo.ogImage ? [seo.ogImage] : undefined,
    },
    twitter: {
      card: seo.ogImage ? "summary_large_image" : "summary",
      title: seo.title,
      description: seo.description ?? undefined,
      images: seo.ogImage ? [seo.ogImage] : undefined,
    },
  };
}

/** Metadata for the index page, from the collection's name and tagline. */
export function collectionMetadata(
  collection: Pick<Collection, "name" | "theme" | "tagline"> | null,
  ballad: Pick<Ballad, "basePath" | "siteUrl">,
  opts: { title?: string; description?: string; feedPath?: string | null } = {},
): Metadata {
  const title = opts.title ?? collection?.name ?? "Blog";
  const description = opts.description ?? collection?.tagline ?? collection?.theme ?? undefined;
  const feedPath = opts.feedPath === undefined ? `${ballad.basePath}/rss.xml` : opts.feedPath;
  return {
    title,
    description,
    alternates: {
      canonical: ballad.siteUrl ? `${ballad.siteUrl}${ballad.basePath}` : ballad.basePath,
      ...(feedPath ? { types: { "application/rss+xml": [{ url: feedPath, title }] } } : {}),
    },
    openGraph: { type: "website", title, description },
  };
}

/**
 * The article's schema.org JSON-LD. Ballad supplies the Article; you supply
 * the publisher (it's your site) and it's merged in. `dateModified` is
 * present only when Ballad tracked a modification.
 */
export function articleJsonLd(
  post: Post,
  opts: { publisher?: Record<string, unknown>; url?: string } = {},
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    ...post.seo.jsonLd,
    ...(opts.url ? { url: opts.url, mainEntityOfPage: opts.url } : {}),
    ...(opts.publisher ? { publisher: opts.publisher } : {}),
  };
}

/** BreadcrumbList: Home → Blog → the post. */
export function breadcrumbJsonLd(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
