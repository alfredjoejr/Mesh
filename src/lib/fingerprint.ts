/**
 * Forensic Message Fingerprinting Engine
 * 
 * Embeds a unique, invisible fingerprint into each message variant
 * so leaked screenshots or copy-pasted text can be traced to a specific recipient.
 * 
 * Layers (ordered by robustness):
 *  1. Zero-width characters — survives copy-paste
 *  2. Unicode homoglyphs — survives screenshots
 *  3. Punctuation variants — survives OCR + screenshots
 *  4. Whitespace patterns — survives screenshots
 * 
 * Layer 5 (AI linguistic paraphrasing) is in fingerprint-ai.ts
 */

import crypto from 'crypto';

// ── Constants ────────────────────────────────────────────────────────

/** Zero-width characters used for binary encoding */
const ZW_ZERO = '\u200B'; // Zero-width space  → bit 0
const ZW_ONE  = '\u200C'; // Zero-width non-joiner → bit 1
const ZW_SEP  = '\u200D'; // Zero-width joiner → separator / start marker
const ZW_END  = '\uFEFF'; // BOM / zero-width no-break space → end marker

/** 
 * Homoglyph map: ASCII char → visually identical Unicode alternatives.
 * Each entry represents a bit: original = 0, replacement = 1.
 */
const HOMOGLYPH_MAP: Record<string, string> = {
  'a': '\u0430', // Cyrillic а
  'c': '\u0441', // Cyrillic с
  'e': '\u0435', // Cyrillic е
  'o': '\u043E', // Cyrillic о
  'p': '\u0440', // Cyrillic р
  's': '\u0455', // Cyrillic ѕ
  'x': '\u0445', // Cyrillic х
  'i': '\u0456', // Cyrillic і
};

const HOMOGLYPH_REVERSE: Record<string, string> = {};
for (const [ascii, cyrillic] of Object.entries(HOMOGLYPH_MAP)) {
  HOMOGLYPH_REVERSE[cyrillic] = ascii;
}

/** All homoglyph values for detection */
const HOMOGLYPH_VALUES = new Set(Object.values(HOMOGLYPH_MAP));

/**
 * Punctuation variant groups.
 * Each group has semantically equivalent options. The index encodes bits.
 * For a group with 4 options, we encode 2 bits.
 */
const PUNCTUATION_VARIANTS: Array<{
  pattern: RegExp;
  variants: string[];
  bitsPerSlot: number;
}> = [
  {
    // Time format: "7:00 PM" vs "7 PM" vs "7:00 pm" vs "7:00PM"
    pattern: /\b(\d{1,2})(?::00)?\s*(?:PM|pm|AM|am)\b/gi,
    variants: ['$1:00 PM', '$1 PM', '$1:00 pm', '$1:00PM'],
    bitsPerSlot: 2,
  },
  {
    // Ellipsis styles: "..." vs "…" vs ". . ." vs ".."
    pattern: /\.{2,3}|…/g,
    variants: ['...', '\u2026', '. . .', '..'],
    bitsPerSlot: 2,
  },
  {
    // Dash styles: " - " vs " — " vs " – " vs " - "
    pattern: /\s[-–—]\s/g,
    variants: [' - ', ' \u2014 ', ' \u2013 ', '  -  '],
    bitsPerSlot: 2,
  },
  {
    // Quote styles: "text" vs "text" vs 'text' vs «text»
    pattern: /[""\u201C\u201D]([^""\u201C\u201D]{1,50})[""\u201C\u201D]/g,
    variants: ['"$1"', '\u201C$1\u201D', "'$1'", '\u00AB$1\u00BB'],
    bitsPerSlot: 2,
  },
];

/**
 * Whitespace variant characters.
 * Regular space (U+0020) = 0, thin space (U+2009) = 1.
 * Applied after punctuation marks.
 */
const SPACE_NORMAL = ' ';        // U+0020 → bit 0
const SPACE_THIN   = '\u2009';   // Thin space → bit 1

// ── Bit Generation ───────────────────────────────────────────────────

/**
 * Generate a deterministic bit-string for a recipient + message combination.
 * Uses HMAC-SHA256 with the member's fingerprint seed.
 */
