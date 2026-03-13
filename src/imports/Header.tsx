import { X, Filter, Search } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import svgPaths from "./svg-yurl9oiucn";
import svgPathsNew from "./svg-bl5oypf3kt";
import svgPathsIcons from "./svg-k2ncor8zr6";
import imgAvatarOnline from "figma:asset/13999075da141928723b8c42fbe1a97dc4a5be20.png";
import imgAvatarOnline1 from "figma:asset/5bd0f85444d9f77271656b5be7fa3c91c10a9579.png";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { HighlightText } from "../components/ui/HighlightText";
import { Switch } from "../components/ui/switch";
import { useFilters } from "../contexts/FilterContext";
import { useSettings } from "../contexts/SettingsContext";
import { useUI } from "../contexts/UIContext";
import { useScheduler } from "../contexts/SchedulerContext";
import { HeaderOnlineUsers } from "../components/scheduler/HeaderOnlineUsers";
import { smartSearch } from "../utils/search";
import { Company } from "../types/Company";
import { Department } from "../types/Department";
import { Project } from "../types/Project";

interface HeaderProps {
  workspaceId?: string;
  accessToken?: string | null;
  scissorsMode?: boolean;
  commentMode?: boolean;
  onToggleScissors?: () => void;
  onToggleComment?: () => void;
  companies?: Company[];
  departments?: Department[];
  projects?: Project[];
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  sidebarCollapsed?: boolean; // ✨ Новый проп для адаптивности
}

type Mode = "cursor" | "scissors" | "comment";
type FilterType = "company" | "department" | "project" | null;

function ModeButton({
  active,
  icon,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`box-border content-stretch flex gap-[6px] items-center justify-center p-[8px] relative rounded-[12px] shrink-0 cursor-pointer transition-colors hover:bg-gray-50`}
      data-name="input"
    >
      <div
        aria-hidden="true"
        className={`absolute border-[0.8px] ${active ? "border-[#0062FF]" : "border-[rgba(0,0,0,0.12)]"} border-solid inset-0 pointer-events-none rounded-[12px]`}
      />
      {icon}
    </div>
  );
}

function CursorIcon({ active }: { active: boolean }) {
  return (
    <div className="relative shrink-0 size-[20px]" data-name={active ? "cursor_active" : "cursor_rest"}>
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g id={active ? "cursor_active" : "cursor_rest"}>
          <path
            d={active ? svgPathsIcons.p268b500 : svgPathsIcons.pb4a2500}
            fill={
              active
                ? "var(--fill-0, #0062FF)"
                : "var(--fill-0, black)"
            }
            id="Vector"
          />
        </g>
      </svg>
    </div>
  );
}

function ScissorsIcon({ active }: { active: boolean }) {
  return (
    <div
      className="relative shrink-0 size-[20px]"
      data-name={active ? "scissors_active" : "scissors_rest"}
    >
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g id={active ? "scissors_active" : "scissors_rest"}>
          <path
            d={active ? svgPathsIcons.p201fc180 : svgPathsIcons.pd69ce00}
            fill={
              active
                ? "var(--fill-0, #0062FF)"
                : "var(--fill-0, black)"
            }
            id="Vector"
          />
        </g>
      </svg>
    </div>
  );
}

function CommentIcon({ active }: { active: boolean }) {
  return (
    <div
      className="relative shrink-0 size-[20px]"
      data-name={active ? "comment_active" : "comment_rest"}
    >
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
      >
        <g id={active ? "comment_active" : "comment_rest"}>
          <path
            d={active ? svgPathsIcons.p265f9c00 : svgPathsIcons.pda47100}
            fill={
              active
                ? "var(--fill-0, #0062FF)"
                : "var(--fill-0, black)"
            }
            id="Vector"
          />
        </g>
      </svg>
    </div>
  );
}

