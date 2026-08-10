/**
 * AI-Powered Linguistic Fingerprinting (Layer 5)
 * 
 * Uses the Gemini API to generate semantically identical but textually unique
 * message variants for each recipient. This is the most robust fingerprinting
 * layer — it survives screenshots, OCR, manual transcription, and even partial
 * quoting.
 * 
 * The key insight: an LLM can produce N semantically equivalent rewrites that
 * differ in word choice, sentence structure, and phrasing. Across a conversation,
 * these differences form a robust fingerprint.
 */

import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

/**
 * Generate N semantically identical but textually unique variants of a message.
 * 
 * @param originalText - The sender's original message
 * @param recipientCount - Number of unique variants needed
 * @returns Array of variant strings (length = recipientCount)
 */
export async function generateLinguisticVariants(
  originalText: string,
  recipientCount: number
): Promise<string[]> {
  // Short messages (< 15 chars) don't have enough substance to paraphrase reliably
  if (originalText.length < 15 || recipientCount <= 1) {
    return Array(recipientCount).fill(originalText);
  }

  try {
    const prompt = `You are a forensic linguistic fingerprinting system. Your job is to rewrite a message in ${recipientCount} semantically identical but textually distinct ways.

RULES:
1. Every variant MUST convey the EXACT same meaning as the original.
2. Each variant MUST be visibly different from the others in word choice, sentence structure, or phrasing.
3. NEVER change names, numbers, dates, URLs, code, or proper nouns.
4. NEVER add or remove information — only rephrase.
5. Keep each variant approximately the same length (±20%) as the original.
6. Maintain the same tone (formal/informal/casual) as the original.
7. Do NOT number the variants or add labels.
8. Output EXACTLY ${recipientCount} variants, one per line, separated by the delimiter |||VARIANT|||

ORIGINAL MESSAGE:
${originalText}

OUTPUT (${recipientCount} variants, separated by |||VARIANT|||):`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const responseText = response.text?.trim();
    if (!responseText) {
      console.error('Empty response from Gemini for linguistic variants');
      return Array(recipientCount).fill(originalText);
    }

    // Parse variants from the response
    let variants = responseText
      .split('|||VARIANT|||')
      .map(v => v.trim())
      .filter(v => v.length > 0);

    // If the model didn't use our delimiter, try newline splitting
    if (variants.length < recipientCount) {
      variants = responseText
        .split('\n')
        .map(v => v.trim())
        .filter(v => v.length > 0)
        // Remove any numbered prefixes like "1. " or "1) "
        .map(v => v.replace(/^\d+[.)]\s*/, ''));
    }

    // Ensure we have exactly the right number
    while (variants.length < recipientCount) {
      variants.push(originalText); // fallback to original for missing variants
    }

    return variants.slice(0, recipientCount);
  } catch (error) {
    console.error('Gemini linguistic variant generation failed:', error);
    return Array(recipientCount).fill(originalText);
  }
}

/**
 * Given a suspected leaked text and a set of known variants,
 * find the closest matching variant using text similarity.
 * 
 * @param suspectedText - The leaked/screenshotted text
 * @param variants - Array of { recipientId, text } known variants
 * @returns Best match with confidence score
 */
export function matchLinguisticVariant(
  suspectedText: string,
  variants: Array<{ recipientId: string; recipientUsername?: string; text: string }>
): { recipientId: string; recipientUsername?: string; confidence: number } | null {
  if (variants.length === 0) return null;

  const cleanSuspected = normalize(suspectedText);
  let bestMatch: typeof variants[0] | null = null;
  let bestScore = 0;

  for (const variant of variants) {
    const cleanVariant = normalize(variant.text);
    const score = computeSimilarity(cleanSuspected, cleanVariant);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = variant;
    }
  }

  if (!bestMatch || bestScore < 0.5) return null;

  return {
    recipientId: bestMatch.recipientId,
    recipientUsername: bestMatch.recipientUsername,
    confidence: Math.round(bestScore * 10000) / 100,
  };
}

// ── Internal Helpers ─────────────────────────────────────────────────

/**
 * Normalize text for comparison: lowercase, collapse whitespace, strip punctuation quirks.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '') // strip zero-width
    .replace(/[\u2009\u2003\u2002\u00A0]/g, ' ') // normalize all spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute similarity between two strings using bigram overlap (Dice coefficient).
 * More robust than edit distance for natural language comparison.
 */
function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersection = 0;
  const countB = new Map(bigramsB);

  for (const [bigram, countA] of bigramsA) {
    const cB = countB.get(bigram) || 0;
    intersection += Math.min(countA, cB);
  }

  const totalA = [...bigramsA.values()].reduce((s, v) => s + v, 0);
  const totalB = [...bigramsB.values()].reduce((s, v) => s + v, 0);

  return (2 * intersection) / (totalA + totalB);
}

/**
 * Get bigram frequency map from a string.
 */
function getBigrams(text: string): Map<string, number> {
  const bigrams = new Map<string, number>();
  for (let i = 0; i < text.length - 1; i++) {
    const bigram = text.slice(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
  }
  return bigrams;
}
