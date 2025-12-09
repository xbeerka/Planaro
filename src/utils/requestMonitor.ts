/**
 * Request Monitor - Мониторинг частоты запросов для диагностики
 * 
 * Помогает выявить проблемы с перегрузкой Edge Function
 */

interface RequestLog {
  id: string;
  timestamp: number;
  count: number;
}

class RequestMonitor {
  private requests: Map<string, RequestLog[]> = new Map();
  private readonly WINDOW_MS = 60000; // 1 минута
  private readonly WARNING_THRESHOLD = 50; // Предупреждение если > 50 запросов/минуту
  
  /**
   * Логирование запроса
   */
  logRequest(requestType: string): void {
    const now = Date.now();
    
    // Получаем историю запросов этого типа
    const history = this.requests.get(requestType) || [];
    
    // Очищаем старые записи (> 1 минуты)
    const recentHistory = history.filter(log => now - log.timestamp < this.WINDOW_MS);
    
    // Добавляем новую запись
    recentHistory.push({
      id: `${requestType}-${now}`,
      timestamp: now,
      count: 1
    });
    
    this.requests.set(requestType, recentHistory);
    
    // Проверяем превышение лимита
    if (recentHistory.length > this.WARNING_THRESHOLD) {
      console.warn(
        `⚠️ REQUEST MONITOR: Высокая частота запросов "${requestType}": ` +
        `${recentHistory.length} запросов за последнюю минуту (лимит: ${this.WARNING_THRESHOLD})`
      );
    }
  }
  
  /**
   * Получить статистику запросов
   */
  getStats(): Record<string, number> {
    const now = Date.now();
    const stats: Record<string, number> = {};
    
    for (const [type, history] of this.requests.entries()) {
      const recentCount = history.filter(
        log => now - log.timestamp < this.WINDOW_MS
      ).length;
      stats[type] = recentCount;
    }
    
    return stats;
  }
  
  /**
   * Вывести отчет в консоль
   */
  printReport(): void {
    const stats = this.getStats();
    const totalRequests = Object.values(stats).reduce((sum, count) => sum + count, 0);
    
    console.log('📊 REQUEST MONITOR REPORT (последняя минута):');
    console.log(`   Всего запросов: ${totalRequests}`);
    
    const sortedStats = Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count > 0);
    
    if (sortedStats.length === 0) {
      console.log('   Нет активных запросов');
      return;
    }
    
    sortedStats.forEach(([type, count]) => {
      const emoji = count > this.WARNING_THRESHOLD ? '⚠️' : '✅';
      console.log(`   ${emoji} ${type}: ${count} req/min`);
    });
  }
  
  /**
   * Очистка старых данных
   */
  cleanup(): void {
    const now = Date.now();
    
    for (const [type, history] of this.requests.entries()) {
      const recentHistory = history.filter(
        log => now - log.timestamp < this.WINDOW_MS
      );
      
      if (recentHistory.length === 0) {
        this.requests.delete(type);
      } else {
        this.requests.set(type, recentHistory);
      }
    }
  }
}

// Singleton instance
export const requestMonitor = new RequestMonitor();

// Периодическая очистка каждые 60 секунд
setInterval(() => {
  requestMonitor.cleanup();
}, 60000);

// Периодический отчет каждые 60 секунд (только в dev режиме)
if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
  setInterval(() => {
    requestMonitor.printReport();
  }, 60000);
}