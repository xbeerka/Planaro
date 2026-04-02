import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Users, Building2, ChevronDown, Check, Search } from "lucide-react";
import { SchedulerEvent, Resource, Department, Project, Grade, Company } from "../../types/scheduler";
import { UNITS } from "../../utils/scheduler";
import { SvgLineChart, ChartDataPoint } from "./SvgLineChart";
import { useSettings } from "../../contexts/SettingsContext";
import { getMatchScore } from "../../utils/search";
import { getCurrentWeekIndex, getWeekStartDate } from "../../utils/scheduler";
import { highlightMatch } from "../../utils/highlightMatch";

const SIZE_WEIGHT: Record<string, number> = { S: 1, M: 2, L: 3, XL: 4 };
const SIZE_ORDER = ["S", "M", "L", "XL"];

function buildGradeWeightMap(grades: Grade[]): Map<string, number> {
  const sorted = [...grades].sort((a, b) => a.sort_order - b.sort_order);
  const map = new Map<string, number>();
  const n = sorted.length;
  if (n === 0) return map;
  sorted.forEach((g, i) => {
    // Reverse: first grade (sort_order=0) gets highest weight (top of chart)
    const weight = n === 1 ? 2 : 1 + ((n - 1 - i) / (n - 1)) * 2;
    map.set(String(g.id), weight);
    if (g.name) map.set(g.name, weight);
  });
  return map;
}

function gradeWeightColor(weight: number): string {
  if (weight >= 2.5) return "#22c55e";
  if (weight >= 1.75) return "#eab308";
  if (weight >= 1.25) return "#ef4444";
  return "#991b1b";
}

function gradeWeightLabel(weight: number, grades: Grade[]): string {
  const sorted = [...grades].sort((a, b) => a.sort_order - b.sort_order);
  const n = sorted.length;
  if (n === 0) return weight.toFixed(1);
  let closestIdx = 0;
  let closestDist = Infinity;
  sorted.forEach((_, i) => {
    // Reverse: first grade gets highest weight
    const w = n === 1 ? 2 : 1 + ((n - 1 - i) / (n - 1)) * 2;
    const dist = Math.abs(w - weight);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
    }
  });
  return `≈ ${sorted[closestIdx].name}`;
}

function sizeToLabel(avg: number): string {
  if (avg <= 1.25) return "S";
  if (avg <= 2.25) return "M";
  if (avg <= 3.25) return "L";
  return "XL";
}

const SIZE_COLORS: Record<string, string> = {
  S: "#22c55e",
  M: "#eab308",
  L: "#ef4444",
  XL: "#991b1b",
};

interface DeptStats {
  deptName: string;
  deptColor?: string | null;
  people: number;
  totalWeeks: number;
  hours: number;
  sizes: Record<string, number>;
  avgSize: number;
  gradeNames: string[];
  avgGradeLabel: string;
  avgGradeWeight: number | null;
}

interface WeeklyLoad {
  week: number;
  label: string;
  people: number;
  avgSize: number | null;
  avgGrade: number | null;
}

