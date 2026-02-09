export interface ParsedImportFileName {
  vehicleParts: { year?: string; make?: string; model?: string } | null;
  title: string;
  suffix: number | null;
  extension: string;
}

/**
 * Parse an import filename into its components.
 * Supports two formats:
 *   1. "Year-Make-Model-Title.ext" (e.g., "2019-Honda-CBR650F-Registration.pdf")
 *   2. "Title.ext" (e.g., "Registration.pdf")
 * Numeric suffixes like "Registration-2.pdf" are detected and stripped from the title.
 */
export function parseImportFileName(filename: string): ParsedImportFileName {
  // Split off extension
  const lastDot = filename.lastIndexOf('.');
  const extension = lastDot >= 0 ? filename.slice(lastDot + 1).toLowerCase() : '';
  const baseName = lastDot >= 0 ? filename.slice(0, lastDot) : filename;

  // Check for numeric suffix: "Title-2" -> suffix=2, title="Title"
  let suffix: number | null = null;
  let titlePart = baseName;
  const suffixMatch = baseName.match(/^(.+)-(\d+)$/);
  if (suffixMatch) {
    // Only treat as suffix if the number is small (avoids treating years as suffixes)
    const num = parseInt(suffixMatch[2], 10);
    if (num < 100) {
      suffix = num;
      titlePart = suffixMatch[1];
    }
  }

  // Try to detect "Year-Make-Model-Title" format
  // Year is a 4-digit number starting with 19 or 20
  const vehiclePrefixMatch = titlePart.match(/^((?:19|20)\d{2})[-\s]+([^-\s]+)[-\s]+([^-\s]+)[-\s]+(.+)$/);
  if (vehiclePrefixMatch) {
    return {
      vehicleParts: {
        year: vehiclePrefixMatch[1],
        make: vehiclePrefixMatch[2],
        model: vehiclePrefixMatch[3],
      },
      title: vehiclePrefixMatch[4].replace(/[-_]/g, ' ').trim(),
      suffix,
      extension,
    };
  }

  return {
    vehicleParts: null,
    title: titlePart.replace(/[-_]/g, ' ').trim(),
    suffix,
    extension,
  };
}

/**
 * Normalize a string for comparison: lowercase, collapse whitespace/hyphens/underscores.
 */
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[-_\s]+/g, ' ').trim();
}

/**
 * Match a filename to a record title from a list.
 * Returns the best match with a confidence score (0-100), or null if no match.
 */
export function matchFileToRecord(
  filename: string,
  recordTitles: string[]
): { title: string; index: number; confidence: number } | null {
  const parsed = parseImportFileName(filename);
  const normalizedFileTitle = normalizeForMatch(parsed.title);

  if (!normalizedFileTitle) return null;

  let bestMatch: { title: string; index: number; confidence: number } | null = null;

  for (let i = 0; i < recordTitles.length; i++) {
    const recordTitle = recordTitles[i];
    const normalizedRecord = normalizeForMatch(recordTitle);

    if (!normalizedRecord) continue;

    let confidence = 0;

    // Exact match after normalization
    if (normalizedFileTitle === normalizedRecord) {
      confidence = 100;
    }
    // One contains the other
    else if (normalizedFileTitle.includes(normalizedRecord)) {
      confidence = 85;
    } else if (normalizedRecord.includes(normalizedFileTitle)) {
      confidence = 80;
    }
    // Word overlap
    else {
      const fileWords = new Set(normalizedFileTitle.split(/\s+/));
      const recordWords = new Set(normalizedRecord.split(/\s+/));
      const overlap = [...fileWords].filter((w) => recordWords.has(w)).length;
      const totalWords = Math.max(fileWords.size, recordWords.size);
      if (overlap > 0) {
        confidence = Math.round((overlap / totalWords) * 60) + 15;
      }
    }

    if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { title: recordTitle, index: i, confidence };
    }
  }

  return bestMatch && bestMatch.confidence >= 50 ? bestMatch : null;
}
