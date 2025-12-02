import { useState, useRef, useEffect } from 'react';
import svgPaths from "./svg-yurl9oiucn";
import svgPathsNew from "./svg-bl5oypf3kt";
import imgAvatarOnline from "figma:asset/13999075da141928723b8c42fbe1a97dc4a5be20.png";
import imgAvatarOnline1 from "figma:asset/5bd0f85444d9f77271656b5be7fa3c91c10a9579.png";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { HeaderOnlineUsers } from "../components/scheduler/HeaderOnlineUsers";
import svgPathsActive from "./svg-jys0cyf1sl";
import svgPathsInactive from "./svg-58ntncjlc7";
import { useFilters } from "../contexts/FilterContext";
import { X } from "lucide-react";

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

type Mode = 'cursor' | 'scissors' | 'comment';
type FilterType = 'company' | 'department' | 'project' | null;

function ModeButton({ active, icon, onClick }: { active: boolean; icon: React.ReactNode; onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`box-border content-stretch flex gap-[6px] items-center justify-center p-[8px] relative rounded-[12px] shrink-0 cursor-pointer transition-colors hover:bg-gray-50`}
      data-name="input"
    >
      <div aria-hidden="true" className={`absolute border-[0.8px] ${active ? 'border-[#0062FF]' : 'border-[rgba(0,0,0,0.12)]'} border-solid inset-0 pointer-events-none rounded-[12px]`} />
      {icon}
    </div>
  );
}

function CursorIcon({ active }: { active: boolean }) {
  return (
    <div className="relative shrink-0 size-[20px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Frame 23">
          <path 
            d={active ? svgPathsActive.p3b7a5900 : svgPathsInactive.p21785580} 
            fill={active ? "var(--fill-0, #0062FF)" : "var(--fill-0, black)"} 
            id="Vector 193" 
          />
        </g>
      </svg>
    </div>
  );
}

function ScissorsIcon({ active }: { active: boolean }) {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <g id="Union">
            <path 
              clipRule="evenodd" 
              d={active ? svgPathsActive.p260f3480 : svgPathsInactive.p382f7100} 
              fill={active ? "var(--fill-0, #0062FF)" : "var(--fill-0, black)"} 
              fillRule="evenodd" 
            />
            <path 
              d={svgPathsActive.p33398ea8} 
              fill={active ? "var(--fill-0, #0062FF)" : "var(--fill-0, black)"} 
            />
          </g>
        </g>
      </svg>
    </div>
  );
}

function CommentIcon({ active }: { active: boolean }) {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Icon">
          <path 
            d={active ? svgPathsActive.p220c8000 : svgPathsInactive.p336f1c00} 
            fill={active ? "var(--fill-0, #0062FF)" : "var(--fill-0, black)"} 
            id="Vector (Stroke)" 
          />
        </g>
      </svg>
    </div>
  );
}

function Frame4(props: HeaderProps) {
  const { scissorsMode, commentMode, onToggleScissors, onToggleComment } = props;
  
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

function Building() {
  return (
    <div className="absolute inset-[5%]" data-name="building">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
        <g id="building">
          <g id="Union">
            <path d={svgPathsNew.p23264200} fill="var(--fill-0, black)" />
            <path d={svgPathsNew.p15827a00} fill="var(--fill-0, black)" />
            <path clipRule="evenodd" d={svgPathsNew.p242ec700} fill="var(--fill-0, black)" fillRule="evenodd" />
          </g>
          <g id="Vector" opacity="0"></g>
        </g>
      </svg>
    </div>
  );
}

function VuesaxLinearBuilding() {
  return (
    <div className="absolute contents inset-[5%]" data-name="vuesax/linear/building">
      <Building />
    </div>
  );
}

function VuesaxLinearBuilding1() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="vuesax/linear/building">
      <VuesaxLinearBuilding />
    </div>
  );
}

function Frame() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Frame">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Frame">
          <g id="Union">
            <path clipRule="evenodd" d={svgPathsNew.p2efbd480} fill="var(--fill-0, black)" fillRule="evenodd" />
            <path clipRule="evenodd" d={svgPathsNew.p6e2fb00} fill="var(--fill-0, black)" fillRule="evenodd" />
            <path clipRule="evenodd" d={svgPathsNew.p10986b00} fill="var(--fill-0, black)" fillRule="evenodd" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function Profile2User() {
  return (
    <div className="absolute inset-[5%]" data-name="profile-2user">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
        <g id="profile-2user">
          <g id="Union">
            <path clipRule="evenodd" d={svgPathsNew.pcae4500} fill="var(--fill-0, black)" fillRule="evenodd" />
            <path d={svgPathsNew.p3a669680} fill="var(--fill-0, black)" />
            <path d={svgPathsNew.p3eda64f2} fill="var(--fill-0, black)" />
            <path clipRule="evenodd" d={svgPathsNew.p3717c9c0} fill="var(--fill-0, black)" fillRule="evenodd" />
          </g>
          <g id="Vector" opacity="0"></g>
        </g>
      </svg>
    </div>
  );
}