function computeStats(
  project: Project,
  events: SchedulerEvent[],
  resources: Resource[],
  departments: Department[],
  grades: Grade[],
  companies: Company[],
  offWeekNumbers?: Set<number>,
) {
  const projectEvents = events.filter((e) => e.projectId === project.id);
  const resourceIds = new Set(projectEvents.map((e) => e.resourceId));
  const totalPeople = resourceIds.size;
  const resourceMap = new Map(resources.map((r) => [r.id, r]));
  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const gradeWeightMap = buildGradeWeightMap(grades);

  // Per-department breakdown
  const deptStatsMap = new Map<
    string,
    {
      deptId: string;
      resourceIds: Set<string>;
      totalWeeks: number;
      sizes: Record<string, number>;
      gradeNames: string[];
      gradeWeights: number[];
    }
  >();

  projectEvents.forEach((event) => {
    const resource = resourceMap.get(event.resourceId);
    if (!resource) return;
    const deptId = resource.departmentId;
    if (!deptStatsMap.has(deptId)) {
      deptStatsMap.set(deptId, {
        deptId,
        resourceIds: new Set(),
        totalWeeks: 0,
        sizes: {},
        gradeNames: [],
        gradeWeights: [],
      });
    }
    const ds = deptStatsMap.get(deptId)!;
    const isNewResource = !ds.resourceIds.has(event.resourceId);
    ds.resourceIds.add(event.resourceId);
    ds.totalWeeks += event.weeksSpan * (event.unitsTall / UNITS);
    if (isNewResource) {
      if (resource.size) ds.sizes[resource.size] = (ds.sizes[resource.size] || 0) + 1;
      if (resource.grade) ds.gradeNames.push(resource.grade);
      const gradeKey = resource.gradeId ? String(resource.gradeId) : resource.grade;
      if (gradeKey && gradeWeightMap.has(gradeKey)) {
        ds.gradeWeights.push(gradeWeightMap.get(gradeKey)!);
      }
    }
  });

  const deptStats: DeptStats[] = Array.from(deptStatsMap.values())
    .map((ds) => {
      const dept = deptMap.get(ds.deptId);
      const people = ds.resourceIds.size;
      const hours = Math.round(ds.totalWeeks * 40);
      const sizeValues = Object.entries(ds.sizes).flatMap(([s, count]) =>
        Array(count).fill(SIZE_WEIGHT[s] || 0),
      );
      const avgSize =
        sizeValues.length > 0
          ? sizeValues.reduce((a: number, b: number) => a + b, 0) / sizeValues.length
          : 0;
      const avgGradeWeight =
        ds.gradeWeights.length > 0
          ? ds.gradeWeights.reduce((a, b) => a + b, 0) / ds.gradeWeights.length
          : null;
      return {
        deptName: dept?.name || "Без департамента",
        deptColor: dept?.color,
        people,
        totalWeeks: ds.totalWeeks,
        hours,
        sizes: ds.sizes,
        avgSize,
        gradeNames: ds.gradeNames,
        avgGradeLabel: avgGradeWeight !== null ? gradeWeightLabel(avgGradeWeight, grades) : "—",
        avgGradeWeight,
      };
    })
    .sort((a, b) => b.people - a.people);

  // Totals
  const totalWeeks = projectEvents.reduce((s, e) => s + e.weeksSpan * (e.unitsTall / UNITS), 0);
  const totalHours = Math.round(totalWeeks * 40);

  // Overall sizes & grades
  const allSizes: Record<string, number> = {};
  const allGrades: Record<string, number> = {};
  const allGradeWeights: number[] = [];
  const allSizeValues: number[] = [];
  resourceIds.forEach((rid) => {
    const r = resourceMap.get(rid);
    if (!r) return;
    if (r.size) {
      allSizes[r.size] = (allSizes[r.size] || 0) + 1;
      allSizeValues.push(SIZE_WEIGHT[r.size] || 0);
    }
    if (r.grade) allGrades[r.grade] = (allGrades[r.grade] || 0) + 1;
    const gradeKey = r.gradeId ? String(r.gradeId) : r.grade;
    if (gradeKey && gradeWeightMap.has(gradeKey)) {
      allGradeWeights.push(gradeWeightMap.get(gradeKey)!);
    }
  });

  const avgSizeAll = allSizeValues.length > 0
    ? allSizeValues.reduce((a, b) => a + b, 0) / allSizeValues.length : 0;
  const avgGradeAll = allGradeWeights.length > 0
    ? allGradeWeights.reduce((a, b) => a + b, 0) / allGradeWeights.length : null;

  // Companies breakdown
  const companyMap = new Map(companies.map((c) => [String(c.id), c]));
  const companyPeople = new Map<string, number>();
  resourceIds.forEach((rid) => {
    const r = resourceMap.get(rid);
    if (!r || !r.companyId) return;
    const cName = companyMap.get(String(r.companyId))?.name || "—";
    companyPeople.set(cName, (companyPeople.get(cName) || 0) + 1);
  });

  // Timeline
  let minWeek = 52, maxWeek = 0;
  projectEvents.forEach((e) => {
    if (e.startWeek < minWeek) minWeek = e.startWeek;
    if (e.startWeek + e.weeksSpan > maxWeek) maxWeek = e.startWeek + e.weeksSpan;
  });
  
  // Count off-weeks within project range to exclude from duration
  let offWeeksInRange = 0;
  if (offWeekNumbers && offWeekNumbers.size > 0 && projectEvents.length > 0) {
    for (let w = minWeek; w < maxWeek; w++) {
      if (offWeekNumbers.has(w + 1)) offWeeksInRange++;
    }
  }
  const projectDurationWeeks = Math.max(0, (maxWeek - minWeek) - offWeeksInRange);
  const avgPeoplePerWeek = projectDurationWeeks > 0 ? totalWeeks / projectDurationWeeks : 0;

  // Weekly load chart data
  const weeklyLoad: WeeklyLoad[] = [];
  if (projectEvents.length > 0) {
    const chartEnd = maxWeek;
    for (let w = minWeek; w < chartEnd; w++) {
      // Skip off-weeks in chart
      if (offWeekNumbers && offWeekNumbers.has(w + 1)) continue;
      
      let people = 0;
      let sizeSum = 0;
      let sizeCount = 0;
      let gradeSum = 0;
      let gradeCount = 0;
      projectEvents.forEach((e) => {
        if (w >= e.startWeek && w < e.startWeek + e.weeksSpan) {
          people += e.unitsTall / UNITS;
          const resource = resourceMap.get(e.resourceId);
          if (resource) {
            if (resource.size) {
              sizeSum += SIZE_WEIGHT[resource.size] || 0;
              sizeCount += 1;
            }
            const gradeKey = resource.gradeId ? String(resource.gradeId) : resource.grade;
            if (gradeKey && gradeWeightMap.has(gradeKey)) {
              gradeSum += gradeWeightMap.get(gradeKey)!;
              gradeCount += 1;
            }
          }
        }
      });
      weeklyLoad.push({
        week: w,
        label: `${w + 1}`,
        people: Math.round(people * 100) / 100,
        avgSize: sizeCount > 0 ? Math.round((sizeSum / sizeCount) * 100) / 100 : null,
        avgGrade: gradeCount > 0 ? Math.round((gradeSum / gradeCount) * 100) / 100 : null,
      });
    }
  }

  return {
    totalPeople,
    totalHours,
    totalWeeks,
    avgPeoplePerWeek,
    deptStats,
    allSizes,
    allGrades,
    avgSizeAll,
    avgGradeAll,
    companyPeople: Array.from(companyPeople.entries()).sort((a, b) => b[1] - a[1]),
    weekRange: projectEvents.length > 0 ? { from: minWeek + 1, to: maxWeek } : null,
    weeklyLoad,
  };
}

