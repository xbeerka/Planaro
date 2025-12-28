import React, { memo } from 'react';

interface ResourceRowSkeletonProps {
  sidebarCollapsed?: boolean;
  rowHeight?: number;
}

/**
 * Skeleton loader для ячейки ресурса (сотрудника)
 * Показывается во время загрузки данных воркспейса
 * Адаптивен к состоянию сайдбара и высоте строки
 */
export const ResourceRowSkeleton = memo(function ResourceRowSkeleton({ 
  sidebarCollapsed = false,
  rowHeight = 144
}: ResourceRowSkeletonProps) {
  
  if (sidebarCollapsed) {
    // Свернутый вид - только аватар по центру
    return (
      <div className="bg-white relative w-full h-full animate-pulse flex items-center justify-center">
        {/* Avatar (центр) */}
        <div className="w-[36px] h-[36px] rounded-[12px] bg-[#f6f6f6] overflow-hidden" />
      </div>
    );
  }

  // Адаптивная логика
  const numericHeight = Number(rowHeight);
  const isSmall = numericHeight <= 96; // S size: <= 96px
  const isXS = numericHeight <= 60;   // XS size: <= 60px

  const showAvatar = !isSmall;
  const showRole = !isXS;
  const showBadges = !isSmall; // Скрываем бейджи на маленьких строках (не влезают)

  const gapClass = isSmall ? "gap-1" : "gap-3"; // Вертикальный отступ (между строкой и бейджами)
  const rowGap = isSmall ? "gap-[4px]" : "gap-[12px]"; // Горизонтальный отступ (между аватаром и именем)

  // Развернутый вид - адаптивная верстка на flexbox
  return (
    <div className={`bg-white w-full h-full animate-pulse flex flex-col justify-center ${gapClass}`}>
      {/* Top Part: Avatar + Info */}
      <div className={`flex items-center ${rowGap} w-full`}>
        {showAvatar && (
          <div className="w-[36px] h-[36px] rounded-[12px] bg-[#f6f6f6] shrink-0" />
        )}

        <div className="flex flex-col gap-[4px] min-w-0 flex-1">
          {/* Name */}
          <div className="h-[14px] bg-[#f6f6f6] rounded-[4px] w-[136px] max-w-full" />
          
          {/* Role */}
          {showRole && (
            <div className="h-[10px] bg-[#f6f6f6] rounded-[4px] w-[96px] max-w-full" />
          )}
        </div>
      </div>

      {/* Bottom Part: Project Badges */}
      {showBadges && (
        <div className="flex gap-[6px]">
          {/* Badge 1 */}
          <div className="h-[16px] w-[48px] bg-[#f6f6f6] rounded-[6px] opacity-50" />
          
          {/* Badge 2 */}
          <div className="h-[16px] w-[48px] bg-[#f6f6f6] rounded-[6px] opacity-50" />
        </div>
      )}
    </div>
  );
});