export function generateFingerprintBits(
  fingerprintSeed: string,
  messageId: string,
  numBits: number
): string {
  const hmac = crypto.createHmac('sha256', fingerprintSeed);
  hmac.update(messageId);
  const hash = hmac.digest('hex');
  
  // Convert hex to binary string
  let binary = '';
  for (const hexChar of hash) {
    binary += parseInt(hexChar, 16).toString(2).padStart(4, '0');
  }
  
  // Truncate or repeat to get exactly numBits
  while (binary.length < numBits) {
    binary += binary; // repeat if needed (unlikely for < 256 bits)
  }
  return binary.slice(0, numBits);
}

// ── Layer 1: Zero-Width Characters ───────────────────────────────────

/**
 * Embed bits as zero-width characters at word boundaries.
 * Invisible in rendered text but survive copy-paste.
 */
function embedZeroWidth(text: string, bits: string): string {
  if (bits.length === 0) return text;
  
  // Encode bits as zero-width chars
  let zwPayload = ZW_SEP; // start marker
  for (const bit of bits) {
    zwPayload += bit === '0' ? ZW_ZERO : ZW_ONE;
  }
  zwPayload += ZW_END; // end marker
  
  // Insert after the first word (after first space)
  const firstSpaceIdx = text.indexOf(' ');
  if (firstSpaceIdx === -1) return text + zwPayload;
  
  return text.slice(0, firstSpaceIdx) + zwPayload + text.slice(firstSpaceIdx);
}

/**
 * Extract zero-width encoded bits from text.
 */
function extractZeroWidth(text: string): string | null {
  const startIdx = text.indexOf(ZW_SEP);
  if (startIdx === -1) return null;
  
  const endIdx = text.indexOf(ZW_END, startIdx + 1);
  if (endIdx === -1) return null;
  
  const payload = text.slice(startIdx + 1, endIdx);
  let bits = '';
  for (const char of payload) {
    if (char === ZW_ZERO) bits += '0';
    else if (char === ZW_ONE) bits += '1';
    // skip any other chars
  }
  
  return bits.length > 0 ? bits : null;
}

/**
 * Strip all zero-width fingerprint characters from text.
 */
function stripZeroWidth(text: string): string {
  return text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
}

// ── Layer 2: Unicode Homoglyphs ──────────────────────────────────────

/**
 * Replace ASCII characters with visually identical Unicode homoglyphs
 * to encode bits. Each eligible character position encodes 1 bit.
 */
function embedHomoglyphs(text: string, bits: string): string {
  if (bits.length === 0) return text;
  
  let bitIdx = 0;
  const chars = [...text]; // handle multi-byte correctly
  const result: string[] = [];
  
  for (const char of chars) {
    const lower = char.toLowerCase();
    if (bitIdx < bits.length && HOMOGLYPH_MAP[lower]) {
      if (bits[bitIdx] === '1') {
        // Replace with homoglyph, preserving case
        const replacement = HOMOGLYPH_MAP[lower];
        result.push(char === lower ? replacement : replacement.toUpperCase());
      } else {
        result.push(char); // keep original (bit 0)
      }
      bitIdx++;
    } else {
      result.push(char);
    }
  }
  
  return result.join('');
}

/**
 * Extract homoglyph-encoded bits from text.
 */
function extractHomoglyphs(text: string): string {
  let bits = '';
  for (const char of text) {
    const lower = char.toLowerCase();
    if (HOMOGLYPH_VALUES.has(lower) || HOMOGLYPH_VALUES.has(char)) {
      bits += '1';
    } else if (HOMOGLYPH_MAP[lower]) {
      bits += '0';
    }
    // Characters not in the map are skipped
  }
  return bits;
}

/**
 * Count how many homoglyph-eligible positions exist in the text.
 */
function countHomoglyphSlots(text: string): number {
  let count = 0;
  for (const char of text) {
    if (HOMOGLYPH_MAP[char.toLowerCase()]) count++;
  }
  return count;
}

// ── Layer 3: Punctuation Variants ────────────────────────────────────

/**
 * Replace punctuation patterns with semantically equivalent variants
 * to encode bits.
 */
