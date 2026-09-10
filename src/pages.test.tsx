import { describe, expect, it, vi } from "vitest";

const tags: string[] = [];
const paths: string[] = [];
vi.mock("next/cache", () => ({
  revalidateTag: (t: string) => tags.push(t),
  revalidatePath: (p: string) => paths.push(p),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { createBallad } from "./client";
import { createBlogPages, createRevalidateHandler } from "./pages/index";

const post = (req: string, body: unknown) => new Request("http://x/api/revalidate", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

describe("createRevalidateHandler", () => {
  it("rejects a bad secret and revalidates tags + paths on a good one", async () => {
    const { POST } = createRevalidateHandler({ secret: "s3cret", basePath: "/blog", paths: ["/blog/rss.xml"] });
    expect((await POST(post("", { secret: "nope", slug: "a" }))).status).toBe(401);
    expect((await POST(new Request("http://x", { method: "POST", body: "{" }))).status).toBe(400);
    const res = await POST(post("", { secret: "s3cret", collection: "blog", slug: "hello" }));
    expect(res.status).toBe(200);
    expect(tags).toEqual(["ballad", "ballad:collection:blog", "ballad:post:hello"]);
    expect(paths).toEqual(["/blog", "/blog/hello", "/blog/rss.xml"]);
  });
  it("is 503 with no secret configured and ignores other collections", async () => {
    const { POST } = createRevalidateHandler({ secret: "", collection: "blog" });
    expect((await POST(post("", { secret: "x" }))).status).toBe(503);
    const { POST: P2 } = createRevalidateHandler({ secret: "s", collection: "blog" });
    const res = await P2(post("", { secret: "s", collection: "changelog", slug: "z" }));
    expect(await res.json()).toMatchObject({ ignored: "changelog" });
  });
});

describe("createBlogPages", () => {
  const f = vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    if (path === "/api/content/collections/blog")
      return Response.json({ slug: "blog", name: "Acme Blog", theme: null, tagline: "Notes", nextCursor: null, items: [{ slug: "hello", title: "Hello", tier: "cadence", publishedAt: "2026-03-04T10:00:00Z", excerpt: "E", author: "Ada", url: null, image: null, artImage: null }] });
    if (path === "/api/content/items/hello")
      return Response.json({ slug: "hello", title: "Hello", tier: "cadence", collectionSlug: "blog", publishedAt: "2026-03-04T10:00:00Z", blocks: [{ type: "prose", position: 0, payload: { markdown: "Hi" } }], seo: { title: "Hello", description: "D", canonical: null, ogImage: null, jsonLd: { "@type": "Article" } } });
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;
  const ballad = createBallad({ apiKey: "k", baseUrl: "https://api.test", siteUrl: "https://acme.com", fetch: f });
  const blog = createBlogPages(ballad, { basePath: "/blog", publisher: { name: "Acme" } });

  it("produces static params, metadata, a feed and a sitemap from one client", async () => {
    expect(await blog.post.generateStaticParams()).toEqual([{ slug: "hello" }]);
    const meta = await blog.post.generateMetadata({ params: Promise.resolve({ slug: "hello" }) });
    expect(meta.alternates?.canonical).toBe("https://acme.com/blog/hello");
    expect(await blog.post.generateMetadata({ params: Promise.resolve({ slug: "nope" }) })).toEqual({});
    const idx = await blog.index.generateMetadata();
    expect(idx.title).toBe("Acme Blog");
    const rss = await blog.rss.GET();
    expect(rss.headers.get("content-type")).toContain("rss+xml");
    expect(await rss.text()).toContain("<title>Hello</title>");
    expect(await blog.sitemap()).toHaveLength(2);
  });
  it("404s a missing post", async () => {
    await expect(blog.post.Page({ params: Promise.resolve({ slug: "nope" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
