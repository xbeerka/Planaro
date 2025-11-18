import { useEffect, useRef, useCallback } from 'react';

interface UseIdleSyncOptions {
  /**
   * Время тишины перед ПЕРВОЙ синхронизацией (мс)
   * @default 5000
   */
  idleTimeout?: number;
  
  /**
   * Интервал ПЕРИОДИЧЕСКОЙ синхронизации (мс)
   * @default 30000 (30 секунд)
   */
  periodicInterval?: number;
  
  /**
   * Callback для синхронизации
   */
  onSync: () => Promise<void>;
  
  /**
   * Флаг активности пользователя
   */
  isUserActive: boolean;
  
  /**
   * Зависимости для отслеживания изменений
   */
  dependencies?: any[];
}

/**
 * 🎯 Idle Sync Pattern + Periodic Sync (ИСПРАВЛЕНО)
 * 
 * ДВУХУРОВНЕВАЯ синхронизация:
 * 1. IDLE SYNC - после 5 секунд тишины (первая синхронизация после загрузки/изменения)
 * 2. PERIODIC SYNC - каждые 30 секунд ПОСТОЯННО (автообновление в фоне)
 * 
 * КРИТИЧНО: Periodic sync работает НЕЗАВИСИМО, не останавливается при взаимодействии!
 * 
 * Алгоритм:
 * 1. При монтировании → запускается idle timer (5 сек) + periodic timer (30 сек)
 * 2. При взаимодействии → сбрасывается ТОЛЬКО idle timer (periodic работает!)
 * 3. Periodic sync ПРОПУСКАЕТСЯ если пользователь активен (но таймер не убивается)
 * 4. Если sync уже идёт → пропускаем следующий tick
 */
export function useIdleSync({
  idleTimeout = 5000,
  periodicInterval = 30000,
  onSync,
  isUserActive,
  dependencies = []
}: UseIdleSyncOptions) {
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const periodicTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);
  const isUserActiveRef = useRef(isUserActive);
  const lastIdleSyncRef = useRef<number>(0);

  // Синхронизируем ref с prop
  useEffect(() => {
    isUserActiveRef.current = isUserActive;
  }, [isUserActive]);

  // Запуск синхронизации
  const startSync = useCallback(async (reason: 'idle' | 'periodic') => {
    // Пропускаем если уже идёт синхронизация
    if (isSyncingRef.current) {
      console.log(`⏭️ ${reason} Sync: пропущен (уже идёт синхронизация)`);
      return;
    }

    // Пропускаем periodic sync если пользователь активен
    if (reason === 'periodic' && isUserActiveRef.current) {
      console.log(`⏭️ Periodic Sync: пропущен (пользователь активен)`);
      return;
    }

    console.log(`🔄 ${reason === 'idle' ? 'Idle' : 'Periodic'} Sync: начало синхронизации...`);
    
    isSyncingRef.current = true;

    try {
      await onSync();
      console.log(`✅ ${reason === 'idle' ? 'Idle' : 'Periodic'} Sync: завершён успешно`);
      
      if (reason === 'idle') {
        lastIdleSyncRef.current = Date.now();
      }
    } catch (error) {
      console.error(`❌ ${reason} Sync ошибка:`, error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [onSync]);

  // Сброс idle таймера (при активности пользователя)
  const resetIdleTimer = useCallback(() => {
    // Очищаем ТОЛЬКО idle таймер (periodic работает независимо!)
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    // Запускаем новый idle таймер
    idleTimerRef.current = setTimeout(() => {
      if (!isUserActiveRef.current && !isSyncingRef.current) {
        startSync('idle');
      }
    }, idleTimeout);
  }, [idleTimeout, startSync]);

  // Запуск periodic таймера (один раз при монтировании)
  const startPeriodicTimer = useCallback(() => {
    // Очищаем старый если был
    if (periodicTimerRef.current) {
      clearInterval(periodicTimerRef.current);
    }

    console.log(`⏰ Запуск периодического sync (каждые ${periodicInterval}ms)`);
    
    periodicTimerRef.current = setInterval(() => {
      startSync('periodic');
    }, periodicInterval);
  }, [periodicInterval, startSync]);

  // Отслеживание активности пользователя (сбрасываем ТОЛЬКО idle timer)
  useEffect(() => {
    if (isUserActive) {
      resetIdleTimer();
    }
  }, [isUserActive, resetIdleTimer]);

  // Отслеживание изменений зависимостей (сбрасываем ТОЛЬКО idle timer)
  useEffect(() => {
    resetIdleTimer();
  }, dependencies);

  // 🚀 Монтирование: запускаем ОБА таймера!
  useEffect(() => {
    console.log('🚀 useIdleSync: монтирование, запуск таймеров...');
    resetIdleTimer(); // Idle timer (5 сек)
    startPeriodicTimer(); // Periodic timer (30 сек)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Только при монтировании

  // Cleanup
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      if (periodicTimerRef.current) {
        clearInterval(periodicTimerRef.current);
      }
    };
  }, []);

  return {
    isSyncing: isSyncingRef.current,
    resetIdleTimer
  };
}
