import React from 'react';

/**
 * Skeleton loader для ячейки ресурса (сотрудника)
 * Показывается во время загрузки данных воркспейса
 * Высота: 144px (RESOURCE_ROW_HEIGHT)
 */
export function ResourceRowSkeleton() {
  return (
    <div className="bg-white border-r border-[#f0f0f0] relative w-full h-[144px] animate-pulse">
      {/* Avatar (слева) */}
      <div className="absolute left-[24px] top-[38px] w-[36px] h-[36px] rounded-[12px] bg-[#f6f6f6] overflow-hidden" />

      {/* Name and Role (справа от аватара) */}
      <div className="absolute left-[72px] top-[38px] flex flex-col gap-[4px] w-[150px]">
        {/* Name */}
        <div className="h-[14px] bg-[#f6f6f6] rounded-[4px] w-[136px] mt-[3px]" />
        
        {/* Role */}
        <div className="h-[10px] bg-[#f6f6f6] rounded-[4px] w-[96px]" />
      </div>

      {/* Project Badges (внизу) */}
      <div className="absolute left-[24px] top-[86px] flex gap-[6px]">
        {/* Badge 1 */}
        <div className="h-[18px] w-[48px] bg-[#f6f6f6] rounded-[6px] opacity-50" />
        
        {/* Badge 2 */}
        <div className="h-[18px] w-[48px] bg-[#f6f6f6] rounded-[6px] opacity-50" />
      </div>
    </div>
  );
}