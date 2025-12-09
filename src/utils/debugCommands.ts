/**
 * Debug Commands - Утилиты для диагностики в консоли браузера
 * 
 * Использование в консоли:
 * - window.debugRequests() - показать статистику запросов
 * - window.debugThrottle() - показать активные throttled запросы
 */

import { requestMonitor } from './requestMonitor';
import { requestThrottle } from './requestThrottle';

// Expose debug commands to window object
declare global {
  interface Window {
    debugRequests: () => void;
    debugThrottle: () => void;
    debugHelp: () => void;
  }
}

/**
 * Показать статистику запросов
 */
window.debugRequests = () => {
  console.log('='.repeat(60));
  requestMonitor.printReport();
  console.log('='.repeat(60));
};

/**
 * Показать активные throttled запросы
 */
window.debugThrottle = () => {
  const activeCount = requestThrottle.getActiveCount();
  const activeRequests = requestThrottle.getActiveRequests();
  
  console.log('='.repeat(60));
  console.log('🔒 ACTIVE THROTTLED REQUESTS:');
  console.log(`   Активных запросов: ${activeCount} / 10 (MAX_CONCURRENT)`);
  console.log('');
  
  if (activeRequests.length === 0) {
    console.log('   ✅ Нет активных запросов');
  } else {
    activeRequests.forEach(req => {
      const duration = Math.round(req.duration / 1000);
      const emoji = duration > 10 ? '🐌' : duration > 5 ? '⏱️' : '✅';
      const warning = duration > 15 ? ' ⚠️ МЕДЛЕННО!' : duration > 10 ? ' ⚠️ ДОЛГО' : '';
      console.log(`   ${emoji} ${req.id}: ${duration}s${warning}`);
    });
  }
  
  console.log('='.repeat(60));
};

/**
 * Показать справку по debug командам
 */
window.debugHelp = () => {
  console.log('='.repeat(60));
  console.log('🔧 DEBUG COMMANDS:');
  console.log('');
  console.log('   debugRequests()  - Статистика запросов (req/min)');
  console.log('   debugThrottle()  - Активные throttled запросы');
  console.log('   debugHelp()      - Эта справка');
  console.log('');
  console.log('Пример:');
  console.log('   > debugRequests()');
  console.log('   📊 events-delta-sync: 15 req/min');
  console.log('   📊 projects-sync: 4 req/min');
  console.log('');
  console.log('   > debugThrottle()');
  console.log('   🔒 ACTIVE THROTTLED REQUESTS:');
  console.log('   Активных запросов: 3 / 10 (MAX_CONCURRENT)');
  console.log('');
  console.log('   ✅ Нет активных запросов');
  console.log('='.repeat(60));
};

// Автоматически показать справку при загрузке (только в dev режиме)
if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
  console.log('');
  console.log('💡 TIP: Введите debugHelp() для справки по debug командам');
  console.log('');
}

export {}; // Make this a module