function embedPunctuation(text: string, bits: string): { text: string; bitsUsed: number } {
  let result = text;
  let bitIdx = 0;
  
  for (const variantGroup of PUNCTUATION_VARIANTS) {
    if (bitIdx >= bits.length) break;
    
    const matches = [...result.matchAll(new RegExp(variantGroup.pattern.source, variantGroup.pattern.flags))];
    if (matches.length === 0) continue;
    
    // Use the first match only for simplicity
    const match = matches[0];
    const bitsNeeded = variantGroup.bitsPerSlot;
    if (bitIdx + bitsNeeded > bits.length) break;
    
    const bitSlice = bits.slice(bitIdx, bitIdx + bitsNeeded);
    const variantIndex = parseInt(bitSlice, 2) % variantGroup.variants.length;
    
    // Replace the match with the chosen variant
    const variant = variantGroup.variants[variantIndex];
    // For simple replacement patterns like '$1:00 PM', handle capture groups
    const replacement = match[0].replace(
      new RegExp(variantGroup.pattern.source, variantGroup.pattern.flags.replace('g', '')),
      variant
    );
    
    result = result.slice(0, match.index!) + replacement + result.slice(match.index! + match[0].length);
    bitIdx += bitsNeeded;
  }
  
  return { text: result, bitsUsed: bitIdx };
}

/**
 * Detect which punctuation variant was used and extract bits.
 */
function extractPunctuation(text: string): string {
  let bits = '';
  
  for (const variantGroup of PUNCTUATION_VARIANTS) {
    // Check which variant the text contains
    for (let i = 0; i < variantGroup.variants.length; i++) {
      const variant = variantGroup.variants[i];
      // Create a simple literal check (strip regex special chars from variant for matching)
      const literalCheck = variant.replace(/\$\d/g, '.*?');
      try {
        const checkRegex = new RegExp(literalCheck.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\.\\\*\\\?/g, '.*?'));
        if (checkRegex.test(text)) {
          bits += i.toString(2).padStart(variantGroup.bitsPerSlot, '0');
          break;
        }
      } catch {
        // Skip malformed regex
      }
    }
  }
  
  return bits;
}

// ── Layer 4: Whitespace Patterns ─────────────────────────────────────

/**
 * Replace spaces after punctuation with thin spaces to encode bits.
 * Only targets spaces after . , : ; ! ? to minimize visual impact.
 */
function embedWhitespace(text: string, bits: string): string {
  if (bits.length === 0) return text;
  
  const punctuationFollowedBySpace = /([.,:;!?])\s/g;
  let bitIdx = 0;
  
  const result = text.replace(punctuationFollowedBySpace, (match, punct) => {
    if (bitIdx >= bits.length) return match;
    const space = bits[bitIdx] === '1' ? SPACE_THIN : SPACE_NORMAL;
    bitIdx++;
    return punct + space;
  });
  
  return result;
}

/**
 * Extract whitespace-encoded bits.
 */
function extractWhitespace(text: string): string {
  let bits = '';
  const punctuationFollowedBySpace = /([.,:;!?])([\s\u2009])/g;
  let match;
  
  while ((match = punctuationFollowedBySpace.exec(text)) !== null) {
    bits += match[2] === SPACE_THIN ? '1' : '0';
  }
  
  return bits;
}

// ── Main Fingerprint Engine ──────────────────────────────────────────

export interface FingerprintResult {
  text: string;
  bits: string;
  layers: Record<string, string>;
}

export interface ExtractionResult {
  bits: string;
  layerBits: Record<string, string>;
  confidence: number;
}

export interface AttributionResult {
  recipientId: string;
  recipientUsername?: string;
  confidence: number;
  bitsMatched: number;
  bitsTotal: number;
  layersDetected: string[];
}

/**
 * Calculate how many bits can be embedded in the given text across all layers.
 */
export function calculateCapacity(text: string): {
  total: number;
  layer1_zeroWidth: number;
  layer2_homoglyphs: number;
  layer3_punctuation: number;
  layer4_whitespace: number;
} {
  const homoglyphSlots = countHomoglyphSlots(text);
  
  let punctuationSlots = 0;
  for (const vg of PUNCTUATION_VARIANTS) {
    const matches = [...text.matchAll(new RegExp(vg.pattern.source, vg.pattern.flags))];
    if (matches.length > 0) punctuationSlots += vg.bitsPerSlot;
  }
  
  const whitespaceSlots = (text.match(/[.,:;!?]\s/g) || []).length;
  
  // Zero-width can carry arbitrary bits but we cap at 16 for stealth
  const zwSlots = 16;
  
  return {
    total: zwSlots + homoglyphSlots + punctuationSlots + whitespaceSlots,
    layer1_zeroWidth: zwSlots,
    layer2_homoglyphs: homoglyphSlots,
    layer3_punctuation: punctuationSlots,
    layer4_whitespace: whitespaceSlots,
  };
}

