import React, { memo, useMemo } from "react";
import { getSearchTokens } from "../../utils/search";

interface HighlightTextProps {
  text: string;
  query?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const HighlightText = memo(({ text, query, className, style }: HighlightTextProps) => {
  const fragments = useMemo(() => {
    if (!query || !text) return [{ text, isMatch: false }];

    const tokens = getSearchTokens(query);
    if (tokens.length === 0) return [{ text, isMatch: false }];

    // Экранируем спецсимволы для regex
    const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // Сортируем по длине (от длинных к коротким), чтобы сначала находить более специфичные совпадения
    escapedTokens.sort((a, b) => b.length - a.length);

    // Создаем regex, который ищет любое из слов
    const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
    
    const parts = text.split(regex);
    
    return parts.map(part => {
      // Проверяем, является ли часть совпадением (case-insensitive)
      const isMatch = tokens.some(t => part.toLowerCase() === t);
      return { text: part, isMatch };
    });
  }, [text, query]);

  if (!query) {
    return <span className={className} style={style}>{text}</span>;
  }

  return (
    <span className={className} style={style} title={text}>
      {fragments.map((fragment, i) => (
        fragment.isMatch ? (
          <mark 
            key={i} 
            className="bg-[#add6ff] text-inherit rounded-[2px] px-[1px] mx-[-1px]"
            style={{ backgroundColor: '#add6ff', color: 'inherit' }}
          >
            {fragment.text}
          </mark>
        ) : (
          <span key={i}>{fragment.text}</span>
        )
      ))}
    </span>
  );
});

HighlightText.displayName = "HighlightText";