// ─── Sub-components ───

function SizePill({ size, count }: { size: string; count: number }) {
  const color = SIZE_COLORS[size] || "#9ca3af";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[4px] px-1.5 py-[1px] text-[10px] font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {size}
      <span className="opacity-70">×{count}</span>
    </span>
  );
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[10px] bg-gray-50 px-3 py-2.5 min-w-0">
      <span className="text-[10px] text-gray-400 uppercase tracking-wide truncate">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[18px] font-semibold text-gray-900" style={accent ? { color: accent } : undefined}>{value}</span>
        {sub && <span className="text-[11px] text-gray-400 truncate">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Project Selector ───

function ProjectSelector({
  projects,
  selectedId,
  onSelect,
  events,
}: {
  projects: Project[];
  selectedId: string;
  onSelect: (id: string) => void;
  events: SchedulerEvent[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Count people per project
  const peopleCounts = useMemo(() => {
    const map = new Map<string, Set<string>>();
    events.forEach((e) => {
      if (!map.has(e.projectId)) map.set(e.projectId, new Set());
      map.get(e.projectId)!.add(e.resourceId);
    });
    const result = new Map<string, number>();
    map.forEach((s, id) => result.set(id, s.size));
    return result;
  }, [events]);

  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      const ca = peopleCounts.get(a.id) || 0;
      const cb = peopleCounts.get(b.id) || 0;
      if (cb !== ca) return cb - ca;
      return a.name.localeCompare(b.name);
    });
  }, [projects, peopleCounts]);

  // Filter by search query using smart search
  const filtered = useMemo(() => {
    if (!query.trim()) return sorted;
    const q = query.trim();
    const scored = sorted
      .map((p) => ({ project: p, score: getMatchScore(q, p.name) }))
      .filter((item) => item.score < 100)
      .sort((a, b) => a.score - b.score);
    return scored.map((s) => s.project);
  }, [sorted, query]);

  const selected = projects.find((p) => p.id === selectedId);

  // Open dropdown
  const handleOpen = useCallback(() => {
    setOpen(true);
    setQuery("");
    // Focus input after render
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Close dropdown
  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  // Select project
  const handleSelect = useCallback((id: string) => {
    onSelect(id);
    handleClose();
  }, [onSelect, handleClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handleClose();
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [open, handleClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      handleClose();
    } else if (e.key === "Enter" && filtered.length > 0) {
      handleSelect(filtered[0].id);
    }
  }, [filtered, handleSelect, handleClose]);

  return (
    <div ref={ref} className="relative">
      {!open ? (
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 rounded-[10px] border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50 transition-colors w-full min-w-0"
        >
          {selected && (
            <div
              className="w-3 h-3 rounded-[3px] shrink-0"
              style={{ backgroundColor: selected.backgroundColor || "#ccc" }}
            />
          )}
          <span className="text-[13px] font-medium text-gray-900 truncate flex-1 text-left">
            {selected?.name || "Выберите проект"}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-[10px] border border-blue-400 bg-white px-3 py-2 w-full min-w-0 ring-2 ring-blue-100">
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Поиск проекта..."
            className="flex-1 text-[13px] text-gray-900 bg-transparent outline-none placeholder:text-gray-400 min-w-0"
          />
          {query && (
            <button onClick={() => setQuery("")} className="p-0.5 hover:bg-gray-100 rounded">
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-[10px] border border-gray-200 shadow-lg max-h-[280px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-[12px] text-gray-400">Ничего не найдено</div>
          ) : (
            filtered.map((p) => {
              const count = peopleCounts.get(p.id) || 0;
              const isSelected = p.id === selectedId;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelect(p.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <div
                    className="w-3 h-3 rounded-[3px] shrink-0"
                    style={{ backgroundColor: p.backgroundColor || "#ccc" }}
                  />
                  <span className={`text-[12px] flex-1 truncate ${isSelected ? "font-medium text-gray-900" : "text-gray-700"}`}>
                    {query.trim() ? highlightMatch(p.name, query.trim()) : p.name}
                  </span>
                  {count > 0 && (
                    <span className="text-[10px] text-gray-400 shrink-0">{count} чел</span>
                  )}
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Custom chart tooltip ───

type ChartMode = 'people' | 'size' | 'grade';

const CHART_MODE_LABELS: Record<ChartMode, string> = {
  people: 'Люди',
  size: 'Размер',
  grade: 'Грейд',
};

// ─── Main Export ───

export interface ProjectAnalyticsModalProps {
  events: SchedulerEvent[];
  resources: Resource[];
  departments: Department[];
  grades: Grade[];
  companies: Company[];
  projects: Project[];
  initialProjectId?: string | null;
  onClose: () => void;
  offWeekNumbers?: Set<number>;
}

// Keep backward compat name as well
export { ProjectAnalyticsModal as ProjectInfoPopover };

export function ProjectAnalyticsModal({
  events,
  resources,
  departments,
  grades,
  companies,
  projects,
  initialProjectId,
  onClose,
  offWeekNumbers,
}: ProjectAnalyticsModalProps) {
  // Pick initial project: provided or first by people count
  const sortedByPeople = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((e) => {
      counts.set(e.projectId, (counts.get(e.projectId) || 0) + 1);
    });
    return [...projects].sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0));
  }, [projects, events]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId || sortedByPeople[0]?.id || ""
  );

  const [chartMode, setChartMode] = useState<ChartMode>('people');

  const project = projects.find((p) => p.id === selectedProjectId);

  const stats = useMemo(() => {
    if (!project) return null;
    return computeStats(project, events, resources, departments, grades, companies, offWeekNumbers);
  }, [project, events, resources, departments, grades, companies, offWeekNumbers]);

  const gradesSorted = useMemo(() => [...grades].sort((a, b) => a.sort_order - b.sort_order), [grades]);

  const gradeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const n = gradesSorted.length;
    gradesSorted.forEach((g, i) => {
      // Reverse: first grade (sort_order=0) gets highest weight (top of chart)
      const weight = n === 1 ? 2 : 1 + ((n - 1 - i) / (n - 1)) * 2;
      map.set(g.name, gradeWeightColor(weight));
    });
    return map;
  }, [gradesSorted]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const projectColor = project?.backgroundColor || "#6366f1";

  const { showDeptColors } = useSettings();

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      data-dropdown-open="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-[16px] shadow-2xl w-[680px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-64px)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-gray-900">Аналитика проекта</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-[10px] transition-colors shrink-0"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <ProjectSelector
            projects={projects}
            selectedId={selectedProjectId}
            onSelect={setSelectedProjectId}
            events={events}
          />
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {!project || !stats ? (
            <div className="text-center text-gray-400 py-12 text-[13px]">Выберите проект</div>
          ) : (
            <>
              {/* ── Metric Cards ── */}
              <div className="grid grid-cols-4 gap-2.5">
                <MetricCard
                  label="Сотрудников"
                  value={String(stats.totalPeople)}
                />
                <MetricCard
                  label="ø чел/нед"
                  value={String(Math.round(stats.avgPeoplePerWeek * 10) / 10)}
                  accent={projectColor}
                />
                <MetricCard
                  label="~ часы"
                  value={stats.totalHours.toLocaleString("ru-RU")}
                />
                <MetricCard
                  label="Период"
                  value={stats.weekRange ? `${stats.weekRange.to - stats.weekRange.from + 1} нед` : "—"}
                  sub={stats.weekRange ? `нед ${stats.weekRange.from}–${stats.weekRange.to}` : undefined}
                />
              </div>

              {/* ── Weekly Load Chart ── */}
              {stats.weeklyLoad.length > 1 && (() => {
                const dataKey = chartMode === 'people' ? 'people' : chartMode === 'size' ? 'avgSize' : 'avgGrade';
                const chartColor = chartMode === 'people' ? projectColor : chartMode === 'size' ? '#f59e0b' : '#8b5cf6';
                // Compute average for reference line
                const validValues = stats.weeklyLoad.map((d: WeeklyLoad) => d[dataKey] as number | null).filter((v): v is number => v != null && v > 0);
                const avg = validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : 0;
                // Format chart data: replace nulls with 0
                const chartData = stats.weeklyLoad.map((d: WeeklyLoad) => ({
                  ...d,
                  value: (d[dataKey] as number | null) ?? 0,
                }));
                // Current week label (1-based)
                const currentWeekLabel = String(getCurrentWeekIndex(new Date().getFullYear()) + 1);

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">По неделям</h3>
                      <div className="flex items-center rounded-[6px] bg-gray-100 p-[2px]">
                        {(['people', 'size', 'grade'] as ChartMode[]).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setChartMode(mode)}
                            className={`px-2 py-0.5 rounded-[4px] text-[10px] transition-colors ${
                              chartMode === mode
                                ? 'bg-white text-gray-900 shadow-sm font-medium'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {CHART_MODE_LABELS[mode]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {avg > 0 && (
                      <div className="text-[10px] text-gray-400">
                        ø {chartMode === 'people' ? `${(Math.round(avg * 10) / 10)} чел/нед` : chartMode === 'size' ? sizeToLabel(avg) : gradeWeightLabel(avg, grades)}
                      </div>
                    )}
                    <div className="bg-gray-50 rounded-[12px] pb-0.5 px-[8px] pt-[16px] pb-[2px]">
                      <SvgLineChart
                        data={chartData.map((d: any) => ({ label: d.label, value: d.value }))}
                        color={chartColor}
                        height={195}
                        skipZero={chartMode !== 'people'}
                        yDomain={chartMode === 'size' ? [1, 4] : chartMode === 'grade' ? [1, 3] : undefined}
                        yTicks={chartMode === 'size' ? [1, 2, 3, 4] : chartMode === 'grade' ? (() => {
                          const sorted = [...grades].sort((a, b) => a.sort_order - b.sort_order);
                          const n = sorted.length;
                          if (n === 0) return [1, 2, 3];
                          if (n === 1) return [2];
                          return sorted.map((_, i) => 1 + (i / (n - 1)) * 2);
                        })() : undefined}
                        yTickFormat={chartMode === 'size' ? (v: number) => ({ 1: 'S', 2: 'M', 3: 'L', 4: 'XL' }[v] || '') : chartMode === 'grade' ? (v: number) => gradeWeightLabel(v, grades).replace('≈ ', '') : undefined}
                        avgLine={avg > 0 ? avg : undefined}
                        highlightLabel={currentWeekLabel}
                        tooltipFormat={(p: ChartDataPoint) => {
                          const weekNum = parseInt(p.label, 10); // 1-based
                          const year = new Date().getFullYear();
                          const weekStart = getWeekStartDate(year, weekNum - 1);
                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekEnd.getDate() + 6);
                          const quarter = `Q${Math.ceil((weekStart.getMonth() + 1) / 3)}`;
                          const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
                          const startDay = weekStart.getDate();
                          const endDay = weekEnd.getDate();
                          const startMonth = MONTHS_SHORT[weekStart.getMonth()];
                          const endMonth = MONTHS_SHORT[weekEnd.getMonth()];
                          const dateRange = weekStart.getMonth() === weekEnd.getMonth()
                            ? `${startDay} – ${endDay} ${endMonth}`
                            : `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
                          const title = `${quarter} · Неделя ${p.label} · ${dateRange}`;
                          let sub = '';
                          if (chartMode === 'people') sub = `${p.value} чел`;
                          else if (chartMode === 'size') sub = `${p.value.toFixed(2)} (${sizeToLabel(p.value)})`;
                          else sub = `${p.value.toFixed(2)} (${gradeWeightLabel(p.value, grades)})`;
                          return [title, sub];
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* ── Sizes & Grades row ── */}
              {(Object.keys(stats.allSizes).length > 0 || Object.keys(stats.allGrades).length > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  {/* Sizes */}
                  {Object.keys(stats.allSizes).length > 0 && (
                    <div className="space-y-2 rounded-[12px] bg-gray-50 px-3 py-3">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Размеры</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {SIZE_ORDER.filter((s) => stats.allSizes[s]).map((s) => (
                          <SizePill key={s} size={s} count={stats.allSizes[s]} />
                        ))}
                        {stats.avgSizeAll > 0 && (
                          <span className="text-[10px] text-gray-400">
                            Среднее — <span className="font-medium" style={{ color: SIZE_COLORS[sizeToLabel(stats.avgSizeAll)] || "#9ca3af" }}>{sizeToLabel(stats.avgSizeAll)}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex h-[5px] rounded-full overflow-hidden bg-gray-200">
                        {SIZE_ORDER.filter((s) => stats.allSizes[s]).map((s) => (
                          <div
                            key={s}
                            style={{ width: `${(stats.allSizes[s] / stats.totalPeople) * 100}%`, backgroundColor: SIZE_COLORS[s] }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grades */}
                  {Object.keys(stats.allGrades).length > 0 && (
                    <div className="space-y-2 rounded-[12px] bg-gray-50 px-3 py-3">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Грейды</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {gradesSorted.filter((g) => stats.allGrades[g.name]).map((g) => {
                          const color = gradeColorMap.get(g.name) || "#9ca3af";
                          return (
                            <span
                              key={g.id}
                              className="inline-flex items-center gap-1 rounded-[4px] px-1.5 py-[1px] text-[10px] font-semibold border"
                              style={{
                                borderColor: color,
                                backgroundColor: `${color}20`,
                                color,
                              }}
                            >
                              {g.name}
                              <span style={{ opacity: 0.7 }}>×{stats.allGrades[g.name]}</span>
                            </span>
                          );
                        })}
                        {stats.avgGradeAll !== null && (
                          <span className="text-[10px] text-gray-400">
                            Среднее — <span className="font-medium" style={{ color: gradeWeightColor(stats.avgGradeAll) }}>{gradeWeightLabel(stats.avgGradeAll, grades).replace('≈ ', '')}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex h-[5px] rounded-full overflow-hidden bg-gray-200">
                        {gradesSorted.filter((g) => stats.allGrades[g.name]).map((g) => {
                          const color = gradeColorMap.get(g.name) || "#9ca3af";
                          return (
                            <div
                              key={g.id}
                              style={{ width: `${(stats.allGrades[g.name] / stats.totalPeople) * 100}%`, backgroundColor: color }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Companies ── */}
              {stats.companyPeople.length > 1 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Компании</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {stats.companyPeople.map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between rounded-[8px] bg-gray-50 px-3 py-2">
                        <span className="text-[12px] text-gray-700 truncate">{name}</span>
                        <span className="text-[12px] font-medium text-gray-900 shrink-0 ml-2">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Departments ── */}
              {stats.deptStats.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      По департаментам ({stats.deptStats.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {stats.deptStats.map((ds) => (
                      <div
                        key={ds.deptName}
                        className="rounded-[10px] border border-gray-100 px-3.5 py-2.5 space-y-1.5"
                        style={{ borderLeftWidth: "3px", borderLeftColor: showDeptColors ? ds.deptColor || "#e5e7eb" : "#e5e7eb" }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-medium text-gray-800 truncate">{ds.deptName}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-gray-400">~{ds.hours.toLocaleString("ru-RU")} ч</span>
                            <span className="text-[12px] font-medium text-gray-600">{ds.people} чел</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 mt-0.5">
                          {/* Sizes row */}
                          {(ds.avgSize > 0 || SIZE_ORDER.some((s) => ds.sizes[s])) && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {SIZE_ORDER.filter((s) => ds.sizes[s]).map((s) => (
                                <SizePill key={s} size={s} count={ds.sizes[s]} />
                              ))}
                              {ds.avgSize > 0 && (
                                <span className="text-[10px] text-gray-400">
                                  Среднее — <span className="font-medium" style={{ color: SIZE_COLORS[sizeToLabel(ds.avgSize)] || "#9ca3af" }}>{sizeToLabel(ds.avgSize)}</span>
                                </span>
                              )}
                            </div>
                          )}
                          {/* Grades row */}
                          {ds.gradeNames.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {(() => {
                                const gradeCounts: Record<string, number> = {};
                                ds.gradeNames.forEach((g) => { gradeCounts[g] = (gradeCounts[g] || 0) + 1; });
                                return Object.entries(gradeCounts).map(([name, count]) => {
                                  const color = gradeColorMap.get(name) || "#9ca3af";
                                  return (
                                    <span
                                      key={name}
                                      className="inline-flex items-center gap-0.5 rounded-[3px] px-1 py-[0px] font-semibold text-[9px] border"
                                      style={{ borderColor: color, backgroundColor: `${color}20`, color }}
                                    >
                                      {name}{count > 1 && <span style={{ opacity: 0.7 }}>×{count}</span>}
                                    </span>
                                  );
                                });
                              })()}
                              {ds.avgGradeWeight !== null && (
                                <span className="text-[10px] text-gray-400">
                                  Среднее — <span className="font-medium" style={{ color: gradeWeightColor(ds.avgGradeWeight) }}>{ds.avgGradeLabel.replace('≈ ', '')}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}