/**
 * Embed a fingerprint into a message using all 4 layers.
 * 
 * @param text - The original message text
 * @param fingerprintSeed - Unique HMAC seed for this recipient
 * @param messageId - Unique message identifier
 * @returns The fingerprinted text and metadata
 */
export function embedFingerprint(
  text: string,
  fingerprintSeed: string,
  messageId: string
): FingerprintResult {
  const capacity = calculateCapacity(text);
  const totalBits = capacity.total;
  
  if (totalBits === 0) {
    return { text, bits: '', layers: {} };
  }
  
  const allBits = generateFingerprintBits(fingerprintSeed, messageId, totalBits);
  const layers: Record<string, string> = {};
  let bitOffset = 0;
  
  // Layer 1: Zero-width characters
  const zwBits = allBits.slice(bitOffset, bitOffset + capacity.layer1_zeroWidth);
  let result = embedZeroWidth(text, zwBits);
  layers['zeroWidth'] = zwBits;
  bitOffset += capacity.layer1_zeroWidth;
  
  // Layer 2: Homoglyphs
  const homoBits = allBits.slice(bitOffset, bitOffset + capacity.layer2_homoglyphs);
  result = embedHomoglyphs(result, homoBits);
  layers['homoglyphs'] = homoBits;
  bitOffset += capacity.layer2_homoglyphs;
  
  // Layer 3: Punctuation variants
  const punctBits = allBits.slice(bitOffset, bitOffset + capacity.layer3_punctuation);
  const punctResult = embedPunctuation(result, punctBits);
  result = punctResult.text;
  const actualPunctBits = punctBits.slice(0, punctResult.bitsUsed);
  layers['punctuation'] = actualPunctBits;
  bitOffset += punctResult.bitsUsed;
  
  // Layer 4: Whitespace patterns
  const wsBits = allBits.slice(bitOffset, bitOffset + capacity.layer4_whitespace);
  result = embedWhitespace(result, wsBits);
  layers['whitespace'] = wsBits;
  bitOffset += capacity.layer4_whitespace;
  
  const usedBits = allBits.slice(0, bitOffset);
  
  return {
    text: result,
    bits: usedBits,
    layers,
  };
}

/**
 * Extract fingerprint bits from a suspected leaked text.
 * Attempts all layers and returns whatever bits can be recovered.
 */
export function extractFingerprint(text: string): ExtractionResult {
  const layerBits: Record<string, string> = {};
  let allBits = '';
  let layersFound = 0;
  let totalLayers = 0;
  
  // Layer 1: Zero-width characters
  const zwBits = extractZeroWidth(text);
  if (zwBits) {
    layerBits['zeroWidth'] = zwBits;
    allBits += zwBits;
    layersFound++;
  }
  totalLayers++;
  
  // Strip zero-width chars for remaining analysis
  const cleanText = stripZeroWidth(text);
  
  // Layer 2: Homoglyphs
  const homoBits = extractHomoglyphs(cleanText);
  if (homoBits.length > 0) {
    layerBits['homoglyphs'] = homoBits;
    allBits += homoBits;
    layersFound++;
  }
  totalLayers++;
  
  // Layer 3: Punctuation variants
  const punctBits = extractPunctuation(cleanText);
  if (punctBits.length > 0) {
    layerBits['punctuation'] = punctBits;
    allBits += punctBits;
    layersFound++;
  }
  totalLayers++;
  
  // Layer 4: Whitespace patterns
  const wsBits = extractWhitespace(cleanText);
  if (wsBits.length > 0) {
    layerBits['whitespace'] = wsBits;
    allBits += wsBits;
    layersFound++;
  }
  totalLayers++;
  
  // Confidence is based on how many layers we could extract from
  const confidence = totalLayers > 0 ? layersFound / totalLayers : 0;
  
  return {
    bits: allBits,
    layerBits,
    confidence,
  };
}

