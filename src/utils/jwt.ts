/**
 * Утилиты для работы с JWT токенами
 */

/**
 * Декодирует base64url строку в UTF-8 строку с поддержкой кириллицы
 * 
 * Проблема: atob() работает только с Latin1 (ASCII), не поддерживает Unicode/кириллицу
 * Решение: atob() → Uint8Array → TextDecoder('utf-8') → правильная UTF-8 строка
 * 
 * @param str - base64url закодированная строка
 * @returns Декодированная UTF-8 строка
 */
export function decodeBase64Unicode(str: string): string {
  try {
    // Заменяем base64url символы на обычный base64
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    
    // Декодируем base64 в бинарную строку
    const binaryString = atob(base64);
    
    // Преобразуем бинарную строку в массив байтов
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Декодируем UTF-8 байты в строку с поддержкой кириллицы и других Unicode символов
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  } catch (e) {
    console.warn('⚠️ Ошибка декодирования base64:', e);
    return str;
  }
}

/**
 * Декодирует JWT токен и возвращает payload с поддержкой кириллицы
 * 
 * @param token - JWT токен (формат: header.payload.signature)
 * @returns Объект payload или null при ошибке
 */
export function decodeJWT<T = any>(token: string): T | null {
  try {
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      console.warn('⚠️ Невалидный формат JWT токена (должно быть 3 части)');
      return null;
    }
    
    // Декодируем payload (вторая часть токена) с поддержкой UTF-8
    const payloadJson = decodeBase64Unicode(parts[1]);
    return JSON.parse(payloadJson) as T;
  } catch (e) {
    console.warn('⚠️ Ошибка парсинга JWT токена:', e);
    return null;
  }
}

/**
 * Интерфейс для Supabase JWT payload
 */
export interface SupabaseJWTPayload {
  sub: string; // User ID
  email?: string;
  user_metadata?: {
    name?: string;
    display_name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
  exp?: number; // Expiration timestamp
  iat?: number; // Issued at timestamp
  [key: string]: any;
}

/**
 * Декодирует Supabase JWT токен
 * 
 * @param token - Supabase access token
 * @returns Payload с типизацией или null при ошибке
 */
export function decodeSupabaseJWT(token: string): SupabaseJWTPayload | null {
  return decodeJWT<SupabaseJWTPayload>(token);
}

/**
 * Получает displayName из Supabase JWT токена
 * 
 * @param token - Supabase access token
 * @returns Display name или null
 */
export function getDisplayNameFromToken(token: string): string | null {
  const payload = decodeSupabaseJWT(token);
  if (!payload) return null;
  
  return payload.user_metadata?.name || 
         payload.user_metadata?.display_name || 
         payload.email || 
         null;
}

/**
 * Получает email из Supabase JWT токена
 * 
 * @param token - Supabase access token
 * @returns Email или null
 */
export function getEmailFromToken(token: string): string | null {
  const payload = decodeSupabaseJWT(token);
  return payload?.email || null;
}

/**
 * Получает user ID из Supabase JWT токена
 * 
 * @param token - Supabase access token
 * @returns User ID или null
 */
export function getUserIdFromToken(token: string): string | null {
  const payload = decodeSupabaseJWT(token);
  return payload?.sub || null;
}
