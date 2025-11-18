# 🔍 Попытки импорта @supabase/supabase-js v3.4.0

**Дата**: 2025-11-18  
**Версия**: v3.4.0  
**Статус**: ❌ ПОДТВЕРЖДЕНО - ПАКЕТ НЕДОСТУПЕН

---

## 🎯 Проблема

Динамический импорт `import('@supabase/supabase-js')` вызывал ошибку сборки:
```
Error: Build failed with 1 error:
virtual-fs:file:///utils/supabase/client.ts:28:34: ERROR: [plugin: npm] Failed to fetch
```

## 💡 Гипотеза

На **сервере** (Edge Function) работает импорт через `jsr:`:
```typescript
import { createClient } from "jsr:@supabase/supabase-js@2";
```

Возможно на **клиенте** тоже нужен специальный спецификатор?

---

## ❌ Результаты тестирования

Попробовали **3 варианта** динамического импорта:

### Вариант 1: npm спецификатор ❌
```typescript
const module1 = await import('npm:@supabase/supabase-js');
```

**Ошибка сборки**:
```
ERROR: [plugin: npm] Failed to fetch
```

### Вариант 2: С версией ❌
```typescript
const module2 = await import('@supabase/supabase-js@2');
```

**Ошибка сборки**:
```
ERROR: [plugin: npm] Failed to fetch
```

### Вариант 3: Обычный импорт ❌
```typescript
const module3 = await import('@supabase/supabase-js');
```

**Ошибка сборки**:
```
ERROR: [plugin: npm] Failed to fetch
```

## 🎯 Вывод

**`@supabase/supabase-js` НЕДОСТУПЕН в Figma Make**

Все попытки динамического импорта вызывают ошибку на **этапе сборки** (не runtime).
Это означает что пакет не включён в whitelist разрешённых пакетов Figma Make.

---

## 📊 Ожидаемые результаты

### Сценарий 1: Один из вариантов РАБОТАЕТ ✅

**Логи в консоли**:
```
🔌 Попытка импорта: npm:@supabase/supabase-js
✅ Supabase клиент инициализирован через npm:
📡 Realtime статус: SUBSCRIBED
✅ Подключено к Realtime Presence
```

**Результат**: 🎉 **Realtime РАБОТАЕТ!** Курсоры включаются автоматически!

### Сценарий 2: Все варианты НЕ РАБОТАЮТ ❌

**Логи в консоли**:
```
🔌 Попытка импорта: npm:@supabase/supabase-js
❌ npm:@supabase/supabase-js: Failed to fetch
🔌 Попытка импорта: @supabase/supabase-js@2
❌ @supabase/supabase-js@2: Failed to fetch
🔌 Попытка импорта: @supabase/supabase-js
❌ @supabase/supabase-js: Failed to fetch
⚠️ @supabase/supabase-js недоступен - курсоры отключены
⚠️ Попробовали: npm:, @2, обычный импорт
⚠️ Supabase Realtime недоступен - курсоры отключены
```

**Результат**: ⚠️ Пакет **действительно недоступен** в Figma Make

---

## 🎯 Следующие шаги

### ✅ Что делаем

1. **Оставляем HTTP polling** ✅
   - Delta Sync работает (4 сек интервал)
   - OnlineUsers работает (30 сек heartbeat)
   - Приложение стабильно

2. **Оставляем код интеграции** ✅
   - `/utils/supabase/client.ts` - заглушка (не мешает)
   - `/contexts/PresenceContext.tsx` - gracefully disabled
   - `/components/scheduler/RealtimeCursors.tsx` - не рендерит ничего
   - Готово к будущей интеграции

3. **Документируем проблему** ✅
   - Этот файл - доказательство что пробовали
   - `/REALTIME_STATUS_v3.4.0.md` - финальный статус
   - Для будущей справки

### ⚠️ Опционально: Запрос к Figma Make

Если **очень нужен** Realtime:
1. Связаться с поддержкой Figma Make
2. Запросить добавление `@supabase/supabase-js` в whitelist
3. После добавления - протестировать (код уже готов)

**Но это НЕ КРИТИЧНО** - приложение работает отлично без Realtime!

---

## 📝 Как проверить результат

### 1. Откройте приложение в браузере

### 2. Откройте консоль (F12)

### 3. Смотрите логи при загрузке

**Если видите** `✅ Supabase клиент инициализирован`:
- 🎉 **РАБОТАЕТ!** Realtime доступен!
- Попробуйте тест с двумя пользователями

**Если видите** `⚠️ @supabase/supabase-js недоступен`:
- ⚠️ Пакет недоступен в Figma Make
- Приложение работает на HTTP polling (это ОК)

---

## 🔧 Технические детали

### Почему разные спецификаторы?

В Figma Make (и вообще в современных JS средах) есть разные источники пакетов:

1. **npm:** - пакеты из npm registry
2. **jsr:** - пакеты из JSR (JavaScript Registry от Deno)
3. **@version** - конкретная версия пакета
4. **обычный** - по умолчанию (обычно npm)

На **сервере** (Deno) используется JSR:
```typescript
import { createClient } from "jsr:@supabase/supabase-js@2";
```

На **клиенте** (браузер) JSR не поддерживается, нужен npm или обычный импорт.

### Почему динамический импорт?

Чтобы избежать ошибки сборки если пакет недоступен:
```typescript
// Статический импорт - ошибка сборки если пакет нет
import { createClient } from '@supabase/supabase-js'; // ❌

// Динамический импорт - ошибка только в runtime (можно обработать)
const module = await import('@supabase/supabase-js'); // ✅
```

### Почему не try/catch в корне модуля?

Top-level await может быть проблематичен, поэтому проверка происходит в функции `getSupabaseClient()`.

---

## 📚 Связанные файлы

- `/utils/supabase/client.ts` - обновлённый код с 3 вариантами импорта
- `/contexts/PresenceContext.tsx` - использует `getSupabaseClient()`
- `/components/scheduler/RealtimeCursors.tsx` - отображает курсоры
- `/REALTIME_STATUS_v3.4.0.md` - текущий статус интеграции

---

## 🎉 Ожидаемый результат

**Надеемся**: Один из вариантов импорта ЗАРАБОТАЕТ! 🤞

**Если нет**: Подтвердим что пакет недоступен и оставим HTTP polling.

---

**Готово к тестированию!** 🚀

Запустите приложение и проверьте логи в консоли!
