# Исправление "призраков" в онлайн статусе

## Проблема (до v1.8.8)

### Симптомы
Пользователь закрыл календарь воркспейса, но в списке воркспейсов его аватарка всё ещё показывается как "онлайн" **более 1-2 минут**.

### Причина
```
Пользователь в календаре воркспейса
  ↓
OnlineUsers отправляет heartbeat каждые 30 секунд
  ↓
Сервер сохраняет presence в KV Store с TTL 120 секунд (2 минуты)
  ↓
Пользователь закрывает календарь (переходит на список воркспейсов)
  ↓
OnlineUsers компонент размонтируется
  ↓
❌ НЕТ сигнала об уходе на сервер
  ↓
Сервер продолжает показывать пользователя "онлайн" пока не истечет TTL
  ↓
Через ~2 минуты presence удаляется автоматически
```

**Результат**: "Призраки" в списке онлайн пользователей - ушедшие пользователи продолжают отображаться.

## Решение (v1.8.8)

### Трёхступенчатое исправление

#### 1. Explicit "leave" при размонтировании

**OnlineUsers компонент** (`/components/scheduler/OnlineUsers.tsx`):

```typescript
// Новая функция для явного ухода
const sendLeave = useCallback(async () => {
  if (!accessToken) return;

  try {
    console.log('👋 Отправка leave для workspace:', workspaceId);
    
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/presence/leave/${workspaceId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      console.log('✅ Leave успешно отправлен - пользователь удалён из онлайн списка');
    }
  } catch (error) {
    console.warn('⚠️ Leave: ошибка', error);
  }
}, [workspaceId, accessToken]);

// Вызов при размонтировании
useEffect(() => {
  sendHeartbeat();
  const heartbeatInterval = setInterval(sendHeartbeat, 30000);

  return () => {
    clearInterval(heartbeatInterval);
    sendLeave(); // ← МГНОВЕННОЕ УДАЛЕНИЕ ИЗ ОНЛАЙН СПИСКА
  };
}, [sendHeartbeat, sendLeave]);
```

**Новый серверный endpoint** (`/supabase/functions/server/index.tsx`):

```typescript
// Leave workspace - явное удаление presence при закрытии календаря
app.delete("/make-server-73d66528/presence/leave/:workspaceId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // Verify user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(accessToken);
    if (authError || !user) {
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
```

#### 2. Уменьшен TTL с 120 до 60 секунд

**Зачем**: Если leave не дошёл (сетевая ошибка, закрытие вкладки, краш браузера) → автоматическое удаление в 2 раза быстрее.

**Изменения в сервере**:

```typescript
// Heartbeat endpoint - комментарий обновлён
// Сохраняем presence в KV Store с TTL 60 секунд (1 минута)
// Если пользователь закроет календарь и не отправит "leave", он исчезнет через 60 сек

// GET /presence/online/:workspaceId - фильтр обновлён
.filter(data => {
  if (!data) return false;
  const lastSeen = new Date(data.lastSeen).getTime();
  const age = now - lastSeen;
  return age < 60000; // 60 секунд (было 120000)
});

// POST /presence/online-batch - фильтр обновлён
return age < 60000; // 60 секунд (1 минута)
```

#### 3. Мгновенная очистка кэша при возврате

**Проблема**: "Мигание" текущего пользователя при возврате из календаря.

**App.tsx** (`handleBackToWorkspaces`):

```typescript
const handleBackToWorkspaces = async () => {
  console.log('🔙 Возврат к списку воркспейсов');
  
  // Мгновенно очищаем текущего пользователя из presence кэша
  // Это предотвращает "мигание" аватарки при возврате из календаря
  try {
    const { getEmailFromToken } = await import('./utils/jwt');
    const currentUserEmail = accessToken ? getEmailFromToken(accessToken) : null;
    
    if (currentUserEmail) {
      const cachedData = await getStorageJSON('cache_online_users_batch');
      
      if (cachedData?.data) {
        console.log('🧹 Очистка текущего пользователя из presence кэша:', currentUserEmail);
        
        // Удаляем текущего пользователя из всех воркспейсов в кэше
        const updatedData: Record<string, any[]> = {};
        
        for (const [workspaceId, users] of Object.entries(cachedData.data)) {
          updatedData[workspaceId] = (users as any[]).filter(
            (user: any) => user.email !== currentUserEmail
          );
        }
        
        // Сохраняем обновлённый кэш с тем же timestamp
        await setStorageJSON('cache_online_users_batch', {
          data: updatedData,
          timestamp: cachedData.timestamp
        });
        
        console.log('✅ Кэш очищен от текущего пользователя');
      }
    }
  } catch (error) {
    console.warn('⚠️ Ошибка очистки presence кэша:', error);
    // Не критично - кэш обновится через batch запрос
  }
  
  setSelectedWorkspace(null);
  window.history.pushState(null, '', '/');
  document.title = 'Planaro - Управление рабочими пространствами';
};
```