function VuesaxLinearProfile2User() {
  return (
    <div className="absolute contents inset-[5%]" data-name="vuesax/linear/profile-2user">
      <Profile2User />
    </div>
  );
}

function VuesaxLinearProfile2User1() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="vuesax/linear/profile-2user">
      <VuesaxLinearProfile2User />
    </div>
  );
}

function FilterButton({ 
  icon, 
  count, 
  isOpen, 
  onClick,
  onClear
}: { 
  icon: React.ReactNode; 
  count: number;
  isOpen: boolean;
  onClick: () => void;
  onClear: (e: React.MouseEvent) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="box-border content-stretch flex gap-[4px] items-center justify-center px-[10px] py-[6px] m-[4px] relative rounded-[8px] shrink-0 cursor-pointer hover:bg-gray-100 transition-colors" 
      data-name="input"
    >
      {icon}
      {count > 0 && (
        <div className="relative">
          {isHovered ? (
            <div 
              onClick={onClear}
              className="flex items-center justify-center w-[16px] h-[16px] rounded-full bg-gray-500 hover:bg-gray-700 transition-colors"
            >
              <X className="w-[10px] h-[10px] text-white" />
            </div>
          ) : (
            <div className="flex items-center justify-center min-w-[16px] h-[16px] px-[4px] rounded-full bg-[#0062FF]">
              <span className="text-white text-[10px] font-medium leading-none">{count}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterPanel({ 
  type, 
  items, 
  selectedIds, 
  onToggle,
  onClose 
}: { 
  type: FilterType;
  items: Company[] | Department[] | Project[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const title = type === 'company' ? 'Компании' : type === 'department' ? 'Департаменты' : 'Проекты';

  return (
    <div 
      ref={panelRef}
      className="absolute top-[calc(100%+8px)] right-0 bg-white rounded-[12px] shadow-lg border border-gray-200 z-50 w-[280px] max-h-[400px] overflow-hidden flex flex-col"
    >
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-medium text-sm">{title}</h3>
      </div>
      <div className="overflow-y-auto flex-1">
        {items.map((item) => {
          const isSelected = selectedIds.has(item.id);
          const isProject = 'backgroundColor' in item;
          
          return (
            <div
              key={item.id}
              onClick={() => onToggle(item.id)}
              className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 transition-colors"
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                isSelected ? 'bg-[#0062FF] border-[#0062FF]' : 'border-gray-300'
              }`}>
                {isSelected && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              {isProject && (
                <div 
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: (item as Project).backgroundColor }}
                />
              )}
              <span className="text-sm">{item.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Container(props: HeaderProps) {
  const { companies = [], departments = [], projects = [] } = props;
  const { 
    enabledCompanies, 
    toggleCompany, 
    setEnabledCompanies,
    enabledDepartments, 
    toggleDepartment,
    setEnabledDepartments,
    enabledProjects, 
    toggleProject,
    setEnabledProjects
  } = useFilters();

  const [openFilter, setOpenFilter] = useState<FilterType>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClearCompanies = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEnabledCompanies(new Set());
  };

  const handleClearDepartments = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEnabledDepartments(new Set());
  };

  const handleClearProjects = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEnabledProjects(new Set());
  };

  return (
    <div ref={containerRef} className="content-stretch flex items-center justify-center relative rounded-[12px] shrink-0" data-name="container">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      
      <FilterButton
        icon={<VuesaxLinearBuilding1 />}
        count={enabledCompanies.size}
        isOpen={openFilter === 'company'}
        onClick={() => setOpenFilter(openFilter === 'company' ? null : 'company')}
        onClear={handleClearCompanies}
      />
      <FilterButton
        icon={<Frame />}
        count={enabledDepartments.size}
        isOpen={openFilter === 'department'}
        onClick={() => setOpenFilter(openFilter === 'department' ? null : 'department')}
        onClear={handleClearDepartments}
      />
      <FilterButton
        icon={<VuesaxLinearProfile2User1 />}
        count={enabledProjects.size}
        isOpen={openFilter === 'project'}
        onClick={() => setOpenFilter(openFilter === 'project' ? null : 'project')}
        onClear={handleClearProjects}
      />

      {openFilter === 'company' && (
        <FilterPanel
          type="company"
          items={companies}
          selectedIds={enabledCompanies}
          onToggle={toggleCompany}
          onClose={() => setOpenFilter(null)}
        />
      )}
      {openFilter === 'department' && (
        <FilterPanel
          type="department"
          items={departments}
          selectedIds={enabledDepartments}
          onToggle={toggleDepartment}
          onClose={() => setOpenFilter(null)}
        />
      )}
      {openFilter === 'project' && (
        <FilterPanel
          type="project"
          items={projects}
          selectedIds={enabledProjects}
          onToggle={toggleProject}
          onClose={() => setOpenFilter(null)}
        />
      )}
    </div>
  );
}

function Group() {
  return (
    <div className="absolute inset-[12.5%]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 15 15">
        <g id="Group 3">
          <g id="Vector">
            <path clipRule="evenodd" d={svgPathsNew.pedce580} fill="var(--fill-0, black)" fillRule="evenodd" />
            <path clipRule="evenodd" d={svgPathsNew.p1b85a700} fill="var(--fill-0, black)" fillRule="evenodd" />
            <path clipRule="evenodd" d={svgPathsNew.p14cff340} fill="var(--fill-0, black)" fillRule="evenodd" />
            <path clipRule="evenodd" d={svgPathsNew.p20fa3280} fill="var(--fill-0, black)" fillRule="evenodd" />
            <path clipRule="evenodd" d={svgPathsNew.p6b7e880} fill="var(--fill-0, black)" fillRule="evenodd" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function IconLineCalendarActive() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="icon_line/Calendar_active">
      <Group />
    </div>
  );
}

function ArrowUp() {
  return (
    <div className="relative size-full" data-name="Arrow - Up 2">
      <div className="absolute inset-[-17.14%_-8.57%]">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11 7">
          <g id="Arrow - Up 2">
            <path d={svgPathsNew.p4616100} id="Stroke 1" stroke="var(--stroke-0, #868789)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function IconlyLightArrowUp() {
  return (
    <div className="relative size-[16px]" data-name="Iconly/Light/Arrow - Up 2">
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
    <div className="relative shrink-0 size-[20px]" data-name="Iconly/Regular/Light/Arrow - Up 2">
      <div className="absolute flex items-center justify-center left-1/2 size-[16px] top-1/2 translate-x-[-50%] translate-y-[-50%]">
        <div className="flex-none scale-y-[-100%]">
          <IconlyLightArrowUp />
        </div>
      </div>
    </div>
  );
}

function Input6() {
  return (
    <div className="box-border content-stretch flex gap-[6px] items-center justify-center px-[12px] py-[8px] relative rounded-[12px] shrink-0" data-name="input">
      <div aria-hidden="true" className="absolute border-[0.8px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <IconLineCalendarActive />
      <p className="font-medium leading-[20px] relative shrink-0 text-[12px] text-black text-nowrap whitespace-pre">{`Вид `}</p>
      <IconlyRegularLightArrowUp />
    </div>
  );
}

function AvatarOnlineNoAvatar() {
  return (
    <div className="bg-[#f6f6f6] mr-[-8px] overflow-clip relative rounded-[12px] shrink-0 size-[32px]" data-name="avatarOnline (no avatar)">
      <p className="absolute font-normal leading-[20px] left-[calc(50%-10px)] text-[#868789] text-[14px] text-nowrap top-[calc(50%-10px)] whitespace-pre">АС</p>
    </div>
  );
}

function AvatarOnline() {
  return (
    <div className="mr-[-8px] pointer-events-none relative rounded-[12px] shrink-0 size-[32px]" data-name="avatarOnline">
      <ImageWithFallback alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover rounded-[12px] size-full" src={imgAvatarOnline} />
      <div aria-hidden="true" className="absolute border-2 border-solid border-white inset-[-2px] rounded-[14px]" />
    </div>
  );
}

function AvatarOnline1() {
  return (
    <div className="mr-[-8px] pointer-events-none relative rounded-[12px] shrink-0 size-[32px]" data-name="avatarOnline">
      <ImageWithFallback alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover rounded-[12px] size-full" src={imgAvatarOnline1} />
      <div aria-hidden="true" className="absolute border-2 border-solid border-white inset-[-2px] rounded-[14px]" />
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
       <HeaderOnlineUsers workspaceId={workspaceId} accessToken={accessToken || null} />
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
    <div className="h-[64px] relative rounded-[16px] shrink-0 w-full" data-name="boxheader">
      <div aria-hidden="true" className="absolute border border-[#f0f0f0] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex h-[64px] items-center px-[16px] py-0 relative w-full">
          <Frame5 {...props} />
        </div>
      </div>
    </div>
  );
}

export default function Header(props: HeaderProps) {
  return (
    <div className="bg-white relative size-full" data-name="header">
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col gap-[8px] items-start p-[8px] relative size-full">
          <Boxheader {...props} />
        </div>
      </div>
    </div>
  );
}