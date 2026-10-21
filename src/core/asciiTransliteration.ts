/**
 * ASCII transliteration for smart glasses display.
 * Specification:
 * - tab, CR, LF become a space
 * - strip diacritics (Unicode NFD, drop combining marks \u0300-\u036f)
 * - map ß to ss
 * - map curly quotes (“ ” ‘ ’) to straight quotes (" ')
 * - anything still not printable ASCII (0x20 to 0x7E) becomes ?
 * - maximum 100 bytes per side (or updated from GET_INFO device limits)
 * - returns cleaned text, byte count, and warning flags
 */

export interface TransliterationResult {
  originalText: string;
  cleanText: string;
  byteLength: number;
  maxBytes: number;
  wasModified: boolean;
  isTruncated: boolean;
  warnings: string[];
}

export function transliterateToGlassesAscii(
  input: string,
  maxBytes: number = 100
): TransliterationResult {
  const warnings: string[] = [];
  if (!input) {
    return {
      originalText: '',
      cleanText: '',
      byteLength: 0,
      maxBytes,
      wasModified: false,
      isTruncated: false,
      warnings: [],
    };
  }

  // 1. Whitespace conversion: tab, CR, LF -> space
  let step1 = input.replace(/[\t\r\n]/g, ' ');

  // 2. Specific replacements: German ß -> ss, curly quotes -> straight quotes
  step1 = step1.replace(/ß/g, 'ss');
  step1 = step1.replace(/[“”„‟]/g, '"');
  step1 = step1.replace(/[‘’‚‛]/g, "'");

  // 3. Strip diacritics: Unicode NFD + drop combining marks
  // Note: normalize('NFD') separates base letters from accents (e.g., é -> e + \u0301)
  const normalized = step1.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 4. Anything not printable ASCII (0x20 to 0x7E) becomes '?'
  let sanitized = '';
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code >= 0x20 && code <= 0x7E) {
      sanitized += normalized[i];
    } else {
      sanitized += '?';
    }
  }

  // Check if modified compared to original
  const wasModified = sanitized !== input;
  if (wasModified) {
    warnings.push('Text was sanitized to printable ASCII for the smart glasses display.');
  }

  // 5. Truncate to maxBytes
  const encoder = new TextEncoder();
  let encoded = encoder.encode(sanitized);
  let isTruncated = false;

  if (encoded.length > maxBytes) {
    isTruncated = true;
    encoded = encoded.slice(0, maxBytes);
    sanitized = new TextDecoder('ascii').decode(encoded);
    warnings.push(`Text exceeded device limit and was truncated to ${maxBytes} bytes.`);
  }

  return {
    originalText: input,
    cleanText: sanitized,
    byteLength: encoded.length,
    maxBytes,
    wasModified,
    isTruncated,
    warnings,
  };
}
