import React, { useMemo, useRef, useState, useCallback } from "react";

export interface ChartDataPoint {
  label: string;
  value: number;
}

interface SvgLineChartProps {
  data: ChartDataPoint[];
  color: string;
  yDomain?: [number, number];
  yTicks?: number[];
  yTickFormat?: (v: number) => string;
  avgLine?: number;
  tooltipFormat?: (point: ChartDataPoint) => [string, string];
  height?: number;
  highlightLabel?: string;
  /** When true, value===0 is treated as "no data" and breaks the line. Default: true */
  skipZero?: boolean;
}

const CHAR_WIDTH = 6.5; // approx px per character at fontSize 10
const FONT_SIZE_Y = 10;
const PAD_RIGHT = 8;
const PAD_TOP = 4;
const PAD_BOTTOM = 20;
const Y_LABEL_GAP = 6; // gap between label text and plot area

export function SvgLineChart({
  data,
  color,
  yDomain,
  yTicks,
  yTickFormat,
  avgLine,
  tooltipFormat,
  height = 195,
  highlightLabel,
  skipZero = true,
}: SvgLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const n = data.length;
  const formatYTick = yTickFormat || ((v: number) => String(v));

  const { yMin, yMax } = useMemo(() => {
    if (yDomain) return { yMin: yDomain[0], yMax: yDomain[1] };
    let max = 0;
    data.forEach((d) => { if (d.value > max) max = d.value; });
    if (max === 0) max = 1;
    return { yMin: 0, yMax: max * 1.05 };
  }, [data, yDomain]);

  const computedYTicks = useMemo(() => {
    if (yTicks) return yTicks;
    const range = yMax - yMin;
    if (range === 0) return [yMin];
    const step = niceStep(range, 4);
    const ticks: number[] = [];
    let v = Math.ceil(yMin / step) * step;
    while (v <= yMax + step * 0.01) {
      ticks.push(Math.round(v * 1000) / 1000);
      v += step;
    }
    return ticks;
  }, [yMin, yMax, yTicks]);

  // Dynamic left padding based on widest Y label
  const padLeft = useMemo(() => {
    let maxLen = 0;
    computedYTicks.forEach((v) => {
      const label = formatYTick(v);
      if (label.length > maxLen) maxLen = label.length;
    });
    return Math.max(24, maxLen * CHAR_WIDTH + Y_LABEL_GAP + 4);
  }, [computedYTicks, formatYTick]);

  const VW = 600;
  const VH = height;
  const plotL = padLeft;
  const plotR = VW - PAD_RIGHT;
  const plotT = PAD_TOP;
  const plotB = VH - PAD_BOTTOM;
  const plotW = plotR - plotL;
  const plotH = plotB - plotT;

  const points = useMemo(() => {
    if (n === 0) return [];
    return data.map((d, i) => {
      const x = n === 1 ? plotL + plotW / 2 : plotL + (i / (n - 1)) * plotW;
      const ratio = yMax === yMin ? 0.5 : (d.value - yMin) / (yMax - yMin);
      const y = plotB - ratio * plotH;
      return { x, y, ...d };
    });
  }, [data, n, yMin, yMax, plotL, plotW, plotB, plotH]);

  // Split points into segments, breaking at value === 0 (no data)
  const lineSegments = useMemo(() => {
    if (!skipZero) return points.length >= 2 ? [points] : [];
    const segments: typeof points[] = [];
    let current: typeof points = [];
    points.forEach((p) => {
      if (p.value === 0) {
        if (current.length >= 2) segments.push(current);
        current = [];
      } else {
        current.push(p);
      }
    });
    if (current.length >= 2) segments.push(current);
    return segments;
  }, [points, skipZero]);

  const fillPolygons = useMemo(() => {
    return lineSegments.map((seg) => {
      const top = seg.map((p) => `${p.x},${p.y}`).join(" ");
      return `${top} ${seg[seg.length - 1].x},${plotB} ${seg[0].x},${plotB}`;
    });
  }, [lineSegments, plotB]);

  const xLabelInterval = useMemo(() => {
    if (n <= 12) return 1;
    if (n <= 26) return 2;
    if (n <= 40) return 4;
    return Math.ceil(n / 10);
  }, [n]);

  const avgY = useMemo(() => {
    if (avgLine == null || yMax === yMin) return null;
    const ratio = (avgLine - yMin) / (yMax - yMin);
    return plotB - ratio * plotH;
  }, [avgLine, yMin, yMax, plotB, plotH]);

  // Mouse handlers on container div (not SVG) to avoid tooltip flicker
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (n === 0 || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * VW;
      // Only track within plot area
      if (mouseX < plotL - 10 || mouseX > plotR + 10) {
        setHoverIdx(null);
        return;
      }
      let closest = 0;
      let minDist = Infinity;
      points.forEach((p, i) => {
        if (skipZero && p.value === 0) return; // skip no-data points
        const d = Math.abs(p.x - mouseX);
        if (d < minDist) { minDist = d; closest = i; }
      });
      if (minDist === Infinity) { setHoverIdx(null); return; }
      setHoverIdx(closest);
    },
    [n, points, VW, plotL, plotR, skipZero],
  );

  const handleMouseLeave = useCallback(() => setHoverIdx(null), []);

  const gradientId = `chart-fill-${color.replace('#', '')}`;

  // Tooltip position computed from hoverIdx
  const tooltip = useMemo(() => {
    if (hoverIdx == null || !points[hoverIdx] || !tooltipFormat) return null;
    const p = points[hoverIdx];
    const [title, sub] = tooltipFormat(p);
    // Convert from viewBox coords to percentage
    const leftPct = (p.x / VW) * 100;
    const topPct = (p.y / VH) * 100;
    // Determine horizontal alignment to keep tooltip within bounds
    let translateX = '-50%'; // center by default
    if (leftPct < 15) translateX = '0%';       // left edge — anchor left
    else if (leftPct > 85) translateX = '-100%'; // right edge — anchor right
    return { title, sub, leftPct, topPct, translateX };
  }, [hoverIdx, points, tooltipFormat, VW, VH]);

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {computedYTicks.map((v) => {
          const ratio = yMax === yMin ? 0 : (v - yMin) / (yMax - yMin);
          const y = plotB - ratio * plotH;
          return (
            <line key={v} x1={plotL} x2={plotR} y1={y} y2={y}
              stroke="#e5e7eb" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          );
        })}

        {/* Y-axis labels */}
        {computedYTicks.map((v) => {
          const ratio = yMax === yMin ? 0 : (v - yMin) / (yMax - yMin);
          const y = plotB - ratio * plotH;
          return (
            <text key={`yl-${v}`} x={plotL - Y_LABEL_GAP} y={y}
              textAnchor="end" dominantBaseline="middle"
              fill="#9ca3af" fontSize={FONT_SIZE_Y} style={{ fontFamily: "inherit" }}>
              {formatYTick(v)}
            </text>
          );
        })}

        {/* X-axis labels */}
        {points.map((p, i) => {
          if (i % xLabelInterval !== 0) return null;
          return (
            <text key={`xl-${i}`} x={p.x} y={plotB + 14}
              textAnchor="middle" fill="#9ca3af" fontSize={10}
              style={{ fontFamily: "inherit" }}>
              {p.label}
            </text>
          );
        })}

        {/* Fill area */}
        {fillPolygons.map((fp, i) => (
          <polygon key={`fill-${i}`} points={fp} fill={`url(#${gradientId})`} />
        ))}

        {/* Average reference line */}
        {avgY != null && (
          <line x1={plotL} x2={plotR} y1={avgY} y2={avgY}
            stroke={color} strokeWidth={1} strokeDasharray="6 4"
            strokeOpacity={0.45} vectorEffect="non-scaling-stroke" />
        )}

        {/* Line */}
        {lineSegments.map((seg, i) => (
          <polyline key={`line-${i}`}
            points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none" stroke={color}
            strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
            vectorEffect="non-scaling-stroke" />
        ))}

        {/* Dots */}
        {points.map((p, i) => (
          (skipZero && p.value === 0) ? null : (
          <circle key={i} cx={p.x} cy={p.y}
            r={hoverIdx === i ? 4 : 2.5}
            fill={hoverIdx === i ? color : "#fff"}
            stroke={color}
            strokeWidth={hoverIdx === i ? 2 : 1.5}
            vectorEffect="non-scaling-stroke"
            style={{ transition: "r 0.1s, fill 0.1s" }} />
          )
        ))}

        {/* Hover vertical guide */}
        {hoverIdx != null && points[hoverIdx] && (
          <line x1={points[hoverIdx].x} x2={points[hoverIdx].x}
            y1={plotT} y2={plotB} stroke={color} strokeWidth={1}
            strokeOpacity={0.2} vectorEffect="non-scaling-stroke" />
        )}

        {/* Current week vertical line */}
        {highlightLabel != null && (() => {
          const idx = points.findIndex((p) => p.label === highlightLabel);
          if (idx === -1) return null;
          const x = points[idx].x;
          return (
            <line x1={x} x2={x} y1={plotT} y2={plotB}
              stroke="#ef4444" strokeWidth={1}
              strokeDasharray="4 3"
              strokeOpacity={0.5}
              vectorEffect="non-scaling-stroke" />
          );
        })()}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: `${tooltip.leftPct}%`,
            top: `${Math.max(tooltip.topPct - 8, 0)}%`,
            transform: `translate(${tooltip.translateX}, -100%)`,
          }}
        >
          <div className="bg-white rounded-[6px] shadow-lg border border-gray-200 px-2.5 py-1.5 whitespace-nowrap">
            <div className="text-[10px] text-gray-400">{tooltip.title}</div>
            <div className="text-[12px] font-semibold text-gray-900">{tooltip.sub}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / pow;
  let nice: number;
  if (frac <= 1.5) nice = 1;
  else if (frac <= 3.5) nice = 2;
  else if (frac <= 7.5) nice = 5;
  else nice = 10;
  return nice * pow;
}