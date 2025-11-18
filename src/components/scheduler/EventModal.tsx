import { useState, useEffect, useRef } from 'react';
import { Project, SchedulerEvent } from '../../types/scheduler';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Check } from 'lucide-react';
import { cn } from '../ui/utils';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<SchedulerEvent>) => void;
  projects: Project[];
  mode: 'create' | 'edit';
  initialData?: {
    projectId?: string;
    weeksSpan?: number;
    unitsTall?: number;
    maxUnits?: number;
  };
}

export function EventModal({ isOpen, onClose, onSave, projects, mode, initialData }: EventModalProps) {
  const [projectId, setProjectId] = useState(initialData?.projectId || projects[0]?.id || '');
  const [weeksSpan, setWeeksSpan] = useState(initialData?.weeksSpan || 1);
  const [unitsTall, setUnitsTall] = useState(initialData?.unitsTall || initialData?.maxUnits || 4);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setProjectId(initialData?.projectId || projects[0]?.id || '');
      setWeeksSpan(initialData?.weeksSpan || 1);
      setUnitsTall(initialData?.unitsTall || initialData?.maxUnits || 4);
      
      // In create mode, start with empty field; in edit mode, show selected project
      if (mode === 'create') {
        setSearchQuery('');
        setShowDropdown(false);
        // Auto-focus the input field
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      } else {
        const selectedProject = projects.find(p => p.id === initialData?.projectId);
        setSearchQuery(selectedProject?.name || '');
        setShowDropdown(false);
      }
    }
  }, [isOpen, initialData, projects, mode]);

  // Close dropdown when clicking outside
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

  // Filter projects based on search query
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = () => {
    onSave({
      projectId,
      weeksSpan: Math.max(1, Math.round(weeksSpan)),
      unitsTall: Math.max(1, Math.round(unitsTall))
    });
    onClose();
  };

  const handleSelectProject = (project: Project) => {
    setProjectId(project.id);
    setSearchQuery(project.name);
    setShowDropdown(false);
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
            <Label htmlFor="project">Проект</Label>
            <Input
              ref={inputRef}
              id="project"
              type="text"
              placeholder="Введите название проекта..."
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              autoComplete="off"
            />
            
            {/* Dropdown with filtered projects */}
            {showDropdown && filteredProjects.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-md shadow-lg max-h-[200px] overflow-y-auto z-[5001]"
              >
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className={cn(
                      "px-3 py-2 cursor-pointer hover:bg-accent flex items-center gap-2 transition-colors",
                      projectId === project.id && "bg-accent/50"
                    )}
                    onClick={() => handleSelectProject(project)}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        projectId === project.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span>{project.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* No results message */}
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
              <Label htmlFor="weeks">Недели</Label>
              <Input
                id="weeks"
                type="number"
                min={1}
                max={52}
                value={weeksSpan}
                onChange={(e) => setWeeksSpan(Number(e.target.value))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="height">Высота</Label>
              <Input
                id="height"
                type="number"
                min={1}
                max={initialData?.maxUnits || 4}
                value={unitsTall}
                onChange={(e) => setUnitsTall(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={handleSave}>
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
