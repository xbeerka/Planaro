import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getStorageItem } from '../../utils/storage';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-73d66528`;

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  token?: string;
  requireAuth?: boolean; // Требуется ли авторизация пользователя
  retries?: number; // Количество повторных попыток
  retryDelay?: number; // Базовая задержка между попытками (мс)
  timeout?: number; // Максимальное время ожидания ответа (мс), по умолчанию 15000
}

/**
 * Парсинг Cloudflare ошибок
 */
function parseCloudflareError(html: string): string | null {
  // Cloudflare Error 1105: Temporarily unavailable
  if (html.includes('Error</span>') && html.includes('1105')) {
    return 'Cloudflare Error 1105: Temporarily unavailable';
  }
  
  // Другие Cloudflare ошибки
  const errorMatch = html.match(/<span class="cf-error-code">(\d+)<\/span>/);
  if (errorMatch) {
    return `Cloudflare Error ${errorMatch[1]}`;
  }
  
  return null;
}

/**
 * Задержка с экспоненциальной задержкой
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { 
    method = 'GET', 
    body, 
    token, 
    requireAuth = true,
    retries = 2, // По умолчанию 2 повторных попытки
    retryDelay = 1000, // По умолчанию 1 секунда базовая задержка
    timeout = 15000 // По умолчанию 15 секунд максимальное время ожидания
  } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const headers: HeadersInit = {};
      
      // Если требуется авторизация, используем access_token пользователя
      if (requireAuth) {
        const accessToken = token || await getStorageItem('auth_access_token');
        if (!accessToken) {
          throw new Error('Требуется авторизация');
        }
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else {
        // Для публичных эндпоинтов используем publicAnonKey
        headers['Authorization'] = `Bearer ${publicAnonKey}`;
      }
      
      if (body) {
        headers['Content-Type'] = 'application/json';
      }
      
      const url = `${BASE_URL}${endpoint}`;
      
      // ⏱️ Timeout защита с AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId); // Отменяем таймер если успешно
        
        if (!response.ok) {
          const errorText = await response.text();
          
          // Парсим Cloudflare ошибку
          const cloudflareError = parseCloudflareError(errorText);
          
          if (cloudflareError) {
            // Cloudflare Error - короткое сообщение
            console.error(`❌ ${cloudflareError} (попытка ${attempt + 1}/${retries + 1})`);
            
            // Если это 1105 и не последняя попытка - retry
            if (cloudflareError.includes('1105') && attempt < retries) {
              const delayMs = retryDelay * Math.pow(2, attempt); // Экспоненциальная задержка
              console.log(`⏳ Повтор через ${delayMs}ms...`);
              await delay(delayMs);
              lastError = new Error(cloudflareError);
              continue; // Retry
            }
            
            throw new Error(cloudflareError);
          }
          
          // Обычная ошибка API
          console.error(`❌ API Error ${response.status}:`, errorText.substring(0, 200));
          
          // If we get a 401, token is invalid - clear auth and reload
          if (response.status === 401 && requireAuth) {
            console.error('❌ Токен невалиден (401), очистка сессии...');
            const { removeStorageItem } = await import('../../utils/storage');
            await removeStorageItem('auth_access_token');
            await removeStorageItem('auth_session_id');
            await removeStorageItem('cache_workspaces_list');
            
            // Reload page to force re-authentication
            window.location.reload();
          }
          
          throw new Error(`API Error ${response.status}: ${errorText.substring(0, 200)}`);
        }
        
        const data = await response.json();
        return data;
      } catch (fetchError) {
        clearTimeout(timeoutId); // Отменяем таймер в любом случае
        
        // Проверяем если это timeout
        if (fetchError.name === 'AbortError') {
          console.error(`⏱️ Request timeout после ${timeout}ms (попытка ${attempt + 1}/${retries + 1})`);
          
          if (attempt < retries) {
            const delayMs = retryDelay * Math.pow(2, attempt);
            console.log(`⏳ Повтор через ${delayMs}ms...`);
            await delay(delayMs);
            lastError = new Error(`Request timeout после ${timeout}ms`);
            continue; // Retry
          }
          
          throw new Error(`Request timeout после ${timeout}ms и ${retries + 1} попыток`);
        }
        
        throw fetchError; // Пробрасываем другие ошибки fetch
      }
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error(`❌ Failed to fetch (попытка ${attempt + 1}/${retries + 1})`);
        
        // Retry на Failed to fetch
        if (attempt < retries) {
          const delayMs = retryDelay * Math.pow(2, attempt);
          console.log(`⏳ Повтор через ${delayMs}ms...`);
          await delay(delayMs);
          lastError = error;
          continue;
        }
        
        throw new Error(`Сервер недоступен после ${retries + 1} попыток`);
      }
      
      // Другие ошибки - не retry
      console.error(`❌ API Request Failed:`, error);
      throw error;
    }
  }
  
  // Если дошли сюда - все попытки failed
  throw lastError || new Error('Неизвестная ошибка API');
}

export async function apiRequestNoResponse(
  endpoint: string,
  options: ApiOptions = {}
): Promise<void> {
  const { 
    method = 'GET', 
    body, 
    token, 
    requireAuth = true,
    retries = 2,
    retryDelay = 1000,
    timeout = 15000
  } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const headers: HeadersInit = {};
      
      // Если требуется авторизация, используем access_token пользователя
      if (requireAuth) {
        const accessToken = token || await getStorageItem('auth_access_token');
        if (!accessToken) {
          throw new Error('Требуется авторизация');
        }
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else {
        // Для публичных эндпоинтов используем publicAnonKey
        headers['Authorization'] = `Bearer ${publicAnonKey}`;
      }
      
      if (body) {
        headers['Content-Type'] = 'application/json';
      }
      
      const url = `${BASE_URL}${endpoint}`;
      
      // ⏱️ Timeout защита с AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId); // Отменяем таймер если успешно
        
        if (!response.ok) {
          const errorText = await response.text();
          
          // Парсим Cloudflare ошибку
          const cloudflareError = parseCloudflareError(errorText);
          
          if (cloudflareError) {
            console.error(`❌ ${cloudflareError} (попытка ${attempt + 1}/${retries + 1})`);
            
            if (cloudflareError.includes('1105') && attempt < retries) {
              const delayMs = retryDelay * Math.pow(2, attempt);
              console.log(`⏳ Повтор через ${delayMs}ms...`);
              await delay(delayMs);
              lastError = new Error(cloudflareError);
              continue;
            }
            
            throw new Error(cloudflareError);
          }
          
          console.error(`❌ API Error ${response.status}:`, errorText.substring(0, 200));
          
          if (response.status === 401 && requireAuth) {
            console.error('❌ Токен невалиден (401), очистка сессии...');
            const { removeStorageItem } = await import('../../utils/storage');
            await removeStorageItem('auth_access_token');
            await removeStorageItem('auth_session_id');
            await removeStorageItem('cache_workspaces_list');
            window.location.reload();
          }
          
          throw new Error(`API Error ${response.status}: ${errorText.substring(0, 200)}`);
        }
        
        return; // Success
      } catch (fetchError) {
        clearTimeout(timeoutId); // Отменяем таймер в любом случае
        
        // Проверяем если это timeout
        if (fetchError.name === 'AbortError') {
          console.error(`⏱️ Request timeout после ${timeout}ms (попытка ${attempt + 1}/${retries + 1})`);
          
          if (attempt < retries) {
            const delayMs = retryDelay * Math.pow(2, attempt);
            console.log(`⏳ Повтор через ${delayMs}ms...`);
            await delay(delayMs);
            lastError = new Error(`Request timeout после ${timeout}ms`);
            continue; // Retry
          }
          
          throw new Error(`Request timeout после ${timeout}ms и ${retries + 1} попыток`);
        }
        
        throw fetchError; // Пробрасываем другие ошибки fetch
      }
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error(`❌ Failed to fetch (попытка ${attempt + 1}/${retries + 1})`);
        
        if (attempt < retries) {
          const delayMs = retryDelay * Math.pow(2, attempt);
          console.log(`⏳ Повтор через ${delayMs}ms...`);
          await delay(delayMs);
          lastError = error;
          continue;
        }
        
        throw new Error(`Сервер недоступен после ${retries + 1} попыток`);
      }
      
      throw error;
    }
  }
  
  throw lastError || new Error('Неизвестная ошибка API');
}