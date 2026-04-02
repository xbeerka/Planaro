import { Hono } from "npm:hono";
import { createAdminClient, createAuthClient, handleError, retryOperation } from './server_utils.tsx';
import * as kv from './kv_store.tsx';

// Initialize clients
const supabase = createAdminClient();
const supabaseAuth = createAuthClient();

// Rate limiting for OTP sending (2 minutes)
const OTP_RATE_LIMIT_SECONDS = 120;

async function checkOTPRateLimit(email: string): Promise<{ allowed: boolean; remainingSeconds?: number }> {
  const key = `otp_sent:${email.toLowerCase().trim()}`;
  const lastSentData = await kv.get(key);
  
  if (lastSentData) {
    const lastSentTime = lastSentData as number;
    const elapsedSeconds = Math.floor((Date.now() - lastSentTime) / 1000);
    const remainingSeconds = OTP_RATE_LIMIT_SECONDS - elapsedSeconds;
    
    if (remainingSeconds > 0) {
      console.log(`⏱️ OTP rate limit active for ${email}: ${remainingSeconds} секунд до повторной отправки`);
      return { allowed: false, remainingSeconds };
    }
  }
  
  // Разрешаем отправку и сохраняем timestamp с TTL
  await kv.set(key, Date.now(), OTP_RATE_LIMIT_SECONDS);
  console.log(`✅ OTP rate limit: разрешена отправка для ${email}, следующая через ${OTP_RATE_LIMIT_SECONDS} сек`);
  return { allowed: true };
}

