import { describe, expect, it } from "vitest";
import { rssFeed, sitemapEntries, xml } from "./feed";
import type { PostSummary } from "./types";

const ballad = {
  siteUrl: "https://acme.com",
  basePath: "/blog",
  permalink: (slug: string, url?: string | null) => url ?? `https://acme.com/blog/${slug}`,
};
const items: PostSummary[] = [
  {
    slug: "one",
    title: "One & Two",
    tier: "cadence",
    publishedAt: "2026-03-04T10:00:00Z",
    excerpt: "An <excerpt>",
    author: "Ada",
    url: null,
    image: "https://app.balladlabs.com/api/content/assets/x.png",
    artImage: null,
  },
];

describe("rssFeed", () => {
  it("builds a valid summary feed with escaped text and an enclosure", () => {
    const out = rssFeed({ slug: "blog", name: "Acme Blog", theme: null, tagline: "Notes" }, items, ballad, { limit: 10 });
    expect(out).toContain("<title>Acme Blog</title>");
    expect(out).toContain("<link>https://acme.com/blog</link>");
    expect(out).toContain('<atom:link href="https://acme.com/blog/rss.xml"');
    expect(out).toContain("<title>One &amp; Two</title>");
    expect(out).toContain("<description>An &lt;excerpt&gt;</description>");
    expect(out).toContain("<dc:creator>Ada</dc:creator>");
    expect(out).toContain('type="image/png"');
    expect(out).toContain("<pubDate>Wed, 04 Mar 2026 10:00:00 GMT</pubDate>");
    expect(out).toContain('<guid isPermaLink="true">https://acme.com/blog/one</guid>');
  });
  it("escapes all five xml characters", () => {
    expect(xml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;");
  });
});

describe("sitemapEntries", () => {
  it("lists the index and each post with its date", () => {
    const out = sitemapEntries(items, ballad);
    expect(out[0]).toMatchObject({ url: "https://acme.com/blog", changeFrequency: "daily" });
    expect(out[1]).toMatchObject({ url: "https://acme.com/blog/one", lastModified: "2026-03-04T10:00:00Z" });
    expect(sitemapEntries(items, ballad, { index: false })).toHaveLength(1);
  });
});
