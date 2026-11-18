export interface MatchRange {
  start: number;
  end: number;
}

export interface SearchMatches {
  ranges: MatchRange[];
  capped: boolean;
}

export const MAX_SEARCH_MATCHES = 1000;

export function findMatches(text: string, query: string): SearchMatches {
  if (!text || !query) return { ranges: [], capped: false };

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped, "gi");
  const ranges: MatchRange[] = [];
  let capped = false;

  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
    if (ranges.length === MAX_SEARCH_MATCHES) {
      capped = pattern.exec(text) !== null;
      break;
    }
  }

  return { ranges, capped };
}
