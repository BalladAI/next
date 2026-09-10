import { describe, expect, it } from "vitest";
import { articleJsonLd, collectionMetadata, postMetadata } from "./seo";
import type { Post } from "./types";

const post: Post = {
  slug: "hello",
  title: "Hello",
  tier: "signature",
  collectionSlug: "blog",
  publishedAt: "2026-03-04T10:00:00Z",
  blocks: [],
  seo: {
    title: "Hello | Acme",
    description: "A description.",
    canonical: null,
    ogImage: "https://app.balladlabs.com/api/content/assets/h.png",
    jsonLd: { "@type": "Article", headline: "Hello" },
  },
};
const ballad = { basePath: "/blog", siteUrl: "https://acme.com", permalink: (s: string, u?: string | null) => u ?? `https://acme.com/blog/${s}` };

describe("postMetadata", () => {
  it("puts the canonical on the site and fills OG + Twitter", () => {
    const m = postMetadata(post, ballad, { feedTitle: "Acme Blog" });
    expect(m.title).toBe("Hello | Acme");
    expect(m.alternates?.canonical).toBe("https://acme.com/blog/hello");
    expect(m.openGraph).toMatchObject({ type: "article", url: "https://acme.com/blog/hello", publishedTime: post.publishedAt });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
    expect((m.alternates?.types as Record<string, unknown>)["application/rss+xml"]).toEqual([{ url: "/blog/rss.xml", title: "Acme Blog" }]);
  });
  it("prefers the API canonical when present", () => {
    const m = postMetadata({ ...post, seo: { ...post.seo, canonical: "https://acme.com/writing/hello" } }, ballad);
    expect(m.alternates?.canonical).toBe("https://acme.com/writing/hello");
  });
});

describe("collectionMetadata", () => {
  it("uses the collection's name and tagline", () => {
    const m = collectionMetadata({ name: "Acme Blog", theme: "Theme", tagline: "One line" }, ballad);
    expect(m.title).toBe("Acme Blog");
    expect(m.description).toBe("One line");
    expect(m.alternates?.canonical).toBe("https://acme.com/blog");
  });
});

describe("articleJsonLd", () => {
  it("merges context, url and publisher onto Ballad's Article", () => {
    const ld = articleJsonLd(post, { url: "https://acme.com/blog/hello", publisher: { "@type": "Organization", name: "Acme" } });
    expect(ld).toMatchObject({ "@context": "https://schema.org", "@type": "Article", headline: "Hello", url: "https://acme.com/blog/hello", publisher: { name: "Acme" } });
  });
});
