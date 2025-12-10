import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Workspace } from '../../types/scheduler';
import { updateWorkspace } from '../../services/api/workspaces';
import { toast } from 'sonner@2.0.3';

interface WorkspaceSettingsModalProps {
  workspace: Workspace | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updatedWorkspace: Workspace) => void;
  accessToken: string | null;
}

export function WorkspaceSettingsModal({
  workspace,
  isOpen,
  onClose,
  onSuccess,
  accessToken,
}: WorkspaceSettingsModalProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isSaving, setIsSaving] = useState(false);

  // Генерируем список доступных лет (±5 лет от текущего)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  useEffect(() => {
    if (workspace) {
      setSelectedYear(workspace.timeline_year || currentYear);
    }
  }, [workspace, currentYear]);

  const handleSave = async () => {
    if (!workspace || !accessToken) {
      toast.error('Ошибка', { description: 'Не удалось сохранить настройки' });
      return;
    }

    setIsSaving(true);
    console.log('⚙️ Сохранение настроек воркспейса:', {
      workspaceId: workspace.id,
      oldYear: workspace.timeline_year,
      newYear: selectedYear,
    });

    try {
      const updatedWorkspace = await updateWorkspace(
        workspace.id,
        { timeline_year: selectedYear },
        accessToken
      );

      console.log('✅ Настройки воркспейса сохранены:', updatedWorkspace);
      toast.success('Настройки сохранены', {
        description: `Год календаря изменён на ${selectedYear}`,
      });
      
      onSuccess?.(updatedWorkspace);
      onClose();
    } catch (error) {
      console.error('❌ Ошибка сохранения настроек воркспейса:', error);
      toast.error('Ошибка сохранения', {
        description: error instanceof Error ? error.message : 'Неизвестная ошибка',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = workspace && selectedYear !== workspace.timeline_year;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Настройки воркспейса</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Смена года календаря */}
          <div className="space-y-2">
            <Label htmlFor="timeline-year">Год календаря</Label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value, 10))}
            >
              <SelectTrigger id="timeline-year" className="w-full">
                <SelectValue placeholder="Выберите год" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Календарь будет отображать 52 недели выбранного года
            </p>
          </div>

          {/* Заглушка для настройки выходных */}
          <div className="space-y-2">
            <Label>Настройка выходных</Label>
            <div className="bg-muted/30 border border-dashed border-muted-foreground/30 rounded-lg p-6 text-center">
              <p className="text-sm text-muted-foreground">
                🚧 Скоро здесь появится настройка выходных дней
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Вы сможете автоматически расставить выходные в столбцах календаря
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
