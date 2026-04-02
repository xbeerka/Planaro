import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

// ==================== SUPABASE CLIENTS ====================

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

/**
 * Admin Supabase client (service role)
 * Используется для всех операций с БД
 */
export function createAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Auth Supabase client (anon key)
 * Используется для проверки JWT токенов
 */
export function createAuthClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * User Supabase client (anon key + access token)
 * Используется для операций от имени пользователя (включая Realtime)
 * @param accessToken - JWT токен пользователя
 */
export function createUserClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Вычисляет количество недель в году по стандарту ISO 8601
 * @param year - Год
 * @returns 52 или 53 недели
 * 
 * По ISO 8601 год имеет 53 недели если:
 * - Начинается с четверга (Thu) ИЛИ
 * - Високосный год И начинается со среды (Wed)
 */
export function getWeeksInYear(year: number): number {
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const jan1DayISO = jan1Day === 0 ? 7 : jan1Day; // Convert to ISO: 1=Mon, 7=Sun
  
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  
  // Год имеет 53 недели если:
  // - Начинается с четверга (4) ИЛИ
  // - Високосный год И начинается со среды (3)
  if (jan1DayISO === 4 || (isLeap && jan1DayISO === 3)) {
    return 53;
  }
  
  return 52;
}

/**
 * Парсинг Cloudflare ошибок из HTML
 */
export function parseCloudflareError(message: string): string | null {
  if (!message || typeof message !== 'string') return null;
  
  // Cloudflare Error 1105: Temporarily unavailable
  if (message.includes('Error</span>') && message.includes('1105')) {
    return 'Cloudflare Error 1105: Temporarily unavailable';
  }
  
  // Другие Cloudflare ошибки
  const errorMatch = message.match(/<span class="cf-error-code">(\d+)<\/span>/);
  if (errorMatch) {
    return `Cloudflare Error ${errorMatch[1]}`;
  }
  
  return null;
}

/**
 * Проверка является ли ошибка Cloudflare Error
 */
export function isCloudflareError(error: any): boolean {
  if (!error || !error.message) return false;
  return parseCloudflareError(error.message) !== null;
}

/**
 * Логирование Cloudflare ошибки (короткое сообщение вместо HTML)
 */
export function logCloudflareError(context: string, error: any): void {
  const cloudflareError = parseCloudflareError(error.message);
  if (cloudflareError) {
    console.error(`❌ ${context}: ${cloudflareError}`);
  } else {
    console.error(`❌ ${context}:`, error);
  }
}

/**
 * Обработка ошибки с возвратом JSON response
 * Автоматически определяет Cloudflare ошибки и возвращает 503
 */
export function handleError(c: any, context: string, error: any, defaultMessage: string = 'Internal error'): Response {
  const cloudflareError = parseCloudflareError(error?.message);
  if (cloudflareError) {
    console.error(`❌ ${context}: ${cloudflareError}`);
    return c.json({ error: cloudflareError }, 503); // Service Unavailable
  }
  
  console.error(`❌ ${context}:`, error);
  const message = error?.message || defaultMessage;
  return c.json({ error: message.substring(0, 200) }, 500);
}

/**
 * Обновляет дату последнего изменения воркспейса
 * Вызывается при создании/изменении/удалении проектов, событий, пользователей, департаментов
 * 
 * ВРЕМЕННО ОТКЛЮЧЕНО: В таблице workspaces может не быть поля updated_at
 */
export async function updateWorkspaceSummary(workspaceId: string, context?: string) {
  // Временно отключаем эту функциональность
  console.log(`ℹ️ updateWorkspaceSummary вызвана для ${workspaceId} (${context || 'unknown'}) - временно отключена`);
  return;
  
  /* ЗАКОММЕНТИРОВАНО до добавления поля updated_at в таблицу workspaces
  try {
    const now = new Date().toISOString();
    console.log(`📊 Обновление updated_at для воркспейса ${workspaceId} (${context || 'unknown'})`);
    
    const supabase = createAdminClient();
    
    // Обновляем базовую таблицу workspaces, а не view
    const { error } = await supabase
      .from('workspaces')
      .update({ updated_at: now })
      .eq('id', workspaceId);
    
    if (error) {
      console.warn(`⚠️ Не удалось обновить workspaces.updated_at для ${workspaceId}:`, error.message);
      // НЕ бросаем ошибку - это не критично для основной операции
    } else {
      console.log(`✅ Workspaces.updated_at обновлён: ${workspaceId} -> ${now}`);
    }
  } catch (error: any) {
    console.warn(`⚠️ Исключение при обновлении workspaces.updated_at:`, error.message);
    // НЕ бросаем ошибку - это не критично
  }
  */
}

/**
 * Генерирует цвет на основе email (для курсоров пользователей)
 */
export function getUserColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Выполняет операцию с повторными попытками при ошибках
 * (Exponential backoff)
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000,
  context = 'Operation'
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ ${context}: попытка ${i + 1}/${maxRetries} не удалась: ${error.message}`);
      
      // Если это не последняя попытка - ждем
      if (i < maxRetries - 1) {
        // Экспоненциальная задержка: 1s, 2s, 4s...
        const waitTime = delay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError;
}

/**
 * Обрабатывает массив элементов частями (чанками) параллельно,
 * но последовательно между чанками, чтобы не перегрузить базу
 */
export async function processInChunks<T, R>(
  items: T[],
  chunkSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    // Обрабатываем чанк параллельно
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
  }
  
  return results;
}