/**
 * Supabase Client для Realtime подписок и прямых запросов (notifications)
 * 
 * Используется для:
 * - Realtime каналов (postgres_changes)
 * - Прямых запросов к таблицам с RLS (notifications, profiles)
 * 
 * Все остальные запросы идут через Edge Function API.
 */
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

const supabaseUrl = `https://${projectId}.supabase.co`;

export const supabaseClient = createClient(supabaseUrl, publicAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  // Отключаем авто-управление сессией — мы управляем токенами вручную
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

/**
 * Устанавливает access_token на Supabase клиент.
 * После вызова все запросы (.from().select() и т.д.) идут как `authenticated` с auth.uid().
 * Также устанавливает токен для Realtime подписок.
 */
let currentToken: string | null = null;
let pendingAuth: Promise<void> | null = null;
export async function setSupabaseAuth(accessToken: string): Promise<void> {
  if (currentToken === accessToken) {
    // Если уже идёт установка с этим токеном — дождёмся завершения
    if (pendingAuth) return pendingAuth;
    return;
  }
  currentToken = accessToken;
  
  // Сохраняем промис чтобы другие вызовы могли дождаться
  pendingAuth = (async () => {
    // Устанавливаем сессию — это позволяет RLS видеть auth.uid()
    // Supabase JS v2: setSession принимает access_token + refresh_token
    // У нас нет refresh_token — передаём access_token как оба значения
    const { error } = await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: accessToken, // dummy — мы не используем auto-refresh
    });
    
    if (error) {
      console.error('❌ setSupabaseAuth error:', error.message);
    }
    
    // Также для Realtime
    supabaseClient.realtime.setAuth(accessToken);
  })();

  try {
    await pendingAuth;
  } finally {
    pendingAuth = null;
  }
}

console.log('🔌 Supabase client создан:', supabaseUrl);