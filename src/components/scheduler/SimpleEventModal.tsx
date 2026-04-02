import { useState, useEffect, useRef, useMemo } from 'react';
import { Project, SchedulerEvent } from '../../types/scheduler';
import { SimpleButton } from '../ui/simple-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/simple-dialog';
import { SimpleLabel } from '../ui/simple-label';
import { SimpleInput } from '../ui/simple-input';
import { getSortedProjectsByUsage, trackProjectUsage } from '../../utils/projectUsageTracking';
import { smartSearch, getMatchScore } from '../../utils/search';
import { highlightMatch } from '../../utils/highlightMatch';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<SchedulerEvent>) => Promise<void>;
  projects: Project[];
  mode: 'create' | 'edit';
  initialData?: {
    projectId?: string;
    weeksSpan?: number;
    unitsTall?: number;
    maxUnits?: number;
    startWeek?: number;
    workspaceId?: string; // ✨ Добавлено для tracking
  };
  weeksInYear: number; // ✅ Динамическое количество недель (52 или 53)
}

export function SimpleEventModal({ isOpen, onClose, onSave, projects, mode, initialData, weeksInYear }: EventModalProps) {
  // ✨ Локальный state для принудительного обновления сортировки
  const [sortTrigger, setSortTrigger] = useState(0);
  
  // ✨ Сортирум проекты по последнему использованию
  const sortedProjects = useMemo(() => {
    if (!initialData?.workspaceId) return projects;
    return getSortedProjectsByUsage(initialData.workspaceId, projects);
  }, [projects, initialData?.workspaceId, sortTrigger]); // ← Добавили sortTrigger
  
  // ✨ НЕ выбираем первый проект по умолчанию (пустая строка вместо projects[0]?.id)
  const [projectId, setProjectId] = useState(initialData?.projectId || '');
  const [weeksSpan, setWeeksSpan] = useState(initialData?.weeksSpan || 1);
  const [unitsTall, setUnitsTall] = useState(initialData?.unitsTall || initialData?.maxUnits || 4);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0); // ✨ Индекс подсвеченного элемента
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const highlightedItemRef = useRef<HTMLDivElement>(null); // ✨ Ref для автоскролла

  // Вычисляем максимальное количество недель на основе недели начала (0-based индексация)
  const maxWeeks = initialData?.startWeek 
    ? weeksInYear - initialData.startWeek 
    : weeksInYear;

  useEffect(() => {
    if (isOpen) {
      // ✨ Обновляем сортировку при открытии модалки (подхватываем изменения из paste/create)
      setSortTrigger(prev => prev + 1);
      
      // ✨ НЕ выбираем первый проект по умолчанию
      setProjectId(initialData?.projectId || '');
      
      // Вычисляем максимум недель для валидации (0-based индексация)
      const maxWeeksCalc = initialData?.startWeek 
        ? weeksInYear - initialData.startWeek 
        : weeksInYear;
      
      // Устанавливаем weeksSpan, но не больше maxWeeks
      const initialWeeks = initialData?.weeksSpan || 1;
      setWeeksSpan(Math.min(initialWeeks, maxWeeksCalc));
      
      setUnitsTall(initialData?.unitsTall || initialData?.maxUnits || 4);
      
      if (mode === 'create') {
        setSearchQuery('');
        setShowDropdown(false);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      } else {
        // ✅ Используем projects напрямую для поиска (избегаем зависимости от sortedProjects)
        const selectedProject = projects.find(p => p.id === initialData?.projectId);
        setSearchQuery(selectedProject?.name || '');
        setShowDropdown(false);
      }
    }
  }, [isOpen, initialData, projects, mode, weeksInYear]); // ✅ Убрали sortedProjects из зависимостей!

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // ✨ Фильтруем и сортируем проекты по релевантности
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      // Если поиск пустой, показываем все проекты с сортировкой по использованию
      return sortedProjects;
    }
    
    // Фильтруем проекты по умному поиску
    // ОПТИМИЗАЦИЯ: Вычисляем score один раз
    const matches = sortedProjects
      .map(project => ({
        project,
        score: getMatchScore(searchQuery, project.name)
      }))
      .filter(item => item.score < 100); // 100 - порог отсечения (из search.ts)
    
    // Сортируем по score (чем меньше, тем лучше)
    // При равенстве score сохраняется порядок от sortedProjects (по использованию)
    matches.sort((a, b) => a.score - b.score);
    
    // Возвращаем только проекты (без score)
    return matches.map(m => m.project);
  }, [sortedProjects, searchQuery]);

  // ✨ Сбрасываем highlightedIndex при изменении списка
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredProjects]);

  // ✨ Автоскролл к подсвеченному элементу
  useEffect(() => {
    if (highlightedItemRef.current && showDropdown) {
      // Используем requestAnimationFrame для более плавного скролла
      requestAnimationFrame(() => {
        highlightedItemRef.current?.scrollIntoView({
          block: 'nearest',
          inline: 'nearest'
        });
      });
    }
  }, [highlightedIndex, showDropdown]);

  const handleSave = async () => {
    if (isSaving) return; // Предотвращаем двойной клик
    
    setIsSaving(true);
    console.log('💾 Начало сохранения события...');
    
    try {
      // Валидация weeksSpan с учетом maxWeeks (на всякий случай)
      const rawWeeksSpan = Math.round(weeksSpan);
      const validWeeksSpan = Math.max(1, Math.min(rawWeeksSpan, maxWeeks));
      
      // ✅ Ждём завершения onSave (создание события асинхронное)
      await onSave({
        projectId,
        weeksSpan: validWeeksSpan,
        unitsTall: Math.max(1, Math.round(unitsTall))
      });
      
      console.log('✅ Событие сохранено, закрываем модалку');
      
      // ✅ Закрываем модалку только после успешного создания события
      onClose();
    } catch (error) {
      console.error('❌ Ошибка при сохранении события в модалке:', error);
      // Не закрываем модалку при ошибке
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectProject = (project: Project) => {
    setProjectId(project.id);
    setSearchQuery(project.name);
    setShowDropdown(false);
    
    // ✨ Отслеживаем использование проекта асинхронно (избегаем React warning)
    if (initialData?.workspaceId) {
      // Используем queueMicrotask для асинхронного вызова
      queueMicrotask(() => {
        trackProjectUsage(initialData.workspaceId!, project.id);
        // Принудительно обновляем сортировку после tracking
        setSortTrigger(prev => prev + 1);
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || filteredProjects.length === 0) {
      // Если дропдаун закрыт или список пуст, не обрабатываем клавиши
      if (e.key === 'Tab') {
        e.preventDefault(); // Всё равно блокируем Tab для консистентности
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filteredProjects.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Tab всегда двигает вниз, циклично возвращается к началу
      setHighlightedIndex(prev => (prev + 1) % filteredProjects.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelectProject(filteredProjects[highlightedIndex]);
      // Blur input and focus dialog container so next Enter triggers form save
      (e.target as HTMLInputElement).blur();
      // Move focus to the dialog content (closest parent with tabIndex)
      const dialog = (e.target as HTMLElement).closest('[tabindex]') as HTMLElement | null;
      if (dialog) {
        requestAnimationFrame(() => dialog.focus());
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]" onKeyDown={(e) => {
        if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement) && !isSaving) {
          e.preventDefault();
          handleSave();
        }
      }}>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Добавить событие' : 'Редактировать событие'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Заполните данные для создания нового события' 
              : 'Измените параметры события'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2 relative">
            <SimpleLabel htmlFor="project">Проект</SimpleLabel>
            <div className="relative flex items-center">
              <SimpleInput
                ref={inputRef}
                id="project"
                type="text"
                placeholder="Введите название проекта..."
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                className="pr-10"
                data-search-focus="50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setProjectId('');
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Очистить"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {showDropdown && filteredProjects.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-md shadow-lg max-h-[200px] overflow-y-auto z-[5001]"
              >
                {filteredProjects.map((project, index) => (
                  <div
                    key={project.id}
                    className={`px-3 py-2 cursor-pointer flex items-center gap-2 transition-colors ${
                      index === highlightedIndex ? "bg-blue-100" : "hover:bg-accent"
                    } ${
                      projectId === project.id ? "bg-accent/50" : ""
                    }`}
                    onClick={() => handleSelectProject(project)}
                    ref={index === highlightedIndex ? highlightedItemRef : null}
                  >
                    <svg
                      className={`h-4 w-4 shrink-0 ${
                        projectId === project.id ? "opacity-100" : "opacity-0"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>{highlightMatch(project.name, searchQuery)}</span>
                  </div>
                ))}
              </div>
            )}

            {showDropdown && filteredProjects.length === 0 && searchQuery.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-md shadow-lg z-[5001]"
              >
                <div className="px-3 py-2 text-muted-foreground text-sm">
                  Проект не найден
                </div>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════
              Stepper + Progress Bar с drag-поддержкой
              ═══════════════════════════════════════════════════════ */}
          
          {(() => {
            const maxUnits = initialData?.maxUnits || 4;
            const clampW = (v: number) => setWeeksSpan(Math.max(1, Math.min(v, maxWeeks)));
            const clampH = (v: number) => setUnitsTall(Math.max(1, Math.min(v, maxUnits)));

            const handleBarDrag = (
              barEl: HTMLDivElement,
              min: number,
              max: number,
              setter: (v: number) => void,
              e: React.MouseEvent
            ) => {
              e.preventDefault();
              const rect = barEl.getBoundingClientRect();
              const calcValue = (clientX: number) => {
                const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                return Math.max(min, Math.min(max, Math.round(min + ratio * (max - min))));
              };
              setter(calcValue(e.clientX));

              const onMove = (ev: MouseEvent) => {
                ev.preventDefault();
                setter(calcValue(ev.clientX));
              };
              const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                window.removeEventListener('blur', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
              window.addEventListener('blur', onUp);
            };

            return (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Недели', val: weeksSpan, set: clampW, min: 1, max: maxWeeks, hint: typeof initialData?.startWeek === 'number' && maxWeeks < weeksInYear && maxWeeks > 0 ? `макс. ${maxWeeks}` : '' },
                  { label: 'Высота', val: unitsTall, set: clampH, min: 1, max: maxUnits, hint: '' },
                ].map(({ label, val, set, min, max, hint }) => {
                  const pct = max <= min ? 100 : ((val - min) / (max - min)) * 100;
                  return (
                    <div key={label} className="flex flex-col gap-1.5">
                      <span className="text-xs text-gray-500">
                        {label}
                        {hint && <span className="text-muted-foreground ml-1">({hint})</span>}
                      </span>
                      <div className="flex items-center h-9 rounded-md border border-input bg-input-background overflow-hidden">
                        <button type="button" className="w-9 h-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent/70 transition-colors disabled:opacity-30 shrink-0 border-r border-input" disabled={val <= min} onClick={() => set(val - 1)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg>
                        </button>
                        <div
                          className="flex-1 h-full relative cursor-grab active:cursor-grabbing select-none"
                          onMouseDown={(e) => handleBarDrag(e.currentTarget, min, max, set, e)}
                        >
                          <div className="absolute inset-y-0 left-0 bg-foreground/[0.04] transition-[width] duration-75" style={{ width: `${pct}%` }} />
                          <div className="absolute inset-0 flex items-center justify-center text-sm tabular-nums text-foreground pointer-events-none">
                            {val}<span className="text-muted-foreground ml-1">/ {max}</span>
                          </div>
                        </div>
                        <button type="button" className="w-9 h-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground active:bg-accent/70 transition-colors disabled:opacity-30 shrink-0 border-l border-input" disabled={val >= max} onClick={() => set(val + 1)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div className="flex justify-end gap-2 pt-4">
            <SimpleButton variant="outline" onClick={onClose} disabled={isSaving}>
              Отмена
            </SimpleButton>
            <SimpleButton onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </SimpleButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}