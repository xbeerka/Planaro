import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner@2.0.3';

/**
 * Optimistic UI Hook - мгновенный feedback с автоматическим откатом при ошибках
 * 
 * Паттерн работы:
 * 1. Мгновенно обновляем UI (оптимистично предполагаем успех)
 * 2. В фоне отправляем запрос на сервер
 * 3. Если успех - всё ОК
 * 4. Если ошибка - откатываем изменения и показываем toast
 * 
 * @example
 * const { addOptimistic, updateOptimistic, removeOptimistic } = useOptimisticUpdate(
 *   events,
 *   setEvents,
 *   (event) => event.id
 * );
 * 
 * // Создание события
 * await addOptimistic(
 *   newEvent,
 *   async (tempEvent) => {
 *     return await eventsApi.create(tempEvent);
 *   }
 * );
 */
export function useOptimisticUpdate<T>(
  data: T[],
  setData: (data: T[] | ((prev: T[]) => T[])) => void,
  getId: (item: T) => string
) {
  // Храним временные ID для отката
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());
  
  // Храним предыдущее состояние для отката
  const previousDataRef = useRef<T[]>(data);

  /**
   * Добавить элемент оптимистично
   * @param tempItem - Временный элемент с temp ID (например, `temp_${Date.now()}`)
   * @param onServerCreate - Функция создания на сервере, возвращает созданный элемент
   * @returns Созданный элемент с реальным ID или null при ошибке
   */
  const addOptimistic = useCallback(async (
    tempItem: T,
    onServerCreate: (tempItem: T) => Promise<T>
  ): Promise<T | null> => {
    const tempId = getId(tempItem);
    
    // Сохраняем предыдущее состояние
    previousDataRef.current = data;
    
    // Помечаем как оптимистичное
    setOptimisticIds(prev => new Set(prev).add(tempId));
    
    // Мгновенно добавляем в UI
    setData(prev => [...prev, tempItem]);
    
    try {
      // В фоне создаём на сервере
      const createdItem = await onServerCreate(tempItem);
      
      // Успех - заменяем временный элемент на реальный
      setData(prev => prev.map(item => 
        getId(item) === tempId ? createdItem : item
      ));
      
      // Убираем из optimistic
      setOptimisticIds(prev => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
      
      return createdItem;
    } catch (error) {
      console.error('❌ Optimistic add failed:', error);
      
      // Откатываем к предыдущему состоянию
      setData(previousDataRef.current);
      
      // Убираем из optimistic
      setOptimisticIds(prev => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
      
      // Показываем ошибку
      toast.error('Ошибка создания', {
        description: error instanceof Error ? error.message : 'Попробуйте еще раз'
      });
      
      return null;
    }
  }, [data, setData, getId]);

  /**
   * Обновить элемент оптимистично
   * @param itemId - ID элемента
   * @param updates - Объект с изменениями
   * @param onServerUpdate - Функция обновления на сервере
   * @returns true при успехе, false при ошибке
   */
  const updateOptimistic = useCallback(async (
    itemId: string,
    updates: Partial<T>,
    onServerUpdate: (itemId: string, updates: Partial<T>) => Promise<void>
  ): Promise<boolean> => {
    // Сохраняем предыдущее состояние
    previousDataRef.current = data;
    
    // Помечаем как оптимистичное
    setOptimisticIds(prev => new Set(prev).add(itemId));
    
    // Мгновенно обновляем UI
    setData(prev => prev.map(item =>
      getId(item) === itemId ? { ...item, ...updates } : item
    ));
    
    try {
      // В фоне обновляем на сервере
      await onServerUpdate(itemId, updates);
      
      // Успех - убираем из optimistic
      setOptimisticIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      
      return true;
    } catch (error) {
      console.error('❌ Optimistic update failed:', error);
      
      // Откатываем к предыдущему состоянию
      setData(previousDataRef.current);
      
      // Убираем из optimistic
      setOptimisticIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      
      // Показываем ошибку
      toast.error('Ошибка обновления', {
        description: error instanceof Error ? error.message : 'Попробуйте еще раз'
      });
      
      return false;
    }
  }, [data, setData, getId]);

  /**
   * Удалить элемент оптимистично
   * @param itemId - ID элемента
   * @param onServerDelete - Функция удаления на сервере
   * @returns true при успехе, false при ошибке
   */
  const removeOptimistic = useCallback(async (
    itemId: string,
    onServerDelete: (itemId: string) => Promise<void>
  ): Promise<boolean> => {
    // Сохраняем предыдущее состояние
    previousDataRef.current = data;
    
    // Помечаем как оптимистичное
    setOptimisticIds(prev => new Set(prev).add(itemId));
    
    // Мгновенно удаляем из UI
    setData(prev => prev.filter(item => getId(item) !== itemId));
    
    try {
      // В фоне удаляем на сервере
      await onServerDelete(itemId);
      
      // Успех - убираем из optimistic
      setOptimisticIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      
      return true;
    } catch (error) {
      console.error('❌ Optimistic delete failed:', error);
      
      // Откатываем к предыдущему состоянию
      setData(previousDataRef.current);
      
      // Убираем из optimistic
      setOptimisticIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      
      // Показываем ошибку
      toast.error('Ошибка удаления', {
        description: error instanceof Error ? error.message : 'Попробуйте еще раз'
      });
      
      return false;
    }
  }, [data, setData, getId]);

  /**
   * Batch обновление нескольких элементов
   * @param updates - Массив { id, data }
   * @param onServerBatchUpdate - Функция batch обновления на сервере
   * @returns true при успехе, false при ошибке
   */
  const batchUpdateOptimistic = useCallback(async (
    updates: Array<{ id: string; data: Partial<T> }>,
    onServerBatchUpdate: (updates: Array<{ id: string; data: Partial<T> }>) => Promise<void>
  ): Promise<boolean> => {
    // Сохраняем предыдущее состояние
    previousDataRef.current = data;
    
    // Помечаем все как оптимистичные
    setOptimisticIds(prev => {
      const next = new Set(prev);
      updates.forEach(u => next.add(u.id));
      return next;
    });
    
    // Мгновенно обновляем UI
    setData(prev => {
      const updatesMap = new Map(updates.map(u => [u.id, u.data]));
      return prev.map(item => {
        const id = getId(item);
        const itemUpdates = updatesMap.get(id);
        return itemUpdates ? { ...item, ...itemUpdates } : item;
      });
    });
    
    try {
      // В фоне обновляем на сервере
      await onServerBatchUpdate(updates);
      
      // Успех - убираем из optimistic
      setOptimisticIds(prev => {
        const next = new Set(prev);
        updates.forEach(u => next.delete(u.id));
        return next;
      });
      
      return true;
    } catch (error) {
      console.error('❌ Optimistic batch update failed:', error);
      
      // Откатываем к предыдущему состоянию
      setData(previousDataRef.current);
      
      // Убираем из optimistic
      setOptimisticIds(prev => {
        const next = new Set(prev);
        updates.forEach(u => next.delete(u.id));
        return next;
      });
      
      // Показываем ошибку
      toast.error('Ошибка массового обновления', {
        description: error instanceof Error ? error.message : 'Попробуйте еще раз'
      });
      
      return false;
    }
  }, [data, setData, getId]);

  return {
    addOptimistic,
    updateOptimistic,
    removeOptimistic,
    batchUpdateOptimistic,
    optimisticIds, // Для визуального индикатора pending состояния
    isOptimistic: (id: string) => optimisticIds.has(id)
  };
}
