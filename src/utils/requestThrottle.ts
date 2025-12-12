/**
 * Request Throttle - Глобальная защита от перегрузки Edge Function
 * 
 * Проблема: Множественные setInterval могут создать сотни одновременных запросов
 * Решение: Ограничение максимального количества одновременных запросов
 */

import { requestMonitor } from './requestMonitor';

interface PendingRequest {
  id: string;
  timestamp: number;
  completed?: boolean; // Флаг что запрос завершён
}

class RequestThrottleManager {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private readonly MAX_CONCURRENT = 10; // Максимум 10 одновременных запросов
  private readonly COOLDOWN_MS = 500; // Минимум 500ms между одинаковыми запросами (после завершения)
  
  /**
   * Проверяет можно ли выполнить запрос И регистрирует его атомарно
   * @param requestId - Уникальный ID запроса (например: "events-sync-workspace-123")
   * @returns true если запрос разрешён, false если нужно пропустить
   */
  canMakeRequest(requestId: string): boolean {
    const now = Date.now();
    
    // 1. Проверка: не превышен ли лимит одновременных запросов
    const activeCount = Array.from(this.pendingRequests.values()).filter(r => !r.completed).length;
    if (activeCount >= this.MAX_CONCURRENT) {
      console.warn(`⚠️ Throttle: Превышен лимит одновременных запросов (${activeCount}/${this.MAX_CONCURRENT})`);
      return false;
    }
    
    // 2. Проверка: не выполняется ли уже такой же запрос (НЕ завершённый)
    const pending = this.pendingRequests.get(requestId);
    if (pending && !pending.completed) {
      return false;
    }
    
    // 3. Проверка: прошёл ли cooldown после ЗАВЕРШЁННОГО запроса
    if (pending && pending.completed) {
      const elapsed = now - pending.timestamp;
      if (elapsed < this.COOLDOWN_MS) {
        // console.debug(`ℹ️ Throttle: Пропуск "${requestId}" (cooldown ${this.COOLDOWN_MS - elapsed}ms)`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Регистрирует начало запроса (должен вызываться СРАЗУ после canMakeRequest)
   */
  registerRequest(requestId: string): void {
    this.pendingRequests.set(requestId, {
      id: requestId,
      timestamp: Date.now(),
      completed: false
    });
  }
  
  /**
   * Регистрирует завершение запроса
   */
  completeRequest(requestId: string): void {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      // Помечаем как завершённый (для cooldown)
      request.completed = true;
      request.timestamp = Date.now(); // Обновляем timestamp для cooldown
    }
  }
  
  /**
   * Получает количество активных запросов
   */
  getActiveCount(): number {
    return Array.from(this.pendingRequests.values()).filter(r => !r.completed).length;
  }
  
  /**
   * Получает список всех активных запросов (для debug)
   */
  getActiveRequests(): Array<{ id: string; duration: number }> {
    const now = Date.now();
    return Array.from(this.pendingRequests.values())
      .filter(r => !r.completed)
      .map(r => ({
        id: r.id,
        duration: now - r.timestamp
      }))
      .sort((a, b) => b.duration - a.duration); // Сортируем по длительности (долгие сверху)
  }
  
  /**
   * Очистка "застрявших" запросов (более 20 секунд в статусе "выполняется")
   */
  cleanupStuckRequests(): void {
    const now = Date.now();
    const STUCK_THRESHOLD = 20000; // 20 секунд
    
    for (const [id, request] of this.pendingRequests.entries()) {
      // Очищаем только НЕ завершённые запросы (застрявшие)
      if (!request.completed && (now - request.timestamp > STUCK_THRESHOLD)) {
        console.error(`⚠️ Throttle: ЗАСТРЯВШИЙ запрос "${id}" (${Math.round((now - request.timestamp)/1000)}s) → принудительно завершён`);
        this.pendingRequests.delete(id);
      }
    }
  }
  
  /**
   * Очистка устаревших запросов (более 30 секунд после завершения)
   */
  cleanup(): void {
    const now = Date.now();
    const STALE_THRESHOLD = 30000; // 30 секунд
    
    for (const [id, request] of this.pendingRequests.entries()) {
      // Очищаем завершённые запросы (старые)
      if (request.completed && (now - request.timestamp > STALE_THRESHOLD)) {
        // console.debug(`🧹 Throttle: Очистка устаревшего запроса "${id}" (${Math.round((now - request.timestamp)/1000)}s)`);
        this.pendingRequests.delete(id);
      }
    }
  }
}

// Singleton instance
export const requestThrottle = new RequestThrottleManager();

// Периодическая очистка завершённых запросов каждые 60 секунд
setInterval(() => {
  requestThrottle.cleanup();
}, 60000);

// Периодическая очистка застрявших запросов каждые 10 секунд
setInterval(() => {
  requestThrottle.cleanupStuckRequests();
}, 10000);

/**
 * Хелпер для выполнения throttled запроса
 * 
 * @example
 * const result = await throttledRequest(
 *   'events-sync-workspace-123',
 *   async () => {
 *     return await eventsApi.getAll(token, workspaceId);
 *   }
 * );
 */
export async function throttledRequest<T>(
  requestId: string,
  request: () => Promise<T>
): Promise<T | null> {
  // Атомарная проверка + регистрация (защита от race conditions)
  const now = Date.now();
  const activeCount = Array.from(requestThrottle['pendingRequests'].values()).filter(r => !r.completed).length;
  
  // 1. Проверка лимита
  if (activeCount >= 10) {
    console.warn(`⚠️ Throttle: Превышен лимит одновременных запросов (${activeCount}/10)`);
    return null;
  }
  
  // 2. Проверка дубликата (АТОМАРНО)
  const pending = requestThrottle['pendingRequests'].get(requestId);
  if (pending && !pending.completed) {
    return null;
  }
  
  // 3. Проверка cooldown (АТОМАРНО)
  if (pending && pending.completed) {
    const elapsed = now - pending.timestamp;
    if (elapsed < 500) {
      // console.debug(`ℹ️ Throttle: Пропуск "${requestId}" (cooldown ${500 - elapsed}ms)`);
      return null;
    }
  }
  
  // 4. Регистрация (СРАЗУ после проверки)
  requestThrottle['pendingRequests'].set(requestId, {
    id: requestId,
    timestamp: Date.now(),
    completed: false
  });
  
  // Логируем для мониторинга
  requestMonitor.logRequest(requestId);
  
  const startTime = Date.now();
  
  try {
    const result = await request();
    
    // Логируем долгие запросы (> 5 секунд)
    const elapsed = Date.now() - startTime;
    if (elapsed > 5000) {
      // console.debug(`🐌 Throttle: Медленный запрос "${requestId}" (${Math.round(elapsed/1000)}s)`);
    }
    
    return result;
  } finally {
    // КРИТИЧНО: всегда снимаем регистрацию (даже при ошибке)
    requestThrottle.completeRequest(requestId);
  }
}