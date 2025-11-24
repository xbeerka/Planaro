# Release Notes v3.3.22

## 🎯 Цель релиза
Исправление проблемы с неинформативной ошибкой "Failed to fetch" при синхронизации восстановленных событий (Undo/Redo).

---

## 🐛 Исправленные проблемы

### Проблема 1: Неинформативная ошибка
**До исправления:**
```
❌ Failed to fetch (попытка 1/3)
```
- Невозможно определить причину ошибки
- Нет информации о параметрах запроса
- Нет инструкций по исправлению

**После исправления:**
```
🔍 BATCH: Валидация параметров...
   projectId: "zhukuvbdjyneoloarlqy" (тип: string)
   accessToken: "eyJhbGciOiJIUzI1NiIsI..." (длина: 512)
   workspaceId: 14 (тип: number)
✅ BATCH: Валидация пройдена
📦 BATCH: Отправка запроса к: https://zhukuvbdjынeoloarlqy.supabase.co/functions/v1/make-server-73d66528/events/batch
✅ BATCH: Получен ответ от сервера (status: 200)
```

### Проблема 2: Невалидные параметры не блокируются
**До исправления:**
- `projectId = "undefined"` отправлялся в запрос
- `accessToken = undefined` не блокировал запрос
- Ошибка возникала только при fetch

**После исправления:**
```typescript
// Строгая валидация ПЕРЕД запросом
if (!projectId || projectId === 'undefined' || projectId === 'null' || projectId.trim() === '') {
  throw new Error(`Invalid project ID: "${projectId}". Check /utils/supabase/info.tsx`);
}
if (!accessToken || accessToken === 'undefined' || accessToken === 'null' || accessToken.trim() === '') {
  throw new Error('Invalid access token. Please re-login.');
}
```

### Проблема 3: Зависшие запросы
**До исправления:**
- Запросы могли зависать бесконечно
- Нет таймаута

**После исправления:**
```typescript
// Таймаут 15 секунд
const controller = new AbortController();
const timeoutId = setTimeout(() => {
  console.error('❌ BATCH: Таймаут 15 секунд истёк');
  controller.abort();
}, 15000);
```

---

## ✨ Новые возможности

### 1. Детальное логирование параметров
```
🔍 BATCH: Валидация параметров...
   projectId: "zhukuvbdjyneoloarlqy" (тип: string)
   accessToken: "eyJhbGciOiJIUzI1NiIsI..." (длина: 512)
   workspaceId: 14 (тип: number)
```

### 2. Логирование HTTP статуса
```
✅ BATCH: Получен ответ от сервера (status: 200)
```

### 3. Детальная информация об ошибках fetch
```
❌ BATCH: Ошибка fetch: {
  name: 'TypeError',
  message: 'Failed to fetch',
  cause: undefined,
  stack: '...'
}
```

### 4. Понятные сообщения об ошибках
```
❌ Ошибка синхронизации: Error: Network error: Failed to fetch. Check server availability and CORS settings.
```

### 5. Обработка таймаутов
```
❌ BATCH: Таймаут 15 секунд истёк
❌ BATCH: Запрос прерван по таймауту (15 сек)
❌ Ошибка: Request timeout after 15 seconds. Server may be overloaded or Edge Function not responding.
```

---

## 🔧 Технические детали

### Затронутые файлы:
- `/contexts/SchedulerContext.tsx` (строки 1305-1370)
- `/QUICK_DEBUG_FAILED_FETCH_v3.3.22.md` (новый)
- `/QUICK_TEST_FETCH_FIX_v3.3.22.md` (новый)
- `/CHANGELOG.md`

### Изменения в коде:

#### 1. Строгая валидация (строки 1305-1324)
```typescript
// БЫЛО (v3.3.21):
if (!accessToken) {
  throw new Error('Access token is required');
}
if (!projectId) {
  throw new Error('Project ID is required');
}

// СТАЛО (v3.3.22):
console.log('🔍 BATCH: Валидация параметров...');
console.log(`   projectId: "${projectId}" (тип: ${typeof projectId})`);
console.log(`   accessToken: ${accessToken ? `"${accessToken.substring(0, 20)}..." (длина: ${accessToken.length})` : 'ОТСУТСТВУЕТ'}`);
console.log(`   workspaceId: ${workspaceId} (тип: ${typeof workspaceId})`);

if (!projectId || projectId === 'undefined' || projectId === 'null' || projectId.trim() === '') {
  console.error('❌ BATCH: projectId невалиден!', { projectId, type: typeof projectId });
  throw new Error(`Invalid project ID: "${projectId}". Check /utils/supabase/info.tsx`);
}
// ... аналогично для accessToken
```

