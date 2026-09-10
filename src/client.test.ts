import { describe, expect, it, vi } from "vitest";
import { createBallad } from "./client";

const collectionBody = (items: { slug: string; publishedAt: string }[], nextCursor: string | null) => ({
  slug: "blog",
  name: "Blog",
  theme: null,
  tagline: "One line",
  items: items.map((i) => ({
    ...i,
    title: i.slug,
    tier: "cadence",
    excerpt: null,
    author: "Ada",
    url: null,
    image: null,
    artImage: null,
  })),
  nextCursor,
});

function fakeFetch(routes: Record<string, unknown>) {
  const calls: { url: string; init: RequestInit & { next?: unknown } }[] = [];
  const f = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const path = new URL(url).pathname + new URL(url).search;
    const body = routes[path];
    if (body === undefined) return new Response("nope", { status: 404 });
    return Response.json(body);
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("createBallad", () => {
  it("is inert without a key", async () => {
    const ballad = createBallad({ apiKey: "", fetch: vi.fn() as unknown as typeof fetch });
    expect(ballad.configured).toBe(false);
    expect(await ballad.post("x")).toBeNull();
    expect(await ballad.posts()).toBeNull();
  });

  it("fetches with the bearer key, cache tags and revalidate", async () => {
    const { f, calls } = fakeFetch({ "/api/content/items/hello": { slug: "hello", blocks: [], seo: {} } });
    const ballad = createBallad({ apiKey: "blc_1", baseUrl: "https://api.test/", fetch: f });
    const post = await ballad.post("hello");
    expect(post?.slug).toBe("hello");
    expect(calls[0]?.url).toBe("https://api.test/api/content/items/hello");
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe("Bearer blc_1");
    expect(calls[0]?.init.next).toEqual({ revalidate: 300, tags: ["ballad", "ballad:post:hello"] });
  });

  it("uses no-store when revalidate is 0", async () => {
    const { f, calls } = fakeFetch({ "/api/content/items/a": { slug: "a" } });
    await createBallad({ apiKey: "k", baseUrl: "https://api.test", fetch: f, revalidate: 0 }).post("a");
    expect(calls[0]?.init.cache).toBe("no-store");
    expect(calls[0]?.init.next).toBeUndefined();
  });

  it("pages through a collection and sorts newest first", async () => {
    const { f, calls } = fakeFetch({
      "/api/content/collections/blog?limit=100": collectionBody(
        [{ slug: "old", publishedAt: "2026-01-01T00:00:00Z" }],
        "c2",
      ),
      "/api/content/collections/blog?limit=100&cursor=c2": collectionBody(
        [{ slug: "new", publishedAt: "2026-02-01T00:00:00Z" }],
        null,
      ),
    });
    const ballad = createBallad({ apiKey: "k", baseUrl: "https://api.test", fetch: f });
    const all = await ballad.posts();
    expect(all?.items.map((i) => i.slug)).toEqual(["new", "old"]);
    expect(all?.collection.nextCursor).toBeNull();
    expect(calls).toHaveLength(2);
    expect(calls[0]?.init.next).toMatchObject({ tags: ["ballad", "ballad:collection:blog"] });
  });

  it("stops on a repeating cursor", async () => {
    const { f, calls } = fakeFetch({
      "/api/content/collections/blog?limit=100": collectionBody([{ slug: "a", publishedAt: "2026-01-01T00:00:00Z" }], "loop"),
      "/api/content/collections/blog?limit=100&cursor=loop": collectionBody([{ slug: "b", publishedAt: "2026-01-02T00:00:00Z" }], "loop"),
    });
    const all = await createBallad({ apiKey: "k", baseUrl: "https://api.test", fetch: f }).posts();
    expect(all?.items).toHaveLength(2);
    expect(calls).toHaveLength(2);
  });

  it("builds permalinks from the API url, else the site url and base path", () => {
    const ballad = createBallad({ apiKey: "k", siteUrl: "https://acme.com/", basePath: "/writing/", fetch: vi.fn() as unknown as typeof fetch });
    expect(ballad.permalink("x")).toBe("https://acme.com/writing/x");
    expect(ballad.permalink("x", "https://acme.com/blog/x")).toBe("https://acme.com/blog/x");
    expect(ballad.basePath).toBe("/writing");
  });

  it("throws on a server error", async () => {
    const f = vi.fn(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
    await expect(createBallad({ apiKey: "k", fetch: f }).post("x")).rejects.toMatchObject({ status: 500 });
  });
});
