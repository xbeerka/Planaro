import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

/**
 * Skeleton loader для карточки воркспейса
 * Показывается во время загрузки списка пространств
 */
export function WorkspaceCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-[16px] p-6 animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-5 w-16 bg-gray-200 rounded-full" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 rounded-[12px]">
          <div className="h-7 w-10 bg-gray-200 rounded mx-auto mb-1" />
          <div className="h-3 w-14 bg-gray-200 rounded mx-auto" />
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-[12px]">
          <div className="h-7 w-10 bg-gray-200 rounded mx-auto mb-1" />
          <div className="h-3 w-14 bg-gray-200 rounded mx-auto" />
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-[12px]">
          <div className="h-7 w-10 bg-gray-200 rounded mx-auto mb-1" />
          <div className="h-3 w-14 bg-gray-200 rounded mx-auto" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="h-3 w-28 bg-gray-200 rounded" />
        <div className="flex items-center -space-x-1.5">
          <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white" />
          <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white" />
        </div>
      </div>
    </div>
  );
}