**Почему это важно**:
- WorkspaceListScreen читает кэш при монтировании (мгновенное отображение)
- Если не очистить кэш → текущий пользователь появится на 1-2 сек → исчезнет (мигание)
- С очисткой → пользователь сразу не видит себя в списке онлайн пользователей

**Timing**:
1. `handleBackToWorkspaces()` вызывается **ДО** размонтирования SchedulerMain
2. Очистка кэша происходит **ДО** монтирования WorkspaceListScreen
3. `sendLeave()` вызывается при размонтировании OnlineUsers (почти одновременно)
4. WorkspaceListScreen монтируется → читает уже очищенный кэш

#### 4. Graceful degradation

**Если leave не дошёл**:
- Сетевая ошибка → catch блок, лог в консоль
- Закрытие вкладки → запрос может не успеть отправиться
- Краш браузера → запрос не отправится

**Fallback**: В любом случае через **60 секунд** сервер автоматически удалит presence при следующем запросе `/presence/online/:workspaceId` (фильтр по TTL).

## Новая логика работы (с оптимизацией кэша)

```
Пользователь в календаре воркспейса
  ↓
OnlineUsers отправляет heartbeat каждые 30 секунд
  ↓
Сервер сохраняет presence в KV Store с TTL 60 секунд
  ↓
Пользователь нажимает "Назад" (закрывает календарь)
  ↓
handleBackToWorkspaces() → мгновенно очищает текущего юзера из cache_online_users_batch
  ↓
OnlineUsers размонтируется → useEffect cleanup
  ↓
sendLeave() отправляет DELETE /presence/leave/:workspaceId
  ↓
✅ Сервер мгновенно удаляет presence из KV Store
  ↓
WorkspaceListScreen монтируется → читает УЖЕ ОЧИЩЕННЫЙ кэш
  ↓
✅ Пользователь НЕ видит себя в списке (нет "мигания")
  ↓
Batch запрос (через 15 сек) → подтверждает отсутствие пользователя
  ↓
ИТОГО: 0 секунд задержки, никакого "мигания"
```

## Тестирование

### Сценарий 1: Нормальный leave (сеть работает)

**Шаги**:
1. Откройте 2 браузера (sa@kode.ru и test@kode.ru)
2. В браузере B: откройте календарь воркспейса → вы станете "онлайн"
3. В браузере A: откройте список воркспейсов → видите аватарку test@kode.ru
4. В браузере B: **нажмите "Назад" (закройте календарь)**
5. В браузере B DevTools → Console: должны быть логи:
   ```
   🔙 Возврат к списку воркспейсов
   🧹 Очистка текущего пользователя из presence кэша: test@kode.ru
   ✅ Кэш очищен от текущего пользователя
   👋 Отправка leave для workspace: 14
   ✅ Leave успешно отправлен - пользователь удалён из онлайн списка
   ```
6. В браузере B: **сразу после возврата** не видите свою аватарку (нет "мигания")
7. Подождите **15 секунд** (batch запрос в WorkspaceListScreen)
8. В браузере A: аватарка test@kode.ru **должна исчезнуть**

**Ожидаемые логи на сервере** (Supabase Edge Function logs):
```
👋 Leave от test@kode.ru из workspace 14
✅ Presence удалён: presence:14:c2bb8098-cd3b-4c77-8aaf-55c095ed3b21
```

**Результат**: 
- ✅ В браузере B: **мгновенно** не видит себя (кэш очищен)
- ✅ В браузере A: исчезает через 0-15 секунд (batch запрос)

### Сценарий 2: Leave не дошёл (эмуляция сетевой ошибки)

**Шаги**:
1. В браузере B: откройте календарь воркспейса
2. В браузере A: откройте список воркспейсов → видите аватарку
3. В браузере B DevTools → Network → **Throttle: Offline** (эмуляция сети)
4. В браузере B: закройте календарь (нажмите "Назад")
5. Подождите **60 секунд**
6. В браузере A: аватарка **должна исчезнуть** (через batch запрос)

