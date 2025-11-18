import { useRef, useCallback, useEffect } from 'react';
import { SchedulerEvent } from '../types/scheduler';

/**
 * Изменение события для сохранения
 */
interface EventChange {
  id: string;
  event: Partial<SchedulerEvent>;
  timestamp: number;
}

/**
 * Метрики сохранений (для диагностики производительности)
 */
interface SaveMetrics {
  totalBatches: number;
  totalEvents: number;
  avgBatchSize: number;
  maxBatchSize: number;
}

/**
 * Hook для накопления и debounced BATCH сохранения изменений событий
 * 
 * Вместо отправки каждого изменения сразу:
 * - Накапливает изменения в очереди
 * - Сохраняет ОДНИМ BATCH запросом через DELAY мс после последнего изменения
 * - Уменьшает нагрузку на сервер в 10-100 раз при быстрых изменениях
 * 
 * BATCH API:
 * - 10 изменений → 1 HTTP запрос вместо 10
 * - Создание/обновление/удаление в одном запросе
 * - SQL транзакция на сервере
 */
export function useDebouncedSave(
  onSaveBatch: (changes: Map<string, Partial<SchedulerEvent>>) => Promise<void>,
  delay: number = 500
) {
  // Очередь изменений: Map<eventId, EventChange>
  const changesQueueRef = useRef<Map<string, EventChange>>(new Map());
  
  // Таймер для debounce
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Флаг активного сохранения
  const isSavingRef = useRef(false);
  
  // Метрики для диагностики
  const metricsRef = useRef<SaveMetrics>({
    totalBatches: 0,
    totalEvents: 0,
    avgBatchSize: 0,
    maxBatchSize: 0
  });

  /**
   * Сохраняет все накопленные изменения ОДНИМ batch запросом
   */
  const flush = useCallback(async () => {
    console.log(`🔍 FLUSH ВЫЗВАН: size=${changesQueueRef.current.size}, isSaving=${isSavingRef.current}`);
    
    if (changesQueueRef.current.size === 0 || isSavingRef.current) {
      console.log(`⏭️ FLUSH ПРОПУЩЕН: ${changesQueueRef.current.size === 0 ? 'очередь пуста' : 'уже сохраняем'}`);
      return;
    }

    // Копируем очередь и очищаем оригинал
    const changesToSave = new Map(changesQueueRef.current);
    changesQueueRef.current.clear();

    // Отменяем таймер если есть
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    console.log(`📦 BATCH Save: НАЧАЛО сохранения ${changesToSave.size} изменений...`);
    console.log(`📋 События для сохранения:`, Array.from(changesToSave.keys()));
    isSavingRef.current = true;

    try {
      // ✅ ИСПРАВЛЕНИЕ: Извлекаем только event из EventChange обёртки
      const eventChanges = new Map<string, Partial<SchedulerEvent>>();
      changesToSave.forEach((change, id) => {
        eventChanges.set(id, change.event);
      });
      
      // 🚀 ОДНИМ batch запросом!
      await onSaveBatch(eventChanges);
      console.log(`✅ BATCH Save: ВСЕ ${changesToSave.size} изменений СОХРАНЕНЫ УСПЕШНО!`);
      
      // Обновляем метрики
      const currentMetrics = metricsRef.current;
      currentMetrics.totalBatches += 1;
      currentMetrics.totalEvents += changesToSave.size;
      currentMetrics.avgBatchSize = currentMetrics.totalEvents / currentMetrics.totalBatches;
      currentMetrics.maxBatchSize = Math.max(currentMetrics.maxBatchSize, changesToSave.size);
      metricsRef.current = currentMetrics;
      
      // Логируем метрики каждые 10 батчей
      if (currentMetrics.totalBatches % 10 === 0) {
        console.log(`📊 BATCH Metrics (${currentMetrics.totalBatches} batches):`, {
          totalEvents: currentMetrics.totalEvents,
          avgSize: currentMetrics.avgBatchSize.toFixed(2),
          maxSize: currentMetrics.maxBatchSize
        });
      }
    } catch (error) {
      console.error('❌ BATCH Save: ошибка при сохранении:', error);
    } finally {
      isSavingRef.current = false;
      console.log(`🏁 FLUSH ЗАВЕРШЁН: isSaving=${isSavingRef.current}`);
    }
  }, [onSaveBatch]);

  /**
   * Добавляет изменение в очередь и запускает debounce таймер
   */
  const queueChange = useCallback((id: string, event: Partial<SchedulerEvent>) => {
    // Пропускаем временные события
    if (id.startsWith('ev_temp_')) {
      return;
    }

    // ✅ ИСПРАВЛЕНИЕ: Мерджим с существующим изменением если оно есть
    const existingChange = changesQueueRef.current.get(id);
    
    const mergedEvent = existingChange 
      ? { ...existingChange.event, ...event } // Мерджим с предыдущим
      : event; // Первое изменение
    
    // Добавляем/обновляем изменение в очереди
    changesQueueRef.current.set(id, {
      id,
      event: mergedEvent, // ✅ Используем merged данные
      timestamp: Date.now(),
    });

    console.log(`⏳ Queued change: ${id} (очередь: ${changesQueueRef.current.size})`, {
      isMerge: !!existingChange,
      changes: Object.keys(event)
    });

    // Сбрасываем предыдущий таймер
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Запускаем новый таймер
    timerRef.current = setTimeout(() => {
      flush();
    }, delay);
  }, [delay, flush]);

  /**
   * Отменяет pending изменение для события
   */
  const cancelChange = useCallback((id: string) => {
    const hadChange = changesQueueRef.current.has(id);
    changesQueueRef.current.delete(id);
    
    if (hadChange) {
      console.log(`🚫 Cancelled change: ${id} (очередь: ${changesQueueRef.current.size})`);
    }
  }, []);

  /**
   * Проверяет, есть ли pending изменения для события
   */
  const hasPendingChange = useCallback((id: string): boolean => {
    return changesQueueRef.current.has(id);
  }, []);

  /**
   * Возвращает количество pending изменений
   */
  const getPendingCount = useCallback((): number => {
    return changesQueueRef.current.size;
  }, []);

  // Cleanup при unmount - сохраняем все изменения
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      // Синхронное сохранение при unmount невозможно из-за async
      // Поэтому просто логируем warning если есть несохранённые изменения
      if (changesQueueRef.current.size > 0) {
        console.warn(
          `⚠️ useDebouncedSave unmount: ${changesQueueRef.current.size} несохранённых изменений!`
        );
      }
    };
  }, []);

  return {
    queueChange,
    flush,
    cancelChange,
    hasPendingChange,
    getPendingCount,
  };
}