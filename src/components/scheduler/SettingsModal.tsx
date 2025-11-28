import { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { 
    weekPx, 
    eventRowH, 
    showGaps, 
    showPatterns, 
    setWeekPx, 
    setEventRowH, 
    setShowGaps, 
    setShowPatterns 
  } = useSettings();

  // Локальное состояние для формы
  const [localWeekPx, setLocalWeekPx] = useState(weekPx);
  const [localEventRowH, setLocalEventRowH] = useState(eventRowH);
  const [localShowGaps, setLocalShowGaps] = useState(showGaps);
  const [localShowPatterns, setLocalShowPatterns] = useState(showPatterns);

  // Синхронизация с глобальным состоянием при открытии
  useEffect(() => {
    if (isOpen) {
      setLocalWeekPx(weekPx);
      setLocalEventRowH(eventRowH);
      setLocalShowGaps(showGaps);
      setLocalShowPatterns(showPatterns);
    }
  }, [isOpen, weekPx, eventRowH, showGaps, showPatterns]);

  const handleSave = () => {
    setWeekPx(localWeekPx);
    setEventRowH(localEventRowH);
    setShowGaps(localShowGaps);
    setShowPatterns(localShowPatterns);
    onClose();
  };

  // Проверка на наличие изменений
  const hasChanges = 
    localWeekPx !== weekPx || 
    localEventRowH !== eventRowH || 
    localShowGaps !== showGaps || 
    localShowPatterns !== showPatterns;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Настройки отображения</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Размеры сетки */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Размеры сетки</h3>
            
            <div className="grid gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <Label htmlFor="weekPx">Ширина недели</Label>
                  <span className="text-sm text-gray-500">{localWeekPx}px</span>
                </div>
                <input
                  type="range"
                  id="weekPx"
                  min="48"
                  max="220"
                  step="4"
                  value={localWeekPx}
                  onChange={(e) => setLocalWeekPx(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <Label htmlFor="eventRowH">Высота строки</Label>
                  <span className="text-sm text-gray-500">{localEventRowH}px</span>
                </div>
                <input
                  type="range"
                  id="eventRowH"
                  min="48"
                  max="144"
                  step="4"
                  value={localEventRowH}
                  onChange={(e) => setLocalEventRowH(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
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
