import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook для батчинга множественных обновлений в один вызов
 * Полезен для оптимизации множественных API запросов
 * 
 * Пример: при drag события - накапливаем изменения и сохраняем одним batch запросом
 * 
 * @param onFlush - Callback который вызывается с накопленными items
 * @param delay - Задержка перед flush (ms)
 * @returns { add, flush } - Добавить item в batch и принудительно flush
 * 
 * @example
 * const { add: addEventUpdate, flush: flushEventUpdates } = useBatchedUpdates(
 *   async (updates) => {
 *     console.log(`Batching ${updates.length} updates`);
 *     await Promise.all(updates.map(u => updateEvent(u.id, u.data)));
 *   },
 *   500
 * );
 * 
 * // Drag события
 * const handleEventDrag = (eventId, newPos) => {
 *   addEventUpdate({ id: eventId, data: newPos }); // Накапливаем
 * };
 * 
 * // Отпускание мыши
 * const handleDragEnd = () => {
 *   flushEventUpdates(); // Сохраняем все сразу
 * };
 */
export function useBatchedUpdates<T>(
  onFlush: (items: T[]) => void | Promise<void>,
  delay: number = 100
) {
  const batchRef = useRef<T[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup timer on unmount
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const flush = useCallback(async () => {
    // Отменяем таймер если есть
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Flush только если есть items
    if (batchRef.current.length > 0 && isMountedRef.current) {
      const itemsToFlush = [...batchRef.current];
      batchRef.current = [];
      
      try {
        await onFlush(itemsToFlush);
      } catch (error) {
        console.error('❌ Batch flush error:', error);
      }
    }
  }, [onFlush]);

  const add = useCallback((item: T) => {
    // Добавляем item в batch
    batchRef.current.push(item);

    // Сбрасываем предыдущий таймер
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Устанавливаем новый таймер для автоматического flush
    timerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        flush();
      }
    }, delay);
  }, [delay, flush]);

  return { add, flush };
}

/**
 * Hook для батчинга с уникальными ключами
 * Обновляет существующий item вместо добавления нового
 * 
 * Полезен когда один и тот же item обновляется много раз
 * 
 * @example
 * const { add, flush } = useBatchedUpdatesMap(
 *   (updates) => updateEvents(updates),
 *   (update) => update.id, // Key extractor
 *   500
 * );
 * 
 * // Много обновлений одного события
 * addEventUpdate({ id: '1', x: 100 }); // Добавлено
 * addEventUpdate({ id: '1', x: 200 }); // Заменяет предыдущее
 * addEventUpdate({ id: '1', x: 300 }); // Заменяет предыдущее
 * // Результат: только { id: '1', x: 300 } будет отправлено
 */
export function useBatchedUpdatesMap<T, K = string>(
  onFlush: (items: T[]) => void | Promise<void>,
  getKey: (item: T) => K,
  delay: number = 100
) {
  const batchMapRef = useRef<Map<K, T>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (batchMapRef.current.size > 0 && isMountedRef.current) {
      const itemsToFlush = Array.from(batchMapRef.current.values());
      batchMapRef.current.clear();
      
      try {
        await onFlush(itemsToFlush);
      } catch (error) {
        console.error('❌ Batch flush error:', error);
      }
    }
  }, [onFlush]);

  const add = useCallback((item: T) => {
    const key = getKey(item);
    
    // Обновляем или добавляем item в Map
    batchMapRef.current.set(key, item);

    // Сбрасываем предыдущий таймер
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Устанавливаем новый таймер
    timerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        flush();
      }
    }, delay);
  }, [delay, flush, getKey]);

  return { add, flush };
}