export function registerAuthRoutes(app: Hono) {

  // ==================== SESSION ====================

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
      
      // KV Store возвращает объект напрямую (JSONB)
      // Для обратной совместимости с legacy сессиями (строками)
      let session = sessionData;
      if (typeof sessionData === 'string') {
        try {
          console.log('⚠️ Обнаружена legacy сессия (строка), выполняю парсинг...');
          session = JSON.parse(sessionData);
        } catch (e) {
          console.error('❌ Ошибка парсинга legacy сессии:', e);
          session = null;
        }
      }
      
      if (!session) {
        console.log('❌ Сессия пуста после загрузки (или ошибки парсинга)');
        return c.json({ session: null }, 200);
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
          // Refresh the session using refresh_token with retry
          const { data: refreshData, error: refreshError } = await retryOperation(
            () => supabaseAuth.auth.refreshSession({
              refresh_token: refresh_token
            }),
            3, 1000, 'Refresh Session'
          );
          
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
          
          // Update session in KV store with new tokens
          const updatedSessionData = {
            user_id: user_id,
            access_token: refreshData.session.access_token,
            refresh_token: refreshData.session.refresh_token,
            expires_at: refreshData.session.expires_at,
            user: refreshData.user || user,
            created_at: created_at // Keep original creation time
          };
          
          await kv.set(`session:${session_id}`, updatedSessionData);
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

  // ==================== SIGN IN ====================

  app.post("/make-server-73d66528/auth/signin", async (c) => {
    try {
      let body;
      try {
        body = await c.req.json();
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        return c.json({ error: 'Неверный формат запроса' }, 400);
      }
      
      const { email, password } = body;
      
      if (!email || !password) {
        return c.json({ error: 'Email и пароль обязательны' }, 400);
      }
      
      const normalizedEmail = email.toLowerCase().trim();
      
      // Validate email format
      const atIndex = normalizedEmail.indexOf('@');
      if (atIndex < 1 || !normalizedEmail.substring(atIndex + 1).includes('.')) {
        return c.json({ error: 'Неверный формат email' }, 400);
      }
      
      const localPart = normalizedEmail.substring(0, atIndex);
      if (localPart.length === 0 || !/^[a-z]/.test(localPart)) {
        return c.json({ error: 'Неверный формат email' }, 400);
      }
      
      console.log('🔐 Попытка входа...', normalizedEmail);
      
      const { data, error } = await retryOperation(
        () => supabaseAuth.auth.signInWithPassword({
          email: normalizedEmail,
          password: password
        }),
        2, 1000, 'Sign In'
      );
      
      if (error) {
        console.error('❌ Ошибка входа:', error.message);
        
        let userMessage = 'Неверный email или пароль';
        
        if (error.message.includes('Email not confirmed')) {
          console.log('📨 Вход: Email не подтвержден. Проверка rate limit...');
          
          // Проверяем rate limit перед отправкой OTP
          const rateLimitCheck = await checkOTPRateLimit(normalizedEmail);
          
          if (rateLimitCheck.allowed) {
            // Rate limit не активен - отправляем новый OTP
            console.log('✅ Rate limit OK, отправка нового OTP...');
            const { error: otpError } = await supabaseAuth.auth.signInWithOtp({
              email: normalizedEmail,
              options: { shouldCreateUser: false }
            });
            
            if (!otpError) {
              console.log('✅ OTP успешно отправлен');
              return c.json({ 
                requiresOTP: true,
                message: 'Email не подтвержден. Код подтверждения отправлен на вашу почту.' 
              }, 200);
            } else {
              console.error('❌ Ошибка отправки OTP при входе:', otpError.message);
              userMessage = 'Email не подтвержден и не удалось отправить код. Попробуйте позже.';
            }
          } else {
            // Rate limit активен - НЕ отправляем OTP, просто показываем экран ввода
            console.log(`⏱️ Rate limit активен (${rateLimitCheck.remainingSeconds} сек), OTP НЕ отправлен`);
            return c.json({ 
              requiresOTP: true,
              message: 'Email не подтвержден. Введите код из письма.' 
            }, 200);
          }
        } else if (error.message.includes('Invalid login credentials')) {
          userMessage = 'Неверный email или пароль. Проверьте правильность ввода.';
        }
        
        return c.json({ error: userMessage }, 401);
      }
      
      if (!data.session?.access_token || !data.session?.refresh_token) {
        return c.json({ error: 'Не удалось получить токены доступа' }, 500);
      }
      
      console.log('✅ Вход успешен:', data.user.email);
      
      // Generate session ID and store in KV
      const sessionId = crypto.randomUUID();
      console.log('🆔 Сгенерирован session_id:', sessionId.substring(0, 8) + '...');
      
      const sessionData = {
        user_id: data.user.id,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: data.user,
        created_at: Date.now()
      };
      
      console.log('💾 Сохранение сессии в KV store...');
      
      try {
        await kv.set(`session:${sessionId}`, sessionData);
        console.log('✅ Сессия сохранена в KV store');
      } catch (kvError: any) {
        console.error('❌ Ошибка сохранения в KV:', kvError.message);
        throw kvError;
      }
      
      console.log('✅ Готово, срок действия сессии: 30 дней');
      
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

  // ==================== SIGN OUT ====================

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

  // ==================== VERIFY OTP ====================

  app.post("/make-server-73d66528/auth/verify-otp", async (c) => {
    try {
      const body = await c.req.json();
      const { email, token } = body;
      
      if (!email || !token) {
        return c.json({ error: 'Email и OTP код обязательны' }, 400);
      }
      
      console.log('🔐 Проверка OTP для:', email);
      
      // Пробуем type: 'email' (OTP отправленный через signInWithOtp)
      console.log('   Попытка verifyOtp type=email...');
      const { data, error } = await supabaseAuth.auth.verifyOtp({
        email,
        token,
        type: 'email'
      });
      
      if (error) {
        console.error('❌ Ошибка проверки OTP (type=email):', error.message, '| code:', error.code, '| status:', error.status);
        
        // Пробуем type: 'signup' как fallback
        console.log('   Попытка verifyOtp type=signup...');
        const { data: data2, error: error2 } = await supabaseAuth.auth.verifyOtp({
          email,
          token,
          type: 'signup'
        });
        
        if (error2) {
          console.error('❌ Ошибка проверки OTP (type=signup):', error2.message, '| code:', error2.code, '| status:', error2.status);
          
          const msg = (error2.message || '').toLowerCase();
          
          // "Token has expired or is invalid" — Supabase не различает
          // Но если код 6 цифр и свежий — скорее всего просто неверный
          if (msg.includes('expired') && msg.includes('invalid')) {
            // Общее сообщение Supabase "Token has expired or is invalid"
            return c.json({ error: 'Неверный код подтверждения. Проверьте код и попробуйте снова.' }, 400);
          }
          
          if (msg.includes('expired') || error2.code === 'otp_expired') {
            return c.json({ error: 'Код подтверждения истёк. Запросите новый код.' }, 400);
          }
          
          return c.json({ error: 'Неверный код подтверждения' }, 400);
        }
        
        if (!data2?.session?.access_token || !data2?.session?.refresh_token) {
          return c.json({ error: 'Не удалось получить токены доступа' }, 500);
        }
        
        console.log('✅ OTP подтвержден (type=signup), вход выполнен:', data2.user?.email);
        
        // Удаляем rate limit после успешной верификации
        await kv.del(`otp_sent:${email.toLowerCase().trim()}`);
        
        // Generate session ID and store in KV
        const sessionId2 = crypto.randomUUID();
        
        const sessionData2 = {
          user_id: data2.user!.id,
          access_token: data2.session.access_token,
          refresh_token: data2.session.refresh_token,
          expires_at: data2.session.expires_at,
          user: data2.user,
          created_at: Date.now()
        };
        
        await kv.set(`session:${sessionId2}`, sessionData2);
        console.log('✅ Сессия сохранена в KV store');
        
        return c.json({
          access_token: data2.session.access_token,
          session_id: sessionId2,
          expires_at: data2.session.expires_at,
          user: data2.user
        });
      }
      
      if (!data.session?.access_token || !data.session?.refresh_token) {
        return c.json({ error: 'Не удалось получить токены доступа' }, 500);
      }
      
      console.log('✅ OTP подтвержден (type=email), вход выполнен:', data.user?.email);
      
      // Удаляем rate limit после успешной верификации
      await kv.del(`otp_sent:${email.toLowerCase().trim()}`);
      
      // Generate session ID and store in KV
      const sessionId = crypto.randomUUID();
      
      const sessionData = {
        user_id: data.user.id,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: data.user,
        created_at: Date.now()
      };
      
      console.log('💾 Сохранение сессии в KV store...');
      
      try {
        await kv.set(`session:${sessionId}`, sessionData);
        console.log('✅ Сессия сохранена в KV store');
      } catch (kvError: any) {
        console.error('❌ Ошибка сохранения в KV:', kvError.message);
        throw kvError;
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

  // ==================== CHECK OTP RATE LIMIT ====================
  
  app.get("/make-server-73d66528/auth/otp-rate-limit/:email", async (c) => {
    try {
      const email = c.req.param('email');
      
      if (!email) {
        return c.json({ error: 'Email обязателен' }, 400);
      }
      
      const normalizedEmail = email.toLowerCase().trim();
      console.log('🕒 Проверка rate limit для:', normalizedEmail);
      
      const key = `otp_sent:${normalizedEmail}`;
      const lastSentData = await kv.get(key);
      
      if (lastSentData) {
        const lastSentTime = lastSentData as number;
        const elapsedSeconds = Math.floor((Date.now() - lastSentTime) / 1000);
        const remainingSeconds = Math.max(0, OTP_RATE_LIMIT_SECONDS - elapsedSeconds);
        
        console.log(`   Последняя отправка: ${elapsedSeconds} сек назад, осталось: ${remainingSeconds} сек`);
        
        return c.json({
          allowed: remainingSeconds === 0,
          remainingSeconds
        });
      }
      
      console.log('   Rate limit не активен');
      return c.json({
        allowed: true,
        remainingSeconds: 0
      });
    } catch (error: any) {
      console.error('❌ Ошибка проверки rate limit:', error);
      return c.json({ error: 'Ошибка проверки rate limit' }, 500);
    }
  });

  // ==================== SIGN UP ====================

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
      
      // Validate email format
      const signupAtIndex = normalizedEmail.indexOf('@');
      if (signupAtIndex < 1) {
        return c.json({ error: 'Неверный формат email' }, 400);
      }
      const signupDomain = normalizedEmail.substring(signupAtIndex + 1);
      if (!signupDomain || !signupDomain.includes('.')) {
        return c.json({ error: 'Неверный формат email' }, 400);
      }
      
      // Validate email format (more strict)
      const localPart = normalizedEmail.substring(0, signupAtIndex);
      
      if (localPart.length === 0 || !/^[a-z]/.test(localPart)) {
        return c.json({ error: 'Email должен начинаться с буквы' }, 400);
      }
      
      if (localPart.length === 1) {
        if (!/^[a-z]$/.test(localPart)) {
          return c.json({ error: 'Email может содержать только буквы' }, 400);
        }
      } else {
        if (!/^[a-z][a-z0-9._-]*[a-z0-9]$/.test(localPart)) {
          return c.json({ error: 'Email может содержать только буквы, цифры, точки и дефисы' }, 400);
        }
        
        if (/\.\./.test(localPart)) {
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
        
        if (existingUser.email_confirmed_at) {
          console.error('❌ ПОЛЬЗОВАТЕЛЬ УЖЕ ЗАРЕГИСТРИРОВАН И ПОДТВЕРЖДЕН');
          return c.json({ error: 'Пользователь с этим email уже зарегистрирован' }, 409);
        }
        
        // Email not confirmed - resend OTP with rate limiting
        console.log('📨 Email не подтвержден, отправка нового OTP кода...');
        
        // Проверяем rate limit
        const rateLimitCheck = await checkOTPRateLimit(normalizedEmail);
        if (!rateLimitCheck.allowed) {
          console.log(`⏱️ Rate limit активен, осталось ${rateLimitCheck.remainingSeconds} сек`);
          return c.json({ 
            success: true, 
            requiresOTP: true,
            message: 'Код подтверждения отправлен',
            user_id: existingUser.id
          }, 200);
        }
        
        const { error: otpError } = await supabaseAuth.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            shouldCreateUser: false
          }
        });
        
        if (otpError) {
          console.error('❌ Ошибка отправки OTP:', otpError.message);
          return c.json({ error: 'Ошибка отправки кода подтверждения' }, 500);
        }
        
        console.log('✅ Новый OTP код отправлен на:', normalizedEmail);
        
        return c.json({ 
          success: true, 
          requiresOTP: true,
          message: 'Код подтверждения отправлен',
          user_id: existingUser.id
        }, 200);
      }
      
      // Upload avatar if provided
      let avatarUrl: string | undefined;
      
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
              public: true
            });
            if (createError) {
              console.error('❌ Ошибка создания bucket:', createError);
              avatarFile = null;
            }
          }

          if (avatarFile) {
            // Generate filename using email
            const fileExt = avatarFile.name.split('.').pop() || 'jpg';
            const tempFileName = `temp_${localPart}_${Date.now()}.${fileExt}`;
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
        }
      }
      
      // Create user with Supabase Auth using admin.createUser
      // ВАЖНО: email_confirm: false — требуем подтверждение через OTP
      const { data, error } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: password,
        email_confirm: false,
        user_metadata: {
          created_via: 'signup_with_otp',
          name: displayName || null,
          avatar_url: avatarUrl || null
        }
      });
      
      if (error) {
        console.error('❌ Ошибка создания пользователя:', error.message);
        return c.json({ error: error.message || 'Ошибка создания пользователя' }, error.status || 500);
      }
      
      if (!data.user) {
        console.error('❌ Пользователь не создан (data.user пустой)');
        return c.json({ error: 'Не удалось создать пользователя' }, 500);
      }
      
      console.log('✅ Пользователь создан:', data.user.id);
      console.log('   Email:', data.user.email);
      console.log('   Display Name:', displayName || 'не указано');
      
      // Проверяем rate limit перед отправкой OTP
      const rateLimitResult = await checkOTPRateLimit(normalizedEmail);
      
      // Отправляем OTP код на email для подтверждения
      console.log('📨 Отправка OTP кода для подтверждения email...');
      const { error: otpError } = await supabaseAuth.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false
        }
      });
      
      if (otpError) {
        console.error('⚠️ Ошибка отправки OTP:', otpError.message);
        // Пользователь создан, но OTP не отправлен — всё равно возвращаем requiresOTP
        // Пользователь сможет запросить повторную отправку
      } else {
        console.log('✅ OTP код отправлен на:', normalizedEmail);
      }
      
      return c.json({ 
        success: true, 
        requiresOTP: true,
        message: 'Код подтверждения отправлен на ваш email',
        user_id: data.user.id
      });
    } catch (error: any) {
      console.error('❌ Ошибка при регистрации:', error);
      return c.json({ error: error.message || 'Ошибка регистрации' }, 500);
    }
  });

  // ==================== USER MANAGEMENT (DEBUG) ====================

  // Delete user endpoint - DISABLED FOR SECURITY
  app.delete("/make-server-73d66528/auth/user/:email", async (c) => {
    console.warn('⚠️ Попытка удаления пользователя заблокирована (функция отключена из соображений безопасности)');
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
      console.log('🔍 Проверка существования пользователя:', normalizedEmail);
      
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
      
      if (existingUser) {
        return c.json({ 
          exists: true,
          user_id: existingUser.id,
          email_confirmed: !!existingUser.email_confirmed_at
        });
      }
      
      return c.json({ exists: false });
    } catch (error: any) {
      return handleError(c, 'Check User', error);
    }
  });

  // ==================== PROFILE ENDPOINTS ====================

  // Upload avatar
  app.post("/make-server-73d66528/profile/upload-avatar", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) {
        console.error('❌ Ошибка авторизации при загрузке аватара:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }

      console.log(`📤 Загрузка аватара для пользователя ${user.email}`);

      const formData = await c.req.formData();
      const avatarFile = formData.get('avatar') as File;

      if (!avatarFile) {
        return c.json({ error: 'Файл не найден' }, 400);
      }

      if (!avatarFile.type.startsWith('image/')) {
        return c.json({ error: 'Можно загружать только изображения' }, 400);
      }

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
          public: true
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

      // Add cache-busting parameter
      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

      console.log(`✅ Аватар загружен: ${cacheBustedUrl}`);

      return c.json({ avatar_url: cacheBustedUrl });
    } catch (error: any) {
      return handleError(c, 'Upload Avatar', error);
    }
  });

  // Update profile (display_name, avatar_url)
  app.post("/make-server-73d66528/profile/update", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) {
        console.error('❌ Ошибка авторизации при обновлении профиля:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const body = await c.req.json();
      const { display_name, avatar_url } = body;

      console.log(`💾 Обновление профиля для ${user.email}:`, { display_name, avatar_url: avatar_url ? 'да' : 'нет' });

      const updateData: any = {};
      
      if (display_name !== undefined) {
        updateData.name = display_name;
      }
      
      if (avatar_url !== undefined) {
        updateData.avatar_url = avatar_url;
      }

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

      return c.json({ success: true, user: data.user });
    } catch (error: any) {
      return handleError(c, 'Update Profile', error);
    }
  });

  // ==================== USER AVATAR (FOR MANAGEMENT) ====================

  // Upload user avatar (for UsersManagementModal)
  app.post("/make-server-73d66528/users/upload-avatar", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
      if (authError || !user) {
        console.error('❌ Ошибка авторизации при загрузке аватара пользователя:', authError);
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const formData = await c.req.formData();
      const avatarFile = formData.get('avatar') as File;
      const userId = formData.get('userId') as string;

      if (!avatarFile) {
        return c.json({ error: 'Файл не найден' }, 400);
      }

      if (!userId) {
        return c.json({ error: 'userId обязателен' }, 400);
      }

      console.log(`📤 Загрузка аватара для пользователя ${userId}`);

      if (!avatarFile.type.startsWith('image/')) {
        return c.json({ error: 'Можно загружать только изображения' }, 400);
      }

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
          public: true
        });
        if (createError) {
          console.error('❌ Ошибка создания bucket:', createError);
          return c.json({ error: 'Ошибка создания хранилища' }, 500);
        }
      }

      // Generate unique filename
      const fileExt = avatarFile.name.split('.').pop() || 'jpg';
      const fileName = `user_${userId}_${Date.now()}.${fileExt}`;
      const filePath = `users/${fileName}`;

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

      // Add cache-busting parameter
      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

      console.log(`✅ Аватар пользователя загружен: ${cacheBustedUrl}`);

      return c.json({ avatarUrl: cacheBustedUrl });
    } catch (error: any) {
      return handleError(c, 'Upload User Avatar', error);
    }
  });

}