import React, { memo } from "react";
import { highlightMatch } from "../../utils/highlightMatch";

interface HighlightTextProps {
  text: string;
  query?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const HighlightText = memo(({ text, query, className, style }: HighlightTextProps) => {
  return (
    <span className={className} style={style} title={text}>
      {highlightMatch(text, query || "")}
    </span>
  );
});

HighlightText.displayName = "HighlightText";
