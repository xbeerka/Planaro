import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { Comment } from "../../types/scheduler";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../ui/avatar";
import { cn } from "../ui/utils";

interface CommentMarkerProps {
  comment: Comment;
  onClick: (e: React.MouseEvent) => void;
  cellWidth: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
  gap?: number;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
  rounded?: boolean; // следует режиму скруглений планировщика
}

function ActionButton({
  label,
  onClick,
  variant = "default",
  rounded = true,
}: {
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  variant?: "default" | "destructive";
  rounded?: boolean;
}) {
  return (
    <div
      className="basis-0 grow h-[36px] min-h-px min-w-px relative shrink-0 cursor-pointer group active:scale-95 transition-transform"
      style={{ borderRadius: rounded ? "12px" : "4px" }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        aria-hidden="true"
        className="absolute border-[0.5px] border-[rgba(0,0,0,0.12)] border-solid inset-0 pointer-events-none group-hover:bg-black/5 transition-colors"
        style={{ borderRadius: rounded ? "12px" : "4px" }}
      />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex items-center justify-center px-[12px] py-[8px] relative size-full">
          <p
            className={cn(
              "font-medium leading-[20px] relative shrink-0 text-[12px] text-nowrap select-none",
              variant === "destructive"
                ? "text-[#e7000b]"
                : "text-black",
            )}
          >
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CommentMarker({
  comment,
  onClick,
  cellWidth,
  onEdit,
  onDelete,
  onDragStart,
  gap = 0,
  isOpen: isOpenProp,
  onToggle,
  rounded = true,
}: CommentMarkerProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const miniRef = useRef<HTMLDivElement>(null);
  const maxiRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );

  const isControlled = isOpenProp !== undefined;
  const isOpen = isControlled ? isOpenProp : internalIsOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalIsOpen(newOpen);
    }
    onToggle?.(newOpen);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle active state styles here, dragging logic should be handled by parent
  };

  const offsetValue = gap * 0.5;

  const initials = comment.userDisplayName
    ? comment.userDisplayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  // Reset position when closed to avoid "stale jump" on next open
  useEffect(() => {
    if (!isOpen) {
      setPosition(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        maxiRef.current &&
        !maxiRef.current.contains(e.target as Node)
      ) {
        handleOpenChange(false);
      }
    };

    // Use pointerdown to catch clicks earlier and more reliably for "outside" checks
    document.addEventListener(
      "pointerdown",
      handleClickOutside,
    );
    return () => {
      document.removeEventListener(
        "pointerdown",
        handleClickOutside,
      );
    };
  }, [isOpen]); // Depend on isOpen, not handleOpenChange (assuming stable)

  // Calculate position whenever isOpen becomes true
  useLayoutEffect(() => {
    if (isOpen && miniRef.current) {
      const rect = miniRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top,
        left: rect.left,
      });
    }
  }, [isOpen]);

  // Update position on scroll/resize to keep maxi attached to mini
  useEffect(() => {
    if (!isOpen) return;

    const updatePos = () => {
      if (miniRef.current) {
        const rect = miniRef.current.getBoundingClientRect();
        setPosition({ top: rect.top, left: rect.left });
      }
    };

    window.addEventListener("scroll", updatePos, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", updatePos, { passive: true });

    return () => {
      window.removeEventListener("scroll", updatePos, {
        capture: true,
      });
      window.removeEventListener("resize", updatePos);
    };
  }, [isOpen]);

  // Auto-scroll if maxi comment is out of bounds
  useLayoutEffect(() => {
    // Only run if position is set (portal is rendered) and we have refs
    if (isOpen && position && maxiRef.current && miniRef.current) {
      const maxiRect = maxiRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const paddingBottom = 26; // Desired margin from bottom

      if (maxiRect.bottom > viewportHeight - paddingBottom) {
        const overflow =
          maxiRect.bottom - (viewportHeight - paddingBottom);

        // Find scroll parent
        let parent = miniRef.current.parentElement;
        let scrollContainer: HTMLElement | Window = window;

        while (parent) {
          const style = window.getComputedStyle(parent);
          if (
            (style.overflowY === "auto" ||
              style.overflowY === "scroll") &&
            parent.scrollHeight > parent.clientHeight
          ) {
            scrollContainer = parent;
            break;
          }
          parent = parent.parentElement;
        }

        scrollContainer.scrollBy({
          top: overflow,
          behavior: "auto",
        });
      }
    }
  }, [isOpen, position]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent drag from starting
    if (!isOpen) {
      // Position will be calculated by useLayoutEffect
      handleOpenChange(true);
    }
  };

  // Prevent drag when clicking on Maxi mode content (not the avatar)
  const handlePointerDownMaxi = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  const cardRadius = rounded ? "12px" : "0px";

  // Maxi View - Render in portal with backdrop
  const maxiContent = (
    <>
      {/* Backdrop - catches all clicks outside */}
      <div
        className="fixed inset-0 z-[550] bg-white/[0.001] pointer-events-auto"
        onClick={() => handleOpenChange(false)}
        onPointerDown={(e) => {
          e.stopPropagation();
          handleOpenChange(false);
        }}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseEnter={(e) => e.stopPropagation()}
        onMouseOver={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onScroll={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      />

      {/* Maxi Comment Card */}
      <div
        ref={maxiRef}
        className="fixed z-[551] w-[260px] min-h-[100px]"
        style={{
          top: position?.top ?? 0,
          left: position?.left ?? 0,
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handlePointerDownMaxi}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseEnter={(e) => e.stopPropagation()}
        onMouseOver={(e) => e.stopPropagation()}
        onMouseLeave={(e) => e.stopPropagation()}
      >
        <div
          className="backdrop-blur-[2px] backdrop-filter bg-[rgba(255,255,255,0.95)] relative size-full shadow-lg transition-all duration-200 animate-in fade-in zoom-in-95"
          style={{ borderRadius: cardRadius }}
        >
          <div
            aria-hidden="true"
            className="absolute border border-[rgba(206,206,206,0.8)] border-solid inset-0 pointer-events-none"
            style={{ borderRadius: cardRadius }}
          />

          <div className="size-full">
            <div className="content-stretch flex gap-[8px] items-start pb-[12px] pl-[10px] pr-[12px] pt-[8px] relative size-full">
              {/* Avatar Frame */}
              <div className="h-[18px] relative shrink-0 w-[16px] mt-1">
                <Avatar className="absolute left-0 top-0 h-[16px] w-[16px] rounded-[6px] pointer-events-none">
                  {comment.authorAvatarUrl ? (
                    <AvatarImage
                      src={comment.authorAvatarUrl}
                      className="object-cover h-full w-full"
                    />
                  ) : (
                    <AvatarFallback className="text-[6px] bg-[#f6f6f6] text-[#868789] rounded-[6px] font-normal flex items-center justify-center size-full">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>

              {/* Content Frame */}
              <div className="basis-0 content-stretch flex flex-col grow items-start justify-center min-h-px min-w-px relative shrink-0">
                {/* User Name */}
                <div className="flex w-full justify-between items-baseline gap-2">
                  <p className="font-medium leading-[18px] relative shrink-0 text-[10px] text-[rgba(0,0,0,0.5)] text-nowrap mb-0.5">
                    {comment.userDisplayName}
                  </p>
                  <span className="text-[10px] text-[rgba(0,0,0,0.3)] shrink-0">
                    {new Date(
                      comment.createdAt,
                    ).toLocaleDateString()}
                  </span>
                </div>
                {/* Comment Text */}
                <p className="font-normal leading-normal min-w-full relative shrink-0 text-[12px] text-black w-full break-words whitespace-pre-wrap mb-2">
                  {comment.comment}
                </p>

                {/* Button Group */}
                <div className="content-stretch flex gap-[8px] items-start pb-0 pt-[8px] px-0 relative shrink-0 w-full">
                  <ActionButton
                    label="Изменить"
                    rounded={rounded}
                    onClick={() => {
                      handleOpenChange(false);
                      onEdit?.();
                    }}
                  />
                  <ActionButton
                    label="Удалить"
                    variant="destructive"
                    rounded={rounded}
                    onClick={onDelete}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mini View */}
      <div
        ref={miniRef}
        className={cn(
          "h-[28px] relative cursor-pointer group w-fit",
          isOpen && "invisible",
        )}
        style={{ maxWidth: cellWidth, marginTop: offsetValue }}
        draggable={false}
        onClick={handleToggle}
        onPointerDown={(e) => {
          if (onDragStart) {
            onDragStart(e);
          } else {
            e.stopPropagation();
          }
        }}
        title={`${comment.userDisplayName}: ${comment.comment}`}
      >
        <div
          className="bg-[rgba(255,255,255,0.8)] backdrop-blur-[2px] relative size-full group-hover:bg-[rgba(255,255,255,0.9)] transition-colors"
          style={{ borderRadius: cardRadius }}
        >
          <div
            aria-hidden="true"
            className="absolute border border-[rgba(206,206,206,0.8)] border-solid inset-0 pointer-events-none"
            style={{ borderRadius: cardRadius }}
          />
          <div
            className="flex flex-row items-center size-full pl-[6px] pr-[8px] py-[4px] gap-[4px]"
            onMouseEnter={(e) => e.stopPropagation()}
            onMouseOver={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
          >
            {/* Avatar Frame */}
            <div className="relative shrink-0 w-[16px] h-[16px]">
              <Avatar className="absolute left-0 top-0 h-[16px] w-[16px] rounded-[6px]">
                {comment.authorAvatarUrl ? (
                  <AvatarImage
                    src={comment.authorAvatarUrl}
                    className="object-cover h-full w-full"
                  />
                ) : (
                  <AvatarFallback className="text-[6px] bg-[#f6f6f6] text-[#868789] rounded-[6px] font-normal flex items-center justify-center size-full">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
            </div>
            {/* Truncated Text */}
            <p className="font-normal leading-[18px] relative text-[10px] text-black text-nowrap overflow-hidden text-ellipsis min-w-0 flex-1">
              {comment.comment}
            </p>
          </div>
        </div>
      </div>

      {/* Maxi View - Rendered in portal */}
      {isOpen &&
        position &&
        typeof document !== "undefined" &&
        createPortal(maxiContent, document.body)}
    </>
  );
}