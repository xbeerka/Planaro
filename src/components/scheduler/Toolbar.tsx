interface ToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  scissorsMode: boolean;
  commentMode: boolean;
  weekPx: number;
  eventRowH: number;
  onUndo: () => void;
  onRedo: () => void;
  onToggleScissors: () => void;
  onToggleComment: () => void;
  onWeekPxChange: (value: number) => void;
  onEventRowHChange: (value: number) => void;
  onOpenUsersModal: () => void;
  onOpenProjectsModal: () => void;
  onOpenDepartmentsModal: () => void;
}

const WEEK_SIZES = [48, 80, 112, 144];
const ROW_HEIGHTS = [48, 80, 112, 144];

export function Toolbar({ 
  canUndo, 
  canRedo, 
  scissorsMode,
  commentMode,
  weekPx,
  eventRowH,
  onUndo, 
  onRedo, 
  onToggleScissors,
  onToggleComment,
  onWeekPxChange,
  onEventRowHChange,
  onOpenUsersModal,
  onOpenProjectsModal,
  onOpenDepartmentsModal
}: ToolbarProps) {
  // Convert pixel value to slider index
  const weekPxToIndex = (px: number) => WEEK_SIZES.indexOf(px);
  const eventRowHToIndex = (h: number) => ROW_HEIGHTS.indexOf(h);
  
  // Convert slider index to pixel value
  const indexToWeekPx = (index: number) => WEEK_SIZES[index] || WEEK_SIZES[3];
  const indexToEventRowH = (index: number) => ROW_HEIGHTS[index] || ROW_HEIGHTS[3];

  // Detect OS for keyboard shortcuts
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const undoShortcut = isMac ? '⌘Z' : 'Ctrl+Z';
  const redoShortcut = isMac ? '⌘⇧Z' : 'Ctrl+Shift+Z';

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[18px] flex items-center gap-3 p-3 rounded-xl shadow-[0_6px_20px_rgba(6,18,36,0.08)] bg-[rgba(0,0,0,0.75)] backdrop-blur-md z-[500]">
      {/* History controls */}
      <div className="flex gap-2">
        <button
          aria-label={`Назад (${undoShortcut})`}
          title={`Назад (${undoShortcut})`}
          className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all outline-none focus:outline-none cursor-pointer"
          onClick={onUndo}
          disabled={!canUndo}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 14l-4 -4l4 -4" />
            <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
          </svg>
        </button>
        <button
          aria-label={`Повторить (${redoShortcut})`}
          title={`Повторить (${redoShortcut})`}
          className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all outline-none focus:outline-none cursor-pointer"
          onClick={onRedo}
          disabled={!canRedo}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 14l4 -4l-4 -4" />
            <path d="M19 10h-11a4 4 0 1 0 0 8h1" />
          </svg>
        </button>
        {/* Separator */}
        <div className="w-px h-[24px] bg-white/20 self-center" />
        
        {/* Scissors button */}
        <button
          aria-label="Ножницы (разрезать событие)"
          title="Ножницы (разрезать событие)"
          className="w-10 h-10 rounded-[10px] flex items-center justify-center transition-all hover:scale-105 active:scale-95 outline-none focus:outline-none cursor-pointer"
          style={{ background: scissorsMode ? 'rgba(200,30,40,0.95)' : 'white' }}
          onClick={onToggleScissors}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={scissorsMode ? "#ffffff" : "#000000"}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <line x1="20" y1="4" x2="8.12" y2="15.88" />
            <line x1="14.47" y1="14.48" x2="20" y2="20" />
            <line x1="8.12" y1="8.12" x2="12" y2="12" />
          </svg>
        </button>
        
        {/* Comment button */}
        <button
          aria-label="Комментарий (оставить заметку)"
          title="Комментарий (оставить заметку)"
          className="w-10 h-10 rounded-[10px] flex items-center justify-center transition-all hover:scale-105 active:scale-95 outline-none focus:outline-none cursor-pointer"
          style={{ background: commentMode ? 'rgba(58,135,173,0.95)' : 'white' }}
          onClick={onToggleComment}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={commentMode ? "#ffffff" : "#000000"}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1 -2 2h-10l-4 4v-14a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v8z" />
          </svg>
        </button>
        
        {/* Separator */}
        <div className="w-px h-[24px] bg-white/20 self-center" />
        <button
          aria-label="Настройки людей"
          className="w-10 h-10 rounded-[10px] flex items-center justify-center transition-all hover:scale-105 active:scale-95 outline-none focus:outline-none cursor-pointer bg-white hover:bg-gray-100"
          onClick={onOpenUsersModal}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />
            <path d="M3 21v-2a4 4 0 0 1 4 -4h4c.96 0 1.84 .338 2.53 .901" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            <path d="M16 19h6" />
            <path d="M19 16v6" />
          </svg>
        </button>
        <button
          aria-label="Настройки проектов"
          className="w-10 h-10 rounded-[10px] flex items-center justify-center transition-all hover:scale-105 active:scale-95 outline-none focus:outline-none cursor-pointer bg-white hover:bg-gray-100"
          onClick={onOpenProjectsModal}
        >

        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#000000"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 4l16 0" />
          <path d="M4 20l16 0" />
          <path d="M6 9m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" />
        </svg>

        </button>
        <button
          aria-label="Настройки департаментов"
          className="w-10 h-10 rounded-[10px] flex items-center justify-center transition-all hover:scale-105 active:scale-95 outline-none focus:outline-none cursor-pointer bg-white hover:bg-gray-100"
          onClick={onOpenDepartmentsModal}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14z" />
            <path d="M10 10h11" />
            <path d="M10 3v18" />
            <path d="M9 3l-6 6" />
            <path d="M10 7l-7 7" />
            <path d="M10 12l-7 7" />
            <path d="M10 17l-4 4" />
          </svg>
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-[24px] bg-white/20 self-center" />

      {/* Width controls */}
      <div className="flex flex-col gap-0 min-w-[140px]">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-white/90 uppercase tracking-wider" style={{ fontWeight: 600 }}>
            Ширина
          </span>
          <span className="text-[11px] text-white/70" style={{ fontWeight: 500 }}>
            {weekPx}px
          </span>
        </div>
        <div className="px-1">
          <input
            type="range"
            min={0}
            max={WEEK_SIZES.length - 1}
            step={1}
            value={weekPxToIndex(weekPx)}
            onChange={(e) => onWeekPxChange(indexToWeekPx(Number(e.target.value)))}
            className="custom-slider w-full"
          />
        </div>
      </div>

      {/* Height controls */}
      <div className="flex flex-col gap-0 min-w-[140px]">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-white/90 uppercase tracking-wider" style={{ fontWeight: 600 }}>
            Высота
          </span>
          <span className="text-[11px] text-white/70" style={{ fontWeight: 500 }}>
            {eventRowH}px
          </span>
        </div>
        <div className="px-1">
          <input
            type="range"
            min={0}
            max={ROW_HEIGHTS.length - 1}
            step={1}
            value={eventRowHToIndex(eventRowH)}
            onChange={(e) => onEventRowHChange(indexToEventRowH(Number(e.target.value)))}
            className="custom-slider w-full"
          />
        </div>
      </div>

      {/* Render mode toggle - ОТКЛЮЧЕНО (используем только DOM режим) */}
      {/* <div className="w-px h-8 bg-white/20 mx-1" />
      <button
        onClick={onToggleRenderMode}
        className="h-10 px-4 rounded-[10px] flex items-center gap-2 bg-blue-600/80 hover:bg-blue-600 text-white transition-all outline-none focus:outline-none cursor-pointer"
        title={`Переключить на ${renderMode === 'dom' ? 'Canvas' : 'DOM'}`}
      >
        {renderMode === 'dom' ? (
          // Canvas mode icon
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
        ) : (
          // DOM mode icon
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5l0 14" />
            <path d="M5 12l14 0" />
            <path d="M7.5 7.5l9 9" />
            <path d="M7.5 16.5l9 -9" />
          </svg>
        )}
        <span className="text-sm" style={{ fontWeight: 600 }}>
          {renderMode === 'dom' ? 'Canvas' : 'DOM'}
        </span>
      </button> */}
    </div>
  );
}