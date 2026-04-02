import { projectId, publicAnonKey } from './supabase/info';

const HEALTH_CHECK_URL = `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/health`;

export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_CHECK_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`
      },
      // Добавляем таймаут чтобы не ждать слишком долго
      signal: AbortSignal.timeout(10000) // 10 секунд (увеличено для cold start)
    });
    
    if (response.ok) {
      return true;
    } else {
      console.warn('⚠️ Edge Function вернул ошибку:', response.status);
      return false;
    }
  } catch (error: any) {
    // Graceful degradation - приложение продолжит работать
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.warn('⚠️ Edge Function: таймаут (10 сек) - возможно холодный старт');
    } else if (error.message?.includes('Failed to fetch')) {
      console.warn('⚠️ Edge Function: не удалось подключиться - возможно функция не развернута');
    } else {
      console.warn('⚠️ Edge Function: проверка не прошла:', error.message);
    }
    
    // Краткая справка для разработчика
    console.warn('💡 Подсказка: разверните функцию командой: supabase functions deploy make-server-73d66528');
    console.warn(`🔗 URL: ${HEALTH_CHECK_URL}`);
    
    return false;
  }
}