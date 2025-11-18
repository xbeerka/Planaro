import { projectId, publicAnonKey } from './supabase/info';

const HEALTH_CHECK_URL = `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/health`;

export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_CHECK_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`
      }
    });
    
    if (response.ok) {
      return true;
    } else {
      console.error('❌ Сервер вернул ошибку:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ Ошибка проверки сервера:', error);
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('⚠️  КРИТИЧЕСКАЯ ОШИБКА: Edge Function недоступен');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('');
    console.error('Суть проблемы:');
    console.error('  Приложение не может подключиться к серверу Supabase Edge Functions.');
    console.error('');
    console.error('Возможные причины:');
    console.error('  1. Edge Function не развернут на Supabase');
    console.error('  2. Неправильный URL или Project ID');
    console.error('  3. Проблемы с сетью или CORS');
    console.error('');
    console.error('Что нужно сделать:');
    console.error('  1. Проверьте, что Edge Function развернут:');
    console.error('     $ supabase functions deploy make-server-73d66528');
    console.error('');
    console.error('  2. Проверьте настройки проекта в Supabase Dashboard:');
    console.error('     - Settings > API > Project URL');
    console.error('     - Settings > API > anon/public key');
    console.error('');
    console.error('  3. Проверьте логи Edge Function в Dashboard:');
    console.error('     - Supabase Dashboard > Edge Functions > make-server-73d66528 > Logs');
    console.error('');
    console.error(`Проверяемый URL: ${HEALTH_CHECK_URL}`);
    console.error(`Project ID: ${projectId}`);
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('');
    
    return false;
  }
}