function Frame4(props: HeaderProps) {
  const {
    scissorsMode,
    onToggleScissors,
    canUndo = false,
    canRedo = false,
    onUndo,
    onRedo,
  } = props;

  const { commentMode, setCommentMode, handleToggleComment } = useUI();

  // Determine current mode
  const isScissors = !!scissorsMode;
  const isComment = !!commentMode;
  const isCursor = !isScissors && !isComment;

  const handleCursorClick = () => {
    if (isScissors && onToggleScissors) onToggleScissors();
    if (isComment) setCommentMode(false);
  };

  const handleScissorsClick = () => {
    if (isComment) setCommentMode(false);
    if (onToggleScissors) onToggleScissors();
  };

  const handleCommentClick = () => {
    if (isScissors && onToggleScissors) onToggleScissors();
    handleToggleComment();
  };

  return (
    <div className="content-stretch flex gap-[12px] items-center relative shrink-0 max-md:hidden">
      {/* Navigation buttons group */}
      <div className="box-border content-stretch flex items-center relative rounded-[12px] shrink-0">
        <div
          aria-hidden="true"
          className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px] z-10"
        />
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-[8px] transition-colors rounded-l-[12px] relative ${canUndo ? "hover:bg-gray-50 cursor-pointer" : "cursor-not-allowed"}`}
        >
          <ChevronLeft
            className={`w-5 h-5 transition-opacity ${!canUndo ? "opacity-40" : ""}`}
          />
        </button>
        <div className="w-[1px] h-5 bg-[rgba(0,0,0,0.12)]" />
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-[8px] transition-colors rounded-r-[12px] relative ${canRedo ? "hover:bg-gray-50 cursor-pointer" : "cursor-not-allowed"}`}
        >
          <ChevronRight
            className={`w-5 h-5 transition-opacity ${!canRedo ? "opacity-40" : ""}`}
          />
        </button>
      </div>

      {/* Separator */}
      <div className="w-[1px] h-6 bg-gray-300 shrink-0" />

      {/* Tool buttons */}
      <ModeButton
        active={isCursor}
        icon={<CursorIcon active={isCursor} />}
        onClick={handleCursorClick}
      />
      <ModeButton
        active={isScissors}
        icon={<ScissorsIcon active={isScissors} />}
        onClick={handleScissorsClick}
      />
      <ModeButton
        active={isComment}
        icon={<CommentIcon active={isComment} />}
        onClick={handleCommentClick}
      />
    </div>
  );
}

