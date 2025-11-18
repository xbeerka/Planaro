import { useState, useCallback } from 'react';
import { SchedulerEvent, Project } from '../types/scheduler';

interface HistoryState {
  events: SchedulerEvent[];
  eventZOrder: Map<string, number>;
  projects: Project[]; // ✅ Добавили проекты для undo/redo удаления
}

const MAX_HISTORY = 50;

export function useHistory(initialEvents: SchedulerEvent[], initialProjects: Project[] = []) {
  const [history, setHistory] = useState<HistoryState[]>([
    { events: initialEvents, eventZOrder: new Map(), projects: initialProjects }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Сброс истории с новым начальным состоянием (после загрузки данных)
  const resetHistory = useCallback((events: SchedulerEvent[], eventZOrder: Map<string, number>, projects: Project[] = []) => {
    console.log(`🔄 История: СБРОС - ${events.length} событий, ${projects.length} проектов`);
    
    // ✅ КРИТИЧЕСКАЯ ПРОВЕРКА: предупреждаем если сбрасываем с событиями но без проектов
    if (events.length > 0 && projects.length === 0) {
      console.error('❌ История: КРИТИЧЕСКАЯ ОШИБКА при СБРОСЕ - события без проектов!');
      console.error(`❌ История: events.length = ${events.length}, projects.length = ${projects.length}`);
      console.error('❌ История: это приведёт к проблемам с Undo/Redo');
    }
    
    setHistory([{
      events: JSON.parse(JSON.stringify(events)),
      eventZOrder: new Map(eventZOrder),
      projects: JSON.parse(JSON.stringify(projects))
    }]);
    setHistoryIndex(0);
  }, []);

  const saveHistory = useCallback((events: SchedulerEvent[], eventZOrder: Map<string, number>, projects: Project[] = []) => {
    console.log(`📝 История: СОХРАНЕНИЕ - ${events.length} событий, ${projects.length} проектов`);
    
    // ✅ КРИТИЧНО: Используем проекты из предыдущего состояния если переданы пустые
    // Это нормально во время загрузки или после удаления всех проектов
    let projectsToSave = projects;
    
    if (projects.length === 0) {
      const prevProjects = history[historyIndex]?.projects || [];
      
      if (prevProjects.length > 0) {
        console.log(`🔧 История: используем проекты из предыдущего состояния (${prevProjects.length} шт)`);
        projectsToSave = prevProjects;
      } else {
        // ✅ КРИТИЧЕСКАЯ ПРОВЕРКА: если есть события но нет проектов - это ошибка!
        if (events.length > 0) {
          console.error('❌ История: КРИТИЧЕСКАЯ ОШИБКА - попытка сохранить события без проектов!');
          console.error('❌ История: это приведёт к некорректному Undo/Redo. Отменяем сохранение.');
          console.error(`❌ История: events.length = ${events.length}, projects.length = ${projects.length}`);
          console.error('❌ История: убедитесь что проекты загружены перед сохранением истории');
          return; // Не сохраняем такое состояние в историю
        }
        
        // Если нет ни событий ни проектов - это начальная загрузка, это нормально
        console.log('ℹ️ История: сохранение без проектов и событий (начальная загрузка)');
        projectsToSave = [];
      }
    } else {
      console.log(`✅ История: проекты переданы явно (${projects.length} шт)`);
    }
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({
        events: JSON.parse(JSON.stringify(events)),
        eventZOrder: new Map(eventZOrder),
        projects: JSON.parse(JSON.stringify(projectsToSave))
      });

      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
        setHistoryIndex(newHistory.length - 1);
        console.log(`История: ${newHistory.length} записей (обрезано), index: ${newHistory.length - 1}`);
        return newHistory;
      }

      setHistoryIndex(newHistory.length - 1);
      console.log(`История: ${newHistory.length} записей, index: ${newHistory.length - 1}`);
      return newHistory;
    });
  }, [historyIndex, history]);

  const undo = useCallback(() => {
    console.log(`История: UNDO - текущий index ${historyIndex}, всего записей ${history.length}`);
    console.log(`История: UNDO - canUndo = ${historyIndex > 0}`);
    
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      
      // ✅ КРИТИЧЕСКАЯ ЗАЩИТА: НЕ восстанавливаем state если там есть события но НЕТ проектов
      // Это означает коррупцию данных в истории
      if (state.events.length > 0 && state.projects.length === 0) {
        console.error('❌ История: КРИТИЧЕСКАЯ ОШИБКА - попытка восстановить state с событиями но без проектов!');
        console.error('❌ История: это приведёт к удалению всех событий. Отменяем Undo.');
        return null;
      }
      
      console.log(`История: UNDO - возвращаем state с ${state.events.length} событиями, ${state.projects.length} проектами (index ${newIndex})`);
      setHistoryIndex(newIndex);
      return state;
    }
    
    console.log('История: UNDO - невозможен (начало истории)');
    return null;
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    console.log(`История: REDO - текущий index ${historyIndex}, всего записей ${history.length}`);
    console.log(`История: REDO - canRedo = ${historyIndex < history.length - 1}`);
    
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      
      // ✅ КРИТИЧЕСКАЯ ЗАЩИТА: НЕ восстанавливаем state если там есть события но НЕТ проектов
      if (state.events.length > 0 && state.projects.length === 0) {
        console.error('❌ История: КРИТИЧЕСКАЯ ОШИБКА - попытка восстановить state с событиями но без проектов!');
        console.error('❌ История: это приведёт к удалению всех событий. Отменяем Redo.');
        return null;
      }
      
      console.log(`История: REDO - возвращаем state с ${state.events.length} событиями, ${state.projects.length} проектами (index ${newIndex})`);
      setHistoryIndex(newIndex);
      return state;
    }
    
    console.log('История: REDO - невозможен (конец истории)');
    return null;
  }, [historyIndex, history]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Обновить ID события во ВСЕЙ истории (для восстановленных событий)
  const updateHistoryEventId = useCallback((oldId: string, newId: string) => {
    console.log(`История: замена ID события ${oldId} → ${newId} во всех записях`);
    
    setHistory(prev => {
      return prev.map(state => ({
        ...state,
        events: state.events.map(event => 
          event.id === oldId ? { ...event, id: newId } : event
        ),
        eventZOrder: new Map(
          Array.from(state.eventZOrder.entries()).map(([id, order]) => 
            [id === oldId ? newId : id, order]
          )
        )
      }));
    });
  }, []);

  // Обновить ID проекта во ВСЕЙ истории (для восстановленных проектов)
  const updateHistoryProjectId = useCallback((oldId: string, newId: string) => {
    console.log(`История: замена ID проекта ${oldId} → ${newId} во всех записях`);
    
    setHistory(prev => {
      return prev.map(state => ({
        ...state,
        projects: state.projects.map(project => 
          project.id === oldId ? { ...project, id: newId } : project
        ),
        // Также обновляем projectId в событиях
        events: state.events.map(event => 
          event.projectId === oldId ? { ...event, projectId: newId } : event
        )
      }));
    });
  }, []);

  return { saveHistory, undo, redo, canUndo, canRedo, resetHistory, updateHistoryEventId, updateHistoryProjectId };
}