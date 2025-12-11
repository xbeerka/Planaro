import React from 'react';

/**
 * Skeleton loader для заголовка департамента
 * Показывается во время загрузки данных воркспейса
 * Высота: 44px (DEPARTMENT_ROW_HEIGHT)
 */
export function DepartmentRowSkeleton() {
  return (
    <div className="px-4 h-full flex items-center animate-pulse">
      {/* Серый блок вместо названия департамента */}
      <div className="h-[12px] w-[120px] bg-[#f6f6f6] rounded-[4px]" />
    </div>
  );
}
