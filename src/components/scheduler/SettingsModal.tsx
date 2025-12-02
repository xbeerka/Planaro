import { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { SchedulerEvent as SchedulerEventComponent } from './SchedulerEvent';
import { SchedulerEvent, Project, EventPattern } from '../../types/scheduler';
import { createLayoutConfig } from '../../utils/schedulerLayout';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mock data for preview
const MOCK_PROJECTS: Project[] = [
  { id: 'p1', name: 'Project 1', backgroundColor: '#3b82f6', textColor: '#ffffff', workspaceId: 'mock' }, // Blue
  { id: 'p2', name: 'Project 2', backgroundColor: '#10b981', textColor: '#ffffff', workspaceId: 'mock' }, // Green
  { id: 'p3', name: 'Project 3', backgroundColor: '#f59e0b', textColor: '#ffffff', workspaceId: 'mock' }, // Amber
];

// Mock patterns as requested
const MOCK_PATTERNS: EventPattern[] = [
  { 
    id: 'pat1', 
    name: 'P1 Pattern', 
    pattern: 'linear-gradient(45deg, rgba(255, 255, 255, 0.2) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.2) 75%, transparent 75%, transparent); background-size: 16px 16px;' 
  },
  { 
    id: 'pat2', 
    name: 'P2 Pattern', 
    pattern: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 1.5px, transparent 2px), radial-gradient(circle, rgba(255, 255, 255, 0.25) 1.5px, transparent 2px); background-size: 12px 12px; background-position: 0 0, 6px 6px;' 
  }
];