function Group() {
  return (
    <div className="absolute inset-[12.5%]">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 15 15"
      >
        <g id="Group 3">
          <g id="Vector">
            <path
              clipRule="evenodd"
              d={svgPathsNew.pedce580}
              fill="var(--fill-0, black)"
              fillRule="evenodd"
            />
            <path
              clipRule="evenodd"
              d={svgPathsNew.p1b85a700}
              fill="var(--fill-0, black)"
              fillRule="evenodd"
            />
            <path
              clipRule="evenodd"
              d={svgPathsNew.p14cff340}
              fill="var(--fill-0, black)"
              fillRule="evenodd"
            />
            <path
              clipRule="evenodd"
              d={svgPathsNew.p20fa3280}
              fill="var(--fill-0, black)"
              fillRule="evenodd"
            />
            <path
              clipRule="evenodd"
              d={svgPathsNew.p6b7e880}
              fill="var(--fill-0, black)"
              fillRule="evenodd"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}

function IconLineCalendarActive() {
  return (
    <div
      className="relative shrink-0 size-[20px]"
      data-name="icon_line/Calendar_active"
    >
      <Group />
    </div>
  );
}

function ArrowUp() {
  return (
    <div
      className="relative size-full"
      data-name="Arrow - Up 2"
    >
      <div className="absolute inset-[-17.14%_-8.57%]">
        <svg
          className="block size-full"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 11 7"
        >
          <g id="Arrow - Up 2">
            <path
              d={svgPathsNew.p4616100}
              id="Stroke 1"
              stroke="var(--stroke-0, #868789)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.6"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}

function IconlyLightArrowUp() {
  return (
    <div
      className="relative size-[16px]"
      data-name="Iconly/Light/Arrow - Up 2"
    >
      <div className="absolute flex inset-[35.42%_20.83%_35.41%_20.84%] items-center justify-center">
        <div className="flex-none h-[4.667px] rotate-[180deg] w-[9.333px]">
          <ArrowUp />
        </div>
      </div>
    </div>
  );
}

function Input6({ sidebarCollapsed }: HeaderProps) {
  const {
    weekPx,
    eventRowH,
    setWeekPx,
    setEventRowH,
    showGaps,
    setShowGaps,
    showPatterns,
    setShowPatterns,
    showProjectWeight,
    setShowProjectWeight,
    showSeparators,
    setShowSeparators,
  } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Drag-to-dismiss state
  const [dragStartY, setDragStartY] = useState<number | null>(
    null,
  );
  const [dragOffset, setDragOffset] = useState(0);

  // Position state for desktop
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    right: 0,
  });

  // Toggle handler with position calculation
  const toggleDropdown = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setIsOpen(!isOpen);
  };

  // Предустановки для ширины недели
  const weekPresets = [
    { label: "Компактный", value: 48 },
    { label: "Стандартный", value: 120 },
    { label: "Широкий", value: 180 },
    { label: "Макси", value: 220 },
  ];

  // Предустановки для высоты строки
  const heightPresets = [
    { label: "Компактный", value: 48 },
    { label: "Стандартный", value: 96 },
    { label: "Комфортный", value: 120 },
    { label: "Просторный", value: 144 },
  ];

  // Закрытие по клику вне дропдауна
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener(
        "mousedown",
        handleClickOutside,
      );
      return () =>
        document.removeEventListener(
          "mousedown",
          handleClickOutside,
        );
    }
  }, [isOpen]);

  // Drag-to-dismiss handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY === null) return;

    const currentY = e.touches[0].clientY;
    const offset = currentY - dragStartY;

    if (offset > 0) {
      const resistance = 0.6;
      setDragOffset(offset * resistance);
    }
  };

  const handleTouchEnd = () => {
    if (dragStartY === null) return;

    if (dragOffset > 80) {
      setIsOpen(false);
    }

    setDragStartY(null);
    setDragOffset(0);
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={toggleDropdown}
        className={`box-border content-stretch flex gap-[6px] items-center justify-center ${sidebarCollapsed ? "px-[8px]" : "px-[12px] max-md:px-[8px]"} py-[8px] relative rounded-[12px] shrink-0 cursor-pointer hover:bg-gray-50 transition-colors`}
        data-name="input"
      >
        <div
          aria-hidden="true"
          className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]"
        />
        <IconLineCalendarActive />
        <p className="font-medium leading-[20px] relative shrink-0 text-[12px] text-black text-nowrap whitespace-pre">{`Вид `}</p>
      </div>

      {/* Overlay для мобилки */}
      {isOpen &&
        createPortal(
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-[9998] transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
          />,
          document.body,
        )}

      {/* Дропдаун с настройками */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              transform: `translateY(${dragOffset}px)`,
              transition:
                dragStartY === null
                  ? "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                  : "none",
              // Позиционирование для десктопа
              ...(window.innerWidth >= 768 && {
                position: "fixed",
                top: `${dropdownPosition.top}px`,
                right: `${dropdownPosition.right}px`,
              }),
            }}
            className="md:w-[320px] md:max-h-[500px] md:rounded-[12px] max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:w-full max-md:h-[calc(100dvh-120px)] max-md:rounded-t-[28px] bg-white md:shadow-lg md:border md:border-gray-200 max-md:shadow-[0_-8px_32px_rgba(0,0,0,0.12)] z-[10000] overflow-hidden flex flex-col"
          >
            {/* Drag Handle (толко на мобилке) */}
            <div
              className="md:hidden flex justify-center pt-4 pb-3 cursor-grab active:cursor-grabbing"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-12 h-[5px] bg-gray-300 rounded-full transition-colors active:bg-gray-400" />
            </div>

            {/* Заголовок */}
            <div className="px-4 py-4 max-md:py-3 border-b border-gray-200 flex items-center justify-between min-h-[60px]">
              <h3 className="font-semibold text-base max-md:text-[19px]">
                Настройки вида
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Содержимое настроек */}
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-6">
              {/* Ширина недели */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    Ширина недели
                  </span>
                  <span className="text-sm text-gray-500">
                    {weekPx}px
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "XS", value: 48 },
                    { label: "S", value: 72 },
                    { label: "M", value: 96 },
                    { label: "L", value: 120 },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setWeekPx(preset.value)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        weekPx === preset.value
                          ? "bg-[#0062FF] text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Высота строки */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    Высота строки
                  </span>
                  <span className="text-sm text-gray-500">
                    {eventRowH}px
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "XS", value: 48 },
                    { label: "S", value: 96 },
                    { label: "M", value: 120 },
                    { label: "L", value: 144 },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setEventRowH(preset.value)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        eventRowH === preset.value
                          ? "bg-[#0062FF] text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Разделитель */}
              <div className="border-t border-gray-200" />

              {/* Свитчи */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">
                    Показывать отступы
                  </span>
                  <Switch
                    checked={showGaps}
                    onCheckedChange={setShowGaps}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">
                    Показывать паттерны
                  </span>
                  <Switch
                    checked={showPatterns}
                    onCheckedChange={setShowPatterns}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">
                    Показывать вес проектов
                  </span>
                  <Switch
                    checked={showProjectWeight}
                    onCheckedChange={setShowProjectWeight}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">
                    Разделитель строк
                  </span>
                  <Switch
                    checked={showSeparators}
                    onCheckedChange={setShowSeparators}
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function AvatarOnlineNoAvatar() {
  return (
    <div
      className="bg-[#f6f6f6] mr-[-8px] overflow-clip relative rounded-[12px] shrink-0 size-[32px]"
      data-name="avatarOnline (no avatar)"
    >
      <p className="absolute font-normal leading-[20px] left-[calc(50%-10px)] text-[#868789] text-[14px] text-nowrap top-[calc(50%-10px)] whitespace-pre">
        АС
      </p>
    </div>
  );
}

function AvatarOnline() {
  return (
    <div
      className="mr-[-8px] pointer-events-none relative rounded-[12px] shrink-0 size-[32px]"
      data-name="avatarOnline"
    >
      <ImageWithFallback
        alt=""
        className="absolute inset-0 max-w-none object-50%-50% object-cover rounded-[12px] size-full"
        src={imgAvatarOnline}
      />
      <div
        aria-hidden="true"
        className="absolute border-2 border-solid border-white inset-[-2px] rounded-[14px]"
      />
    </div>
  );
}

function AvatarOnline1() {
  return (
    <div
      className="mr-[-8px] pointer-events-none relative rounded-[12px] shrink-0 size-[32px]"
      data-name="avatarOnline"
    >
      <ImageWithFallback
        alt=""
        className="absolute inset-0 max-w-none object-50%-50% object-cover rounded-[12px] size-full"
        src={imgAvatarOnline1}
      />
      <div
        aria-hidden="true"
        className="absolute border-2 border-solid border-white inset-[-2px] rounded-[14px]"
      />
    </div>
  );
}

function Frame1({ workspaceId, accessToken }: HeaderProps) {
  if (!workspaceId) {
    // Fallback to static design if no workspaceId (e.g. inside Figma import preview)
    return (
      <div className="box-border content-stretch flex items-center pl-0 pr-[8px] py-0 relative shrink-0">
        <AvatarOnlineNoAvatar />
        <AvatarOnline />
        <AvatarOnline1 />
      </div>
    );
  }

  return (
    <div className="box-border content-stretch flex items-center pl-0 pr-[8px] py-0 relative shrink-0">
      <HeaderOnlineUsers
        workspaceId={workspaceId}
        accessToken={accessToken || null}
      />
    </div>
  );
}

function Frame2(props: HeaderProps) {
  const { sidebarCollapsed = false } = props;

  return (
    <div className="content-stretch flex gap-[16px] items-center relative shrink-0">
      <Container
        {...props}
        sidebarCollapsed={sidebarCollapsed}
      />
      <Input6 sidebarCollapsed={sidebarCollapsed} />
      {!sidebarCollapsed && (
        <div className="max-md:hidden">
          <Frame1 {...props} />
        </div>
      )}
    </div>
  );
}

function Frame5(props: HeaderProps) {
  return (
    <div className="basis-0 content-stretch flex grow items-center justify-between min-h-px min-w-px relative shrink-0">
      <Frame4 {...props} />
      <Frame2 {...props} />
    </div>
  );
}

function Boxheader(props: HeaderProps) {
  return (
    <div
      className="h-full relative rounded-[16px] shrink-0 w-full flex items-center px-[16px]"
      data-name="boxheader"
    >
      <div
        aria-hidden="true"
        className="absolute border border-[#f0f0f0] border-solid inset-0 pointer-events-none rounded-[16px]"
      />
      <Frame5 {...props} />
    </div>
  );
}

export default function Header(props: HeaderProps) {
  const { sidebarCollapsed = false } = props;
  const { commentMode } = useUI();

  return (
    <div
      className="box-border content-stretch flex flex-col gap-2 items-start p-2 w-full relative h-full"
      data-name="header"
      style={{
        width: commentMode ? "calc(100% - 292px)" : "100%",
        transition: "width 0.2s ease-in-out",
      }}
    >
      <Boxheader {...props} />
    </div>
  );
}

function Container(props: HeaderProps) {
  const {
    companies = [],
    departments = [],
    projects = [],
    sidebarCollapsed = false,
  } = props;
  const {
    enabledCompanies,
    toggleCompany,
    setEnabledCompanies,
    enabledDepartments,
    toggleDepartment,
    setEnabledDepartments,
    enabledProjects,
    toggleProject,
    setEnabledProjects,
    projectFilterTodayOnly,
    toggleProjectFilterTodayOnly,
  } = useFilters();

  const { events } = useScheduler();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "company" | "department" | "project"
  >("project");
  const [searchQuery, setSearchQuery] = useState(""); // ✨ Состояние поиска
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Drag-to-dismiss state
  const [dragStartY, setDragStartY] = useState<number | null>(
    null,
  );
  const [dragOffset, setDragOffset] = useState(0);

  // Позиция dropdown для десктопа
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    right: 0,
  });

  // Подсчет использования проектов (кол-во сотрудников)
  const projectUsageMap = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    events.forEach(event => {
      if (event.projectId && event.resourceId) {
        if (!counts.has(event.projectId)) {
          counts.set(event.projectId, new Set());
        }
        counts.get(event.projectId)!.add(event.resourceId);
      }
    });
    
    const usage = new Map<string, number>();
    counts.forEach((resources, projectId) => {
      usage.set(projectId, resources.size);
    });
    return usage;
  }, [events]);

  // Сортировка проектов по использованию
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const countA = projectUsageMap.get(a.id) || 0;
      const countB = projectUsageMap.get(b.id) || 0;
      if (countB !== countA) return countB - countA;
      return a.name.localeCompare(b.name);
    });
  }, [projects, projectUsageMap]);

  // Общий счетчик активных фильтров
  const totalFilters =
    enabledCompanies.size +
    enabledDepartments.size +
    enabledProjects.size;

  // Toggle dropdown handler with immediate position calculation
  const toggleDropdown = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setIsOpen(!isOpen);
  };

  // Закрытие по клику вне дропдауна
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener(
        "mousedown",
        handleClickOutside,
      );
      return () =>
        document.removeEventListener(
          "mousedown",
          handleClickOutside,
        );
    }
  }, [isOpen]);

  // Drag-to-dismiss handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    // Запоминаем начальную позицию касания
    setDragStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY === null) return;

    const currentY = e.touches[0].clientY;
    const offset = currentY - dragStartY;

    // Разрешаем только свайп вниз (с небольшим сопротивлением)
    if (offset > 0) {
      // Добавляем resistance для более приятного UX
      const resistance = 0.6; // Чем меньше, тем больше сопротивление
      setDragOffset(offset * resistance);
    }
  };

  const handleTouchEnd = () => {
    if (dragStartY === null) return;

    // Закрываем если протянули больше 80px (с учетом resistance)
    if (dragOffset > 80) {
      setIsOpen(false);
    }

    // Сброс
    setDragStartY(null);
    setDragOffset(0);
  };

  // Очистка всех фильтров
  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEnabledCompanies(new Set());
    setEnabledDepartments(new Set());
    setEnabledProjects(new Set());
    console.log("🧹 Все фильтры очищены");
  };

  // Сброс поиска при смене вкладки
  useEffect(() => {
    setSearchQuery("");
  }, [activeTab]);

  // Сортировка департаментов (как в модалке управления)
  const sortedDepartments = useMemo(() => {
    return [...departments].sort((a, b) => {
      const queueA = a.queue || 999;
      const queueB = b.queue || 999;
      return queueA - queueB;
    });
  }, [departments]);

  // Получение текущих данных для активной вкладки
  const getCurrentData = () => {
    switch (activeTab) {
      case "company":
        return {
          items: companies,
          selectedIds: enabledCompanies,
          onToggle: toggleCompany,
        };
      case "department":
        return {
          items: sortedDepartments,
          selectedIds: enabledDepartments,
          onToggle: toggleDepartment,
        };
      case "project":
        return {
          items: sortedProjects,
          selectedIds: enabledProjects,
          onToggle: toggleProject,
        };
    }
  };

  const { items, selectedIds, onToggle } = getCurrentData();

  // Умная фильтрация по поисковому запросу
  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;

    // Для проектов ищем по name и id
    if ("backgroundColor" in item) {
      const targetText = [item.name, item.id]
        .filter(Boolean)
        .join(" ");
      return smartSearch(searchQuery, targetText);
    }

    // Для департаментов и компаний ищем только по name
    return smartSearch(searchQuery, item.name);
  });

  return (
    <div ref={containerRef} className="relative">
      {/* Кнопка "Фильтр" */}
      <div
        onClick={toggleDropdown}
        className="box-border content-stretch flex gap-[6px] items-center justify-center px-[12px] py-[8px] relative rounded-[12px] shrink-0 cursor-pointer hover:bg-gray-50 transition-colors"
        data-name="container"
      >
        <div
          aria-hidden="true"
          className={`absolute border-[0.8px] ${totalFilters > 0 ? "border-[#0062FF]" : "border-[rgba(0,0,0,0.12)]"} border-solid inset-0 pointer-events-none rounded-[12px]`}
        />

        <div className="relative shrink-0 size-[20px] flex items-center justify-center">
          <Filter
            className={`w-[16px] h-[16px] ${totalFilters > 0 ? "text-[#0062FF]" : "text-black"}`}
          />
        </div>

        <p
          className={`font-medium leading-[20px] relative shrink-0 text-[12px] ${totalFilters > 0 ? "text-[#0062FF]" : "text-black"} text-nowrap whitespace-pre`}
        >
          Фильтр
        </p>
      </div>

      {/* Overlay для мобилки */}
      {isOpen &&
        createPortal(
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-[9998] transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
          />,
          document.body,
        )}

      {/* Дропдаун с вкладками */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              transform: `translateY(${dragOffset}px)`,
              transition:
                dragStartY === null
                  ? "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                  : "none",
              // Позиционирование для десктопа
              ...(window.innerWidth >= 768 && {
                position: "fixed",
                top: `${dropdownPosition.top}px`,
                right: `${dropdownPosition.right}px`,
              }),
            }}
            className="md:w-[340px] md:max-h-[450px] md:rounded-[12px] max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:w-full max-md:h-[calc(100dvh-120px)] max-md:rounded-t-[28px] bg-white md:shadow-lg md:border md:border-gray-200 max-md:shadow-[0_-8px_32px_rgba(0,0,0,0.12)] z-[9999] overflow-hidden flex flex-col"
          >
            {/* Drag Handle (только на мобилке) */}
            <div
              className="md:hidden flex justify-center pt-4 pb-3 cursor-grab active:cursor-grabbing"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-12 h-[5px] bg-gray-300 rounded-full transition-colors active:bg-gray-400" />
            </div>

            {/* Заголовок с поиском */}
            <div className="px-4 border-b border-gray-200 h-[60px] shrink-0 flex items-center gap-2">
              {/* Поле поиска */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(e.target.value)
                  }
                  placeholder="Поиск..."
                  className="w-full h-9 pl-9 pr-8 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#0062FF] transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                    aria-label="Очистить поиск"
                  >
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Кнопка сброса фильтров */}
              {totalFilters > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-[12px] py-[10px] text-xs font-medium text-[#0062FF] bg-[#0062FF]/10 hover:bg-[#0062FF]/20 rounded-lg transition-colors shrink-0"
                  aria-label="Очистить все фильтры"
                >
                  Сбросить
                </button>
              )}

              {/* Кнопка закрытия (мобилка) */}
              <button
                onClick={() => setIsOpen(false)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Вкладки */}
            <div className="flex border-b border-gray-200 h-[52px] shrink-0">
              <button
                onClick={() => setActiveTab("project")}
                className={`flex-1 text-sm max-md:text-[17px] font-medium transition-colors relative h-full flex items-center justify-center ${
                  activeTab === "project"
                    ? "text-[#0062FF]"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Проекты
                {enabledProjects.size > 0 && (
                  <span className="ml-1.5 text-xs max-md:text-sm px-2 py-0.5 rounded-full bg-[#0062FF] text-white">
                    {enabledProjects.size}
                  </span>
                )}
                {activeTab === "project" && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0062FF]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("department")}
                className={`flex-1 text-sm max-md:text-[17px] font-medium transition-colors relative h-full flex items-center justify-center ${
                  activeTab === "department"
                    ? "text-[#0062FF]"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Департаменты
                {enabledDepartments.size > 0 && (
                  <span className="ml-1.5 text-xs max-md:text-sm px-2 py-0.5 rounded-full bg-[#0062FF] text-white">
                    {enabledDepartments.size}
                  </span>
                )}
                {activeTab === "department" && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0062FF]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("company")}
                className={`flex-1 text-sm max-md:text-[17px] font-medium transition-colors relative h-full flex items-center justify-center ${
                  activeTab === "company"
                    ? "text-[#0062FF]"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Компании
                {enabledCompanies.size > 0 && (
                  <span className="ml-1.5 text-xs max-md:text-sm px-2 py-0.5 rounded-full bg-[#0062FF] text-white">
                    {enabledCompanies.size}
                  </span>
                )}
                {activeTab === "company" && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0062FF]" />
                )}
              </button>
            </div>

            {/* Toggle "Только на текущей неделе" — только на вкладке Проекты при выбранных проектах */}
            {activeTab === "project" && enabledProjects.size > 0 && (
              <div className="px-4 py-2.5 border-b border-gray-200 shrink-0 flex items-center justify-between gap-3">
                <span className="text-xs max-md:text-sm text-gray-600">
                  Только на текущей неделе
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={projectFilterTodayOnly}
                  onClick={toggleProjectFilterTodayOnly}
                  className="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer"
                  style={{
                    backgroundColor: projectFilterTodayOnly ? '#0062FF' : 'rgb(209, 213, 219)',
                  }}
                >
                  <span
                    className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out"
                    style={{
                      transform: projectFilterTodayOnly ? 'translateX(16px)' : 'translateX(0)',
                    }}
                  />
                </button>
              </div>
            )}

            {/* Список элементов */}
            <div
              ref={scrollRef}
              className="overflow-y-auto flex-1"
            >
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-base max-md:text-[17px] text-gray-500">
                  Нет данных
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-base max-md:text-[17px] text-gray-500">
                  Ничего не найдено
                </div>
              ) : (
                filteredItems
                  .slice()
                  .sort((a, b) => {
                    if (activeTab === "department") {
                      const queueA = (a as Department).queue ?? 999;
                      const queueB = (b as Department).queue ?? 999;
                      return queueA - queueB;
                    }
                    return 0;
                  })
                  .map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const isProject = "backgroundColor" in item;

                  return (
                    <div
                      key={item.id}
                      onClick={() => onToggle(item.id)}
                      className="px-4 py-3 max-md:py-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer flex items-center gap-3 transition-colors min-h-[48px]"
                    >
                      <div
                        className={`w-5 h-5 max-md:w-6 max-md:h-6 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? "bg-[#0062FF] border-[#0062FF]"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            width="12"
                            height="10"
                            viewBox="0 0 10 8"
                            fill="none"
                            className="max-md:scale-110"
                          >
                            <path
                              d="M1 4L3.5 6.5L9 1"
                              stroke="white"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                      {isProject && (
                        <div
                          className="w-4 h-4 max-md:w-5 max-md:h-5 rounded shrink-0"
                          style={{
                            backgroundColor: (item as Project)
                              .backgroundColor,
                          }}
                        />
                      )}
                      <span className="text-sm max-md:text-[17px] flex-1 truncate">
                        <HighlightText
                          text={item.name}
                          query={searchQuery}
                        />
                      </span>
                      {isProject && (
                        <span className="text-xs text-gray-400 ml-2 shrink-0">
                          {projectUsageMap.get(item.id) || 0} чел
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}