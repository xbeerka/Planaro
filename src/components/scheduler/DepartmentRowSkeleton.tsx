import React, { memo } from 'react';

interface DepartmentRowSkeletonProps {
  sidebarCollapsed?: boolean;
}

/**
 * Skeleton loader для заголовка департамента
 * Показывается во время загрузки данных воркспейса
 * Высота: 52px (DEPARTMENT_ROW_HEIGHT)
 * Адаптивен к состоянию сайдбара (свернут/развернут)
 */
export const DepartmentRowSkeleton = memo(function DepartmentRowSkeleton({ sidebarCollapsed = false }: DepartmentRowSkeletonProps) {
  if (sidebarCollapsed) {
    // Свернутый вид - короткий блок по центру
    return (
      <div className="h-full flex items-center justify-center animate-pulse">
        <div className="h-[12px] w-[36px] bg-[#f6f6f6] rounded-[4px]" />
      </div>
    );
  }

  // Развернутый вид - полная ширина
  return (
    <div className="px-4 h-full flex items-center animate-pulse">
      {/* Серый блок вместо названия департамента */}
      <div className="h-[12px] w-[120px] bg-[#f6f6f6] rounded-[4px]" />
    </div>
  );
});