// Mock events as requested
const MOCK_EVENTS = [
  // Week 0: P1 0-100%
  { id: 'm1', projectId: 'p1', startWeek: 0, weeksSpan: 1, startUnit: 0, unitsTall: 4, resourceId: 'r1' },
  // Week 1: P2 0-50%, P1 50-100%
  { id: 'm2', projectId: 'p2', startWeek: 1, weeksSpan: 1, startUnit: 0, unitsTall: 2, resourceId: 'r1' },
  { id: 'm3', projectId: 'p1', startWeek: 1, weeksSpan: 1, startUnit: 2, unitsTall: 2, resourceId: 'r1' },
  // Week 2: P3 0-25%, P2 25-75%, P1 75-100%
  { id: 'm4', projectId: 'p3', startWeek: 2, weeksSpan: 1, startUnit: 0, unitsTall: 1, resourceId: 'r1' },
  { id: 'm5', projectId: 'p2', startWeek: 2, weeksSpan: 1, startUnit: 1, unitsTall: 2, resourceId: 'r1' },
  { id: 'm6', projectId: 'p1', startWeek: 2, weeksSpan: 1, startUnit: 3, unitsTall: 1, resourceId: 'r1' },
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { 
    weekPx, 
    eventRowH, 
    showGaps, 
    showPatterns, 
    showProjectWeight,
    setWeekPx, 
    setEventRowH, 
    setShowGaps, 
    setShowPatterns,
    setShowProjectWeight
  } = useSettings();

  // Локальное состояние для формы
  const [localWeekPx, setLocalWeekPx] = useState(weekPx);
  const [localEventRowH, setLocalEventRowH] = useState(eventRowH);
  const [localShowGaps, setLocalShowGaps] = useState(showGaps);
  const [localShowPatterns, setLocalShowPatterns] = useState(showPatterns);
  const [localShowProjectWeight, setLocalShowProjectWeight] = useState(showProjectWeight);

  // Синхронизация с глобальным состоянием при открытии
  useEffect(() => {
    if (isOpen) {
      setLocalWeekPx(weekPx);
      setLocalEventRowH(eventRowH);
      setLocalShowGaps(showGaps);
      setLocalShowPatterns(showPatterns);
      setLocalShowProjectWeight(showProjectWeight);
    }
  }, [isOpen, weekPx, eventRowH, showGaps, showPatterns, showProjectWeight]);

  const handleSave = () => {
    setWeekPx(localWeekPx);
    setEventRowH(localEventRowH);
    setShowGaps(localShowGaps);
    setShowPatterns(localShowPatterns);
    setShowProjectWeight(localShowProjectWeight);
    onClose();
  };

  // Проверка на наличие изменений
  const hasChanges = 
    localWeekPx !== weekPx || 
    localEventRowH !== eventRowH || 
    localShowGaps !== showGaps || 
    localShowPatterns !== showPatterns ||
    localShowProjectWeight !== showProjectWeight;

  // Create layout config for preview
  const previewConfig = createLayoutConfig(localWeekPx, localEventRowH, localShowGaps);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Настройки отображения</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Размеры сетки */}
          

          {/* Preview Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Предпросмотр</h3>
            <div className="bg-gray-50 overflow-x-auto">
              <div 
                className="relative bg-white"
                style={{ 
                  width: localWeekPx * 3,
                  height: localEventRowH,
                  backgroundImage: `linear-gradient(to right, transparent ${localWeekPx - 1}px, #f3f4f6 ${localWeekPx - 1}px, #f3f4f6 ${localWeekPx}px, transparent ${localWeekPx}px, transparent ${localWeekPx * 2 - 1}px, #f3f4f6 ${localWeekPx * 2 - 1}px, #f3f4f6 ${localWeekPx * 2}px, transparent ${localWeekPx * 2}px)`,
                  backgroundSize: '100% 100%',
                  // Fix sticky positioning context for preview
                  ['--sticky-name-left' as any]: '0px'
                }}
              >
                {/* Force 12px horizontal padding for preview events to match guidelines */}
                <style>{`
                  .scheduler-event {
                    padding-left: 12px !important;
                    padding-right: 12px !important;
                    pointer-events: none !important;
                  }
                  .scheduler-event * {
                    pointer-events: none !important;
                  }
                `}</style>
                {MOCK_EVENTS.map((originalEvent) => {
                  // Prepare projects with patterns if enabled
                  const effectiveProjects = localShowPatterns ? MOCK_PROJECTS.map(p => {
                    if (p.id === 'p1') return { ...p, patternId: 'pat1' };
                    if (p.id === 'p2') return { ...p, patternId: 'pat2' };
                    return p;
                  }) : MOCK_PROJECTS;

                  // Patch event geometry per request
                  // m1 (P1, W0): 0-100% (Units 0-4) - Unchanged
                  // m2 (P2, W1): 0-50% (Units 0-2) - Unchanged
                  // m3 (P1, W1): 50-100% -> Units 2-4 (Height 2)
                  // m4 (P3, W2): 0-25% (Unit 0-1) - Unchanged
                  // m5 (P2, W2): 25-75% -> Units 1-3 (Height 2)
                  // m6 (P1, W2): 75-100% -> Units 3-4 (Height 1)
                  
                  const event = { ...originalEvent };
                  if (event.id === 'm3') {
                    (event as any).startUnit = 2;
                    event.unitsTall = 2;
                  } else if (event.id === 'm5') {
                    (event as any).startUnit = 1;
                    event.unitsTall = 2;
                  } else if (event.id === 'm6') {
                    (event as any).startUnit = 3;
                    event.unitsTall = 1;
                  }

                  const id = event.id;
                  const p1Color = MOCK_PROJECTS[0].backgroundColor;
                  const p2Color = MOCK_PROJECTS[1].backgroundColor;
                  
                  // Determine neighbors for padding removal
                  const hasLeftNeighbor = id === 'm3' || id === 'm6' || id === 'm5'; 
                  const hasRightNeighbor = id === 'm1' || id === 'm3' || id === 'm2'; 
                  
                  // Check for grid edges
                  const isAtStart = event.startWeek === 0;
                  const isAtEnd = (event.startWeek + event.weeksSpan) === 3;

                  // Apply padding logic - remove padding at grid edges
                  const padLeft = (hasLeftNeighbor || isAtStart) ? 0 : previewConfig.cellPaddingLeft;
                  const padRight = (hasRightNeighbor || isAtEnd) ? 0 : previewConfig.cellPaddingRight;

                  let left = event.startWeek * localWeekPx + padLeft;
                  let width = localWeekPx - padLeft - padRight;
                  
                  // Manual adjustments for Project 1 overlap
                  if (id === 'm3') {
                    // Reduce width by 1 gap on right to accommodate m6 shift
                    width -= previewConfig.gap;
                  } else if (id === 'm6') {
                    // Shift left by 1 gap and increase width by 1 gap
                    left -= previewConfig.gap;
                    width += previewConfig.gap;
                  }
                  
                  const unitStart = (event as any).startUnit;
                  const top = unitStart * previewConfig.unitStride + previewConfig.rowPaddingTop;
                  const height = event.unitsTall * previewConfig.unitContentH + (event.unitsTall - 1) * previewConfig.gap;

                  // Corner Logic
                  let roundTopLeft = true;
                  let roundBottomLeft = true;
                  let roundTopRight = true;
                  let roundBottomRight = true;
                  
                  // Inner Corner Colors
                  let innerTopLeftColor = 'transparent';
                  let innerBottomLeftColor = 'transparent';
                  let innerTopRightColor = 'transparent';
                  let innerBottomRightColor = 'transparent';

                  if (id === 'm1') { // P1 W0 (0-4)
                     // Right: m3 (2-4)
                     roundTopRight = true; // 0 < 2
                     roundBottomRight = false; // 4 == 4
                  } else if (id === 'm3') { // P1 W1 (2-4)
                     // Left: m1 (0-4)
                     innerTopLeftColor = p1Color!; // 0 < 2
                     roundTopLeft = false;
                     roundBottomLeft = false; // 4 == 4
                     
                     // Right: m6 (3-4)
                     roundTopRight = true; // 2 < 3
                     roundBottomRight = false; // 4 == 4
                  } else if (id === 'm6') { // P1 W2 (3-4)
                     // Left: m3 (2-4)
                     innerTopLeftColor = p1Color!; // 2 < 3
                     roundTopLeft = false;
                     roundBottomLeft = false; // 4 == 4
                  } else if (id === 'm2') { // P2 W1 (0-2)
                     // Right: m5 (1-3)
                     roundTopRight = true; // 0 < 1
                     innerBottomRightColor = p2Color!; // 2 < 3
                     roundBottomRight = false;
                  } else if (id === 'm5') { // P2 W2 (1-3)
                     // Left: m2 (0-2)
                     innerTopLeftColor = p2Color!; // 0 < 1
                     roundTopLeft = false;
                     roundBottomLeft = true; // 3 > 2
                  }
                  
                  // Hide project names for specific events as requested (hardcoded example)
                  // Project 1 on Week 1 (m3) -> hidden
                  // Project 2 on Week 2 (m5) -> hidden
                  const shouldHideName = id === 'm3' || id === 'm5';

                  return (
                    <SchedulerEventComponent
                      key={`${event.id}-${localShowProjectWeight}-${localShowPatterns}`}
                      event={{
                        ...event,
                        unitStart: unitStart
                      } as unknown as SchedulerEvent}
                      config={previewConfig}
                      projects={effectiveProjects}
                      eventPatterns={MOCK_PATTERNS}
                      scissorsMode={false}
                      commentMode={false}
                      isCtrlPressed={false}
                      showGaps={localShowGaps}
                      showPatterns={localShowPatterns}
                      showProjectWeight={localShowProjectWeight}
                      hideProjectName={shouldHideName}
                      onContextMenu={() => {}}
                      onPointerDown={() => {}}
                      onHandlePointerDown={() => {}}
                      onClick={() => {}}
                      onScissorClick={() => {}}
                      left={left}
                      top={top}
                      width={width}
                      height={height}
                      eventRowH={localEventRowH}
                      roundTopLeft={roundTopLeft}
                      roundBottomLeft={roundBottomLeft}
                      roundTopRight={roundTopRight}
                      roundBottomRight={roundBottomRight}
                      innerTopLeftColor={innerTopLeftColor}
                      innerBottomLeftColor={innerBottomLeftColor}
                      innerTopRightColor={innerTopRightColor}
                      innerBottomRightColor={innerBottomRightColor}
                    />
                  );
                })}
              </div>
            </div>
            
          </div>

          {/* Внешний вид */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Внешний вид</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="showGaps" className="text-base">Отступы между проектами</Label>
                  <span className="text-xs text-gray-500">Включить отступы и скругления углов</span>
                </div>
                <Switch
                  id="showGaps"
                  checked={localShowGaps}
                  onCheckedChange={setLocalShowGaps}
                />
              </div>
              
              <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="showPatterns" className="text-base">Паттерны проектов</Label>
                  <span className="text-xs text-gray-500">Отображать текстурные фоны на событиях</span>
                </div>
                <Switch
                  id="showPatterns"
                  checked={localShowPatterns}
                  onCheckedChange={setLocalShowPatterns}
                />
              </div>
              
              <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="showProjectWeight" className="text-base">Показывать вес проекта</Label>
                  <span className="text-xs text-gray-500">Отображать вес проекта на событии</span>
                </div>
                <Switch
                  id="showProjectWeight"
                  checked={localShowProjectWeight}
                  onCheckedChange={setLocalShowProjectWeight}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
