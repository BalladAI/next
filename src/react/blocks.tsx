import type { ComponentType, ReactNode } from "react";
import Markdown, { type Components as MarkdownComponents } from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  CodeEmbedBlock,
  ContentBlock,
  CtaBlock,
  HeroImageBlock,
  ProseBlock,
  PullQuoteBlock,
  UnknownBlock,
} from "../types";

/**
 * The default block renderers. Every one can be replaced through
 * `components`, and the markdown elements inside prose through
 * `components.markdown` (react-markdown's own `components` map). Markdown
 * is rendered as React nodes — raw HTML in the content is escaped, since it
 * arrives over the network. Class names are `${prefix}-…` with prefix
 * "ballad" by default; the optional stylesheet styles them.
 */
export type BlockComponents = {
  Prose?: ComponentType<{ block: ProseBlock; prefix: string; markdown?: MarkdownComponents }>;
  HeroImage?: ComponentType<{ block: HeroImageBlock; prefix: string }>;
  PullQuote?: ComponentType<{ block: PullQuoteBlock; prefix: string }>;
  Cta?: ComponentType<{ block: CtaBlock; prefix: string }>;
  Code?: ComponentType<{ block: CodeEmbedBlock; prefix: string }>;
  /** A block type this package doesn't know; default renders nothing. */
  Unknown?: ComponentType<{ block: UnknownBlock; prefix: string }>;
  /** Overrides for elements inside prose (a, h2, img, code…). */
  markdown?: MarkdownComponents;
};

export function Prose({
  block,
  prefix,
  markdown,
}: {
  block: ProseBlock;
  prefix: string;
  markdown?: MarkdownComponents;
}) {
  return (
    <div className={`${prefix}-prose`}>
      <Markdown remarkPlugins={[remarkGfm]} components={markdown}>
        {block.payload.markdown}
      </Markdown>
    </div>
  );
}

export function HeroImage({ block, prefix }: { block: HeroImageBlock; prefix: string }) {
  const p = block.payload;
  // Served from Ballad's origin, sized and immutable-cached; a plain <img>
  // keeps it out of your image optimizer's allowlist and quota.
  return (
    <img
      className={`${prefix}-hero`}
      src={p.artUrl ?? p.url}
      alt={p.alt ?? ""}
      width={p.width}
      height={p.height}
      loading="eager"
      decoding="async"
    />
  );
}

export function PullQuote({ block, prefix }: { block: PullQuoteBlock; prefix: string }) {
  return <blockquote className={`${prefix}-pullquote`}>{block.payload.text}</blockquote>;
}

export function Cta({ block, prefix }: { block: CtaBlock; prefix: string }) {
  const { text, url } = block.payload;
  return (
    <p className={`${prefix}-cta`}>
      {url ? (
        <a href={url} className={`${prefix}-cta-link`}>
          {text}
        </a>
      ) : (
        text
      )}
    </p>
  );
}

export function Code({ block, prefix }: { block: CodeEmbedBlock; prefix: string }) {
  const { code, lang, caption } = block.payload;
  return (
    <figure className={`${prefix}-code`}>
      <pre>
        <code className={lang ? `language-${lang}` : undefined}>{code}</code>
      </pre>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

export const defaultComponents = { Prose, HeroImage, PullQuote, Cta, Code };

export function renderBlock(
  block: ContentBlock,
  components: BlockComponents,
  prefix: string,
): ReactNode {
  const c = { ...defaultComponents, ...components };
  switch (block.type) {
    case "prose":
      return <c.Prose block={block as ProseBlock} prefix={prefix} markdown={components.markdown} />;
    case "hero_image":
      return <c.HeroImage block={block as HeroImageBlock} prefix={prefix} />;
    case "pull_quote":
      return <c.PullQuote block={block as PullQuoteBlock} prefix={prefix} />;
    case "cta":
      return <c.Cta block={block as CtaBlock} prefix={prefix} />;
    case "code_embed":
      return <c.Code block={block as CodeEmbedBlock} prefix={prefix} />;
    default:
      return components.Unknown ? <components.Unknown block={block} prefix={prefix} /> : null;
  }
}
