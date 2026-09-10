/**
 * The content API contract (Ballad app: `GET /api/content/collections/[slug]`
 * and `GET /api/content/items/[slug]`, `Authorization: Bearer <key>`).
 * Blocks are a discriminated union so a renderer can switch on `type`;
 * anything the app adds later arrives as `UnknownBlock` and is skipped, so
 * a new block type never takes a site down.
 */
export type ProseBlock = {
  type: "prose";
  position: number;
  payload: { markdown: string };
};
export type HeroImageBlock = {
  type: "hero_image";
  position: number;
  payload: {
    alt: string;
    width: number;
    height: number;
    url: string;
    s3Key?: string;
    /** Brand-card heroes: the title-less variant, for on-page use beside
     * the text title (the titled card stays the og:image). */
    artUrl?: string;
    artS3Key?: string;
  };
};
export type PullQuoteBlock = {
  type: "pull_quote";
  position: number;
  payload: { text: string };
};
export type CtaBlock = {
  type: "cta";
  position: number;
  payload: { text: string; url?: string };
};
export type CodeEmbedBlock = {
  type: "code_embed";
  position: number;
  payload: { code: string; lang?: string; caption?: string };
};
export type UnknownBlock = {
  type: string;
  position: number;
  payload: Record<string, unknown>;
};
export type ContentBlock =
  | ProseBlock
  | HeroImageBlock
  | PullQuoteBlock
  | CtaBlock
  | CodeEmbedBlock
  | UnknownBlock;

export type Tier = "cadence" | "signature" | (string & {});

export type ContentSeo = {
  title: string;
  description: string | null;
  canonical: string | null;
  ogImage: string | null;
  /** schema.org Article, ready for a <script type="application/ld+json">. */
  jsonLd: Record<string, unknown>;
};

/** A published article with its rendered blocks. */
export type Post = {
  slug: string;
  title: string | null;
  tier: Tier;
  collectionSlug: string | null;
  publishedAt: string | null;
  blocks: ContentBlock[];
  seo: ContentSeo;
};

/** One entry of a collection's feed — enough for a card, an RSS item, a
 * sitemap line. The full body comes from `Post`. */
export type PostSummary = {
  slug: string;
  title: string | null;
  tier: Tier;
  publishedAt: string | null;
  excerpt: string | null;
  author: string | null;
  /** Absolute permalink on your site, when Ballad knows your site URL. */
  url: string | null;
  image: string | null;
  /** Title-less variant of a brand-card hero, for a listing card. */
  artImage: string | null;
};

export type Collection = {
  slug: string;
  name: string;
  theme: string | null;
  /** The founder's one-liner — a ready description for the index page. */
  tagline: string | null;
  items: PostSummary[];
  nextCursor: string | null;
};

export class BalladApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BalladApiError";
  }
}
