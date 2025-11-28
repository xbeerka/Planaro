import { useState } from 'react';
import { Calendar, Copy, Loader2 } from 'lucide-react';
import { Workspace } from '../../types/scheduler';
import { createWorkspace } from '../../services/api/workspaces';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

import { Alert, AlertDescription } from "../ui/alert";

interface CreateWorkspaceModalProps {
  existingWorkspaces: Workspace[];
  onClose: () => void;
  onCreate: () => void;
}

export function CreateWorkspaceModal({ existingWorkspaces, onClose, onCreate }: CreateWorkspaceModalProps) {
  const currentYear = new Date().getFullYear();
  
  const [name, setName] = useState('');
  const [year, setYear] = useState(currentYear.toString());
  const [baseWorkspaceId, setBaseWorkspaceId] = useState<string>('new');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Введите название пространства');
      return;
    }
    
    const yearInt = parseInt(year);
    if (!yearInt || yearInt < 2000 || yearInt > 2100) {
      setError('Введите корректный год (2000-2100)');
      return;
    }
    
    try {
      setIsCreating(true);
      setError(null);
      
      await createWorkspace({
        name: name.trim(),
        timeline_year: yearInt,
        base_workspace_id: baseWorkspaceId === 'new' ? undefined : baseWorkspaceId
      });
      
      onCreate();
    } catch (err: any) {
      console.error('Failed to create workspace:', err);
      setError(err.message || 'Ошибка при создании пространства');
      setIsCreating(false);
    }
  };

  const generateYearOptions = () => {
    const years = [];
    for (let y = currentYear - 2; y <= currentYear + 5; y++) {
      years.push(y);
    }
    return years;
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Создать пространство</DialogTitle>
          <DialogDescription>
            Создайте новое рабочее пространство для планирования ресурсов.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Workspace Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Название <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Например: Планирование 2025"
              disabled={isCreating}
              autoFocus
            />
          </div>

          {/* Year */}
          <div className="space-y-2">
            <Label htmlFor="year">
              Год календаря <span className="text-red-500">*</span>
            </Label>
            <select
              id="year"
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setError(null);
              }}
              disabled={isCreating}
              className="flex h-12 w-full items-center justify-between rounded-xl border border-gray-200 bg-transparent px-4 py-2 text-base shadow-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            >
              {generateYearOptions().map((y) => (
                <option key={y} value={y.toString()}>
                  {y} {y === currentYear ? ' (текущий)' : ''}
                </option>
              ))}
            </select>
            <p className="text-[0.8rem] text-muted-foreground">
              На основе года будут построены недели с датами
            </p>
          </div>

          {/* Base Workspace (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="baseWorkspace">
              Создать на основе
            </Label>
            <select
              id="baseWorkspace"
              value={baseWorkspaceId}
              onChange={(e) => setBaseWorkspaceId(e.target.value)}
              disabled={isCreating}
              className="flex h-12 w-full items-center justify-between rounded-xl border border-gray-200 bg-transparent px-4 py-2 text-base shadow-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            >
              <option value="new">Новое пространство</option>
              {existingWorkspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.timeline_year})
                </option>
              ))}
            </select>

            {baseWorkspaceId !== 'new' ? (
              <div className="mt-3 rounded-2xl bg-gray-50 p-4">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600">
                    <Copy className="h-5 w-5" />
                  </div>
                  <div className="space-y-2 pt-0.5">
                    <p className="text-sm font-medium text-gray-900">Будут скопированы</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                        Департаменты
                      </span>
                      <span className="inline-flex items-center rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                        Пользователи
                      </span>
                      <span className="inline-flex items-center rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                        Проекты
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">События не копируются</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl bg-gray-50 p-4">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="pt-2.5">
                    <p className="text-sm text-gray-600">
                      Будет создан департамент <span className="font-medium text-gray-900">"Разработка"</span> по умолчанию
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isCreating}>
              Отмена
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreating ? 'Создание...' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
