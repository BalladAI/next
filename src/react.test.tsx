import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Article, Blocks, JsonLd, PostList } from "./react/index";
import type { Post } from "./types";

const post: Post = {
  slug: "hello",
  title: "Hello world",
  tier: "cadence",
  collectionSlug: "blog",
  publishedAt: "2026-03-04T10:00:00Z",
  blocks: [
    { type: "prose", position: 1, payload: { markdown: "## Why\n\nBecause **bold** and <b>raw</b>." } },
    { type: "hero_image", position: 0, payload: { alt: "cover", width: 1200, height: 630, url: "https://x/a.png", artUrl: "https://x/art.png" } },
    { type: "pull_quote", position: 2, payload: { text: "The filter is the failure." } },
    { type: "code_embed", position: 3, payload: { code: "x = 1", lang: "py", caption: "One" } },
    { type: "cta", position: 4, payload: { text: "Try it", url: "https://acme.com/join" } },
    { type: "mystery", position: 5, payload: {} },
  ],
  seo: { title: "t", description: null, canonical: null, ogImage: null, jsonLd: {} },
};

describe("Article", () => {
  it("renders header, hero (art variant), and blocks in order; escapes raw html", () => {
    const html = renderToStaticMarkup(<Article post={post} author="Ada" />);
    expect(html).toContain('<h1 class="ballad-title">Hello world</h1>');
    expect(html).toContain("1 min read");
    expect(html).toContain("Ada");
    expect(html).toContain('src="https://x/art.png"');
    expect(html.indexOf("ballad-block-hero_image")).toBeLessThan(html.indexOf("ballad-block-prose"));
    expect(html).toContain("<h2>Why</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).not.toContain("<b>raw</b>");
    expect(html).toContain("ballad-pullquote");
    expect(html).toContain('class="language-py"');
    expect(html).toContain('href="https://acme.com/join"');
    expect(html).not.toContain("mystery-rendered");
  });
  it("lets every block component be replaced", () => {
    const html = renderToStaticMarkup(
      <Blocks
        blocks={post.blocks}
        components={{
          PullQuote: ({ block }) => <aside data-quote>{block.payload.text}</aside>,
          Unknown: ({ block }) => <div data-unknown={block.type} />,
          markdown: { h2: ({ children }) => <h2 className="mine">{children}</h2> },
        }}
      />,
    );
    expect(html).toContain("<aside data-quote=\"true\">");
    expect(html).toContain('data-unknown="mystery"');
    expect(html).toContain('<h2 class="mine">Why</h2>');
  });
  it("supports a custom header and no hero", () => {
    const html = renderToStaticMarkup(<Article post={post} header={<p>custom</p>} showHero={false} />);
    expect(html).toContain("<p>custom</p>");
    expect(html).not.toContain("ballad-title");
    expect(html).not.toContain("https://x/art.png");
  });
});

describe("PostList + JsonLd", () => {
  it("renders cards with links and an empty state", () => {
    const html = renderToStaticMarkup(
      <PostList
        posts={[{ slug: "a", title: "A", tier: "cadence", publishedAt: "2026-01-01T00:00:00Z", excerpt: "E", author: "Ada", url: null, image: null, artImage: null }]}
        hrefFor={(p) => `/blog/${p.slug}`}
      />,
    );
    expect(html).toContain('href="/blog/a"');
    expect(html).toContain("ballad-card-excerpt");
    expect(renderToStaticMarkup(<PostList posts={[]} hrefFor={() => "/"} />)).toContain("Nothing published yet.");
  });
  it("escapes < in JSON-LD", () => {
    const html = renderToStaticMarkup(<JsonLd data={{ a: "</script>" }} />);
    expect(html).toContain("\\u003c/script>");
    expect(html).toContain('type="application/ld+json"');
  });
});

describe("guards", () => {
  it("narrow the union and pick known blocks", async () => {
    const { isProse, knownBlocks, blockOfType, isKnownBlock } = await import("./guards");
    const prose = post.blocks.find(isProse);
    expect(prose?.payload.markdown).toContain("Why");
    expect(knownBlocks(post.blocks)).toHaveLength(5);
    expect(isKnownBlock(post.blocks[5] as never)).toBe(false);
    expect(blockOfType(post.blocks[1] as never, "hero_image")?.payload.width).toBe(1200);
    expect(blockOfType(post.blocks[1] as never, "prose")).toBeNull();
  });
});
