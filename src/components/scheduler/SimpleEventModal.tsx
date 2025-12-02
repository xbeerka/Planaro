import { useState, useEffect, useRef, useMemo } from 'react';
import { Project, SchedulerEvent } from '../../types/scheduler';
import { SimpleButton } from '../ui/simple-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/simple-dialog';
import { SimpleLabel } from '../ui/simple-label';
import { SimpleInput } from '../ui/simple-input';
import { WEEKS } from '../../utils/scheduler';
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
}

export function SimpleEventModal({ isOpen, onClose, onSave, projects, mode, initialData }: EventModalProps) {
  // ✨ Локальный state для принудительного обновления сортировки
  const [sortTrigger, setSortTrigger] = useState(0);
  
  // ✨ Сортиру��м проекты по последнему использованию
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
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Вычисляем максимальное количество недель на основе недели начала (0-based индексация)
  const maxWeeks = initialData?.startWeek 
    ? WEEKS - initialData.startWeek 
    : WEEKS;

  useEffect(() => {
    if (isOpen) {
      // ✨ Обновляем сортировку при открытии модалки (подхватываем изменения из paste/create)
      setSortTrigger(prev => prev + 1);
      
      // ✨ НЕ выбираем первый проект по умолчанию
      setProjectId(initialData?.projectId || '');
      
      // Вычисляем максимум недель для валидации (0-based индексация)
      const maxWeeksCalc = initialData?.startWeek 
        ? WEEKS - initialData.startWeek 
        : WEEKS;
      
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
  }, [isOpen, initialData, projects, mode]); // ✅ Убрали sortedProjects из зависимостей!

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
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
                autoComplete="off"
                className="pr-10"
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
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`px-3 py-2 cursor-pointer hover:bg-accent flex items-center gap-2 transition-colors ${
                      projectId === project.id ? "bg-accent/50" : ""
                    }`}
                    onClick={() => handleSelectProject(project)}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <SimpleLabel htmlFor="weeks">
                Недели {initialData?.startWeek && maxWeeks < WEEKS && (
                  <span className="text-xs text-muted-foreground">(макс. {maxWeeks})</span>
                )}
              </SimpleLabel>
              <SimpleInput
                id="weeks"
                type="number"
                min={1}
                max={maxWeeks}
                value={weeksSpan}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  // ✅ Автоматически ограничиваем значение при вводе
                  const clampedValue = Math.max(1, Math.min(value, maxWeeks));
                  setWeeksSpan(clampedValue);
                }}
                onBlur={(e) => {
                  // ✅ Дополнительная проверка при потере фокуса
                  const value = Number(e.target.value);
                  const clampedValue = Math.max(1, Math.min(value, maxWeeks));
                  if (value !== clampedValue) {
                    setWeeksSpan(clampedValue);
                  }
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <SimpleLabel htmlFor="height">Высота</SimpleLabel>
              <SimpleInput
                id="height"
                type="number"
                min={1}
                max={initialData?.maxUnits || 4}
                value={unitsTall}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  const maxUnits = initialData?.maxUnits || 4;
                  // ✅ Автоматически ограничиваем значение при вводе
                  const clampedValue = Math.max(1, Math.min(value, maxUnits));
                  setUnitsTall(clampedValue);
                }}
                onBlur={(e) => {
                  // ✅ Дополнительная проверка при потере фокуса
                  const value = Number(e.target.value);
                  const maxUnits = initialData?.maxUnits || 4;
                  const clampedValue = Math.max(1, Math.min(value, maxUnits));
                  if (value !== clampedValue) {
                    setUnitsTall(clampedValue);
                  }
                }}
              />
            </div>
          </div>

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