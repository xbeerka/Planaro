import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from './kv_store.tsx';

const app = new Hono();

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

console.log('🔧 Инициализация Supabase клиента...');
console.log('URL:', supabaseUrl ? '✓ установлен' : '✗ отсутствует');
console.log('SERVICE KEY:', supabaseServiceKey ? '✓ установлен' : '✗ отсутствует');
console.log('ANON KEY:', supabaseAnonKey ? '✓ установлен' : '✗ отсутствует');

// Service role client for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Anon client for auth verification (uses same JWT signing key as frontend)
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Global error handler
app.onError((err, c) => {
  console.error('🔥 ГЛОБАЛЬНАЯ ОШИБКА:', {
    message: err.message,
    stack: err.stack,
    name: err.name
  });
  return c.json({ error: 'Internal Server Error', details: err.message }, 500);
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Парсинг Cloudflare ошибок из HTML
 */
function parseCloudflareError(message: string): string | null {
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
function isCloudflareError(error: any): boolean {
  if (!error || !error.message) return false;
  return parseCloudflareError(error.message) !== null;
}

/**
 * Логирование Cloudflare ошибки (короткое сообщение вместо HTML)
 */
function logCloudflareError(context: string, error: any): void {
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
function handleError(c: any, context: string, error: any, defaultMessage: string = 'Internal error'): Response {
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
async function updateWorkspaceSummary(workspaceId: string, context?: string) {
  // Временно отключаем эту функциональность
  console.log(`ℹ️ updateWorkspaceSummary вызвана для ${workspaceId} (${context || 'unknown'}) - временно отключена`);
  return;
  
  /* ЗАКОММЕНТИРОВАНО до добавления поля updated_at в таблицу workspaces
  try {
    const now = new Date().toISOString();
    console.log(`📊 Обновление updated_at для воркспейса ${workspaceId} (${context || 'unknown'})`);
    
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

// ==================== ENDPOINTS ====================

// Health check endpoint
app.get("/make-server-73d66528/health", (c) => {
  console.log('💚 Health check called');
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Test KV endpoint
app.get("/make-server-73d66528/test-kv", async (c) => {
  console.log('🧪 Test KV endpoint called');
  try {
    const testKey = 'test:' + Date.now();
    const testValue = JSON.stringify({ test: true, timestamp: Date.now() });
    
    console.log('  Writing to KV...');
    await kv.set(testKey, testValue);
    
    console.log('  Reading from KV...');
    const retrieved = await kv.get(testKey);
    
    console.log('  Deleting from KV...');
    await kv.del(testKey);
    
    return c.json({ 
      status: 'ok', 
      kv_works: retrieved === testValue,
      written: testValue,
      retrieved: retrieved
    });
  } catch (error: any) {
    console.error('❌ KV test error:', error);
    return c.json({ status: 'error', message: error.message }, 500);
  }
});

// ==================== AUTH ENDPOINTS ====================

// Check session endpoint
// Uses server-side sessions stored in KV store
app.post("/make-server-73d66528/auth/session", async (c) => {
  console.log('🔵 SESSION ENDPOINT CALLED');
  
  try {
    console.log('📨 Получен запрос на проверку сессии');
    
    let body;
    try {
      body = await c.req.json();
    } catch (parseError: any) {
      console.error('❌ Ошибка парсинга JSON:', parseError.message);
      return c.json({ error: 'Invalid JSON', session: null }, 400);
    }
    
    const { session_id, force_refresh } = body;
    
    console.log('📦 Полученные данные:', {
      hasSessionId: !!session_id,
      sessionIdPreview: session_id ? session_id.substring(0, 8) + '...' : 'null',
      forceRefresh: !!force_refresh,
      bodyKeys: Object.keys(body)
    });
    
    if (!session_id) {
      console.log('⚠️ Нет session_id - возврат session: null');
      return c.json({ session: null }, 200);
    }
    
    // Load session from KV store
    console.log('🔍 Проверка session_id в KV store...');
    console.log('   KV import type:', typeof kv);
    console.log('   KV.get type:', typeof kv.get);
    
    let sessionData;
    try {
      sessionData = await kv.get(`session:${session_id}`);
      console.log('   KV.get результат:', sessionData ? 'данные получены' : 'null');
    } catch (kvError: any) {
      console.error('❌ Ошибка чтения из KV:', kvError.message);
      return c.json({ error: 'KV store error', session: null }, 500);
    }
    
    if (!sessionData) {
      console.log('❌ Сессия не найдена в KV store');
      return c.json({ session: null }, 200);
    }
    
    console.log('✅ Сессия найдена в KV store');
    
    let session;
    try {
      session = JSON.parse(sessionData);
    } catch (jsonError: any) {
      console.error('❌ Ошибка парсинга сессии из KV:', jsonError.message);
      return c.json({ error: 'Invalid session data', session: null }, 500);
    }
    
    const { user_id, created_at, access_token, refresh_token, expires_at, user } = session;
    
    console.log('📋 Данные сессии:', {
      hasUserId: !!user_id,
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
      hasUser: !!user,
      createdAt: created_at ? new Date(created_at).toISOString() : 'null',
      expiresAt: expires_at ? new Date(expires_at * 1000).toISOString() : 'null'
    });
    
    // Check if session expired (30 days since creation)
    const sessionAge = Date.now() - created_at;
    const MAX_SESSION_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    if (sessionAge > MAX_SESSION_AGE) {
      console.log('❌ Сессия истекла (создана', new Date(created_at).toLocaleString(), ')');
      await kv.del(`session:${session_id}`);
      return c.json({ session: null }, 200);
    }
    
    console.log('✅ Сессия в пределах 30 дней (возраст:', Math.floor(sessionAge / 1000 / 60), 'минут)');
    console.log('   Пользователь:', user?.email || user_id);
    
    // Check if access_token expired or will expire soon (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const tokenExpiresIn = expires_at ? expires_at - now : 0;
    
    console.log('🕒 Access token expires in:', tokenExpiresIn, 'seconds');
    
    // Check if need to refresh token (expired, expiring soon, or forced)
    if (tokenExpiresIn < 300 || force_refresh) { // Less than 5 minutes OR force refresh
      if (force_refresh) {
        console.log('🔄 FORCE_REFRESH: принудительное обновление для получения свежих user_metadata');
      } else {
        console.log('🔄 Access token истек или скоро истечет, обновление через refresh_token');
      }
      
      if (!refresh_token) {
        console.log('❌ Нет refresh_token для обновления');
        await kv.del(`session:${session_id}`);
        return c.json({ session: null }, 200);
      }
      
      try {
        // Refresh the session using refresh_token
        const { data: refreshData, error: refreshError } = await supabaseAuth.auth.refreshSession({
          refresh_token: refresh_token
        });
        
        if (refreshError) {
          console.error('❌ Ошибка обновления токена:', refreshError.message);
          await kv.del(`session:${session_id}`);
          return c.json({ session: null }, 200);
        }
        
        if (!refreshData.session) {
          console.log('❌ Не удалось обновить сессию');
          await kv.del(`session:${session_id}`);
          return c.json({ session: null }, 200);
        }
        
        console.log('✅ Access token успешно обновлен');
        console.log('   Новый expires_at:', new Date((refreshData.session.expires_at || 0) * 1000).toISOString());
        console.log('   User metadata в обновленном токене:', {
          name: refreshData.user?.user_metadata?.name,
          display_name: refreshData.user?.user_metadata?.display_name,
          avatar_url: refreshData.user?.user_metadata?.avatar_url ? 'да (' + refreshData.user.user_metadata.avatar_url.substring(0, 50) + '...)' : 'нет'
        });
        
        // Update session in KV store with new tokens
        const updatedSessionData = {
          user_id: user_id,
          access_token: refreshData.session.access_token,
          refresh_token: refreshData.session.refresh_token,
          expires_at: refreshData.session.expires_at,
          user: refreshData.user || user,
          created_at: created_at // Keep original creation time
        };
        
        await kv.set(`session:${session_id}`, JSON.stringify(updatedSessionData));
        console.log('💾 Обновленная сессия сохранена в KV store');
        
        // Return refreshed session
        return c.json({
          session: {
            access_token: refreshData.session.access_token,
            refresh_token: refreshData.session.refresh_token,
            expires_at: refreshData.session.expires_at,
            user: refreshData.user || user,
            session_id: session_id
          }
        }, 200);
        
      } catch (refreshError: any) {
        console.error('❌ Исключение при обновлении токена:', refreshError.message);
        await kv.del(`session:${session_id}`);
        return c.json({ session: null }, 200);
      }
    }
    
    // Access token is still valid, return current session
    console.log('✅ Access token еще валиден, возврат текущей сессии');
    return c.json({
      session: {
        access_token: access_token,
        refresh_token: refresh_token,
        expires_at: expires_at,
        user: user,
        session_id: session_id
      }
    }, 200);
    
  } catch (error: any) {
    console.error('❌ Критическая ошибка проверки сессии:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return c.json({ error: 'Server error', session: null }, 500);
  }
});

// Sign in endpoint
app.post("/make-server-73d66528/auth/signin", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return c.json({ error: 'Email и пароль обязательны' }, 400);
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Validate email format
    if (!normalizedEmail.endsWith('@kode.ru')) {
      return c.json({ error: 'Используйте корпоративный адрес @kode.ru' }, 400);
    }
    
    const localPart = normalizedEmail.replace('@kode.ru', '');
    if (localPart.length === 0 || !/^[a-z]/.test(localPart)) {
      return c.json({ error: 'Н��верный формат email' }, 400);
    }
    
    console.log('🔐 Попытка входа...');
    console.log('   Email:', normalizedEmail);
    console.log('   Длина пароля:', password.length);
    
    // Use supabaseAuth (with ANON_KEY) for auth operations
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email: normalizedEmail,
      password: password
    });
    
    if (error) {
      console.error('❌ Ошибка входа:', error.message);
      console.error('   Код ошибки:', error.code || error.status);
      console.error('   Детали:', error);
      
      // Provide user-friendly error messages
      let userMessage = 'Неверный email или пароль';
      if (error.message.includes('Email not confirmed')) {
        userMessage = 'Email не подтвержден. Проверьте почту для подтверждения.';
      } else if (error.message.includes('Invalid login credentials')) {
        userMessage = 'Неверный email или пароль. Проверьте правильность ввода.';
      }
      
      return c.json({ error: userMessage }, 401);
    }
    
    if (!data.session?.access_token || !data.session?.refresh_token) {
      return c.json({ error: 'Не удалось получить токены доступа' }, 500);
    }
    
    console.log('✅ Вход успешен');
    console.log('   Access token expires:', new Date((data.session.expires_at || 0) * 1000).toLocaleString());
    console.log('   Refresh token expires:', data.session.refresh_token ? 'через 30 дней' : 'отсутствует');
    console.log('   User:', data.user.email, 'ID:', data.user.id);
    
    // Generate session ID and store in KV
    const sessionId = crypto.randomUUID();
    console.log('🆔 Сгенерирован session_id:', sessionId);
    
    const sessionData = {
      user_id: data.user.id,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: data.user,
      created_at: Date.now()
    };
    
    const sessionDataJson = JSON.stringify(sessionData);
    console.log('💾 Сохранение сессии в KV store...');
    console.log('   Key: session:' + sessionId.substring(0, 8) + '...');
    console.log('   Data size:', sessionDataJson.length, 'bytes');
    
    try {
      await kv.set(`session:${sessionId}`, sessionDataJson);
      console.log('✅ Сессия сохранена в KV store');
    } catch (kvError: any) {
      console.error('❌ Ошибка сохранения в KV:', kvError.message);
      throw kvError;
    }
    
    // Verify it was saved
    try {
      const verify = await kv.get(`session:${sessionId}`);
      console.log('🔍 Проверка сохранения:', verify ? 'OK' : 'FAILED');
    } catch (verifyError: any) {
      console.error('❌ Ошибка проверки:', verifyError.message);
    }
    
    console.log('✅ Готово, с����������ок действия сессии: 30 дней');
    
    return c.json({
      access_token: data.session.access_token,
      session_id: sessionId,
      expires_at: data.session.expires_at,
      user: data.user
    });
  } catch (error: any) {
    console.error('❌ Ошибка при входе:', error);
    return c.json({ error: error.message || 'Ошибка входа' }, 500);
  }
});

// Sign out endpoint
app.post("/make-server-73d66528/auth/signout", async (c) => {
  try {
    const body = await c.req.json();
    const { session_id } = body;
    
    if (session_id) {
      console.log('🗑️ Удаление сессии из KV store:', session_id.substring(0, 8) + '...');
      await kv.del(`session:${session_id}`);
      console.log('✅ Сессия удалена из KV store');
    }
    
    console.log('✅ Выход выполнен');
    return c.json({ success: true });
  } catch (error: any) {
    console.error('❌ Ошибка выхода:', error);
    return c.json({ error: error.message || 'Ошибка выхода' }, 500);
  }
});

// Verify OTP endpoint
app.post("/make-server-73d66528/auth/verify-otp", async (c) => {
  try {
    const body = await c.req.json();
    const { email, token } = body;
    
    if (!email || !token) {
      return c.json({ error: 'Email и OTP код обязательны' }, 400);
    }
    
    console.log('🔐 Проверка OTP для:', email);
    
    // Use supabaseAuth (with ANON_KEY) for auth operations
    const { data, error } = await supabaseAuth.auth.verifyOtp({
      email,
      token,
      type: 'signup'
    });
    
    if (error) {
      console.error('❌ Ошибка проверки OTP:', error);
      
      // Специальная обработка для истёкших кодов
      if (error.message?.includes('expired') || error.code === 'otp_expired') {
        return c.json({ error: 'Код подтверждения истёк. Пожалуйста, запросите новый код.' }, 400);
      }
      
      return c.json({ error: error.message || 'Неверный код подтверждения' }, 400);
    }
    
    if (!data.session?.access_token || !data.session?.refresh_token) {
      return c.json({ error: 'Не удалось получить токены доступа' }, 500);
    }
    
    console.log('✅ OTP подтвержден, вход выполнен');
    console.log('   Access token expires:', new Date((data.session.expires_at || 0) * 1000).toLocaleString());
    console.log('   Refresh token expires:', data.session.refresh_token ? 'через 30 дней' : 'отсутствует');
    console.log('   User:', data.user.email, 'ID:', data.user.id);
    
    // Generate session ID and store in KV
    const sessionId = crypto.randomUUID();
    console.log('🆔 Сгенерирован session_id:', sessionId);
    
    const sessionData = {
      user_id: data.user.id,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: data.user,
      created_at: Date.now()
    };
    
    const sessionDataJson = JSON.stringify(sessionData);
    console.log('💾 Сохранение сессии в KV store...');
    console.log('   Key: session:' + sessionId.substring(0, 8) + '...');
    console.log('   Data size:', sessionDataJson.length, 'bytes');
    
    try {
      await kv.set(`session:${sessionId}`, sessionDataJson);
      console.log('✅ Сессия сохранена в KV store');
    } catch (kvError: any) {
      console.error('❌ Ошибка сохранения в KV:', kvError.message);
      throw kvError;
    }
    
    // Verify it was saved
    try {
      const verify = await kv.get(`session:${sessionId}`);
      console.log('🔍 Проверка сохранения:', verify ? 'OK' : 'FAILED');
    } catch (verifyError: any) {
      console.error('❌ Ошибка проверки:', verifyError.message);
    }
    
    console.log('✅ Готово, срок действия сессии: 30 дней');
    
    return c.json({
      access_token: data.session.access_token,
      session_id: sessionId,
      expires_at: data.session.expires_at,
      user: data.user
    });
  } catch (error: any) {
    console.error('❌ Ошибка при проверке OTP:', error);
    return c.json({ error: error.message || 'Ошибка проверки OTP' }, 500);
  }
});

// Sign up endpoint with @kode.ru domain validation and OTP
app.post("/make-server-73d66528/auth/signup", async (c) => {
  try {
    console.log('🔐 Регистрация нового пользователя с OTP...');
    
    // Проверяем тип контента
    const contentType = c.req.header('content-type') || '';
    let email: string, password: string, displayName: string | undefined;
    let avatarFile: File | null = null;
    
    if (contentType.includes('multipart/form-data')) {
      // Обработка multipart/form-data (с аватаркой)
      console.log('📤 Получены данные с аватаркой (multipart/form-data)');
      const formData = await c.req.formData();
      
      email = formData.get('email') as string;
      password = formData.get('password') as string;
      displayName = formData.get('displayName') as string | undefined;
      avatarFile = formData.get('avatar') as File | null;
      
      if (avatarFile) {
        console.log(`📷 Получена аватарка: ${avatarFile.name}, размер: ${avatarFile.size} байт`);
      }
    } else {
      // Обычный JSON (без аватарки)
      console.log('📝 Получены данные без аватарки (JSON)');
      const body = await c.req.json();
      email = body.email;
      password = body.password;
      displayName = body.displayName;
    }
    
    if (!email || !password) {
      return c.json({ error: 'Email и пароль обязательны' }, 400);
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Validate email domain
    if (!normalizedEmail.endsWith('@kode.ru')) {
      console.log(`❌ Отклонен email с неправильным доменом: ${normalizedEmail}`);
      return c.json({ error: 'Регистрация доступна только для адресов @kode.ru' }, 403);
    }
    
    // Validate email format (more strict)
    const localPart = normalizedEmail.replace('@kode.ru', '');
    
    // Local part must exist and start with a letter
    if (localPart.length === 0 || !/^[a-z]/.test(localPart)) {
      console.log(`❌ Отклонен email с неверным формат��м: ${normalizedEmail}`);
      return c.json({ error: 'Email должен начинаться с буквы до @kode.ru' }, 400);
    }
    
    // Single character - must be a letter
    if (localPart.length === 1) {
      if (!/^[a-z]$/.test(localPart)) {
        console.log(`❌ Отклонен email с недопустимым символом: ${normalizedEmail}`);
        return c.json({ error: 'Email может содержать только буквы' }, 400);
      }
    } else {
      // Multiple characters - can contain letters, numbers, dots, hyphens, underscores
      // But cannot end with dot/hyphen/underscore
      if (!/^[a-z][a-z0-9._-]*[a-z0-9]$/.test(localPart)) {
        console.log(`❌ Отклонен email с недопустимыми символами: ${normalizedEmail}`);
        return c.json({ error: 'Email может содержать только буквы, цифры, точки и дефисы' }, 400);
      }
      
      // Cannot have consecutive dots
      if (/\.\./.test(localPart)) {
        console.log(`❌ Отклонен email с последовательными точками: ${normalizedEmail}`);
        return c.json({ error: 'Email не может содержать последовательные точки' }, 400);
      }
    }
    
    // Validate password length
    if (password.length < 6) {
      return c.json({ error: 'Пароль должен содержать минимум 6 символов' }, 400);
    }
    console.log(`📧 Создание пользователя для email: ${normalizedEmail}`);
    if (displayName) {
      console.log(`👤 Display Name: ${displayName}`);
    }
    
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
    
    if (existingUser) {
      console.log('ℹ️ Пользователь уже существует:', normalizedEmail);
      console.log('   Email confirmed:', existingUser.email_confirmed_at ? 'Да' : 'Нет');
      
      // If email is already confirmed, don't allow re-signup
      if (existingUser.email_confirmed_at) {
        console.error('❌ ПОЛЬЗОВАТЕЛЬ УЖЕ ЗАРЕГИСТРИРОВАН И ПОДТВЕРЖДЕН');
        console.error(`   Email: ${normalizedEmail}`);
        console.error('   Решение: Войдите с существующим паролем');
        
        return c.json({ error: 'Пользователь с этим email уже зарегистрирован' }, 409);
      }
      
      // Email not confirmed - resend OTP
      console.log('📨 Email не подтвержден, отправка нового OTP кода...');
      
      // Resend confirmation email via signInWithOtp (use supabaseAuth with ANON_KEY)
      const { error: otpError } = await supabaseAuth.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false // Don't create new user, just send OTP
        }
      });
      
      if (otpError) {
        console.error('❌ Ошибка отправки OTP:', otpError.message);
        return c.json({ error: 'Ошибка отправки кода подтверждения' }, 500);
      }
      
      console.log('✅ Новый OTP код отправлен на:', normalizedEmail);
      
      return c.json({ 
        success: true, 
        message: 'Код подтверждения отправлен на ваш email',
        user_id: existingUser.id
      }, 200);
    }
    
    // Create user with Supabase Auth using signUp (sends OTP automatically)
    // Note: email_confirm is NOT set to true - user must confirm via OTP
    // Use supabaseAuth (with ANON_KEY) for auth operations
    
    let avatarUrl: string | undefined;
    
    // Если есть аватарка - загружаем её ДО создания пользователя
    // Потому что нам нужен user.id для пути файла
    if (avatarFile) {
      console.log('📤 Загрузка аватарки в Storage...');
      
      try {
        // Validate file type
        if (!avatarFile.type.startsWith('image/')) {
          return c.json({ error: 'Можно загружать только изображения' }, 400);
        }

        // Validate file size (max 5MB)
        if (avatarFile.size > 5 * 1024 * 1024) {
          return c.json({ error: 'Размер файла не должен превышать 5MB' }, 400);
        }

        // Create bucket if not exists
        const bucketName = 'make-73d66528-avatars';
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
        
        if (!bucketExists) {
          console.log(`📦 Создание публичного bucket ${bucketName}...`);
          const { error: createError } = await supabase.storage.createBucket(bucketName, {
            public: true // Аватары публичные
          });
          if (createError) {
            console.error('❌ Ошибка создания bucket:', createError);
            // Не останавливаем регистрацию из-за аватарки
            avatarFile = null;
          }
        }

        if (avatarFile) {
          // Generate filename using email (user.id еще нет)
          const fileExt = avatarFile.name.split('.').pop() || 'jpg';
          const tempFileName = `temp_${normalizedEmail.replace('@kode.ru', '')}_${Date.now()}.${fileExt}`;
          const filePath = `avatars/${tempFileName}`;

          // Convert File to ArrayBuffer
          const arrayBuffer = await avatarFile.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Upload to Supabase Storage
          console.log(`💾 Загрузка файла ${filePath} в Supabase Storage...`);
          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, uint8Array, {
              contentType: avatarFile.type,
              upsert: true
            });

          if (uploadError) {
            console.error('❌ Ошибка загрузки в Storage:', uploadError);
            // Не останавливаем регистрацию из-за аватарки
          } else {
            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from(bucketName)
              .getPublicUrl(filePath);

            avatarUrl = publicUrl;
            console.log(`✅ Аватар загружен: ${avatarUrl}`);
          }
        }
      } catch (uploadError: any) {
        console.error('❌ Ошибка загрузки аватарки:', uploadError);
        // Не останавливаем регистрацию из-за аватарки
      }
    }
    
    const { data, error } = await supabaseAuth.auth.signUp({
      email: normalizedEmail,
      password: password,
      options: {
        data: {
          created_via: 'signup_with_otp',
          name: displayName || null,
          avatar_url: avatarUrl || null
        }
      }
    });
    
    if (error) {
      console.error('❌ Ошибка создания пользователя:', error.message);
      console.error('   Код ошибки:', error.code || error.status);
      console.error('   Детали:', error);
      
      return c.json({ error: error.message || 'Ошибка создания пользователя' }, error.status || 500);
    }
    
    if (!data.user) {
      console.error('❌ Пользователь не создан (data.user пустой)');
      return c.json({ error: 'Не удалось создать пользователя' }, 500);
    }
    
    console.log('✅ Пользователь создан:', data.user.id);
    console.log('   Email:', data.user.email);
    console.log('   Display Name:', displayName || 'не указано');
    console.log('   Avatar URL:', avatarUrl || 'не указано');
    console.log('   Email confirmed:', data.user.email_confirmed_at ? 'Да' : 'Нет (требуется OTP)');
    console.log('   📧 OTP код отправлен на email');
    
    // Return success - user needs to verify OTP
    return c.json({ 
      success: true, 
      message: 'Код подтверждения отправлен на ваш email',
      requiresOTP: true,
      user_id: data.user.id
    });
  } catch (error: any) {
    console.error('❌ Ошибка при регистрации:', error);
    return c.json({ error: error.message || 'Ошибка регистрации' }, 500);
  }
});

// Delete user endpoint - DISABLED FOR SECURITY
// Users should not be able to delete accounts from the frontend
// Use Supabase Dashboard for user management
app.delete("/make-server-73d66528/auth/user/:email", async (c) => {
  console.warn('⚠️ Попытка удаления пользователя заблокирован���� (фу��кция отключена из соображений безопасности)');
  return c.json({ 
    error: 'Удаление пользователей отключено из соображений безопасности. Используйте Supabase Dashboard для управления пользователями.' 
  }, 403);
});

// Debug endpoint - check if user exists
app.post("/make-server-73d66528/auth/check-user", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body;
    
    if (!email) {
      return c.json({ error: 'Email обязателен' }, 400);
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    console.log('🔍 Пров��рка ��уществования пользователя:', normalizedEmail);
    
    // List users (admin function)
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Ошибка получения списка пользователей:', error);
      return c.json({ error: error.message }, 500);
    }
    
    const user = data.users.find(u => u.email?.toLowerCase() === normalizedEmail);
    
    if (user) {
      console.log('✅ Пользователь найден:');
      console.log('   ID:', user.id);
      console.log('   Email:', user.email);
      console.log('   Email confirmed at:', user.email_confirmed_at || 'не подтвержден');
      console.log('   Created at:', user.created_at);
      console.log('   Last sign in:', user.last_sign_in_at || 'никогда');
      
      return c.json({
        exists: true,
        user: {
          id: user.id,
          email: user.email,
          email_confirmed: !!user.email_confirmed_at,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at
        }
      });
    } else {
      console.log('❌ Пользователь НЕ найден');
      console.log('   Всего пользователей в системе:', data.users.length);
      if (data.users.length > 0) {
        console.log('   Существующие emails:');
        data.users.slice(0, 5).forEach(u => console.log('   -', u.email));
      }
      
      return c.json({ exists: false });
    }
  } catch (error: any) {
    console.error('❌ Ошибка проверки пользователя:', error);
    return c.json({ error: error.message || 'Ошибка проверки пользователя' }, 500);
  }
});

// Get all departments
app.get("/make-server-73d66528/departments", async (c) => {
  try {
    const workspaceId = c.req.query('workspace_id');
    console.log('📋 Запрос департаментов для workspace:', workspaceId || 'все');
    
    // Strategy 1: Try to get from departments table
    let query = supabase
      .from('departments')
      .select('*');
    
    // Filter by workspace_id if provided
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }
    
    const { data: deptsTable, error: deptsError } = await query.order('id', { ascending: false });
    
    if (!deptsError && deptsTable && deptsTable.length > 0) {
      console.log(`✓ Получено ${deptsTable.length} департаментов из таблицы departments`);
      
      const departments = deptsTable.map(dept => ({
        id: `d${dept.id}`,
        name: dept.name,
        queue: dept.queue || 999,
        visible: dept.visible !== undefined ? dept.visible : true
      }));
      
      console.log('✓ Возвращаем департаменты:', departments);
      return c.json(departments);
    }
    
    // If departments table is empty or not found for this workspace, return empty array
    // Do NOT fallback to users.department_id as it doesn't have workspace filtering
    console.log('⚠️ Таблица departments пустая для воркспейса:', workspaceId);
    console.log('💡 Используйте кнопку "Добавить департамент" чтобы создать первый департамент');
    return c.json([]);
    
  } catch (error: any) {
    // Обработка Cloudflare ошибки
    const cloudflareError = parseCloudflareError(error?.message);
    if (cloudflareError) {
      console.error(`❌ Departments: ${cloudflareError}`);
      return c.json({ error: cloudflareError }, 503);
    }
    
    console.error(`❌ Exception fetching departments:`, error);
    return c.json({ error: `Failed to fetch departments: ${error.message || error}`.substring(0, 200) }, 500);
  }
});

// Update department queue (batch update) - MUST come before /departments/:id to avoid route collision
app.put("/make-server-73d66528/departments/queue", async (c) => {
  try {
    console.log('🔄 Обновление очередности департаментов...');
    
    const body = await c.req.json();
    console.log('📝 Данные очередности:', JSON.stringify(body, null, 2));
    
    // body should be an array of { id, queue }
    if (!Array.isArray(body.departments)) {
      return c.json({ error: 'Expected departments array' }, 400);
    }
    
    if (body.departments.length === 0) {
      console.log('⚠️ Пустой массив департаментов, нечего обновлять');
      return c.json({ success: true });
    }
    
    // Since unique constraint on queue was removed, we can update directly
    // No need for two-step temporary values approach
    console.log(`Обновление queue для ${body.departments.length} департаментов...`);
    
    const updates = body.departments.map(async (dept: { id: string, queue: number }) => {
      const numericId = parseInt(dept.id.replace('d', ''));
      
      const { error } = await supabase
        .from('departments')
        .update({ queue: dept.queue })
        .eq('id', numericId);
      
      if (error) {
        console.error(`❌ Ошибка обновления department ${dept.id}:`, error);
        throw new Error(`Failed to update queue for dept ${dept.id}: ${error.message}`);
      }
      
      console.log(`  ✓ Department ${dept.id}: queue = ${dept.queue}`);
    });
    
    await Promise.all(updates);
    
    console.log('✅ Все департаменты обновлены');
    return c.json({ success: true });
  } catch (error) {
    console.error(`❌ Exception updating department queue:`, error);
    return c.json({ error: `Failed to update department queue: ${error.message || error}` }, 500);
  }
});

// Update department visibility (batch update)
app.put("/make-server-73d66528/departments/visibility", async (c) => {
  try {
    console.log('🔄 Обновление видимости департаментов...');
    
    const body = await c.req.json();
    console.log('📝 Данные видимости:', body);
    
    // body should be an array of { id, visible }
    if (!Array.isArray(body.departments)) {
      return c.json({ error: 'Expected departments array' }, 400);
    }
    
    // Update each department's visibility
    const updates = body.departments.map(async (dept: { id: string, visible: boolean }) => {
      const numericId = parseInt(dept.id.replace('d', ''));
      
      const { error } = await supabase
        .from('departments')
        .update({ visible: dept.visible })
        .eq('id', numericId);
      
      if (error) {
        console.error(`❌ Ошибка обновления visibility для department ${dept.id}:`, error);
        throw error;
      }
      
      console.log(`✅ Обновлен visible для department ${dept.id}: ${dept.visible}`);
    });
    
    await Promise.all(updates);
    
    console.log('✅ Видимость всех департаментов обновлена');
    return c.json({ success: true });
  } catch (error) {
    console.error(`❌ Exception updating department visibility:`, error);
    return c.json({ error: `Failed to update department visibility: ${error.message || error}` }, 500);
  }
});

// Get department users count
app.get("/make-server-73d66528/departments/:id/users-count", async (c) => {
  try {
    const departmentId = c.req.param('id');
    console.log('👥 Запрос количества пользователей для департамента:', departmentId);
    
    const numericId = parseInt(departmentId.replace('d', ''));
    
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', numericId);
    
    if (error) {
      console.error(`❌ Ошибка подсчета пользователей:`, error);
      return c.json({ error: `Failed to count users: ${error.message}` }, 500);
    }
    
    console.log(`✓ Департамент ${departmentId} имеет ${count || 0} пользователей`);
    return c.json({ count: count || 0 });
  } catch (error) {
    console.error(`❌ Exception counting department users:`, error);
    return c.json({ error: `Failed to count users: ${error.message || error}` }, 500);
  }
});

// Create department
app.post("/make-server-73d66528/departments", async (c) => {
  try {
    console.log('➕ Создание нового департамента...');
    
    const body = await c.req.json();
    const { name, workspace_id } = body;
    
    if (!name) {
      return c.json({ error: 'Department name is required' }, 400);
    }
    
    if (!workspace_id) {
      return c.json({ error: 'Workspace ID is required' }, 400);
    }
    
    // Get max queue for this workspace
    const { data: existingDepts } = await supabase
      .from('departments')
      .select('queue')
      .eq('workspace_id', workspace_id)
      .order('queue', { ascending: false })
      .limit(1);
    
    const maxQueue = existingDepts && existingDepts.length > 0 ? existingDepts[0].queue : 0;
    const newQueue = maxQueue + 1;
    
    const { data, error } = await supabase
      .from('departments')
      .insert({
        name,
        workspace_id,
        queue: newQueue,
        visible: true
      })
      .select();
    
    if (error) {
      console.error(`❌ Ошибка создания департамента:`, error);
      return c.json({ error: `Failed to create department: ${error.message}` }, 500);
    }
    
    if (!data || data.length === 0) {
      return c.json({ error: 'Failed to create department' }, 500);
    }
    
    console.log('✅ Департамент создан:', data[0]);
    
    // 🔄 Обновляем дату последнего изменения воркспейса
    await updateWorkspaceSummary(workspace_id, 'create department');
    
    const transformedDepartment = {
      id: `d${data[0].id}`,
      name: data[0].name,
      queue: data[0].queue || 999,
      visible: data[0].visible !== undefined ? data[0].visible : true
    };
    
    return c.json(transformedDepartment);
  } catch (error) {
    console.error(`❌ Exception creating department:`, error);
    return c.json({ error: `Failed to create department: ${error.message || error}` }, 500);
  }
});

// Delete department
app.delete("/make-server-73d66528/departments/:id", async (c) => {
  try {
    const departmentId = c.req.param('id');
    console.log('🗑️ Удаление департамента:', departmentId);
    
    const numericId = parseInt(departmentId.replace('d', ''));
    
    // Check if department has users
    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', numericId);
    
    if (countError) {
      console.error(`❌ Ошибка проверки пользователей:`, countError);
      return c.json({ error: `Failed to check users: ${countError.message}` }, 500);
    }
    
    if (count && count > 0) {
      console.log(`⚠️ Департамент ${departmentId} имеет ${count} пользова��елей, удаление невозможно`);
      return c.json({ error: `Cannot delete department with ${count} users` }, 400);
    }
    
    // Получаем workspace_id перед удалением для обновления summary
    const { data: dept } = await supabase
      .from('departments')
      .select('workspace_id')
      .eq('id', numericId)
      .single();
    
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', numericId);
    
    if (error) {
      console.error(`❌ Ошибка удаления де��артамента:`, error);
      return c.json({ error: `Failed to delete department: ${error.message}` }, 500);
    }
    
    console.log('✅ Департамент удален:', departmentId);
    
    // 🔄 Обновляем дату последнего изменения воркспейса
    if (dept?.workspace_id) {
      await updateWorkspaceSummary(dept.workspace_id, 'delete department');
    }
    return c.json({ success: true });
  } catch (error) {
    console.error(`❌ Exception deleting department:`, error);
    return c.json({ error: `Failed to delete department: ${error.message || error}` }, 500);
  }
});

// Update single department (for renaming)
app.put("/make-server-73d66528/departments/:id", async (c) => {
  try {
    const departmentId = c.req.param('id');
    console.log('✏️ Обновление департамента:', departmentId);
    
    const body = await c.req.json();
    console.log('📝 Новые данные департамента:', body);
    
    // Extract numeric ID
    const numericId = parseInt(departmentId);
    
    const departmentData: any = {};
    
    if (body.name !== undefined) {
      departmentData.name = body.name;
    }
    if (body.queue !== undefined) {
      departmentData.queue = body.queue;
    }
    if (body.visible !== undefined) {
      departmentData.visible = body.visible;
    }
    
    console.log('📝 Данные для обновления:', departmentData);
    
    const { data, error } = await supabase
      .from('departments')
      .update(departmentData)
      .eq('id', numericId)
      .select();
    
    if (error) {
      console.error(`❌ Supabase error updating department:`, error);
      return c.json({ error: `Failed to update department: ${error.message}` }, 500);
    }
    
    if (!data || data.length === 0) {
      console.error(`⚠️ Департамент с ID ${numericId} не найден в базе данных`);
      return c.json({ error: `Department not found: ${departmentId}` }, 404);
    }
    
    console.log('✅ Департамент обновлен:', data[0]);
    
    // 🔄 Обновляем дату последнего изменения воркспейса
    if (data[0].workspace_id) {
      await updateWorkspaceSummary(data[0].workspace_id, 'update department');
    }
    
    // Transform back to frontend format
    const transformedDepartment = {
      id: `d${data[0].id}`,
      name: data[0].name,
      queue: data[0].queue || 999,
      visible: data[0].visible !== undefined ? data[0].visible : true
    };
    
    return c.json(transformedDepartment);
  } catch (error) {
    console.error(`❌ Exception updating department:`, error);
    return c.json({ error: `Failed to update department: ${error.message || error}` }, 500);
  }
});

// Get all grades
app.get("/make-server-73d66528/grades", async (c) => {
  try {
    console.log('🎓 Запрос грейдов...');
    
    const { data: grades, error } = await supabase
      .from('grades')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) {
      console.error('❌ Ошибка загрузки грейдов:', error);
      return c.json({ error: `Failed to fetch grades: ${error.message}` }, 500);
    }
    
    if (!grades || grades.length === 0) {
      console.warn('⚠️ Таблица grades пустая');
      return c.json([]);
    }
    
    console.log(`✓ По��учено ${grades.length} гре��д��в:`, grades);
    
    // Transform to frontend format
    const transformedGrades = grades.map(g => ({
      id: String(g.id),
      name: g.name
    }));
    
    return c.json(transformedGrades);
  } catch (error) {
    console.error(`❌ Exception fetching grades:`, error);
    return c.json({ error: `Failed to fetch grades: ${error.message || error}` }, 500);
  }
});

// Get all companies
app.get("/make-server-73d66528/companies", async (c) => {
  try {
    console.log('🏢 Запрос компаний...');
    
    const { data: companies, error } = await supabase
      .from('companies')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) {
      console.error('❌ Ошибка загрузки компаний:', error);
      return c.json({ error: `Failed to fetch companies: ${error.message}` }, 500);
    }
    
    if (!companies || companies.length === 0) {
      console.warn('⚠️ Таблица companies пустая');
      return c.json([]);
    }
    
    console.log(`✓ Получено ${companies.length} компаний:`, companies);
    
    // Transform to frontend format
    const transformedCompanies = companies.map(c => ({
      id: String(c.id),
      name: c.name
    }));
    
    return c.json(transformedCompanies);
  } catch (error) {
    console.error(`❌ Exception fetching companies:`, error);
    return c.json({ error: `Failed to fetch companies: ${error.message || error}` }, 500);
  }
});

// Get all resources (users from Supabase users table)
app.get("/make-server-73d66528/resources", async (c) => {
  try {
    const workspaceId = c.req.query('workspace_id');
    console.log('👥 Запрос сотрудников из таблицы users для workspace:', workspaceId || 'все');
    
    // Strategy 1: Try with JOIN to get department names
    let query = supabase
      .from('users')
      .select('*, departments(name)');
    
    // Filter by workspace_id if provided
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }
    
    const { data: usersWithJoin, error: joinError } = await query
      .order('department_id', { ascending: false })
      .order('id', { ascending: true });
    
    if (!joinError && usersWithJoin && usersWithJoin.length > 0) {
      console.log(`✓ Получено ${usersWithJoin.length} пользователей (JOIN с departments)`);
      console.log('📝 Первый пользователь из базы:', JSON.stringify(usersWithJoin[0], null, 2));
      
      const resources = usersWithJoin.map(user => {
        // Support both snake_case and camelCase column names
        const firstName = user.firstName || user.first_name || "";
        const lastName = user.lastName || user.last_name || "";
        const fullName = user.fullName || user.full_name || 
                        (firstName || lastName ? `${firstName} ${lastName}`.trim() : `User ${user.id}`);
        
        return {
          id: `r${user.id}`,
          firstName,
          lastName,
          fullName,
          position: user.position || "Employee",
          departmentId: `d${user.department_id}`,
          grade: user.grade_id ? String(user.grade_id) : (user.grade ? String(user.grade) : undefined),
          companyId: user.company_id ? String(user.company_id) : undefined
        };
      });
      
      // Check for empty names
      const emptyCount = resources.filter(r => r.fullName.startsWith('User ')).length;
      if (emptyCount > 0) {
        console.warn(`⚠️ ВНИМАНИЕ: ${emptyCount} из ${resources.length} сотрудников имеют пустые имена!`);
        console.warn('   📖 Выполните UPDATE запрос из QUICK_FIX_NAMES.md');
      }
      
      console.log('📝 Первый resource после мапинга:', JSON.stringify(resources[0], null, 2));
      console.log('✓ Возвращаем сотрудников (JOIN):', resources.length);
      return c.json(resources);
    }
    
    console.log('⚠️ JOIN не удался, пробуем без JOIN...');
    
    // Strategy 2: Get users with department_id (no JOIN)
    let query2 = supabase
      .from('users')
      .select('*');
    
    // Filter by workspace_id if provided
    if (workspaceId) {
      query2 = query2.eq('workspace_id', workspaceId);
    }
    
    const { data: usersWithDeptId, error: deptIdError } = await query2
      .order('department_id', { ascending: false })
      .order('id', { ascending: true });
    
    if (!deptIdError && usersWithDeptId && usersWithDeptId.length > 0) {
      console.log(`✓ Получено ${usersWithDeptId.length} пользователей (с department_id)`);
      console.log('📝 Первый пользователь из базы:', JSON.stringify(usersWithDeptId[0], null, 2));
      
      const resources = usersWithDeptId.map(user => {
        // Support both snake_case and camelCase column names
        const firstName = user.firstName || user.first_name || "";
        const lastName = user.lastName || user.last_name || "";
        const fullName = user.fullName || user.full_name || 
                        (firstName || lastName ? `${firstName} ${lastName}`.trim() : `User ${user.id}`);
        
        return {
          id: `r${user.id}`,
          firstName,
          lastName,
          fullName,
          position: user.position || "Employee",
          departmentId: `d${user.department_id}`,
          grade: user.grade_id ? String(user.grade_id) : (user.grade ? String(user.grade) : undefined),
          companyId: user.company_id ? String(user.company_id) : undefined
        };
      });
      
      // Check for empty names
      const emptyCount = resources.filter(r => r.fullName.startsWith('User ')).length;
      if (emptyCount > 0) {
        console.warn(`⚠�� ВНИМАНИЕ: ${emptyCount} из ${resources.length} сотрудников имеют пустые имена!`);
        console.warn('   📖 Выполните UPDATE запрос из QUICK_FIX_NAMES.md');
      }
      
      console.log('📝 Первый resource после мапинга:', JSON.stringify(resources[0], null, 2));
      console.log('✓ Возвращаем сотрудников (department_id):', resources.length);
      return c.json(resources);
    }
    
    console.log('⚠️ department_id не найден, пробуем department (text)...');
    
    // Strategy 3: Get users with department (text field) - without ordering by department
    let query3 = supabase
      .from('users')
      .select('*');
    
    // Filter by workspace_id if provided
    if (workspaceId) {
      query3 = query3.eq('workspace_id', workspaceId);
    }
    
    const { data: usersWithDept, error: deptError } = await query3.order('id', { ascending: true });
    
    if (deptError) {
      // Обработка Cloudflare ошибки
      const cloudflareError = parseCloudflareError(deptError.message);
      if (cloudflareError) {
        console.error(`❌ Users: ${cloudflareError}`);
        return c.json({ error: cloudflareError }, 503);
      }
      
      console.error(`❌ Supabase error fetching users:`, deptError);
      return c.json({ error: `Failed to fetch users: ${deptError.message.substring(0, 200)}` }, 500);
    }
    
    if (!usersWithDept || usersWithDept.length === 0) {
      console.log('⚠️ Таблица users пустая');
      return c.json([]);
    }

    console.log(`✓ Получено ${usersWithDept.length} пользователей (без department)`);
    console.log('📝 Первый пользователь из базы:', JSON.stringify(usersWithDept[0], null, 2));

    const resources = usersWithDept.map(user => {
      // Support both snake_case and camelCase column names
      const firstName = user.firstName || user.first_name || "";
      const lastName = user.lastName || user.last_name || "";
      const fullName = user.fullName || user.full_name || 
                      (firstName || lastName ? `${firstName} ${lastName}`.trim() : `User ${user.id}`);
      
      // Try to get department_id, fallback to a default
      const deptId = user.department_id || user.departmentId || 1;
      
      return {
        id: `r${user.id}`,
        firstName,
        lastName,
        fullName,
        position: user.position || "Employee",
        departmentId: `d${deptId}`,
        grade: user.grade_id ? String(user.grade_id) : (user.grade ? String(user.grade) : undefined),
        companyId: user.company_id ? String(user.company_id) : undefined
      };
    });
    
    // Check for empty names
    const emptyCount = resources.filter(r => r.fullName.startsWith('User ')).length;
    if (emptyCount > 0) {
      console.warn(`⚠️ ВНИМАНИЕ: ${emptyCount} из ${resources.length} сотрудников имеют пустые имена!`);
      console.warn('   📖 Выполните UPDATE запрос из QUICK_FIX_NAMES.md');
    }
    
    console.log('📝 Первый resource после мапинга:', JSON.stringify(resources[0], null, 2));
    console.log('✓ Возвращаем сотрудников (без department):', resources.length);
    return c.json(resources);
  } catch (error) {
    console.error(`❌ Exception fetching resources:`, error);
    return c.json({ error: `Failed to fetch resources: ${error.message || error}` }, 500);
  }
});

// ====================================================================================
// NOTE: Duplicate routes were removed from here (lines that were creating deployment errors)
// ====================================================================================

// ==================== BATCH POLLING ENDPOINT ====================

/**
 * Batch endpoint для оптимизации polling
 * Вместо 4 раздельных запросов (events, resources, departments, projects)
 * делаем 1 batch запрос → снижение network overhead на 75%
 * 
 * GET /batch?workspace_id=123
 * Returns: { events, resources, departments, projects }
 */
app.get("/make-server-73d66528/batch", async (c) => {
  try {
    const workspaceId = c.req.query('workspace_id');
    
    if (!workspaceId) {
      return c.json({ error: 'workspace_id is required' }, 400);
    }
    
    console.log(`🔄 BATCH POLLING для workspace ${workspaceId}`);
    const startTime = Date.now();
    
    // Загружаем ВСЕ данные параллельно
    const [eventsResult, resourcesResult, departmentsResult, projectsResult] = await Promise.all([
      // Events (с пагинацией)
      (async () => {
        const PAGE_SIZE = 1000;
        const allEvents: any[] = [];
        let currentPage = 0;
        let hasMore = true;
        
        while (hasMore) {
          const rangeStart = currentPage * PAGE_SIZE;
          const rangeEnd = rangeStart + PAGE_SIZE - 1;
          
          const { data: pageEvents, error } = await supabase
            .from('events')
            .select('*, event_patterns(name, pattern)')
            .eq('workspace_id', workspaceId)
            .order('id', { ascending: true })
            .range(rangeStart, rangeEnd);
          
          if (error) throw error;
          
          if (pageEvents && pageEvents.length > 0) {
            allEvents.push(...pageEvents);
          }
          
          hasMore = (pageEvents?.length || 0) === PAGE_SIZE;
          currentPage++;
          
          if (currentPage >= 100) break; // Защита
        }
        
        return allEvents;
      })(),
      
      // Resources
      supabase
        .from('users')
        .select('*, departments(id, name)')
        .eq('workspace_id', workspaceId)
        .order('id', { ascending: true }),
      
      // Departments
      supabase
        .from('departments')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('queue', { ascending: true }),
      
      // Projects
      supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('id', { ascending: true })
    ]);
    
    // Transform events
    const events = eventsResult.map((event: any) => ({
      id: `e${event.id}`,
      resourceId: `r${event.user_id}`,
      projectId: `p${event.project_id}`,
      startWeek: (event.start_week || 1) - 1,
      weeksSpan: event.weeks_span || 1,
      unitStart: event.unit_start || 0,
      unitsTall: event.units_tall || 1,
      patternId: event.pattern_id ? `ep${event.pattern_id}` : undefined,
      patternName: event.event_patterns?.name || undefined,
      patternValue: event.event_patterns?.pattern || undefined
    }));
    
    // Transform resources
    if (resourcesResult.error) throw resourcesResult.error;
    const resources = resourcesResult.data.map((user: any) => {
      const deptId = user.departments?.id || user.department_id || 0;
      const fullName = (user.first_name && user.last_name)
        ? `${user.first_name} ${user.last_name}`.trim()
        : (user.name || `User ${user.id}`);
      
      return {
        id: `r${user.id}`,
        fullName,
        position: user.position || "Employee",
        departmentId: `d${deptId}`,
        grade: user.grade_id ? String(user.grade_id) : (user.grade ? String(user.grade) : undefined),
        companyId: user.company_id ? String(user.company_id) : undefined
      };
    });
    
    // Transform departments
    if (departmentsResult.error) throw departmentsResult.error;
    const departments = departmentsResult.data.map((dept: any) => ({
      id: `d${dept.id}`,
      name: dept.name || `Department ${dept.id}`,
      queue: dept.queue ?? 0
    }));
    
    // Transform projects
    if (projectsResult.error) throw projectsResult.error;
    const projects = projectsResult.data.map((project: any) => ({
      id: `p${project.id}`,
      name: project.name || `Project ${project.id}`,
      backgroundColor: project.backgroundColor || '#3a87ad',
      textColor: project.textColor || '#ffffff'
    }));
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ BATCH POLLING завершён за ${duration}ms:`);
    console.log(`   📦 Events: ${events.length}`);
    console.log(`   👥 Resources: ${resources.length}`);
    console.log(`   🏢 Departments: ${departments.length}`);
    console.log(`   📊 Projects: ${projects.length}`);
    
    return c.json({
      events,
      resources,
      departments,
      projects,
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('❌ BATCH POLLING error:', error);
    return c.json({ error: `Batch polling failed: ${error.message}` }, 500);
  }
});

// ==================== EVENTS ENDPOINTS ====================

// Get all events
app.get("/make-server-73d66528/events", async (c) => {
  try {
    const workspaceId = c.req.query('workspace_id');
    console.log('📅 GET /events - запрос событий из таблицы events');
    console.log(`   Workspace ID: ${workspaceId || 'не указан (все воркспейсы)'}`);
    
    // ✅ PAGINATION: PostgREST возвращает максимум 1000 записей за запрос
    // Загружаем события порциями по 1000 до получения всех данных
    const PAGE_SIZE = 1000;
    const allEvents: any[] = [];
    let currentPage = 0;
    let hasMore = true;
    
    const startTime = Date.now();
    
    while (hasMore) {
      const rangeStart = currentPage * PAGE_SIZE;
      const rangeEnd = rangeStart + PAGE_SIZE - 1;
      
      console.log(`📦 Загрузка страницы ${currentPage + 1}: range(${rangeStart}, ${rangeEnd})...`);
      
      let query = supabase
        .from('events')
        .select('*, event_patterns(name, pattern)')
        .order('id', { ascending: true })
        .range(rangeStart, rangeEnd);
      
      // Filter by workspace_id if provided
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }
      
      const { data: pageEvents, error } = await query;
      
      if (error) {
        // Обработка Cloudflare ошибки
        const cloudflareError = parseCloudflareError(error.message);
        if (cloudflareError) {
          console.error(`❌ Events (page ${currentPage + 1}): ${cloudflareError}`);
          return c.json({ error: cloudflareError }, 503);
        }
        
        console.error(`❌ Supabase error fetching events (page ${currentPage + 1}):`, error);
        return c.json({ error: `Failed to fetch events: ${error.message.substring(0, 200)}` }, 500);
      }
      
      const pageCount = pageEvents?.length || 0;
      console.log(`   ✅ Страница ${currentPage + 1}: получено ${pageCount} событий`);
      
      if (pageEvents && pageEvents.length > 0) {
        allEvents.push(...pageEvents);
      }
      
      // Если получили меньше чем PAGE_SIZE - это последняя страница
      hasMore = pageCount === PAGE_SIZE;
      currentPage++;
      
      // Защита от бесконечного цикла (макс 100 страниц = 100,000 событий)
      if (currentPage >= 100) {
        console.warn(`⚠️ Достигнут лимит пагинации (100 страниц, ${allEvents.length} событий)`);
        break;
      }
    }
    
    const duration = Date.now() - startTime;
    const totalCount = allEvents.length;
    
    console.log(`✅ Загрузка завершена: ${totalCount} событий за ${currentPage} запросов (${duration}ms)`);
    
    if (totalCount === 0) {
      console.warn('⚠️ Ноль событий - возможно воркспейс пустой или неверный workspace_id');
    }
    
    if (!workspaceId) {
      console.warn('⚠️ workspace_id не указан - загружены события из ВСЕХ воркспейсов!');
    }
    
    console.log('📝 Первое событие из БД:', allEvents[0]);

    // Transform events to expected format
    // WORKAROUND: Database has constraint start_week >= 1, but frontend uses 0-51
    // So we subtract 1 when reading from DB to convert DB range (1-52) to frontend range (0-51)
    const transformedEvents = allEvents.map(event => ({
      id: `e${event.id}`,
      resourceId: `r${event.user_id}`,
      projectId: `p${event.project_id}`,
      startWeek: (event.start_week || 1) - 1, // DB: 1-52 → Frontend: 0-51
      weeksSpan: event.weeks_span || 1,
      unitStart: event.unit_start || 0,
      unitsTall: event.units_tall || 1,
      patternId: event.pattern_id ? `ep${event.pattern_id}` : undefined,
      patternName: event.event_patterns?.name || undefined,
      patternValue: event.event_patterns?.pattern || undefined
    }));
    
    console.log('📝 Первое событие после трансформации:', transformedEvents[0]);
    console.log(`✅ GET /events - возвращаем ${transformedEvents.length} событий (workspace: ${workspaceId || 'all'})`);
    
    // 📊 Статистика для отладки
    if (transformedEvents.length > 0) {
      const uniqueResources = new Set(transformedEvents.map(e => e.resourceId)).size;
      const uniqueProjects = new Set(transformedEvents.map(e => e.projectId)).size;
      console.log(`   📊 Уникальных сотрудников: ${uniqueResources}, проектов: ${uniqueProjects}`);
    }
    
    return c.json(transformedEvents);
  } catch (error) {
    console.error(`❌ Exception fetching events:`, error);
    return c.json({ error: `Failed to fetch events: ${error.message || error}` }, 500);
  }
});

// ✨ Get events changes (delta sync) - ТОЛЬКО изменённые события
// Query params: workspace_id, since (ISO timestamp)
app.get("/make-server-73d66528/events/changes", async (c) => {
  try {
    const workspaceId = c.req.query('workspace_id');
    const since = c.req.query('since'); // ISO timestamp (например: "2024-11-17T12:00:00Z")
    
    console.log('🔄 GET /events/changes - запрос изменённых событий');
    console.log(`   Workspace ID: ${workspaceId || 'не указан'}`);
    console.log(`   Since: ${since || 'не указан (все события)'}`);
    
    if (!workspaceId) {
      return c.json({ error: 'workspace_id is required' }, 400);
    }
    
    // Строим запрос
    let query = supabase
      .from('events')
      .select('*, event_patterns(name, pattern)')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false }) // Сортируем по дате обновления
      .limit(1000); // Максимум 1000 изменений за раз
    
    // Фильтруем по дате изменения если указан since
    if (since) {
      query = query.gt('updated_at', since);
    }
    
    const { data: events, error } = await query;
    
    if (error) {
      console.error('❌ Supabase error fetching event changes:', error);
      return c.json({ error: `Failed to fetch event changes: ${error.message}` }, 500);
    }
    
    const count = events?.length || 0;
    console.log(`✅ Найдено ${count} изменённых событий`);
    
    if (count === 0) {
      return c.json({ events: [], timestamp: new Date().toISOString() });
    }
    
    // Transform events to expected format
    const transformedEvents = events.map(event => ({
      id: `e${event.id}`,
      resourceId: `r${event.user_id}`,
      projectId: `p${event.project_id}`,
      startWeek: (event.start_week || 1) - 1,
      weeksSpan: event.weeks_span || 1,
      unitStart: event.unit_start || 0,
      unitsTall: event.units_tall || 1,
      patternId: event.pattern_id ? `ep${event.pattern_id}` : undefined,
      patternName: event.event_patterns?.name || undefined,
      patternValue: event.event_patterns?.pattern || undefined,
      updatedAt: event.updated_at // ✨ Возвращаем timestamp обновления!
    }));
    
    console.log(`✅ GET /events/changes - возвращаем ${transformedEvents.length} изменений`);
    
    return c.json({ 
      events: transformedEvents, 
      timestamp: new Date().toISOString() // Текущее время для следующего запроса
    });
  } catch (error) {
    console.error('❌ Exception fetching event changes:', error);
    return c.json({ error: `Failed to fetch event changes: ${error.message || error}` }, 500);
  }
});

// Get all event patterns
app.get("/make-server-73d66528/event-patterns", async (c) => {
  try {
    console.log('🎨 Запрос паттернов из таблицы event_patterns...');
    
    const { data: patterns, error } = await supabase
      .from('event_patterns')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) {
      console.error(`❌ Supabase error fetching event patterns:`, error);
      return c.json({ error: `Failed to fetch event patterns: ${error.message}` }, 500);
    }

    console.log(`✓ Получено ${patterns?.length || 0} паттернов`);

    // Transform patterns to expected format
    const transformedPatterns = patterns?.map(pattern => ({
      id: `ep${pattern.id}`,
      name: pattern.name || `Pattern ${pattern.id}`,
      pattern: pattern.pattern || ''
    })) || [];
    
    console.log('✓ Возвращаем паттерны:', transformedPatterns.length);
    return c.json(transformedPatterns);
  } catch (error) {
    console.error(`❌ Exception fetching event patterns:`, error);
    return c.json({ error: `Failed to fetch event patterns: ${error.message || error}` }, 500);
  }
});

// Create new event
app.post("/make-server-73d66528/events", async (c) => {
  try {
    console.log('➕ Создание нового события...');
    const body = await c.req.json();
    console.log('📝 Данные события:', body);
    
    // Extract numeric IDs (remove 'r' and 'p' prefixes)
    const userId = parseInt(body.resourceId.replace('r', ''));
    const projectId = parseInt(body.projectId.replace('p', ''));
    
    // Get workspace_id from user
    const { data: user } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', userId)
      .single();
    
    if (!user || !user.workspace_id) {
      console.error('❌ User not found or has no workspace_id:', userId);
      return c.json({ error: 'User not found or not associated with workspace' }, 400);
    }
    
    // Extract pattern ID if provided (remove 'ep' prefix)
    const patternId = body.patternId ? parseInt(body.patternId.replace('ep', '')) : null;
    
    // ✅ ВАЛИДАЦИЯ: weeks_span должен быть в диапазоне 1-52
    const startWeek = body.startWeek || 0; // Frontend: 0-51
    const maxWeeks = 52 - startWeek; // Максимум недель от startWeek до конца года
    let weeksSpan = body.weeksSpan || 1;
    
    // Валидируем и исправляем если нужно
    if (weeksSpan < 1 || weeksSpan > 52 || weeksSpan > maxWeeks) {
      const originalWeeksSpan = weeksSpan;
      weeksSpan = Math.max(1, Math.min(weeksSpan, maxWeeks));
      // Логируем только значительные отклонения (> 10 недель)
      if (Math.abs(originalWeeksSpan - weeksSpan) > 10) {
        console.error('⚠️ weeksSpan скорректирован', {
          original: originalWeeksSpan,
          corrected: weeksSpan,
          maxWeeks,
          startWeek,
          reason: 'Превышен диапазон или выходит за границы года'
        });
      } else {
        console.log(`📝 weeksSpan скорректирован: ${originalWeeksSpan} → ${weeksSpan}`);
      }
    }
    
    const eventData: any = {
      user_id: userId,
      project_id: projectId,
      // WORKAROUND: Database has constraint start_week >= 1, but frontend uses 0-51
      // So we add 1 when writing to DB to convert frontend range (0-51) to DB range (1-52)
      start_week: (body.startWeek || 0) + 1, // Frontend: 0-51 → DB: 1-52
      weeks_span: weeksSpan, // Already validated above
      unit_start: body.unitStart !== undefined ? body.unitStart : 0,
      units_tall: body.unitsTall !== undefined ? body.unitsTall : 1,
      pattern_id: patternId,
      workspace_id: user.workspace_id
    };
    
    console.log('📝 Данные для вставки:', eventData);
    
    const { data, error } = await supabase
      .from('events')
      .insert([eventData])
      .select('*, event_patterns(name, pattern)')
      .single();
    
    if (error) {
      console.error(`❌ Supabase error creating event:`, error);
      return c.json({ error: `Failed to create event: ${error.message}` }, 500);
    }
    
    console.log('✅ Событие создано:', data);
    
    // 🔄 Обновляем дату последнего изменения воркспейса
    await updateWorkspaceSummary(user.workspace_id, 'create event');
    
    // Transform back to frontend format
    const transformedEvent = {
      id: `e${data.id}`,
      resourceId: `r${data.user_id}`,
      projectId: `p${data.project_id}`,
      startWeek: (data.start_week || 1) - 1, // DB: 1-52 → Frontend: 0-51
      weeksSpan: data.weeks_span || 1,
      unitStart: data.unit_start || 0,
      unitsTall: data.units_tall || 1,
      patternId: data.pattern_id ? `ep${data.pattern_id}` : undefined,
      patternName: data.event_patterns?.name || undefined,
      patternValue: data.event_patterns?.pattern || undefined
    };
    
    return c.json(transformedEvent);
  } catch (error: any) {
    console.error(`❌ Exception creating event:`, error);
    return c.json({ error: `Failed to create event: ${error.message || error}` }, 500);
  }
});

// Batch create events (optimized for bulk generation)
app.post("/make-server-73d66528/events/batch-create", async (c) => {
  try {
    const body = await c.req.json();
    const events = body.events || [];
    
    console.log(`🚀 Массовое создание событий: ${events.length} шт.`);
    
    if (!Array.isArray(events) || events.length === 0) {
      return c.json({ error: 'events array is required' }, 400);
    }
    
    // Максимум 100 событий за раз (уменьшено со 200 для стабильности Edge Function)
    if (events.length > 100) {
      console.warn(`⚠️ Запрошено ${events.length} событий, но максимум 100 за раз`);
      return c.json({ error: 'Maximum 100 events per batch. Split into smaller batches.' }, 400);
    }
    
    // Получаем workspace_id из первого события
    const firstUserId = parseInt(events[0].resourceId.replace('r', ''));
    const { data: user } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', firstUserId)
      .single();
    
    if (!user || !user.workspace_id) {
      console.error('❌ User not found or has no workspace_id:', firstUserId);
      return c.json({ error: 'User not found or not associated with workspace' }, 400);
    }
    
    const workspaceId = user.workspace_id;
    
    // Преобразуем события для вставк��
    const eventsToInsert = events.map((event: any) => {
      const userId = parseInt(event.resourceId.replace('r', ''));
      const projectId = parseInt(event.projectId.replace('p', ''));
      const patternId = event.patternId ? parseInt(event.patternId.replace('ep', '')) : null;
      
      // Валидация weeks_span
      const startWeek = event.startWeek || 0;
      const maxWeeks = 52 - startWeek;
      let weeksSpan = event.weeksSpan || 1;
      
      if (weeksSpan < 1 || weeksSpan > 52 || weeksSpan > maxWeeks) {
        weeksSpan = Math.max(1, Math.min(weeksSpan, maxWeeks));
      }
      
      return {
        user_id: userId,
        project_id: projectId,
        start_week: (event.startWeek || 0) + 1, // Frontend: 0-51 → DB: 1-52
        weeks_span: weeksSpan,
        unit_start: event.unitStart !== undefined ? event.unitStart : 0,
        units_tall: event.unitsTall !== undefined ? event.unitsTall : 1,
        pattern_id: patternId,
        workspace_id: workspaceId
      };
    });
    
    console.log(`📝 Вставка ${eventsToInsert.length} событий в БД...`);
    console.log(`   Workspace ID: ${workspaceId}`);
    console.log(`   Первое событие: user_id=${eventsToInsert[0]?.user_id}, project_id=${eventsToInsert[0]?.project_id}, start_week=${eventsToInsert[0]?.start_week}, weeks_span=${eventsToInsert[0]?.weeks_span}`);
    
    // Вставляем все события за один запрос
    const insertStartTime = Date.now();
    const { data, error } = await supabase
      .from('events')
      .insert(eventsToInsert)
      .select('*, event_patterns(name, pattern)');
    
    const insertDuration = Date.now() - insertStartTime;
    console.log(`⏱️ Batch insert завершен за ${insertDuration}ms`);
    
    if (error) {
      console.error(`❌ Supabase error creating batch:`, error);
      console.error(`   Error details:`, JSON.stringify(error, null, 2));
      console.error(`   Attempted to insert ${eventsToInsert.length} events`);
      console.error(`   Duration: ${insertDuration}ms`);
      return c.json({ error: `Failed to create events: ${error.message}` }, 500);
    }
    
    const createdCount = data?.length || 0;
    console.log(`✅ Создано ${createdCount} событий за ${insertDuration}ms (avg ${(insertDuration/createdCount).toFixed(1)}ms/event)`);
    
    // ⚠️ ПРОВЕРКА: убеждаемся что все события созданы
    if (createdCount !== eventsToInsert.length) {
      const missing = eventsToInsert.length - createdCount;
      console.error(`❌ КРИТИЧНО: Запрошено создать ${eventsToInsert.length} событий, но создано только ${createdCount}!`);
      console.error(`   ❌ ПОТЕРЯНО: ${missing} событий (${(missing/eventsToInsert.length*100).toFixed(1)}%)`);
      console.error(`   Возможные причины:`);
      console.error(`   1. Constraint violations (дубликаты, невалидные foreign keys)`);
      console.error(`   2. Ошибки валидации (weeks_span, start_week вне диапазона)`);
      console.error(`   3. Ограничения БД (max rows, storage limits)`);
      console.error(`   4. Несуществующие user_id или project_id`);
      console.error(`   Проверьте логи Supabase Dashboard для деталей`);
    } else {
      console.log(`✅ Все ${createdCount} событий успешно созданы (100% success rate)`);
    }
    
    // Обновляем дату последнего изменения воркспейса
    await updateWorkspaceSummary(workspaceId, `batch create ${data?.length || 0} events`);
    
    // Преобразуем обратно в frontend формат
    const transformedEvents = (data || []).map((event: any) => ({
      id: `e${event.id}`,
      resourceId: `r${event.user_id}`,
      projectId: `p${event.project_id}`,
      startWeek: (event.start_week || 1) - 1, // DB: 1-52 → Frontend: 0-51
      weeksSpan: event.weeks_span || 1,
      unitStart: event.unit_start || 0,
      unitsTall: event.units_tall || 1,
      patternId: event.pattern_id ? `ep${event.pattern_id}` : undefined,
      patternName: event.event_patterns?.name || undefined,
      patternValue: event.event_patterns?.pattern || undefined
    }));
    
    return c.json({ 
      created: transformedEvents.length,
      events: transformedEvents 
    });
  } catch (error: any) {
    console.error(`❌ Exception creating batch:`, error);
    return c.json({ error: `Failed to create events: ${error.message || error}` }, 500);
  }
});

// Update event
app.put("/make-server-73d66528/events/:id", async (c) => {
  try {
    const eventId = c.req.param('id');
    console.log('✏️ Обновление ��обытия:', eventId);
    
    const body = await c.req.json();
    console.log('📝 Новые данные события:', body);
    
    // Extract numeric ID (remove 'e' prefix if present)
    const numericId = parseInt(eventId.replace('e', ''));
    
    // PARTIAL UPDATE: only update fields that are provided
    const eventData: any = {};
    
    // Extract numeric IDs from body (only if provided)
    if (body.resourceId !== undefined) {
      eventData.user_id = parseInt(body.resourceId.replace('r', ''));
    }
    
    if (body.projectId !== undefined) {
      eventData.project_id = parseInt(body.projectId.replace('p', ''));
    }
    
    // Extract pattern ID if provided (remove 'ep' prefix)
    if (body.patternId !== undefined) {
      eventData.pattern_id = body.patternId ? parseInt(body.patternId.replace('ep', '')) : null;
    }
    
    // Start week (only if provided)
    if (body.startWeek !== undefined) {
      // WORKAROUND: Database has constraint start_week >= 1, but frontend uses 0-51
      // So we add 1 when writing to DB to convert frontend range (0-51) to DB range (1-52)
      eventData.start_week = body.startWeek + 1; // Frontend: 0-51 -> DB: 1-52
    }
    
    // Weeks span (only if provided)
    if (body.weeksSpan !== undefined) {
      // VALIDATION: weeks_span must be in range 1-52
      // For validation we need startWeek - if not provided, get from DB
      let startWeek = 0;
      if (body.startWeek !== undefined) {
        startWeek = body.startWeek; // Frontend: 0-51
      } else {
        // Get current value from DB for validation
        const { data: currentEvent } = await supabase
          .from('events')
          .select('start_week')
          .eq('id', numericId)
          .single();
        
        if (currentEvent) {
          startWeek = currentEvent.start_week - 1; // DB: 1-52 -> Frontend: 0-51
        }
      }
      
      const maxWeeks = 52 - startWeek; // Maximum weeks from startWeek to end of year
      let weeksSpan = body.weeksSpan;
      
      // Validate and fix if needed
      if (weeksSpan < 1 || weeksSpan > 52 || weeksSpan > maxWeeks) {
        const originalWeeksSpan = weeksSpan;
        weeksSpan = Math.max(1, Math.min(weeksSpan, maxWeeks));
        // Log only significant deviations (> 10 weeks)
        if (Math.abs(originalWeeksSpan - weeksSpan) > 10) {
          console.warn(`weeks_span significantly corrected (update): ${originalWeeksSpan} -> ${weeksSpan} (max: ${maxWeeks})`);
        }
      }
      
      eventData.weeks_span = weeksSpan;
    }
    
    // Unit start (only if provided)
    if (body.unitStart !== undefined) {
      eventData.unit_start = body.unitStart;
    }
    
    // Units tall (only if provided)
    if (body.unitsTall !== undefined) {
      eventData.units_tall = body.unitsTall;
    }
    
    console.log('Data for update (only changed fields):', eventData);
    
    const { data, error } = await supabase
      .from('events')
      .update(eventData)
      .eq('id', numericId)
      .select('*, event_patterns(name, pattern)');
    
    if (error) {
      console.error(`❌ Supabase error updating event:`, error);
      return c.json({ error: `Failed to update event: ${error.message}` }, 500);
    }
    
    // Check if event was found and updated
    if (!data || data.length === 0) {
      console.error(`⚠️ Событие с ID ${numericId} не найдено в базе данных`);
      return c.json({ error: `Event not found: ${eventId}` }, 404);
    }
    
    console.log('✅ Событие обновлено:', data[0]);
    
    // 🔄 Обновляем дату последнего изменения воркспейса
    if (data[0].workspace_id) {
      await updateWorkspaceSummary(data[0].workspace_id, 'update event');
    }
    
    // Transform back to frontend format
    // WORKAROUND: Convert DB range (1-52) back to frontend range (0-51)
    const transformedEvent = {
      id: `e${data[0].id}`,
      resourceId: `r${data[0].user_id}`,
      projectId: `p${data[0].project_id}`,
      startWeek: data[0].start_week - 1, // DB: 1-52 → Frontend: 0-51
      weeksSpan: data[0].weeks_span,
      unitStart: data[0].unit_start,
      unitsTall: data[0].units_tall,
      patternId: data[0].pattern_id ? `ep${data[0].pattern_id}` : undefined,
      patternName: data[0].event_patterns?.name || undefined,
      patternValue: data[0].event_patterns?.pattern || undefined
    };
    
    return c.json(transformedEvent);
  } catch (error) {
    console.error(`❌ Exception updating event:`, error);
    return c.json({ error: `Failed to update event: ${error.message || error}` }, 500);
  }
});

// Delete event
app.delete("/make-server-73d66528/events/:id", async (c) => {
  try {
    const eventId = c.req.param('id');
    console.log('🗑️ Удаление события:', eventId);
    
    // ✅ Проверяем что это не временное событие
    if (eventId.startsWith('ev_temp_')) {
      console.warn('⚠️ Попытка удалить временн��е событие через API:', eventId);
      return c.json({ error: 'Cannot delete temporary events via API' }, 400);
    }
    
    // Extract numeric ID (remove 'e' prefix if present)
    const numericId = parseInt(eventId.replace(/^e/, ''));
    
    // ✅ Проверяем что ID валидный
    if (isNaN(numericId)) {
      console.error(`❌ Невалидный ID события: ${eventId} → ${numericId}`);
      return c.json({ error: `Invalid event ID: ${eventId}` }, 400);
    }
    
    console.log(`📝 Удаляем событие с ID: ${numericId}`);
    
    // Получаем workspace_id перед удалением для обновления summary
    const { data: eventData } = await supabase
      .from('events')
      .select('workspace_id')
      .eq('id', numericId)
      .single();
    
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', numericId);
    
    if (error) {
      console.error(`❌ Supabase error deleting event:`, error);
      return c.json({ error: `Failed to delete event: ${error.message}` }, 500);
    }
    
    console.log('✅ Событие удалено:', eventId);
    
    // 🔄 Обновляем дату последнего изменения воркспейса
    if (eventData?.workspace_id) {
      await updateWorkspaceSummary(eventData.workspace_id, 'delete event');
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error(`❌ Exception deleting event:`, error);
    return c.json({ error: `Failed to delete event: ${error.message || error}` }, 500);
  }
});

// 🚀 BATCH API - пакетные операции с событиями
app.post("/make-server-73d66528/events/batch", async (c) => {
  try {
    console.log('📦 BATCH: начало пакетной операции...');
    const body = await c.req.json();
    console.log('📦 BATCH: получено тело запроса:', JSON.stringify(body, null, 2));
    
    const { operations } = body; // [{ op: 'create'|'update'|'delete', data: {...} }]
    
    if (!operations || !Array.isArray(operations)) {
      console.error('❌ BATCH: невалидный запрос:', { operations, isArray: Array.isArray(operations) });
      return c.json({ error: 'Invalid batch request: operations array required' }, 400);
    }
    
    console.log(`📦 BATCH: получено операций: ${operations.length}`);
    
    const results = {
      created: [],
      updated: [],
      deleted: [],
      errors: []
    };
    
    // Группируем операции по типу для оптимизации
    const creates = operations.filter(op => op.op === 'create');
    const updates = operations.filter(op => op.op === 'update');
    const deletes = operations.filter(op => op.op === 'delete');
    
    console.log(`📦 BATCH: create=${creates.length}, update=${updates.length}, delete=${deletes.length}`);
    
    // 1️⃣ УДАЛЕНИЕ (сначала, чтобы освободить место)
    for (const op of deletes) {
      try {
        const eventId = op.id;
        if (eventId.startsWith('ev_temp_')) {
          console.log(`⏭️ BATCH: пропуск временного события ${eventId}`);
          continue;
        }
        
        const numericId = parseInt(eventId.replace(/^e/, ''));
        if (isNaN(numericId)) {
          results.errors.push({ op: 'delete', id: eventId, error: 'Invalid ID' });
          continue;
        }
        
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', numericId);
        
        if (error) {
          console.error(`❌ BATCH delete error:`, error);
          results.errors.push({ op: 'delete', id: eventId, error: error.message });
        } else {
          results.deleted.push(eventId);
        }
      } catch (error) {
        results.errors.push({ op: 'delete', id: op.id, error: error.message });
      }
    }
    
    // 2️⃣ СОЗДАНИЕ (пакетом через .upsert() для поддержки восстановления с существующими ID)
    if (creates.length > 0) {
      try {
        const eventsToCreate = creates.map(op => {
          const body = op.data;
          const userId = parseInt(body.resourceId.replace('r', ''));
          const projectId = parseInt(body.projectId.replace('p', ''));
          const patternId = body.patternId ? parseInt(body.patternId.replace('ep', '')) : null;
          
          const startWeek = body.startWeek || 0;
          const maxWeeks = 52 - startWeek;
          let weeksSpan = body.weeksSpan || 1;
          weeksSpan = Math.max(1, Math.min(weeksSpan, maxWeeks));
          
          // ✅ Поддержка восстановления с существующим ID (для Undo/Redo)
          const eventData: any = {
            user_id: userId,
            project_id: projectId,
            start_week: startWeek + 1, // Frontend: 0-51 → DB: 1-52
            weeks_span: weeksSpan,
            unit_start: body.unitStart !== undefined ? body.unitStart : 0,
            units_tall: body.unitsTall !== undefined ? body.unitsTall : 1,
            pattern_id: patternId,
            workspace_id: op.workspace_id // Должен быть передан в операции
          };
          
          // Если передан ID (для Undo/Redo), добавляем его
          if (body.id) {
            const numericId = parseInt(body.id.replace('e', ''));
            if (!isNaN(numericId)) {
              eventData.id = numericId;
              console.log(`📝 BATCH create: используем существующий ID ${body.id} (${numericId})`);
            }
          }
          
          return eventData;
        });
        
        // ✅ Разделяем на события с ID (восстановление) и без ID (новые)
        // Это критично, так как Supabase/PostgREST может неправильно обработать смешанный массив,
        // пытаясь вставить NULL в ID column для новых событий
        const eventsWithId = eventsToCreate.filter((e: any) => e.id !== undefined);
        const eventsNew = eventsToCreate.filter((e: any) => e.id === undefined);
        
        console.log(`📦 BATCH create split: ${eventsWithId.length} with ID, ${eventsNew.length} new`);
        
        // 2.1 Восстановление событий с ID (UPSERT)
        if (eventsWithId.length > 0) {
          const { data, error } = await supabase
            .from('events')
            .upsert(eventsWithId, { onConflict: 'id' })
            .select('*, event_patterns(name, pattern)');
            
          if (error) {
            console.error(`❌ BATCH upsert (restore) error:`, error);
            results.errors.push({ op: 'create', error: error.message });
          } else if (data) {
            const transformed = data.map(ev => ({
              id: `e${ev.id}`,
              resourceId: `r${ev.user_id}`,
              projectId: `p${ev.project_id}`,
              startWeek: (ev.start_week || 1) - 1,
              weeksSpan: ev.weeks_span || 1,
              unitStart: ev.unit_start || 0,
              unitsTall: ev.units_tall || 1,
              patternId: ev.pattern_id ? `ep${ev.pattern_id}` : undefined,
              patternName: ev.event_patterns?.name,
              pattern: ev.event_patterns?.pattern
            }));
            results.created.push(...transformed);
          }
        }
        
        // 2.2 Создание новых событий (INSERT)
        if (eventsNew.length > 0) {
          const { data, error } = await supabase
            .from('events')
            .insert(eventsNew)
            .select('*, event_patterns(name, pattern)');
            
          if (error) {
            console.error(`❌ BATCH insert (new) error:`, error);
            results.errors.push({ op: 'create', error: error.message });
          } else if (data) {
            const transformed = data.map(ev => ({
              id: `e${ev.id}`,
              resourceId: `r${ev.user_id}`,
              projectId: `p${ev.project_id}`,
              startWeek: (ev.start_week || 1) - 1,
              weeksSpan: ev.weeks_span || 1,
              unitStart: ev.unit_start || 0,
              unitsTall: ev.units_tall || 1,
              patternId: ev.pattern_id ? `ep${ev.pattern_id}` : undefined,
              patternName: ev.event_patterns?.name,
              pattern: ev.event_patterns?.pattern
            }));
            results.created.push(...transformed);
          }
        }
        
        console.log(`✅ BATCH create total: создано/восстановлено ${results.created.length} событий`);
      } catch (error) {
        console.error(`❌ BATCH create exception:`, error);
        results.errors.push({ op: 'create', error: error.message });
      }
    }
    
    // 3️⃣ ОБНОВЛЕНИЕ (параллельно через Promise.all)
    if (updates.length > 0) {
      console.log(`🔄 BATCH: начало обновления ${updates.length} событий:`, updates.map(u => u.id).join(', '));
      
      const updatePromises = updates.map(async (op) => {
        try {
          const eventId = op.id;
          const numericId = parseInt(eventId.replace(/^e/, ''));
          
          if (isNaN(numericId)) {
            return { error: { id: eventId, message: 'Invalid ID' } };
          }
          
          const body = op.data;
          const updateData: any = {};
          
          if (body.resourceId !== undefined) {
            updateData.user_id = parseInt(body.resourceId.replace('r', ''));
          }
          if (body.projectId !== undefined) {
            updateData.project_id = parseInt(body.projectId.replace('p', ''));
          }
          if (body.startWeek !== undefined) {
            updateData.start_week = body.startWeek + 1; // Frontend: 0-51 → DB: 1-52
          }
          if (body.weeksSpan !== undefined) {
            const startWeek = body.startWeek !== undefined ? body.startWeek : 0;
            const maxWeeks = 52 - startWeek;
            updateData.weeks_span = Math.max(1, Math.min(body.weeksSpan, maxWeeks));
          }
          if (body.unitStart !== undefined) {
            updateData.unit_start = body.unitStart;
          }
          if (body.unitsTall !== undefined) {
            updateData.units_tall = body.unitsTall;
          }
          if (body.patternId !== undefined) {
            updateData.pattern_id = body.patternId ? parseInt(body.patternId.replace('ep', '')) : null;
          }
          
          const { data, error } = await supabase
            .from('events')
            .update(updateData)
            .eq('id', numericId)
            .select('*, event_patterns(name, pattern)')
            .maybeSingle();
          
          if (error) {
            console.error(`❌ BATCH update error для ${eventId}:`, error.message);
            return { error: { id: eventId, message: error.message } };
          }
          
          if (!data) {
            console.warn(`⚠️ BATCH update: событие ${eventId} не найдено в БД (будет удалено из локального состояния)`);
            return { error: { id: eventId, message: 'Event not found' } };
          }
          
          return {
            success: {
              id: `e${data.id}`,
              resourceId: `r${data.user_id}`,
              projectId: `p${data.project_id}`,
              startWeek: (data.start_week || 1) - 1,
              weeksSpan: data.weeks_span || 1,
              unitStart: data.unit_start || 0,
              unitsTall: data.units_tall || 1,
              patternId: data.pattern_id ? `ep${data.pattern_id}` : undefined,
              patternName: data.event_patterns?.name,
              pattern: data.event_patterns?.pattern
            }
          };
        } catch (error) {
          return { error: { id: op.id, message: error.message } };
        }
      });
      
      const updateResults = await Promise.all(updatePromises);
      
      updateResults.forEach(result => {
        if (result.error) {
          results.errors.push({ op: 'update', ...result.error });
        } else if (result.success) {
          results.updated.push(result.success);
        }
      });
    }
    
    console.log(`✅ BATCH: завершено. Создано: ${results.created.length}, обновлено: ${results.updated.length}, удалено: ${results.deleted.length}, ошибок: ${results.errors.length}`);
    
    // Обновляем workspace summary (берём workspace_id из первой операции)
    const workspaceId = operations[0]?.workspace_id;
    if (workspaceId) {
      await updateWorkspaceSummary(workspaceId, `batch: ${operations.length} ops`);
    }
    
    return c.json(results);
  } catch (error) {
    console.error(`❌ BATCH exception:`, error);
    return c.json({ error: `Batch operation failed: ${error.message || error}` }, 500);
  }
});

// 🧪 Clear all events in workspace (для тестирования)
app.delete("/make-server-73d66528/events/clear/:workspaceId", async (c) => {
  try {
    const workspaceId = c.req.param('workspaceId');
    console.log('🗑️ Очистка всех событий в воркспейсе:', workspaceId);
    
    // ✅ Проверяем авторизацию
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (!user || authError) {
      console.error('❌ Unauthorized access to clear events');
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Сначала подсчитываем количество событий
    const { count } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);
    
    console.log(`📊 Найдено событий для удаления: ${count || 0}`);
    
    if (!count || count === 0) {
      console.log('ℹ️ Нет событий для удаления');
      return c.json({ success: true, deleted: 0 });
    }
    
    // Удаляем все события в воркспейсе
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('workspace_id', workspaceId);
    
    if (error) {
      console.error(`❌ Supabase error clearing events:`, error);
      return c.json({ error: `Failed to clear events: ${error.message}` }, 500);
    }
    
    console.log(`✅ Удалено событий: ${count}`);
    
    // 🔄 Обновляем дату последнего изменения воркспейса
    await updateWorkspaceSummary(parseInt(workspaceId), 'clear all events');
    
    return c.json({ success: true, deleted: count });
  } catch (error) {
    console.error(`❌ Exception clearing events:`, error);
    return c.json({ error: `Failed to clear events: ${error.message || error}` }, 500);
  }
});

// ==================== PROJECTS ENDPOINTS ====================

// Get all projects
app.get("/make-server-73d66528/projects", async (c) => {
  try {
    const workspaceId = c.req.query('workspace_id');
    console.log('📁 Запрос проектов для workspace:', workspaceId || 'все');
    
    let query = supabase.from('projects').select('*, event_patterns(name, pattern)');
    
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }
    
    const { data, error } = await query.order('id', { ascending: false });
    
    if (error) {
      // Обработка Cloudflare ошибки
      const cloudflareError = parseCloudflareError(error.message);
      if (cloudflareError) {
        console.error(`❌ Projects: ${cloudflareError}`);
        return c.json({ error: cloudflareError }, 503); // 503 Service Unavailable
      }
      
      console.error(`❌ Supabase error fetching projects:`, error);
      return c.json({ error: `Failed to fetch projects: ${error.message.substring(0, 200)}` }, 500);
    }
    
    console.log(`✅ Получено ${data?.length || 0} проектов`);
    
    // Transform to frontend format
    const projects = (data || []).map(p => ({
      id: `p${p.id}`,
      name: p.name,
      backgroundColor: p.backgroundColor || undefined,
      textColor: p.textColor || undefined,
      patternId: p.pattern_id ? `ep${p.pattern_id}` : undefined,
      patternName: p.event_patterns?.name || undefined,
      patternValue: p.event_patterns?.pattern || undefined
    }));
    
    return c.json(projects);
  } catch (error: any) {
    console.error(`❌ Exception fetching projects:`, error);
    return c.json({ error: `Failed to fetch projects: ${error.message || error}` }, 500);
  }
});

// Create new project
app.post("/make-server-73d66528/projects", async (c) => {
  try {
    console.log('➕ Создание нового проекта...');
    
    const body = await c.req.json();
    console.log('📝 Данные проекта:', body);
    
    // Validate workspace_id
    if (!body.workspace_id) {
      console.error('❌ workspace_id отсутствует в запросе');
      return c.json({ error: 'workspace_id is required' }, 400);
    }
    
    // Extract pattern ID if provided (remove 'ep' prefix)
    const patternId = body.patternId ? parseInt(body.patternId.replace('ep', '')) : null;
    
    const projectData: any = {
      name: body.name,
      workspace_id: body.workspace_id,
      backgroundColor: body.backgroundColor || null,
      textColor: body.textColor || null,
      pattern_id: patternId
    };
    
    console.log('📝 Данные для вставки:', projectData);
    
    const { data, error } = await supabase
      .from('projects')
      .insert([projectData])
      .select('*, event_patterns(name, pattern)')
      .single();
    
    if (error) {
      console.error(`❌ Supabase error creating project:`, error);
      return c.json({ error: `Failed to create project: ${error.message}` }, 500);
    }
    
    console.log('✅ Проект создан:', data);
    
    // 🔄 Обновляем дату последнего изменения воркспейса
    await updateWorkspaceSummary(body.workspace_id, 'create project');
    
    // Transform to frontend format
    const project = {
      id: `p${data.id}`,
      name: data.name,
      backgroundColor: data.backgroundColor || undefined,
      textColor: data.textColor || undefined,
      patternId: data.pattern_id ? `ep${data.pattern_id}` : undefined,
      patternName: data.event_patterns?.name || undefined,
      patternValue: data.event_patterns?.pattern || undefined
    };
    
    return c.json(project);
  } catch (error: any) {
    console.error(`❌ Exception creating project:`, error);
    return c.json({ error: `Failed to create project: ${error.message || error}` }, 500);
  }
});

// Update project
app.put("/make-server-73d66528/projects/:id", async (c) => {
  try {
    const projectId = c.req.param('id');
    console.log('✏️ Обновление проекта:', projectId);
    
    const body = await c.req.json();
    console.log('📝 Новые данные ��роекта:', body);
    
    // Extract numeric ID (remove 'p' prefix if present)
    const numericId = parseInt(projectId.replace('p', ''));
    
    // Extract pattern ID if provided (remove 'ep' prefix)
    const patternId = body.patternId !== undefined 
      ? (body.patternId ? parseInt(body.patternId.replace('ep', '')) : null)
      : undefined;
    
    const projectData: any = {};
    if (body.name !== undefined) projectData.name = body.name;
    if (body.backgroundColor !== undefined) projectData.backgroundColor = body.backgroundColor;
    if (body.textColor !== undefined) projectData.textColor = body.textColor;
    if (patternId !== undefined) projectData.pattern_id = patternId;
    
    console.log('📝 Данные для обновления:', projectData);
    
    const { data, error } = await supabase
      .from('projects')
      .update(projectData)
      .eq('id', numericId)
      .select('*, event_patterns(name, pattern)');
    
    if (error) {
      console.error(`❌ Supabase error updating project:`, error);
      return c.json({ error: `Failed to update project: ${error.message}` }, 500);
    }
    
    // Check if project was found and updated
    if (!data || data.length === 0) {
      console.error(`⚠️ Проект с ID ${numericId} не найден в базе данных`);
      return c.json({ error: `Project not found: ${projectId}` }, 404);
    }
    
    console.log('✅ Проект обновлен:', data[0]);
    
    // 🔄 Обновляем дату последнего изменения воркспейса
    if (data[0].workspace_id) {
      await updateWorkspaceSummary(data[0].workspace_id, 'update project');
    }
    
    // Transform to frontend format
    const project = {
      id: `p${data[0].id}`,
      name: data[0].name,
      backgroundColor: data[0].backgroundColor || undefined,
      textColor: data[0].textColor || undefined,
      patternId: data[0].pattern_id ? `ep${data[0].pattern_id}` : undefined,
      patternName: data[0].event_patterns?.name || undefined,
      patternValue: data[0].event_patterns?.pattern || undefined
    };
    
    return c.json(project);
  } catch (error: any) {
    console.error(`❌ Exception updating project:`, error);
    return c.json({ error: `Failed to update project: ${error.message || error}` }, 500);
  }
});

// Delete project
app.delete("/make-server-73d66528/projects/:id", async (c) => {
  try {
    const projectId = c.req.param('id');
    console.log('🗑️ Удаление проекта:', projectId);
    
    // Extract numeric ID (remove 'p' prefix if present)
    const numericId = parseInt(projectId.replace('p', ''));
    
    console.log(`📝 Удаляем проект с ID: ${numericId}`);
    
    // По��учаем workspace_id перед удалением для обновления summary
    const { data: projectData } = await supabase
      .from('projects')
      .select('workspace_id')
      .eq('id', numericId)
      .single();
    
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', numericId);
    
    if (error) {
      console.error(`❌ Supabase error deleting project:`, error);
      return c.json({ error: `Failed to delete project: ${error.message}` }, 500);
    }
    
    console.log('✅ Проект удален:', projectId);
    
    // 🔄 Обновляем дату последнего изменения воркспейса
    if (projectData?.workspace_id) {
      await updateWorkspaceSummary(projectData.workspace_id, 'delete project');
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error(`❌ Exception deleting project:`, error);
    return c.json({ error: `Failed to delete project: ${error.message || error}` }, 500);
  }
});

// ==================== RESOURCES ENDPOINTS ====================

// Create new user
app.post("/make-server-73d66528/resources", async (c) => {
  try {
    console.log('➕ Создание нового пользователя...');
    
    const body = await c.req.json();
    console.log('📝 Данные пользователя:', body);
    
    // Validate workspace_id
    if (!body.workspace_id) {
      console.error('❌ workspace_id отсутствует в запросе');
      return c.json({ error: 'workspace_id is required' }, 400);
    }
    
    // Extract numeric department ID (remove 'd' prefix)
    const departmentId = parseInt(body.departmentId.replace('d', ''));
    
    // First, get one existing user to determine table structure
    const { data: sampleUsers } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    console.log('📋 Структура таблицы users (sample):', sampleUsers?.[0]);
    
    let userData: any = {
      workspace_id: body.workspace_id,
      position: body.position,
      department_id: departmentId
    };
    
    // Add grade_id if provided (convert to number if possible, allow null)
    if (body.grade) {
      const gradeNum = parseInt(body.grade);
      userData.grade_id = isNaN(gradeNum) ? body.grade : gradeNum;
    }
    
    // Add company_id (default to 1 if not provided since column is NOT NULL)
    if (body.companyId) {
      const companyNum = parseInt(body.companyId);
      userData.company_id = isNaN(companyNum) ? 1 : companyNum;
    } else {
      userData.company_id = 1; // Default to company 1
    }
    
    // Determine which column names to use based on existing data
    if (sampleUsers && sampleUsers.length > 0) {
      const allKeys = Object.keys(sampleUsers[0]);
      console.log('📋 Вс�� колонки таблицы users:', allKeys);
      
      // Check each possible name column (both camelCase and snake_case)
      if (allKeys.includes('fullName')) {
        console.log('✅ Используем fullName (camelCase)');
        userData.fullName = body.fullName;
      } else if (allKeys.includes('full_name')) {
        console.log('✅ Используем full_name (snake_case)');
        userData.full_name = body.fullName;
      } else if (allKeys.includes('firstName') && allKeys.includes('lastName')) {
        console.log('✅ Используем firstName и lastName (camelCase)');
        const [firstName, ...lastNameParts] = body.fullName.split(' ');
        userData.firstName = firstName || body.fullName;
        userData.lastName = lastNameParts.join(' ') || '';
      } else if (allKeys.includes('first_name') && allKeys.includes('last_name')) {
        console.log('✅ Используем first_name и last_name (snake_case)');
        const [firstName, ...lastNameParts] = body.fullName.split(' ');
        userData.first_name = firstName || body.fullName;
        userData.last_name = lastNameParts.join(' ') || '';
      } else if (allKeys.includes('name')) {
        console.log('✅ Используем name');
        userData.name = body.fullName;
      } else {
        console.warn('⚠️ Не найдена колонка для имени. Доступные колонки:', allKeys);
        console.warn('⚠️ Создаем пользователя только с position и department_id');
      }
    } else {
      console.warn('⚠️ Нет существующих пользователей для определения структуры');
      console.warn('⚠��� Создаем пользователя только с position и department_id');
    }
    
    console.log('📝 Финальные данные для вставки:', userData);
    
    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();
    
    if (error) {
      console.error(`❌ Supabase error creating user:`, error);
      console.error('❌ Полная информация об ошибке:', JSON.stringify(error, null, 2));
      console.error('❌ Пытались вставить данные:', JSON.stringify(userData, null, 2));
      return c.json({ error: `Failed to create user: ${error.message}` }, 500);
    }
    
    console.log('✅ Пользователь создан:', data);
    
    // 🔄 Обновляем дату последнего изменения воркспейса
    await updateWorkspaceSummary(body.workspace_id, 'create resource');
    console.log('✅ Все по��я созданного пользователя:', Object.keys(data));
    
    // Transform back to frontend format (support all naming conventions - both camelCase and snake_case)
    const fullName = data.fullName || data.full_name || data.name || 
                    (data.firstName || data.lastName ? `${data.firstName || ''} ${data.lastName || ''}`.trim() : '') ||
                    (data.first_name || data.last_name ? `${data.first_name || ''} ${data.last_name || ''}`.trim() : '') ||
                    `User ${data.id}`;
    
    const transformedUser = {
      id: `r${data.id}`,
      fullName,
      position: data.position,
      departmentId: `d${data.department_id}`,
      grade: data.grade_id ? String(data.grade_id) : (data.grade ? String(data.grade) : undefined),
      companyId: data.company_id ? String(data.company_id) : undefined
    };
    
    return c.json(transformedUser);
  } catch (error) {
    console.error(`❌ Exception creating user:`, error);
    return c.json({ error: `Failed to create user: ${error.message || error}` }, 500);
  }
});

// Update user
app.put("/make-server-73d66528/resources/:id", async (c) => {
  try {
    const userId = c.req.param('id');
    console.log('✏️ Обновление пользователя:', userId);
    
    const body = await c.req.json();
    console.log('📝 Новые данные пользователя:', body);
    
    // Extract numeric ID (remove 'r' prefix if present)
    const numericId = parseInt(userId.replace('r', ''));
    
    // Extract numeric department ID
    const departmentId = parseInt(body.departmentId.replace('d', ''));
    
    // First, get the existing user to determine table structure
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', numericId)
      .single();
    
    console.log('📋 Существующий пользователь (все поля):', existingUser);
    console.log('📋 Ключи существующего пользователя:', existingUser ? Object.keys(existingUser) : []);
    
    if (!existingUser) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    // Build update object with only safe fields
    let userData: any = {
      position: body.position,
      department_id: departmentId
    };
    
    // Add grade_id if provided (including empty string to allow clearing)
    if (body.grade !== undefined) {
      if (body.grade === '' || body.grade === null) {
        userData.grade_id = null;
      } else {
        const gradeNum = parseInt(body.grade);
        userData.grade_id = isNaN(gradeNum) ? body.grade : gradeNum;
      }
    }
    
    // Add company_id if provided (default to 1 if empty since column is NOT NULL)
    if (body.companyId !== undefined) {
      if (body.companyId === '' || body.companyId === null) {
        userData.company_id = 1; // Default to company 1 instead of null
      } else {
        const companyNum = parseInt(body.companyId);
        userData.company_id = isNaN(companyNum) ? 1 : companyNum;
      }
    }
    
    // Try to update name field only if we know which column to use
    const allKeys = Object.keys(existingUser);
    console.log('📋 Все колонки табл��цы users:', allKeys);
    
    // Check each possible name column (both camelCase and snake_case)
    if (allKeys.includes('fullName')) {
      console.log('✅ Использ��ем fullName (camelCase)');
      userData.fullName = body.fullName;
    } else if (allKeys.includes('full_name')) {
      console.log('✅ Используем full_name (snake_case)');
      userData.full_name = body.fullName;
    } else if (allKeys.includes('firstName') && allKeys.includes('lastName')) {
      console.log('✅ Используем firstName и lastName (camelCase)');
      const [firstName, ...lastNameParts] = body.fullName.split(' ');
      userData.firstName = firstName || body.fullName;
      userData.lastName = lastNameParts.join(' ') || '';
    } else if (allKeys.includes('first_name') && allKeys.includes('last_name')) {
      console.log('✅ Исп��льзуем first_name и last_name (snake_case)');
      const [firstName, ...lastNameParts] = body.fullName.split(' ');
      userData.first_name = firstName || body.fullName;
      userData.last_name = lastNameParts.join(' ') || '';
    } else if (allKeys.includes('name')) {
      console.log('✅ Используем name');
      userData.name = body.fullName;
    } else {
      // Can't update name - no matching column found
      console.warn('⚠️ Не найдена колонка для имени. Доступные колонки:', allKeys);
      console.warn('⚠️ Обновляем только position и department_id');
    }
    
    console.log('📝 Финальные данные для обновления:', userData);
    
    const { data, error } = await supabase
      .from('users')
      .update(userData)
      .eq('id', numericId)
      .select()
      .single();
    
    if (error) {
      console.error(`❌ Supabase error updating user:`, error);
      console.error('❌ Полная информация об ошибке:', JSON.stringify(error, null, 2));
      console.error('❌ Пытались обновить данные:', JSON.stringify(userData, null, 2));
      return c.json({ error: `Failed to update user: ${error.message}` }, 500);
    }
    
    console.log('✅ Пользователь обновлен:', data);
    
    // 🔄 Обн��вляем дату последнего изменения воркспейса
    if (data.workspace_id) {
      await updateWorkspaceSummary(data.workspace_id, 'update resource');
    }
    
    // Transform back to frontend format (support all naming conventions - both camelCase and snake_case)
    const fullName = data.fullName || data.full_name || data.name || 
                    (data.firstName || data.lastName ? `${data.firstName || ''} ${data.lastName || ''}`.trim() : '') ||
                    (data.first_name || data.last_name ? `${data.first_name || ''} ${data.last_name || ''}`.trim() : '') ||
                    `User ${data.id}`;
    
    const transformedUser = {
      id: `r${data.id}`,
      fullName,
      position: data.position,
      departmentId: `d${data.department_id}`,
      grade: data.grade_id ? String(data.grade_id) : (data.grade ? String(data.grade) : undefined),
      companyId: data.company_id ? String(data.company_id) : undefined
    };
    
    return c.json(transformedUser);
  } catch (error) {
    console.error(`❌ Exception updating user:`, error);
    return c.json({ error: `Failed to update user: ${error.message || error}` }, 500);
  }
});

// Delete user
app.delete("/make-server-73d66528/resources/:id", async (c) => {
  try {
    const userId = c.req.param('id');
    console.log('🗑️ Удаление пользователя:', userId);
    
    // Extract numeric ID (remove 'r' prefix if present)
    const numericId = parseInt(userId.replace('r', ''));
    
    // Получаем workspace_id перед удалением для обновления summary
    const { data: user } = await supabase
      .from('users')
      .select('workspace_id')
      .eq('id', numericId)
      .single();
    
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', numericId);
    
    if (error) {
      console.error(`❌ Supabase error deleting user:`, error);
      return c.json({ error: `Failed to delete user: ${error.message}` }, 500);
    }
    
    console.log('✅ Пользователь удален:', userId);
    
    // 🔄 Обновляем дату последнего изменения воркспейса
    if (user?.workspace_id) {
      await updateWorkspaceSummary(user.workspace_id, 'delete resource');
    }
    return c.json({ success: true });
  } catch (error) {
    console.error(`❌ Exception deleting user:`, error);
    return c.json({ error: `Failed to delete user: ${error.message || error}` }, 500);
  }
});

// ==================== WORKSPACE ENDPOINTS ====================

// Get all workspaces for current user
app.get("/make-server-73d66528/workspaces", async (c) => {
  try {
    console.log('📁 Запрос списка workspaces...');
    
    // Get user ID from access token
    const authHeader = c.req.header('Authorization');
    console.log('🔍 Authorization header:', authHeader ? authHeader.substring(0, 50) + '...' : 'null');
    
    const accessToken = authHeader?.split(' ')[1];
    console.log('🔑 Извлечен токен:', accessToken ? accessToken.substring(0, 30) + '...' : 'null');
    console.log('   Длина токена:', accessToken?.length || 0);
    
    if (!accessToken) {
      console.error('❌ Токен не предоставлен');
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    console.log('🔐 Создание клиента с токеном пользователя...');
    // Create a client with the user's access token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });
    
    console.log('🔐 Проверка токена через userClient.auth.getUser()...');
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    
    console.log('📋 Результат getUser():', {
      hasUser: !!user,
      hasError: !!authError,
      errorMessage: authError?.message,
      errorStatus: authError?.status,
      userId: user?.id,
      userEmail: user?.email
    });
    
    if (authError || !user) {
      console.error('❌ Ошибка авторизации:', JSON.stringify(authError, null, 2));
      return c.json({ 
        error: 'Unauthorized',
        code: 401,
        message: authError?.message || 'Invalid JWT'
      }, 401);
    }
    
    // Try to get workspaces - support both owner_id and user_id columns
    let workspacesQuery = supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Try owner_id first
    let { data: workspaces, error } = await workspacesQuery.eq('owner_id', user.id);
    
    // If owner_id doesn't exist, try user_id
    if (error && error.message?.includes('owner_id does not exist')) {
      console.log('⚠️ Колонка owner_id не найдена, пробуем user_id...');
      workspacesQuery = supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });
      const result = await workspacesQuery.eq('user_id', user.id);
      workspaces = result.data;
      error = result.error;
    }
    
    // If both fail, just get all workspaces (for development)
    if (error && (error.message?.includes('user_id does not exist') || error.message?.includes('owner_id does not exist'))) {
      console.log('⚠️ Колонки owner_id и user_id не найдены, получаем все workspaces...');
      const result = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });
      workspaces = result.data;
      error = result.error;
    }
    
    if (error) {
      console.error('❌ Ошибка загрузки workspaces:', error);
      return c.json({ error: `Failed to fetch workspaces: ${error.message}` }, 500);
    }
    
    console.log(`✓ Получено ${workspaces?.length || 0} workspaces для пользователя ${user.email}`);
    return c.json(workspaces || []);
  } catch (error) {
    console.error('❌ Exception fetching workspaces:', error);
    return c.json({ error: `Failed to fetch workspaces: ${error.message || error}` }, 500);
  }
});

// [Deleted duplicate endpoints]

// Get workspace summary (from workspaces_summary view)
app.get("/make-server-73d66528/workspaces/:id/summary", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Verify user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !user) {
      console.error('❌ Ошибка авторизации при получении summary:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('id');
    console.log(`📊 Загрузка summary для workspace ${workspaceId}`);
    console.log(`   User email: ${user.email}`);
    console.log(`   User ID: ${user.id}`);

    // Get summary from view (используем service role client для обхода RLS)
    const { data: summary, error } = await supabase
      .from('workspaces_summary')
      .select('*')
      .eq('id', workspaceId)
      .maybeSingle();

    if (error) {
      console.error('❌ Ошибка загрузки summary:', error);
      console.error('   Error code:', error.code);
      console.error('   Error details:', error.details);
      console.error('   Error hint:', error.hint);
      return c.json({ error: `Failed to load summary: ${error.message}` }, 500);
    }

    if (!summary) {
      console.warn(`⚠️ Summary не найден для workspace ${workspaceId}`);
      return c.json(null);
    }

    // ДИАГНОСТ��КА: Логируем RAW данные из view
    console.log(`📊 RAW данные из workspaces_summary view:`, JSON.stringify(summary, null, 2));
    console.log(`   Доступные поля:`, Object.keys(summary));
    console.log(`   projects_count (raw):`, summary.projects_count);
    console.log(`   users_count (raw):`, summary.users_count);
    console.log(`   department_count (raw):`, summary.department_count);
    
    console.log(`🔍 КРИТИЧЕСКАЯ ПРОВЕРКА: Endpoint /workspaces/${workspaceId}/summary ВЫЗВАН!`);

    // Если view не содержит данных - делаем ручной подсчет
    if (!summary.projects_count && !summary.users_count && !summary.department_count) {
      console.warn(`⚠️ View вернула нули, делаем ручной подсчет для workspace ${workspaceId}...`);
      
      // Подсчитываем проекты
      const { count: projectsCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);
      
      // Подсчитываем пользователей
      const { count: usersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);
      
      // Подсчитываем департаменты
      const { count: departmentsCount } = await supabase
        .from('departments')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);
      
      console.log(`📊 Руч��ой подсчет:`, {
        projects: projectsCount,
        users: usersCount,
        departments: departmentsCount
      });
      
      // Используем ручной подсчет
      const mappedSummary = {
        id: summary.id,
        project_count: projectsCount || 0,
        member_count: usersCount || 0,
        department_count: departmentsCount || 0,
        last_activity_at: summary?.last_activity_at || null,
        last_updated: summary?.last_updated || null,
        updated_at: summary?.updated_at || null,
        summary_json: summary?.summary_json || null
      };
      
      console.log(`✅ Summary с ручным подсчетом:`, {
        projects: mappedSummary.project_count,
        members: mappedSummary.member_count,
        departments: mappedSummary.department_count
      });
      
      return c.json(mappedSummary);
    }

    // Map view fields to expected frontend fields
    // View has: users_count, projects_count
    // Frontend expects: member_count, project_count
    const mappedSummary = {
      id: summary.id,
      project_count: summary.projects_count || 0,
      member_count: summary.users_count || 0,
      department_count: summary.department_count || 0,
      last_activity_at: summary?.last_activity_at || null,
      last_updated: summary?.last_updated || null,
      updated_at: summary?.updated_at || null,
      summary_json: summary?.summary_json || null
    };

    return c.json(mappedSummary);
  } catch (error: any) {
    console.error('❌ Exception loading summary:', error);
    return c.json({ error: error.message || 'Failed to load summary' }, 500);
  }
});

// Get workspace users (members)
app.get("/make-server-73d66528/workspaces/:id/users", async (c) => {
  try {
    const workspaceId = c.req.param('id');
    console.log('👥 Запрос пользователей для workspace:', workspaceId);
    
    // Получаем всех пользователей этого воркспейса (все поля, чтобы определить структуру)
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('workspace_id', workspaceId);
    
    if (error) {
      console.error('❌ Ошибка загрузки пользователей workspace:', error);
      return c.json({ error: `Failed to fetch workspace users: ${error.message}` }, 500);
    }
    
    console.log(`✓ Получено ${users?.length || 0} пользователей для workspace ${workspaceId}`);
    
    if (users && users.length > 0) {
      console.log('📋 Структура таблицы users (первый пользователь):', users[0]);
      console.log('📋 Доступные поля:', Object.keys(users[0]));
    }
    
    // Преобразуем в нужный формат для фронтенда
    // Поддерживаем разные варианты именования полей
    const formattedUsers = users?.map(user => {
      // Support multiple field name variants
      const firstName = user.firstName || user.first_name || '';
      const lastName = user.lastName || user.last_name || '';
      const fullName = user.fullName || user.full_name || user.name || 
                      (firstName || lastName ? `${firstName} ${lastName}`.trim() : '');
      const position = user.position || '';
      const email = user.email || '';
      
      return {
        id: String(user.id),
        firstName,
        lastName,
        fullName,
        position,
        email
      };
    }) || [];
    
    // Сортируем по fullName
    formattedUsers.sort((a, b) => a.fullName.localeCompare(b.fullName));
    
    console.log(`📝 Форматированных пользователей: ${formattedUsers.length}`);
    if (formattedUsers.length > 0) {
      console.log('📝 Первый пользователь (отформатированный):', formattedUsers[0]);
    }
    
    return c.json(formattedUsers);
  } catch (error: any) {
    console.error('❌ Exception fetching workspace users:', error);
    return c.json({ error: `Failed to fetch workspace users: ${error.message || error}` }, 500);
  }
});

// Get single workspace
app.get("/make-server-73d66528/workspaces/:id", async (c) => {
  try {
    const workspaceId = c.req.param('id');
    console.log('📁 Зап��ос workspace:', workspaceId);
    
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .maybeSingle();
    
    if (error) {
      console.error('❌ Ошибка загрузки workspace:', error);
      return c.json({ error: `Failed to fetch workspace: ${error.message}` }, 500);
    }
    
    if (!workspace) {
      console.warn('⚠️ Workspace not found:', workspaceId);
      return c.json({ error: 'Workspace not found' }, 404);
    }
    
    console.log(`✓ Workspace получен:`, workspace.name);
    return c.json(workspace);
  } catch (error) {
    console.error('❌ Exception fetching workspace:', error);
    return c.json({ error: `Failed to fetch workspace: ${error.message || error}` }, 500);
  }
});

// Create new workspace
app.post("/make-server-73d66528/workspaces", async (c) => {
  try {
    console.log('➕ Создание нового workspace...');
    
    // Get user ID from access token
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Create a client with the user's access token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ Ошибка авторизации:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const body = await c.req.json();
    const { name, timeline_year, base_workspace_id } = body;
    
    console.log('📝 Данные для создания:', { name, timeline_year, base_workspace_id });
    
    if (!name || !timeline_year) {
      return c.json({ error: 'Name and timeline_year are required' }, 400);
    }
    
    // Create workspace - RLS will handle user association
    const now = new Date().toISOString();
    const workspaceData: any = {
      name,
      timeline_year,
      created_at: now
      // updated_at не используется - нет такой колонки в таблице workspaces
    };
    
    console.log('📝 Создаём workspace с данными:', workspaceData);
    
    const { data: workspace, error: createError } = await supabase
      .from('workspaces')
      .insert([workspaceData])
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Ошибка создания workspace:', createError);
      return c.json({ error: `Failed to create workspace: ${createError.message}` }, 500);
    }
    
    console.log('✅ Workspace создан:', workspace.id, workspace.name);
    
    // If base_workspace_id provided, copy structure
    if (base_workspace_id) {
      console.log('📋 Копирование структуры из workspace:', base_workspace_id);
      
      try {
        // Map to store old department ID -> new department ID
        const departmentIdMap = new Map<number, number>();
        
        // Copy departments
        console.log('  → Копирование департаментов...');
        
        const { data: departments, error: deptSelectError } = await supabase
          .from('departments')
          .select('*')
          .eq('workspace_id', base_workspace_id)
          .order('queue', { ascending: true });
        
        if (deptSelectError) {
          console.error('❌ Ошибка выборки департаментов:', deptSelectError);
          console.error('   Детали:', JSON.stringify(deptSelectError, null, 2));
        } else if (departments && departments.length > 0) {
          console.log(`  → Найдено ${departments.length} департаментов для копирования`);
          console.log('   Департаменты:', departments.map(d => ({ id: d.id, name: d.name, queue: d.queue })));
          
          // Copy departments with original queue values
          // NOTE: This requires a composite unique constraint (workspace_id, queue) in the database
          // If you have a global unique constraint on queue, run this SQL first:
          //   ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_queue_key;
          //   ALTER TABLE departments ADD CONSTRAINT departments_workspace_queue_key UNIQUE (workspace_id, queue);
          const newDepartments = departments.map(d => ({
            name: d.name,
            workspace_id: workspace.id,
            queue: d.queue,  // Copy original queue value
            visible: d.visible !== undefined ? d.visible : true
          }));
          
          console.log('   Данные для вставки:', newDepartments);
          console.log('   Queue копируются с исходными значениями:', departments.map(d => d.queue).join(', '));
          
          const { data: insertedDepts, error: deptInsertError } = await supabase
            .from('departments')
            .insert(newDepartments)
            .select();
          
          if (deptInsertError) {
            console.error('❌ Ошибка вставки департаментов:', deptInsertError);
            console.error('   Код ошиб��и:', deptInsertError.code);
            console.error('   Сообщение:', deptInsertError.message);
            console.error('   Детали:', deptInsertError.details);
            console.error('   Hint:', deptInsertError.hint);
          } else {
            console.log(`✅ Скопировано ${insertedDepts?.length || 0} департаментов`);
            if (insertedDepts && insertedDepts.length > 0) {
              console.log('   Созданные департаменты:', insertedDepts.map(d => ({ id: d.id, name: d.name, queue: d.queue })));
              
              // Create mapping of old department IDs to new ones
              departments.forEach((oldDept, index) => {
                if (insertedDepts[index]) {
                  departmentIdMap.set(oldDept.id, insertedDepts[index].id);
                  console.log(`   Маппинг: старый dept ${oldDept.id} -> новый dept ${insertedDepts[index].id}`);
                }
              });
            }
          }
        } else {
          console.log('  ℹ️ Департаменты для копирования не найдены');
        }
        
        // Map to store old user ID -> new user ID
        const userIdMap = new Map<number, number>();
        
        // Copy users (resources)
        console.log('  → Копирование пользователей...');
        const { data: users, error: usersSelectError } = await supabase
          .from('users')
          .select('*')
          .eq('workspace_id', base_workspace_id)
          .order('id', { ascending: true });
        
        if (usersSelectError) {
          console.error('❌ Ошибка выборки пользователей:', usersSelectError);
          console.error('   Детали:', JSON.stringify(usersSelectError, null, 2));
        } else if (users && users.length > 0) {
          console.log(`  → Найдено ${users.length} пользователей для копирования`);
          console.log('   Примеры пользователей:', users.slice(0, 3).map(u => ({ 
            id: u.id, 
            firstName: u.firstName, 
            lastName: u.lastName,
            department_id: u.department_id 
          })));
          
          const newUsers = users.map(u => {
            const { id, created_at, updated_at, ...rest } = u;
            
            // Map old department_id to new department_id
            const newDepartmentId = u.department_id ? departmentIdMap.get(u.department_id) : undefined;
            
            return {
              ...rest,
              workspace_id: workspace.id,
              department_id: newDepartmentId || u.department_id // Fallback to old ID if mapping not found
            };
          });
          
          console.log('   Данные для вставки (примеры):', newUsers.slice(0, 2));
          console.log('   Используется маппинг департаментов:', departmentIdMap.size > 0 ? 'да' : 'нет');
          
          const { data: insertedUsers, error: usersInsertError } = await supabase
            .from('users')
            .insert(newUsers)
            .select();
          
          if (usersInsertError) {
            console.error('❌ Ошибка вставки пользователей:', usersInsertError);
            console.error('   Код ошибки:', usersInsertError.code);
            console.error('   Сообщение:', usersInsertError.message);
            console.error('   Детали:', usersInsertError.details);
            console.error('   Hint:', usersInsertError.hint);
          } else {
            console.log(`✅ Скопировано ${insertedUsers?.length || 0} пользователей`);
            if (insertedUsers && insertedUsers.length > 0) {
              console.log('   Созданные пользователи (примеры):', insertedUsers.slice(0, 3).map(u => ({ id: u.id, firstName: u.firstName })));
              
              // Create mapping of old user IDs to new ones
              users.forEach((oldUser, index) => {
                if (insertedUsers[index]) {
                  userIdMap.set(oldUser.id, insertedUsers[index].id);
                  console.log(`   Маппинг: старый user ${oldUser.id} -> новый user ${insertedUsers[index].id}`);
                }
              });
            }
          }
        } else {
          console.log('  ℹ️ Пользователи для копирования не найдены');
        }
        
        // Map to store old project ID -> new project ID
        const projectIdMap = new Map<number, number>();
        
        // Copy projects
        console.log('  → Копирование проектов...');
        const { data: projects, error: projectsSelectError } = await supabase
          .from('projects')
          .select('*')
          .eq('workspace_id', base_workspace_id)
          .order('id', { ascending: true });
        
        if (projectsSelectError) {
          console.error('❌ Ошибка выборки проектов:', projectsSelectError);
          console.error('   Детали:', JSON.stringify(projectsSelectError, null, 2));
        } else if (projects && projects.length > 0) {
          console.log(`  → Найдено ${projects.length} проектов для копирования`);
          console.log('   Проекты:', projects.map(p => ({ id: p.id, name: p.name })));
          
          const newProjects = projects.map(p => {
            const { id, created_at, updated_at, ...rest } = p;
            return {
              ...rest,
              workspace_id: workspace.id
            };
          });
          
          console.log('   Данные для вставки:', newProjects.map(p => ({ name: p.name, workspace_id: p.workspace_id })));
          
          const { data: insertedProjects, error: projectsInsertError } = await supabase
            .from('projects')
            .insert(newProjects)
            .select();
          
          if (projectsInsertError) {
            console.error('❌ Ошибка вставки проектов:', projectsInsertError);
            console.error('   Ко�� ошибки:', projectsInsertError.code);
            console.error('   Сообщение:', projectsInsertError.message);
            console.error('   Детали:', projectsInsertError.details);
            console.error('   Hint:', projectsInsertError.hint);
          } else {
            console.log(`✅ Скопировано ${insertedProjects?.length || 0} проектов`);
            if (insertedProjects && insertedProjects.length > 0) {
              console.log('   Созданные проекты:', insertedProjects.map(p => ({ id: p.id, name: p.name })));
              
              // Create mapping of old project IDs to new ones
              projects.forEach((oldProject, index) => {
                if (insertedProjects[index]) {
                  projectIdMap.set(oldProject.id, insertedProjects[index].id);
                  console.log(`   Маппинг: старый project ${oldProject.id} -> новый project ${insertedProjects[index].id}`);
                }
              });
            }
          }
        } else {
          console.log('  ℹ️ Проекты для копирования не найдены');
        }
        
        // NOTE: Events are NOT copied - users should create events manually in the new workspace
        console.log('  ℹ️ События НЕ копируются (пользователи создают их самостоятельно)');
        
        console.log('✅ Процесс копирования стру��туры завершен');
        console.log(`   Итого скопировано:`);
        console.log(`   - Департаменты: ${departmentIdMap.size}`);
        console.log(`   - Пользователи: ${userIdMap.size}`);
        console.log(`   - Проекты: ${projectIdMap.size}`);
      } catch (copyError) {
        console.error('⚠️ Ошибка копирования структуры:', copyError);
        console.error('Stack trace:', copyError.stack);
        // Don't fail workspace creation if copy fails
      }
    } else {
      // Создаём департамент "Разработка" по умолчанию для нового воркспейса
      console.log('📋 Создание департамента по умолчанию "Разработка"...');
      
      try {
        const { data: defaultDept, error: deptError } = await supabase
          .from('departments')
          .insert([{
            name: 'Разработка',
            workspace_id: workspace.id,
            queue: 1,
            visible: true
          }])
          .select()
          .single();
        
        if (deptError) {
          console.error('❌ Ошибка создания департамента по умолчанию:', deptError);
        } else {
          console.log('✅ Департамент "Разработка" создан:', defaultDept.id);
          
          // Создаем дефолтного пользователя
          console.log('📋 Создание дефолтного пользователя...');

          try {
            // 1. Находим Grade "Lead"
            const { data: gradeData } = await supabase
              .from('grades')
              .select('id')
              .ilike('name', 'Lead') // Case-insensitive match
              .limit(1)
              .maybeSingle();
            
            const leadGradeId = gradeData?.id;
            console.log('   Grade Lead ID:', leadGradeId || 'не найден');

            // 2. Находим Company "KODE"
            const { data: companyData } = await supabase
              .from('companies')
              .select('id')
              .ilike('name', 'KODE') // Case-insensitive match
              .limit(1)
              .maybeSingle();
              
            const kodeCompanyId = companyData?.id;
            console.log('   Company KODE ID:', kodeCompanyId || 'не найден');

            // 3. Определяем имя пользователя
            // Используем им�� из токена авторизации
            const userName = user?.user_metadata?.name || 
                             user?.user_metadata?.display_name || 
                             user?.user_metadata?.full_name ||
                             user?.email?.split('@')[0] || 
                             'Новый пользователь';
            
            console.log('   Имя пользователя:', userName);

            // 4. Создаем пользователя (ПРОВЕРЯЕМ СТРУКТУРУ ТАБЛИЦЫ ПЕРЕД ВСТАВКОЙ)
            // Сначала получаем одного пользователя чтобы узнать какие колонки есть
            const { data: sampleUsers } = await supabase
              .from('users')
              .select('*')
              .limit(1);
              
            const existingColumns = sampleUsers && sampleUsers.length > 0 ? Object.keys(sampleUsers[0]) : [];
            console.log('   Доступные колонки в users:', existingColumns);
            
            const userData: any = {
              workspace_id: workspace.id,
              department_id: defaultDept.id,
              position: 'Новый пользователь', // Запрошено: "Новый пользователь"
              grade_id: leadGradeId,
              company_id: kodeCompanyId
            };
            
            // Адаптивно заполняем имя
            if (existingColumns.includes('full_name')) {
              userData.full_name = userName;
            } else if (existingColumns.includes('fullName')) {
              userData.fullName = userName;
            } else if (existingColumns.includes('name')) {
              userData.name = userName;
            } else if (existingColumns.includes('first_name') && existingColumns.includes('last_name')) {
              // Если есть только first_name/last_name, пытаемся разбить
              const parts = userName.split(' ');
              userData.first_name = parts[0];
              userData.last_name = parts.slice(1).join(' ') || '';
            } else if (existingColumns.includes('firstName') && existingColumns.includes('lastName')) {
              const parts = userName.split(' ');
              userData.firstName = parts[0];
              userData.lastName = parts.slice(1).join(' ') || '';
            } else {
              // Fallback: пробуем самые вероятные, если не удалось определить
              // Но, судя по ошибке, 'first_name' нет. Скорее всего 'full_name' или 'name'.
              console.warn('⚠️ Не удалось определить колонки имени, используем безопасный набор');
              userData.name = userName; // Самый безопасный вариант, часто это алиас или основное поле
            }
            
            console.log('   Данные для создания:', userData);

            const { error: userError } = await supabase.from('users').insert([userData]);

            if (userError) {
              console.error('❌ Ошибка создания дефолтного пользователя:', userError);
            } else {
              console.log('✅ Дефолтный пользователь создан');
            }
          } catch (userCreationError) {
            console.error('⚠️ Исключение при создании дефолтного пользователя:', userCreationError);
          }
        }
      } catch (deptError) {
        console.error('⚠️ Ошибка при создании департамента по умолчанию:', deptError);
        // Don't fail workspace creation if department creation fails
      }
    }
    
    return c.json(workspace);
  } catch (error) {
    console.error('❌ Exception creating workspace:', error);
    return c.json({ error: `Failed to create workspace: ${error.message || error}` }, 500);
  }
});

// Update workspace
app.put("/make-server-73d66528/workspaces/:id", async (c) => {
  try {
    const workspaceId = c.req.param('id');
    console.log('✏️ Обновление workspace:', workspaceId);
    
    const body = await c.req.json();
    const { name, timeline_year } = body;
    
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (timeline_year !== undefined) updateData.timeline_year = timeline_year;
    
    // updated_at не используется - нет такой колонки в таблице workspaces
    
    // If no fields to update, return error
    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }
    
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .update(updateData)
      .eq('id', workspaceId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Ошибка обновления workspace:', error);
      return c.json({ error: `Failed to update workspace: ${error.message}` }, 500);
    }
    
    console.log('✅ Workspace обновлен:', workspace.name);
    return c.json(workspace);
  } catch (error) {
    console.error('❌ Exception updating workspace:', error);
    return c.json({ error: `Failed to update workspace: ${error.message || error}` }, 500);
  }
});

// Delete workspace
app.delete("/make-server-73d66528/workspaces/:id", async (c) => {
  try {
    const workspaceId = c.req.param('id');
    console.log('🗑️ Удаление workspace:', workspaceId);
    
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId);
    
    if (error) {
      console.error('❌ Ошибка удаления workspace:', error);
      return c.json({ error: `Failed to delete workspace: ${error.message}` }, 500);
    }
    
    console.log('✅ Workspace удален:', workspaceId);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Exception deleting workspace:', error);
    return c.json({ error: `Failed to delete workspace: ${error.message || error}` }, 500);
  }
});

// ==================== PRESENCE ENDPOINTS ====================

// Send heartbeat - mark user as online in workspace
app.post("/make-server-73d66528/presence/heartbeat", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Verify user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !user) {
      console.error('❌ Ошибка авторизации при heartbeat:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { workspace_id } = body;

    if (!workspace_id) {
      return c.json({ error: 'workspace_id обязателен' }, 400);
    }

    console.log(`💓 Heartbeat от ${user.email} в workspace ${workspace_id}`);

    // Store presence with 2-minute TTL
    const presenceKey = `presence:${workspace_id}:${user.id}`;
    const displayName = user.user_metadata?.display_name || user.user_metadata?.name || null;
    const avatarUrl = user.user_metadata?.avatar_url || null;
    
    // ВАЖНО: kv.set сохраняет в JSONB, поэтому передаем объект напрямую (БЕЗ JSON.stringify)
    const presenceData = {
      userId: user.id,
      email: user.email,
      displayName: displayName,
      avatarUrl: avatarUrl,
      lastSeen: new Date().toISOString()
    };

    await kv.set(presenceKey, presenceData);
    console.log(`✅ Presence сохранён: ${user.email}${avatarUrl ? ' (с аватаркой)' : ''}`);
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('❌ Ошибка heartbeat:', error);
    return c.json({ error: error.message || 'Ошибка heartbeat' }, 500);
  }
});

// Get online users for multiple workspaces (batch request)
app.post("/make-server-73d66528/presence/online-batch", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Verify user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !user) {
      console.error('❌ Ошибка авторизации при batch получении онлайн пользователей:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { workspace_ids } = body;

    if (!workspace_ids || !Array.isArray(workspace_ids)) {
      return c.json({ error: 'workspace_ids должен быть массивом' }, 400);
    }

    console.log(`👥 Batch запрос онлайн пользователей для ${workspace_ids.length} воркспейсов`);

    // Get all presence entries for all workspaces in parallel
    const now = Date.now();
    const twoMinutesAgo = now - 2 * 60 * 1000;
    
    const results: Record<string, any[]> = {};
    
    // Fetch presence for all workspaces in parallel
    await Promise.all(
      workspace_ids.map(async (workspaceId) => {
        try {
          const presencePrefix = `presence:${workspaceId}:`;
          const presenceEntries = await kv.getByPrefix(presencePrefix);
          
          const onlineUsers = presenceEntries
            .filter(entry => entry && typeof entry === 'object') // kv.getByPrefix возвращает уже распарсенные JSONB объекты
            .filter(data => {
              if (!data) return false;
              const lastSeen = new Date(data.lastSeen).getTime();
              return lastSeen >= twoMinutesAgo;
            });
          
          results[workspaceId] = onlineUsers;
        } catch (error) {
          console.error(`⚠️ Ошибка получения presence для workspace ${workspaceId}:`, error);
          results[workspaceId] = [];
        }
      })
    );

    const totalOnline = Object.values(results).reduce((sum, users) => sum + users.length, 0);
    console.log(`✅ Batch: ${totalOnline} онлайн в ${workspace_ids.length} воркспейсах`);

    return c.json({ workspaces: results });
  } catch (error: any) {
    console.error('❌ Ошибка batch получения онлайн пользователей:', error);
    return c.json({ error: error.message || 'Ошибка получ��ния онлайн пользователей' }, 500);
  }
});

// УДАЛЕНО: Дубликат endpoint'а - см. строку 3355 для актуальной версии

// ==================== PROFILE ENDPOINTS ====================

// Upload avatar
app.post("/make-server-73d66528/profile/upload-avatar", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Verify user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !user) {
      console.error('❌ Ошибка авторизации при загрузке аватара:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log(`📤 Загрузка аватара для пользователя ${user.email}`);

    // Parse multipart form data
    const formData = await c.req.formData();
    const avatarFile = formData.get('avatar') as File;

    if (!avatarFile) {
      return c.json({ error: 'Файл не найден' }, 400);
    }

    // Validate file type
    if (!avatarFile.type.startsWith('image/')) {
      return c.json({ error: 'Можно загружать только изображения' }, 400);
    }

    // Validate file size (max 5MB)
    if (avatarFile.size > 5 * 1024 * 1024) {
      return c.json({ error: 'Размер файла не должен превышать 5MB' }, 400);
    }

    // Create bucket if not exists
    const bucketName = 'make-73d66528-avatars';
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log(`📦 Создание bucket ${bucketName}...`);
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true // Аватары публичные
      });
      if (createError) {
        console.error('❌ Ошибка создания bucket:', createError);
        return c.json({ error: 'Ошибка создания хранилища' }, 500);
      }
    }

    // Generate unique filename
    const fileExt = avatarFile.name.split('.').pop() || 'jpg';
    const fileName = `${user.id}_${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    // Convert File to ArrayBuffer
    const arrayBuffer = await avatarFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    console.log(`💾 Загрузка файла ${filePath} в Supabase Storage...`);
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, uint8Array, {
        contentType: avatarFile.type,
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Ошибка загрузки в Storage:', uploadError);
      return c.json({ error: 'Ошибка загрузки файла' }, 500);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    // Add cache-busting parameter to prevent browser caching
    const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

    console.log(`✅ Аватар загружен: ${cacheBustedUrl}`);

    return c.json({ avatar_url: cacheBustedUrl });
  } catch (error: any) {
    console.error('❌ Ошибка загрузки аватара:', error);
    return c.json({ error: error.message || 'Ошибка загрузки аватара' }, 500);
  }
});

// Update profile (display_name, avatar_url)
app.post("/make-server-73d66528/profile/update", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Verify user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !user) {
      console.error('❌ Ошибка авторизации при обновлении профиля:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { display_name, avatar_url } = body;

    console.log(`💾 Обновление профиля для ${user.email}:`, { 
      display_name, 
      avatar_url: avatar_url ? avatar_url.substring(0, 80) + '...' : 'нет' 
    });

    // Update user metadata using service role (admin.updateUserById)
    const updateData: any = {};
    
    if (display_name !== undefined) {
      updateData.name = display_name;
    }
    
    if (avatar_url !== undefined) {
      updateData.avatar_url = avatar_url;
    }

    console.log('📝 Данные для обновления user_metadata:', {
      name: updateData.name || '(без изменений)',
      avatar_url: updateData.avatar_url ? updateData.avatar_url.substring(0, 80) + '...' : '(без изменений)'
    });

    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          ...updateData
        }
      }
    );

    if (error) {
      console.error('❌ Ошибка обновления профиля:', error);
      return c.json({ error: 'Ошибка обновления профиля' }, 500);
    }

    console.log(`✅ Профиль обновлён для ${user.email}`);
    console.log('   User metadata после обновления:', {
      name: data.user.user_metadata?.name,
      display_name: data.user.user_metadata?.display_name,
      avatar_url: data.user.user_metadata?.avatar_url ? 'да (' + data.user.user_metadata.avatar_url.substring(0, 50) + '...)' : 'нет'
    });

    return c.json({ success: true, user: data.user });
  } catch (error: any) {
    console.error('❌ Ошибка обновления профиля:', error);
    return c.json({ error: error.message || 'Ошибка обновления профиля' }, 500);
  }
});

// ==================== PRESENCE ENDPOINTS ====================

// Presence heartbeat - отправляется каждые 30 секунд из OnlineUsers компонента
app.post("/make-server-73d66528/presence/heartbeat", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Verify user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !user) {
      console.error('❌ Ошибка авторизации в heartbeat:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { workspace_id } = body;

    if (!workspace_id) {
      return c.json({ error: 'workspace_id обязателен' }, 400);
    }

    console.log(`💓 Heartbeat от ${user.email} в workspace ${workspace_id}`);
    console.log(`   user_metadata:`, JSON.stringify(user.user_metadata));

    // Сохраняем presence в KV Store с TTL 60 секунд (1 минута)
    // Если пользователь закроет календарь и не отправит "leave", он исчезнет через 60 сек
    const presenceKey = `presence:${workspace_id}:${user.id}`;
    const presenceData = {
      userId: user.id,
      email: user.email,
      displayName: user.user_metadata?.name || user.user_metadata?.display_name || null,
      avatarUrl: user.user_metadata?.avatar_url || null,
      lastSeen: new Date().toISOString(),
      workspaceId: workspace_id
    };

    // Сохраняем объект напрямую (kv.set делает JSON.stringify внутри)
    await kv.set(presenceKey, presenceData);

    console.log(`✅ Presence сохранён: ${presenceKey}`);
    console.log(`   displayName: ${presenceData.displayName || 'нет'}`);
    console.log(`   avatarUrl: ${presenceData.avatarUrl || 'нет'}`);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('❌ Ошибка heartbeat:', error);
    return c.json({ error: error.message || 'Ошибка heartbeat' }, 500);
  }
});

// Get online users for specific workspace
app.get("/make-server-73d66528/presence/online/:workspaceId", async (c) => {
  const startTime = Date.now();
  
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Verify user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !user) {
      console.error('❌ Ошибка авторизации при получении онлайн пользователей:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    console.log(`👥 Зап��ос онлайн пользователей для workspace ${workspaceId}`);

    // Получаем все presence записи для воркспейса
    const prefix = `presence:${workspaceId}:`;
    const kvStartTime = Date.now();
    const presenceRecords = await kv.getByPrefix(prefix);
    const kvDuration = Date.now() - kvStartTime;
    
    console.log(`⏱️ KV getByPrefix выполнен за ${kvDuration}ms`);
    console.log(`📊 Найдено ${presenceRecords.length} presence записей`);

    // Парсим данные и фильтруем устаревшие (старше 60 секунд)
    const now = Date.now();
    const users = presenceRecords
      .map(record => {
        try {
          // kv.getByPrefix возвращает уже распарсенные объекты
          const data = typeof record === 'string' ? JSON.parse(record) : record;
          return data;
        } catch (e) {
          console.error('⚠️ Ошибка парсинга presence записи:', e);
          return null;
        }
      })
      .filter(data => {
        if (!data) return false;
        const lastSeen = new Date(data.lastSeen).getTime();
        const age = now - lastSeen;
        // Фильтр��ем записи старше 60 секунд (60000 мс)
        return age < 60000;
      });

    const totalDuration = Date.now() - startTime;
    console.log(`✅ Активных пользователей: ${users.length} (общее время: ${totalDuration}ms)`);
    
    if (users.length > 0) {
      users.forEach(u => {
        console.log(`  👤 ${u.email}: displayName=${u.displayName || 'нет'}, avatarUrl=${u.avatarUrl || 'нет'}`);
      });
    }

    return c.json({ users });
  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    console.error(`❌ Ошибка получения онлайн пользователей (${totalDuration}ms):`, error);
    return c.json({ error: error.message || 'Ошибка получения онлайн пользователей' }, 500);
  }
});

// Batch endpoint - получает онлайн пользователей для нескольких воркспейсов за один запрос
app.post("/make-server-73d66528/presence/online-batch", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Verify user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !user) {
      console.error('❌ Ошибка авторизации в batch endpoint:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { workspace_ids } = body;

    if (!Array.isArray(workspace_ids)) {
      return c.json({ error: 'workspace_ids должен быть массивом' }, 400);
    }

    console.log(`👥 Batch запрос онлайн пользователей для ${workspace_ids.length} воркспейсов:`, workspace_ids);

    // Получаем presence для всех воркспейсов параллельно
    const results: Record<string, any[]> = {};
    const now = Date.now();

    await Promise.all(
      workspace_ids.map(async (workspaceId) => {
        const prefix = `presence:${workspaceId}:`;
        const presenceRecords = await kv.getByPrefix(prefix);

        // Парсим и фильтруем
        const users = presenceRecords
          .map(record => {
            try {
              const data = typeof record === 'string' ? JSON.parse(record) : record;
              return data;
            } catch (e) {
              console.error('⚠️ Ошибка парсинга presence записи:', e);
              return null;
            }
          })
          .filter(data => {
            if (!data) return false;
            const lastSeen = new Date(data.lastSeen).getTime();
            const age = now - lastSeen;
            return age < 60000; // 60 секунд (1 минута)
          });

        results[String(workspaceId)] = users;
        console.log(`  📊 Workspace ${workspaceId}: ${users.length} онлайн`)
        
        // Детальное логирование для диагностики аватарок
        if (users.length > 0) {
          users.forEach(u => {
            console.log(`     👤 ${u.email}: displayName=${u.displayName || 'нет'}, avatarUrl=${u.avatarUrl ? 'да' : 'нет'}`);
          });
        }
      
      })
    );

    console.log(`✅ Batch запрос выполнен, всего воркспейсов: ${workspace_ids.length}`);
    console.log(`📤 Возвращаем results:`, JSON.stringify(results));

    return c.json(results);
  } catch (error: any) {
    console.error('❌ Ошибка batch запроса:', error);
    return c.json({ error: error.message || 'Ошибка batch запроса' }, 500);
  }
});

// Leave workspace - явное удаление presence при закрытии календаря
app.delete("/make-server-73d66528/presence/leave/:workspaceId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Verify user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !user) {
      console.error('❌ Ошибка авторизации в leave endpoint:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const workspaceId = c.req.param('workspaceId');
    console.log(`👋 Leave от ${user.email} из workspace ${workspaceId}`);

    // Удаляем presence из KV Store
    const presenceKey = `presence:${workspaceId}:${user.id}`;
    await kv.del(presenceKey);

    console.log(`✅ Presence удалён: ${presenceKey}`);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('❌ Ошибка leave:', error);
    return c.json({ error: error.message || 'Ошибка leave' }, 500);
  }
});

// ==================== WEBSOCKET CURSORS ====================

// Store active WebSocket connections per workspace
// Map<workspaceId, Map<userId, {ws: WebSocket, displayName, email, avatarUrl, color}>>
const workspaceConnections = new Map<string, Map<string, any>>();

// Helper: generate color from email
function getUserColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
}

// WebSocket endpoint for collaborative cursors - ОТКЛЮЧЕНО (нестабильная работа в Edge Functions)
// WebSocket upgrade работает нестабильно в текущей версии Deno/Supabase
// Возможна реализация в будущем после улучшения поддержки WebSocket
/*
app.get("/make-server-73d66528/cursors/:workspaceId", (c) => {
  // ... endpoint code was here ...
  return c.json({ error: 'WebSocket cursors disabled' }, 501);
});
*/

Deno.serve(app.fetch);