**Ожидаемые логи в браузере B**:
```
👋 Отправка leave для workspace: 14
⚠️ Leave: ошибка Failed to fetch
```

**Результат**: ✅ Пользователь исчезает через **максимум 60 секунд** (TTL истекает, фильтр срабатывает).

### Сценарий 3: Закрытие вкладки браузера

**Шаги**:
1. В браузере B: откройте календарь воркспейса
2. В браузере A: откройте список воркспейсов → видите аватарку
3. В браузере B: **закройте вкладку** (крестик) или закройте весь браузер
4. В браузере A: подождите **60 секунд**
5. Аватарка **должна исчезнуть**

**Результат**: ✅ Leave запрос может не успеть отправиться, но через 60 секунд presence автоматически удаляется (TTL истекает).

## Метрики

### До v1.8.8
- Время удаления из онлайн списка: **90-120 секунд**
- Механизм: только TTL (2 минуты)
- "Призраки": часто показываются после ухода
- "Мигание" текущего пользователя: **да** (при возврате из календаря)

### После v1.8.8
- Время удаления из онлайн списка (другие пользователи): **0-15 секунд** (batch запрос)
- Время удаления текущего пользователя (в своём браузере): **0 секунд** (мгновенная очистка кэша)
- Время удаления при сетевых проблемах: **максимум 60 секунд** (fallback TTL)
- Механизм: explicit leave + очистка кэша + уменьшенный TTL
- "Призраки": практически отсутствуют
- "Мигание" текущего пользователя: **нет** (кэш очищается до монтирования WorkspaceListScreen)

## Troubleshooting

### Проблема: Leave не отправляется

**Симптомы**:
- Нет лога `👋 Отправка leave для workspace: X` в консоли
- Пользователь исчезает только через 60 секунд

**Решение**:
1. Проверьте что OnlineUsers компонент правильно размонтируется
2. Проверьте что useEffect cleanup срабатывает
3. Проверьте что accessToken не null при размонтировании
4. Добавьте `console.log` в cleanup:
   ```typescript
   return () => {
     console.log('🧹 OnlineUsers cleanup');
     clearInterval(heartbeatInterval);
     sendLeave();
   };
   ```

### Проблема: Сервер возвращает 401 Unauthorized

**Симптомы**:
- Лог `⚠️ Leave: сервер вернул ошибку 401`

**Решение**:
1. Токен мог истечь между открытием календаря и закрытием
2. Это не критично - сработает fallback (60 секунд TTL)
3. Можно добавить refresh token логику перед leave

### Проблема: Пользователь всё равно показывается 60+ секунд

**Симптомы**:
- Leave отправлен успешно, но пользователь не исчезает

**Решение**:
1. Проверьте логи на сервере - удаляется ли presence из KV Store
2. Проверьте что batch запрос в WorkspaceListScreen срабатывает каждые 15 секунд
3. Проверьте что фильтр `age < 60000` применяется корректно
4. Очистите IndexedDB кэш: DevTools → Application → Storage → Clear storage

## Дополнительные улучшения (future)

### Потенциальные оптимизации:

1. **Server-Sent Events (SSE)**:
   - Real-time обновление онлайн списка без polling
   - Сервер отправляет события при leave/join
   - Убирает задержку в 0-15 секунд

2. **WebSockets**:
   - Двусторонняя связь для мгновенных обновлений
   - Может быть overkill для простого presence

3. **Beacon API**:
   - Гарантированная отправка leave при закрытии вкладки
   - `navigator.sendBeacon()` отправляет запрос даже если вкладка закрывается
   - Поддерживается всеми современными браузерами

### Пример с Beacon API:

```typescript
// В OnlineUsers компоненте
useEffect(() => {
  const handleUnload = () => {
    if (accessToken && workspaceId) {
      // Beacon API - гарантированная отправка при unload
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/presence/leave/${workspaceId}`;
      const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
      
      navigator.sendBeacon(url, blob);
      console.log('📡 Beacon leave отправлен');
    }
  };

  window.addEventListener('beforeunload', handleUnload);
  return () => window.removeEventListener('beforeunload', handleUnload);
}, [accessToken, workspaceId]);
```

**Плюсы**: Работает при закрытии вкладки
**Минусы**: Не работает при навигации внутри SPA (нужно использовать оба метода)

---

**Версия**: 1.8.8
**Дата**: 2025-10-21
**Статус**: ✅ Реализовано и протестировано
