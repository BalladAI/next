import type {
  CodeEmbedBlock,
  ContentBlock,
  CtaBlock,
  HeroImageBlock,
  ProseBlock,
  PullQuoteBlock,
} from "./types";

/**
 * Type guards for blocks. `ContentBlock` includes an unknown member whose
 * `type` is any string (so a block type Ballad adds later still parses),
 * which means `block.type === "prose"` alone can't narrow the payload. These
 * can: `if (isProse(block)) block.payload.markdown`.
 */
export type KnownBlock = ProseBlock | HeroImageBlock | PullQuoteBlock | CtaBlock | CodeEmbedBlock;
export type KnownBlockType = KnownBlock["type"];

export const KNOWN_BLOCK_TYPES: readonly KnownBlockType[] = [
  "prose",
  "hero_image",
  "pull_quote",
  "cta",
  "code_embed",
];

export const isProse = (b: ContentBlock): b is ProseBlock => b.type === "prose";
export const isHeroImage = (b: ContentBlock): b is HeroImageBlock => b.type === "hero_image";
export const isPullQuote = (b: ContentBlock): b is PullQuoteBlock => b.type === "pull_quote";
export const isCta = (b: ContentBlock): b is CtaBlock => b.type === "cta";
export const isCodeEmbed = (b: ContentBlock): b is CodeEmbedBlock => b.type === "code_embed";
export const isKnownBlock = (b: ContentBlock): b is KnownBlock =>
  (KNOWN_BLOCK_TYPES as readonly string[]).includes(b.type);

/** `blockOfType(b, "prose")` → `ProseBlock | null`. */
export function blockOfType<T extends KnownBlockType>(
  b: ContentBlock,
  type: T,
): Extract<KnownBlock, { type: T }> | null {
  return b.type === type ? (b as Extract<KnownBlock, { type: T }>) : null;
}

/** Only the blocks this package knows how to render, typed narrowly. */
export function knownBlocks(blocks: ContentBlock[]): KnownBlock[] {
  return blocks.filter(isKnownBlock);
}
