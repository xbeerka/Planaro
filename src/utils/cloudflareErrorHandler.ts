/**
 * Обработка Cloudflare ошибок
 * 
 * Показывает пользователю понятное уведомление вместо технических деталей
 */

let cloudflareErrorShown = false; // Флаг чтобы показать toast только один раз
let cloudflareErrorTimeout: number | null = null;

/**
 * Проверка является ли ошибка Cloudflare Error 1105
 */
export function isCloudflareError(error: Error): boolean {
  return error.message.includes('Cloudflare Error 1105') || 
         error.message.includes('Temporarily unavailable');
}

/**
 * Обработка Cloudflare ошибки с показом toast
 * Показывает toast только один раз, затем сбрасывает флаг через 60 секунд
 */
export function handleCloudflareError(error: Error, showToast?: (message: string, type: 'error') => void): void {
  if (!isCloudflareError(error)) {
    return; // Не Cloudflare ошибка
  }
  
  // Показываем toast только один раз
  if (!cloudflareErrorShown && showToast) {
    showToast('База данных временно недоступна. Повторная попытка...', 'error');
    cloudflareErrorShown = true;
    
    // Сбрасываем флаг через 60 секунд
    if (cloudflareErrorTimeout) {
      clearTimeout(cloudflareErrorTimeout);
    }
    cloudflareErrorTimeout = window.setTimeout(() => {
      cloudflareErrorShown = false;
      cloudflareErrorTimeout = null;
    }, 60000); // 60 секунд
  }
  
  // Короткое логирование вместо огромного HTML
  console.error('❌ Cloudflare Error 1105: Database temporarily unavailable');
}

/**
 * Сброс флага (для тестирования)
 */
export function resetCloudflareErrorFlag(): void {
  cloudflareErrorShown = false;
  if (cloudflareErrorTimeout) {
    clearTimeout(cloudflareErrorTimeout);
    cloudflareErrorTimeout = null;
  }
}
