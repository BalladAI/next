import type { ReactNode } from "react";
import { formatDate, heroOf, orderBlocks, readingTime } from "../text";
import type { Post, PostSummary } from "../types";
import { type BlockComponents, renderBlock } from "./blocks";

/** Render a post's blocks in order. Nothing around them. */
export function Blocks({
  blocks,
  components = {},
  prefix = "ballad",
  skipHero = false,
}: {
  blocks: Post["blocks"];
  components?: BlockComponents;
  prefix?: string;
  /** Leave the opening image out (you're placing it yourself). */
  skipHero?: boolean;
}) {
  return (
    <>
      {orderBlocks(blocks)
        .filter((b) => !(skipHero && b.type === "hero_image"))
        .map((b) => (
          <div key={`${b.type}-${b.position}`} className={`${prefix}-block ${prefix}-block-${b.type}`}>
            {renderBlock(b, components, prefix)}
          </div>
        ))}
    </>
  );
}

/**
 * A whole article: header (title, date, reading time, author), the opening
 * image, the blocks. Every part is optional or replaceable — pass `header`
 * to render your own, `components` to swap block renderers, or use `Blocks`
 * directly and keep only the pieces you want.
 */
export function Article({
  post,
  author,
  components,
  prefix = "ballad",
  header,
  showHero = true,
  showMeta = true,
  children,
}: {
  post: Post;
  /** Author name, from the collection feed (the post itself doesn't carry it). */
  author?: string | null;
  components?: BlockComponents;
  prefix?: string;
  /** Your own header; `null` for none; omit for the default. */
  header?: ReactNode | null;
  showHero?: boolean;
  showMeta?: boolean;
  /** Rendered after the blocks (a CTA, related posts…). */
  children?: ReactNode;
}) {
  const hero = heroOf(post);
  return (
    <article className={`${prefix}-article`}>
      {header === undefined ? (
        <header className={`${prefix}-header`}>
          <h1 className={`${prefix}-title`}>{post.title ?? post.slug}</h1>
          {showMeta && (
            <p className={`${prefix}-meta`}>
              {post.publishedAt && (
                <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              )}
              {post.publishedAt && <span aria-hidden> · </span>}
              <span>{readingTime(post)} min read</span>
              {author && (
                <>
                  <span aria-hidden> · </span>
                  <span>{author}</span>
                </>
              )}
            </p>
          )}
        </header>
      ) : (
        header
      )}
      {showHero && hero && (
        <div className={`${prefix}-block ${prefix}-block-hero_image`}>
          {renderBlock(
            { type: "hero_image", position: -1, payload: hero },
            components ?? {},
            prefix,
          )}
        </div>
      )}
      <Blocks blocks={post.blocks} components={components} prefix={prefix} skipHero />
      {children}
    </article>
  );
}

/** JSON-LD in a script tag, for a post page or an index. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD is data, not markup; "<" is escaped so it can't close the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** One post in a list: title, date, excerpt, image. Replace freely. */
export function PostCard({
  post,
  href,
  prefix = "ballad",
  showImage = true,
}: {
  post: PostSummary;
  href: string;
  prefix?: string;
  showImage?: boolean;
}) {
  const image = post.artImage ?? post.image;
  return (
    <article className={`${prefix}-card`}>
      {showImage && image && (
        <a href={href} className={`${prefix}-card-media`}>
          <img src={image} alt="" loading="lazy" decoding="async" />
        </a>
      )}
      <h2 className={`${prefix}-card-title`}>
        <a href={href}>{post.title ?? post.slug}</a>
      </h2>
      <p className={`${prefix}-card-meta`}>
        {post.publishedAt && (
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        )}
        {post.author && (
          <>
            <span aria-hidden> · </span>
            <span>{post.author}</span>
          </>
        )}
      </p>
      {post.excerpt && <p className={`${prefix}-card-excerpt`}>{post.excerpt}</p>}
    </article>
  );
}

/** The index list: a `PostCard` per post, or your own `renderItem`. */
export function PostList({
  posts,
  hrefFor,
  prefix = "ballad",
  renderItem,
  empty = "Nothing published yet.",
}: {
  posts: PostSummary[];
  hrefFor: (post: PostSummary) => string;
  prefix?: string;
  renderItem?: (post: PostSummary, href: string) => ReactNode;
  empty?: ReactNode;
}) {
  if (posts.length === 0) return <p className={`${prefix}-empty`}>{empty}</p>;
  return (
    <div className={`${prefix}-list`}>
      {posts.map((p) => {
        const href = hrefFor(p);
        return (
          <div key={p.slug} className={`${prefix}-list-item`}>
            {renderItem ? renderItem(p, href) : <PostCard post={p} href={href} prefix={prefix} />}
          </div>
        );
      })}
    </div>
  );
}
