import { useState, useRef, useEffect } from "react";
import svgPaths from "./svg-yurl9oiucn";
import svgPathsNew from "./svg-bl5oypf3kt";
import imgAvatarOnline from "figma:asset/13999075da141928723b8c42fbe1a97dc4a5be20.png";
import imgAvatarOnline1 from "figma:asset/5bd0f85444d9f77271656b5be7fa3c91c10a9579.png";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { HeaderOnlineUsers } from "../components/scheduler/HeaderOnlineUsers";
import svgPathsActive from "./svg-jys0cyf1sl";
import svgPathsInactive from "./svg-58ntncjlc7";
import { useFilters } from "../contexts/FilterContext";
import { useSettings } from "../contexts/SettingsContext";
import { X, Filter } from "lucide-react";

interface Company {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  queue?: number;
}

interface Project {
  id: string;
  name: string;
  backgroundColor: string;
  textColor: string;
}

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
    <div className="relative shrink-0 size-[20px]">
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 20 20"
      >
        <g id="Frame 23">
          <path
            d={
              active
                ? svgPathsActive.p3b7a5900
                : svgPathsInactive.p21785580
            }
            fill={
              active
                ? "var(--fill-0, #0062FF)"
                : "var(--fill-0, black)"
            }
            id="Vector 193"
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
      data-name="Icon"
    >
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 20 20"
      >
        <g id="Icon">
          <g id="Union">
            <path
              clipRule="evenodd"
              d={
                active
                  ? svgPathsActive.p260f3480
                  : svgPathsInactive.p382f7100
              }
              fill={
                active
                  ? "var(--fill-0, #0062FF)"
                  : "var(--fill-0, black)"
              }
              fillRule="evenodd"
            />
            <path
              d={svgPathsActive.p33398ea8}
              fill={
                active
                  ? "var(--fill-0, #0062FF)"
                  : "var(--fill-0, black)"
              }
            />
          </g>
        </g>
      </svg>
    </div>
  );
}

function CommentIcon({ active }: { active: boolean }) {
  return (
    <div
      className="relative shrink-0 size-[20px]"
      data-name="Icon"
    >
      <svg
        className="block size-full"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 20 20"
      >
        <g id="Icon">
          <path
            d={
              active
                ? svgPathsActive.p220c8000
                : svgPathsInactive.p336f1c00
            }
            fill={
              active
                ? "var(--fill-0, #0062FF)"
                : "var(--fill-0, black)"
            }
            id="Vector (Stroke)"
          />
        </g>
      </svg>
    </div>
  );
}