#### 2. Таймаут для fetch (строки 1330-1355)
```typescript
// БЫЛО (v3.3.21):
const response = await fetch(batchUrl, {
  method: 'POST',
  headers: { /* ... */ },
  body: JSON.stringify({ operations })
});

// СТАЛО (v3.3.22):
const controller = new AbortController();
const timeoutId = setTimeout(() => {
  console.error('❌ BATCH: Таймаут 15 секунд истёк');
  controller.abort();
}, 15000);

try {
  response = await fetch(batchUrl, {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify({ operations }),
    signal: controller.signal // ← Добавлен signal
  });
  clearTimeout(timeoutId);
  console.log(`✅ BATCH: Получен ответ от сервера (status: ${response.status})`);
} catch (fetchError: any) {
  clearTimeout(timeoutId);
  
  if (fetchError.name === 'AbortError') {
    throw new Error('Request timeout after 15 seconds. Server may be overloaded or Edge Function not responding.');
  }
  
  console.error('❌ BATCH: Ошибка fetch:', {
    name: fetchError.name,
    message: fetchError.message,
    cause: fetchError.cause,
    stack: fetchError.stack
  });
  
  throw new Error(`Network error: ${fetchError.message}. Check server availability and CORS settings.`);
}
```

#### 3. Обработка ошибок парсинга (строки 1357-1370)
```typescript
// БЫЛО (v3.3.21):
if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error || 'Batch operation failed');
}

// СТАЛО (v3.3.22):
if (!response.ok) {
  let errorData: any;
  try {
    errorData = await response.json();
  } catch (parseError) {
    console.error('❌ BATCH: Не удалось распарсить ответ сервера');
    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
  }
  console.error('❌ BATCH: ответ сервера:', errorData);
  throw new Error(errorData.error || `Batch operation failed with status ${response.status}`);
}
```

---

## 🧪 Тестирование

### Быстрый тест:
1. Создайте событие (Ctrl+Click)
2. Сделайте drag
3. Нажмите Ctrl+Z (Undo)
4. Проверьте консоль → должны видеть:
   ```
   🔍 BATCH: Валидация параметров...
   ```

### Полный план тестирования:
См. `/QUICK_TEST_FETCH_FIX_v3.3.22.md`

---

## 📚 Документация

### Новые документы:
- `/QUICK_DEBUG_FAILED_FETCH_v3.3.22.md` - диагностика ошибок "Failed to fetch"
- `/QUICK_TEST_FETCH_FIX_v3.3.22.md` - план тестирования исправления
- `/RELEASE_NOTES_v3.3.22.md` - этот документ

### Обновлённые документы:
- `/CHANGELOG.md` - добавлена запись v3.3.22

---

## 🚀 Миграция

### Обратная совместимость:
✅ **Полностью совместимо с предыдущими версиями**
- Нет изменений в API
- Нет изменений в структуре данных
- Только улучшенная валидация и логирование

### Действия после обновления:
1. Проверьте что `/utils/supabase/info.tsx` заполнен корректно
2. Проверьте логи в консоли при Undo/Redo
3. Убедитесь что нет ошибок валидации

---

## 🎯 Метрики успеха

### До исправления:
- ❌ "Failed to fetch" без контекста
- ❌ Невозможно определить причину
- ❌ Запросы могут зависать

### После исправления:
- ✅ Детальные логи с параметрами
- ✅ Валидация блокирует невалидные запросы
- ✅ Таймаут 15 секунд
- ✅ Понятные сообщения об ошибках
- ✅ Инструкции по исправлению

---

**Версия**: v3.3.22  
**Дата релиза**: 2025-11-19  
**Приоритет**: 🔴 КРИТИЧЕСКИЙ  
**Статус**: ✅ Готово к развёртыванию  
**Автор**: AI Assistant
