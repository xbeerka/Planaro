import { Hono } from "npm:hono";
import { createAuthClient, handleError, retryOperation } from './server_utils.tsx';
import * as kv from './kv_store.tsx';

// Initialize auth client
const supabaseAuth = createAuthClient();

export function registerPresenceRoutes(app: Hono) {

  // ==================== PRESENCE ====================

  // Send heartbeat - mark user as online in workspace
  app.post("/make-server-73d66528/presence/heartbeat", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      if (!accessToken) {
        console.error('❌ Heartbeat: токен не передан');
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Verify user with try-catch and retry logic
      let user;
      try {
        const { data, error: authError } = await retryOperation(
          () => supabaseAuth.auth.getUser(accessToken),
          3, // max retries
          1000, // initial delay
          'Auth check (Heartbeat)'
        );

        if (authError || !data?.user) {
          console.error('❌ Ошибка авторизации при heartbeat:', authError?.message || 'No user data');
          return c.json({ error: 'Unauthorized' }, 401);
        }
        user = data.user;
      } catch (authException: any) {
        // Handle connection reset specifically
        if (authException.message && (authException.message.includes('Connection reset') || authException.message.includes('os error 104'))) {
          console.warn('⚠️ Connection reset error in auth check (Heartbeat). Skipping auth verification for heartbeat to avoid client error.');
          // For heartbeats, we can be slightly lenient if the auth server is flaky
          // But we need user ID. If we can't get it, we can't update presence.
          // However, we can try to decode the JWT locally (unverified) just to get the SUB (user_id) if verified call fails.
          // Or we can just fail gracefully without 500.
          return c.json({ error: 'Auth service temporary unavailable' }, 503);
        }

        console.error('❌ Exception при проверке токена в heartbeat:', authException);
        return c.json({ error: 'Invalid token' }, 401);
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
      return handleError(c, 'Heartbeat', error);
    }
  });

  // Get online users for multiple workspaces (batch request)
  app.post("/make-server-73d66528/presence/online-batch", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      if (!accessToken) {
        console.error('❌ Online-batch: токен не передан');
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Verify user with try-catch and retry logic
      let user;
      try {
        const { data, error: authError } = await retryOperation(
          () => supabaseAuth.auth.getUser(accessToken),
          3,
          1000,
          'Auth check (Batch Online)'
        );

        if (authError || !data?.user) {
          console.error('❌ Ошибка авторизации при batch получении онлайн пользователей:', authError?.message || 'No user data');
          return c.json({ error: 'Unauthorized' }, 401);
        }
        user = data.user;
      } catch (authException: any) {
         if (authException.message && (authException.message.includes('Connection reset') || authException.message.includes('os error 104'))) {
          console.warn('⚠️ Connection reset error in auth check (Batch Online). Returning empty list to prevent crash.');
          // Graceful degradation: return empty workspaces if auth fails
          return c.json({ workspaces: {} }, 200);
        }

        console.error('❌ Exception при проверке токена в online-batch:', authException);
        return c.json({ error: 'Invalid token' }, 401);
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
      return handleError(c, 'Batch Online Users', error);
    }
  });

  // Get online users for specific workspace
  app.get("/make-server-73d66528/presence/online/:workspaceId", async (c) => {
    const startTime = Date.now();
    
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      if (!accessToken) {
        console.error('❌ Online/:workspaceId: токен не передан');
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Verify user with try-catch and retry logic
      let user;
      try {
        const { data, error: authError } = await retryOperation(
          () => supabaseAuth.auth.getUser(accessToken),
          3,
          1000,
          'Auth check (Online Users)'
        );

        if (authError || !data?.user) {
          console.error('❌ Ошибка авторизации при получении онлайн пользователей:', authError?.message || 'No user data');
          return c.json({ error: 'Unauthorized' }, 401);
        }
        user = data.user;
      } catch (authException: any) {
        if (authException.message && (authException.message.includes('Connection reset') || authException.message.includes('os error 104'))) {
          console.warn('⚠️ Connection reset error in auth check (Online Users). Returning empty list.');
          // Graceful degradation
          return c.json({ users: [] }, 200);
        }

        console.error('❌ Exception при проверке токена в online/:workspaceId:', authException);
        return c.json({ error: 'Invalid token' }, 401);
      }

      const workspaceId = c.req.param('workspaceId');
      console.log(`👥 Запрос онлайн пользователей для workspace ${workspaceId}`);

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
          // Фильтруем записи старше 60 секунд (60000 мс)
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

  // Leave workspace - явное удаление presence при закрытии календаря
  app.delete("/make-server-73d66528/presence/leave/:workspaceId", async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      
      if (!accessToken) {
        console.error('❌ Leave: токен не передан');
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Verify user with try-catch and retry logic
      let user;
      try {
        const { data, error: authError } = await retryOperation(
          () => supabaseAuth.auth.getUser(accessToken),
          3,
          1000,
          'Auth check (Leave)'
        );
        
        if (authError || !data?.user) {
          console.error('❌ Ошибка авторизации в leave endpoint:', authError?.message || 'No user data');
          return c.json({ error: 'Unauthorized' }, 401);
        }
        user = data.user;
      } catch (authException: any) {
        console.error('❌ Exception при проверке токена в leave:', authException);
        return c.json({ error: 'Invalid token' }, 401);
      }

      const workspaceId = c.req.param('workspaceId');
      console.log(`👋 Leave от ${user.email} из workspace ${workspaceId}`);

      // Удаляем presence из KV Store
      const presenceKey = `presence:${workspaceId}:${user.id}`;
      await kv.del(presenceKey);

      console.log(`✅ Presence удалён: ${presenceKey}`);

      return c.json({ success: true });
    } catch (error: any) {
      return handleError(c, 'Leave Workspace', error);
    }
  });

}