function Frame4(props: HeaderProps) {
  const {
    scissorsMode,
    commentMode,
    onToggleScissors,
    onToggleComment,
  } = props;

  // Determine current mode
  const isScissors = !!scissorsMode;
  const isComment = !!commentMode;
  const isCursor = !isScissors && !isComment;

  const handleCursorClick = () => {
    if (isScissors && onToggleScissors) onToggleScissors();
    if (isComment && onToggleComment) onToggleComment();
  };

  const handleScissorsClick = () => {
    if (onToggleScissors) onToggleScissors();
  };

  const handleCommentClick = () => {
    if (onToggleComment) onToggleComment();
  };

  return (
    <div className="content-stretch flex gap-[12px] items-center relative shrink-0">
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

function IconlyRegularLightArrowUp() {
  return (
    <div
      className="relative shrink-0 size-[20px]"
      data-name="Iconly/Regular/Light/Arrow - Up 2"
    >
      <div className="absolute flex items-center justify-center left-1/2 size-[16px] top-1/2 translate-x-[-50%] translate-y-[-50%]">
        <div className="flex-none">
          <IconlyLightArrowUp />
        </div>
      </div>
    </div>
  );
}

function Input6() {
  const { weekPx, eventRowH, setWeekPx, setEventRowH } =
    useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        !dropdownRef.current.contains(e.target as Node)
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

  return (
    <div ref={dropdownRef} className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="box-border content-stretch flex gap-[6px] items-center justify-center px-[12px] py-[8px] relative rounded-[12px] shrink-0 cursor-pointer hover:bg-gray-50 transition-colors"
        data-name="input"
      >
        <div
          aria-hidden="true"
          className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]"
        />
        <IconLineCalendarActive />
        <p className="font-medium leading-[20px] relative shrink-0 text-[12px] text-black text-nowrap whitespace-pre">{`Вид `}</p>
        <div
          className={`transition-transform ${isOpen ? "" : "rotate-180"}`}
        >
          <IconlyRegularLightArrowUp />
        </div>
      </div>

      {/* Дропдаун с настройками */}
      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] right-0 bg-white rounded-[12px] shadow-lg border border-gray-200 z-50 w-[320px] py-4">
          {/* Ширина недели */}
          <div className="px-4 mb-4">
            <p className="text-xs font-medium text-gray-600 mb-2">
              Ширина недели
            </p>
            <div className="grid grid-cols-2 gap-2">
              {weekPresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => {
                    console.log(
                      `🎨 Изменение ширины недели: ${weekPx}px → ${preset.value}px`,
                    );
                    setWeekPx(preset.value);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    weekPx === preset.value
                      ? "bg-[#0062FF] text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Высота строки */}
          <div className="px-4">
            <p className="text-xs font-medium text-gray-600 mb-2">
              Высота строки
            </p>
            <div className="grid grid-cols-2 gap-2">
              {heightPresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => {
                    console.log(
                      `🎨 Изменение высоты строки: ${eventRowH}px → ${preset.value}px`,
                    );
                    setEventRowH(preset.value);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    eventRowH === preset.value
                      ? "bg-[#0062FF] text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
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
  return (
    <div className="content-stretch flex gap-[16px] items-center relative shrink-0">
      <Container {...props} />
      <Input6 />
      <Frame1 {...props} />
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
  return (
    <div
      className="box-border content-stretch flex flex-col gap-2 items-start py-2 pl-0 pr-2 relative h-full w-full"
      data-name="header"
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
  } = useFilters();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "company" | "department" | "project"
  >("project");
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Общий счетчик активных фильтров
  const totalFilters =
    enabledCompanies.size +
    enabledDepartments.size +
    enabledProjects.size;

  // Закрытие по клику вне дропдауна
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
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

  // Очистка всех фильтров
  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEnabledCompanies(new Set());
    setEnabledDepartments(new Set());
    setEnabledProjects(new Set());
    console.log("🧹 Все фильтры очищены");
  };

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
          items: departments,
          selectedIds: enabledDepartments,
          onToggle: toggleDepartment,
        };
      case "project":
        return {
          items: projects,
          selectedIds: enabledProjects,
          onToggle: toggleProject,
        };
    }
  };

  const { items, selectedIds, onToggle } = getCurrentData();

  return (
    <div ref={containerRef} className="relative">
      {/* Кнопка "Фильтр" */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="box-border content-stretch flex gap-[6px] items-center justify-center px-[12px] py-[8px] relative rounded-[12px] shrink-0 cursor-pointer hover:bg-gray-50 transition-colors"
        data-name="container"
      >
        <div
          aria-hidden="true"
          className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]"
        />

        <Filter className="w-[16px] h-[16px] text-black" />
        <p className="font-medium leading-[20px] relative shrink-0 text-[12px] text-black text-nowrap whitespace-pre">
          Фильтр
        </p>

        {/* Счетчик активных фильтров */}
        {totalFilters > 0 && (
          <div className="flex items-center justify-center min-w-[18px] h-[18px] px-[5px] rounded-full bg-[#0062FF]">
            <span className="text-white text-[11px] font-medium leading-none">
              {totalFilters}
            </span>
          </div>
        )}
      </div>

      {/* Дропдаун с вкладками */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-[calc(100%+8px)] right-0 bg-white rounded-[12px] shadow-lg border border-gray-200 z-50 w-[340px] max-h-[450px] overflow-hidden flex flex-col"
        >
          {/* Заголовок с кнопкой "Очистить всё" */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-medium text-sm">Фильтры</h3>
            {totalFilters > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-[#0062FF] hover:text-[#0052CC] font-medium transition-colors"
              >
                Очистить всё
              </button>
            )}
          </div>

          {/* Вкладки */}
          <div className="flex border-b border-gray-200 px-4">
            <button
              onClick={() => setActiveTab("project")}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors relative ${
                activeTab === "project"
                  ? "text-[#0062FF]"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Проекты
              {enabledProjects.size > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#0062FF] text-white">
                  {enabledProjects.size}
                </span>
              )}
              {activeTab === "project" && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0062FF]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("department")}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors relative ${
                activeTab === "department"
                  ? "text-[#0062FF]"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Департаменты
              {enabledDepartments.size > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#0062FF] text-white">
                  {enabledDepartments.size}
                </span>
              )}
              {activeTab === "department" && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0062FF]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("company")}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors relative ${
                activeTab === "company"
                  ? "text-[#0062FF]"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Компании
              {enabledCompanies.size > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#0062FF] text-white">
                  {enabledCompanies.size}
                </span>
              )}
              {activeTab === "company" && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0062FF]" />
              )}
            </button>
          </div>

          {/* Список элементов */}
          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Нет данных
              </div>
            ) : (
              items.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const isProject = "backgroundColor" in item;

                return (
                  <div
                    key={item.id}
                    onClick={() => onToggle(item.id)}
                    className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer flex items-center gap-2 transition-colors"
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-[#0062FF] border-[#0062FF]"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          width="10"
                          height="8"
                          viewBox="0 0 10 8"
                          fill="none"
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
                        className="w-3 h-3 rounded"
                        style={{
                          backgroundColor: (item as Project)
                            .backgroundColor,
                        }}
                      />
                    )}
                    <span className="text-sm flex-1">
                      {item.name}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}