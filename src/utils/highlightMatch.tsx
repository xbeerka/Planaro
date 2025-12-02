import React from 'react';
import { generateSearchVariants, damerauLevenshteinDistance } from './search';

interface Range {
  start: number;
  end: number; // exclusive
  score: number;
}

/**
 * Подсвечивает совпадения в тексте маркерным стилем
 * Использует Fuzzy Search (Damerau-Levenshtein)
 * 
 * @param text - Текст для подсветки
 * @param query - Поисковый запрос
 * @returns React элемент с подсвеченными совпадениями
 */
export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || !query.trim() || !text) return text;

  const qTokens = query.split(/[\s,.-]+/).filter(s => s.length > 0);
  if (qTokens.length === 0) return text;

  const ranges: Range[] = [];
  const textLower = text.toLowerCase();

  for (const token of qTokens) {
    const variants = generateSearchVariants(token);
    let bestTokenRange: Range | null = null;

    for (const variant of variants) {
      if (variant.length < 2) continue;

      let maxErrors = 0;
      if (variant.length >= 3) maxErrors = 1;
      if (variant.length >= 7) maxErrors = 2; // Sync with search.ts
      if (variant.length >= 10) maxErrors = 3;

      // Min length to match
      const minLen = Math.max(1, variant.length - maxErrors);
      const maxLen = Math.min(textLower.length, variant.length + maxErrors + 1);

      for (let len = minLen; len <= maxLen; len++) {
        for (let i = 0; i <= textLower.length - len; i++) {
          // Определяем, является ли это началом слова
          const isWordStart = i === 0 || /[\s\-_]/.test(textLower[i - 1]);

          // Для коротких токенов (включая скелеты типа "gl") запрещаем поиск в середине слова
          // Это решает проблему "enGLish" по запросу "гэл" (скелет "gl")
          if (!isWordStart && variant.length < 3) {
            continue;
          }

          const sub = textLower.slice(i, i + len);
          const dist = damerauLevenshteinDistance(variant, sub);
          
          // Строгость проверки: префикс слова (lenient) vs середина (strict)
          const allowedErrors = isWordStart ? maxErrors : Math.max(0, maxErrors - 1);
          
          if (dist <= allowedErrors) {
            const isBetter = !bestTokenRange || 
              dist < bestTokenRange.score || 
              (dist === bestTokenRange.score && len > (bestTokenRange.end - bestTokenRange.start));

            if (isBetter) {
               bestTokenRange = { start: i, end: i + len, score: dist };
            }
          }
        }
      }
    }

    if (bestTokenRange) {
      ranges.push(bestTokenRange);
    }
  }

  if (ranges.length === 0) return text;

  ranges.sort((a, b) => a.start - b.start);
  
  const mergedRanges: Range[] = [];
  if (ranges.length > 0) {
    let current = ranges[0];
    
    for (let i = 1; i < ranges.length; i++) {
      const next = ranges[i];
      if (next.start <= current.end) { 
        current.end = Math.max(current.end, next.end);
        current.score = Math.min(current.score, next.score);
      } else {
        mergedRanges.push(current);
        current = next;
      }
    }
    mergedRanges.push(current);
  }

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const range of mergedRanges) {
    if (range.start > lastIndex) {
      nodes.push(text.slice(lastIndex, range.start));
    }
    nodes.push(<mark key={`${range.start}-${range.end}`}>{text.slice(range.start, range.end)}</mark>);
    lastIndex = range.end;
  }
  
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return <>{nodes}</>;
}