/**
 * Compute Hamming distance between two bit-strings.
 * Handles unequal lengths by comparing the shorter prefix.
 */
function hammingDistance(a: string, b: string): { distance: number; compared: number } {
  const len = Math.min(a.length, b.length);
  let distance = 0;
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) distance++;
  }
  return { distance, compared: len };
}

/**
 * Match extracted fingerprint bits against known fingerprint maps.
 * Uses fuzzy matching (Hamming distance) to tolerate OCR errors.
 * 
 * @param extractedBits - Bits extracted from the leaked text
 * @param knownMaps - Array of { recipientId, recipientUsername, fingerprintBits }
 * @returns The best match with confidence score
 */
export function matchFingerprint(
  extractedBits: string,
  knownMaps: Array<{
    recipientId: string;
    recipientUsername?: string;
    fingerprintBits: string;
  }>
): AttributionResult | null {
  if (extractedBits.length === 0 || knownMaps.length === 0) return null;
  
  let bestMatch: AttributionResult | null = null;
  let bestScore = -1;
  
  for (const map of knownMaps) {
    const { distance, compared } = hammingDistance(extractedBits, map.fingerprintBits);
    
    if (compared === 0) continue;
    
    const matchRate = 1 - (distance / compared);
    
    if (matchRate > bestScore) {
      bestScore = matchRate;
      bestMatch = {
        recipientId: map.recipientId,
        recipientUsername: map.recipientUsername,
        confidence: Math.round(matchRate * 10000) / 100, // e.g. 99.23%
        bitsMatched: compared - distance,
        bitsTotal: compared,
        layersDetected: [], // filled by caller
      };
    }
  }
  
  return bestMatch;
}

/**
 * Full attribution pipeline: extract fingerprint from leaked text,
 * then match against all known maps for a given message.
 */
export function attributeLeak(
  leakedText: string,
  knownMaps: Array<{
    recipientId: string;
    recipientUsername?: string;
    fingerprintBits: string;
    fingerprintedText: string;
  }>
): AttributionResult | null {
  // Strategy 1: Direct extraction from the leaked text
  const extracted = extractFingerprint(leakedText);
  
  if (extracted.bits.length > 0) {
    const match = matchFingerprint(extracted.bits, knownMaps);
    if (match) {
      match.layersDetected = Object.keys(extracted.layerBits);
      return match;
    }
  }
  
  // Strategy 2: Text similarity comparison (for when fingerprint chars are stripped)
  // Compare the cleaned leaked text against each known variant
  const cleanedLeak = stripZeroWidth(leakedText).trim().toLowerCase();
  
  let bestSimilarity = 0;
  let bestMap: typeof knownMaps[0] | null = null;
  
  for (const map of knownMaps) {
    const cleanedVariant = stripZeroWidth(map.fingerprintedText).trim().toLowerCase();
    const similarity = computeTextSimilarity(cleanedLeak, cleanedVariant);
    
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMap = map;
    }
  }
  
  if (bestMap && bestSimilarity > 0.7) {
    return {
      recipientId: bestMap.recipientId,
      recipientUsername: bestMap.recipientUsername,
      confidence: Math.round(bestSimilarity * 10000) / 100,
      bitsMatched: Math.round(bestSimilarity * 100),
      bitsTotal: 100,
      layersDetected: ['textSimilarity'],
    };
  }
  
  return null;
}

/**
 * Simple text similarity using character-level comparison.
 * More sophisticated than Hamming, handles insertions/deletions.
 */
function computeTextSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  // Use longest common subsequence ratio
  const lcsLen = lcs(a, b);
  return (2 * lcsLen) / (a.length + b.length);
}

/**
 * Longest Common Subsequence length (optimized for moderate strings).
 */
function lcs(a: string, b: string): number {
  // Cap to prevent excessive computation on very long texts
  const maxLen = 500;
  const sa = a.slice(0, maxLen);
  const sb = b.slice(0, maxLen);
  
  const m = sa.length;
  const n = sb.length;
  
  // Use two rows to save memory
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (sa[i - 1] === sb[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  
  return prev[n];
}
