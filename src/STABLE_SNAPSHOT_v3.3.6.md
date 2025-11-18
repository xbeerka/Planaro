# 📸 СТАБИЛЬНАЯ ВЕРСИЯ v3.3.6 - SNAPSHOT

**Дата фиксации**: 2025-11-18  
**Статус**: ✅ СТАБИЛЬНАЯ, PRODUCTION-READY  
**Последнее критическое исправление**: Undo/Redo синхронизация изменённых событий

---

## 🎯 Что работает

### ✅ Основной функционал
- **Календарь 52 недели** с sticky заголовками
- **Drag & Drop событий** с snap-to-grid
- **Resize в 4 направлениях** (top, bottom, left, right)
- **Режим ножниц** для разделения событий
- **Z-order управление** для перекрывающихся событий
- **Undo/Redo** с горячими клавишами (Ctrl+Z, Ctrl+Shift+Z)
- **Фильтрация** по департаментам и проектам
- **Автоскролл** к текущей неделе

### ✅ Аутентификация
- **Email + пароль** вход
- **OTP** (one-time password) вход
- **30-дневные сессии** с автообновлением токенов
- **Только @kode.ru** email домен
- **JWT с кириллицей** через `/utils/jwt.ts`

### ✅ Управление данными
- **Воркспейсы** - организация проектов по рабочим пространствам
- **Департаменты** с сортировкой (queue)
- **Сотрудники** с грейдами и компаниями
- **Проекты** с автогенерацией цветов
- **События** с паттернами (vacation, bench, etc.)
- **Профиль пользователя** с аватаркой

### ✅ Онлайн пользователи (Presence)
- **HTTP-based система** с heartbeat каждые 30 секунд
- **Graceful leave** при закрытии календаря
- **Batch оптимизация** для списка воркспейсов
- **Кэширование** (TTL 45 секунд) для мгновенного отображения
- **Аватарки** из user_metadata токена

### ✅ Delta Sync автообновление
- **Delta Sync**: каждые 4 секунды (только изменённые события) ⚡
- **Full Sync**: каждые 30 секунд (обнаружение удалений) 🔄
- **Защита от конфликтов** при drag/drop и resize
- **Минимальный трафик** - только изменённые данные
- **Автоматическая синхронизация** сотрудников, департаментов, проектов (каждые 15 секунд)

### ✅ Undo/Redo (полностью исправлено в v3.3.6)
- **CREATE**: восстановление удалённых событий
- **UPDATE**: синхронизация изменённых событий (высота, позиция, проект)
- **DELETE**: удаление событий с сервера
- **Защита от race condition** с Full Sync
- **Синхронизация проектов** при Undo/Redo
- **Максимум 50 состояний** в истории

### ✅ Умная склейка событий
- **Pixel-perfect позиционирование** (целые пиксели)
- **Унифицированные отступы** (cellPadding = gap)
- **Адаптивные скругления** (внешние + внутренние)
- **7 правил склейки** (оптимизировано v6.0)
- **Горизонтальная склейка** с умными отступами
- **Откусывание** только при двойном gap (v5.23)

---

## 🏗️ Архитектура

### Frontend (React + TypeScript)
```
/components
  /auth - AuthScreen
  /scheduler - основные компоненты календаря
  /workspace - список и создание воркспейсов
  /ui - shadcn компоненты

/contexts
  - SchedulerContext.tsx - глобальное состояние
  - FilterContext.tsx - фильтры
  - SettingsContext.tsx - настройки размеров

/hooks
  - useEventInteractions.ts - drag, drop, resize
  - useHistory.ts - undo/redo
  - useKeyboardShortcuts.ts - хоткеи
  - usePanning.ts - панорамирование

/services/api - API клиенты

/types/scheduler.ts - TypeScript интерфейсы

/utils
  - jwt.ts - JWT декодирование с кириллицей
  - eventNeighbors.v6.ts - склейка событий (оптимизировано)
  - indexedDBCache.ts - кэширование
```

### Backend (Supabase Edge Function на Hono)
```
/supabase/functions/server/index.tsx - единый файл со всеми routes
```

### Database (Supabase PostgreSQL)
```
Основные таблицы:
- workspaces (воркспейсы с годом)
- workspaces_summary (сводка по воркспейсам)
- departments (отделы с queue)
- users (сотрудники)
- projects (проекты с цветами)
- events (события)
- event_patterns (паттерны)
- grades (грейды)
- companies (компании)

KV Store:
- kv_store_73d66528 (ключ-значение для всего остального)
```

---

## 📊 Производительность

### Оптимизации
- **React.memo** для OnlineUsers, SchedulerEvent
- **useMemo/useCallback** для стабильности пропсов
- **Batch операции** через Promise.all()
- **Параллельные запросы** для загрузки данных
- **Индексация событий** для склейки (O(1) вместо O(n))
- **Кэширование** воркспейсов, онлайн пользователей
- **Режим производительности** (gap = 0, без паттернов)

### Метрики
- **Delta Sync**: 4 секунды (очень быстро!)
- **Full Sync**: 30 секунд (обнаружение удалений)
- **Heartbeat**: 30 секунд (presence)
- **Нагрузка**: ~29 запросов/минуту/пользователь

---

## 🔑 API Endpoints (важные)

### Аутентификация
- `POST /make-server-73d66528/auth/login` - вход (email + password)
- `POST /make-server-73d66528/auth/signup` - регистрация
- `POST /make-server-73d66528/auth/otp/send` - отправка OTP
- `POST /make-server-73d66528/auth/otp/verify` - проверка OTP
- `POST /make-server-73d66528/auth/logout` - выход
- `GET /make-server-73d66528/auth/session` - проверка сессии

### События
- `GET /make-server-73d66528/events?workspace_id=X` - получить все события
- `GET /make-server-73d66528/events/changes?workspace_id=X&since=TIMESTAMP` - Delta Sync
- `POST /make-server-73d66528/events/batch` - batch операции (create/update/delete)
- `DELETE /make-server-73d66528/events/:id` - удалить событие

### Presence
- `POST /make-server-73d66528/presence/heartbeat/:workspaceId` - heartbeat
- `GET /make-server-73d66528/presence/online/:workspaceId` - онлайн пользователи
- `POST /make-server-73d66528/presence/batch` - batch запрос онлайн пользователей
- `DELETE /make-server-73d66528/presence/leave/:workspaceId` - graceful leave

### Профиль
- `POST /make-server-73d66528/profile/upload-avatar` - загрузка аватарки
- `PATCH /make-server-73d66528/profile/update` - обновление профиля

---

## 🐛 Известные ограничения

### ❌ НЕ работает (отключено)
- **Collaborative Cursors** - WebSocket нестабильны в Edge Functions (v1.9.2)
- **Realtime Broadcast** - `@supabase/supabase-js` недоступен (v1.9.3)

### ⚠️ Требует внимания
- **Миграции БД** - не поддерживаются в Figma Make
- **WebSocket** - нестабильно в Edge Functions
- **Supabase Realtime** - НЕ протестировано (может работать после настройки)

---

## 📚 Ключевые файлы

### Обязательно изучи
1. `/guidelines/Guidelines.md` - полная документация проекта
2. `/types/scheduler.ts` - все TypeScript интерфейсы
3. `/contexts/SchedulerContext.tsx` - глобальное состояние
4. `/supabase/functions/server/index.tsx` - все API endpoints
5. `/components/scheduler/SchedulerMain.tsx` - главный компонент календаря
6. `/hooks/useEventInteractions.ts` - drag & drop логика
7. `/hooks/useHistory.ts` - undo/redo
8. `/utils/jwt.ts` - JWT с кириллицей
9. `/utils/eventNeighbors.v6.ts` - склейка событий (оптимизировано)

### Защищённые файлы (НЕ ИЗМЕНЯТЬ!)
- `/supabase/functions/server/kv_store.tsx`
- `/utils/supabase/info.tsx`
- `/components/figma/ImageWithFallback.tsx`

---

## 🚀 Deployment

### Edge Function
- **Название**: `make-server-73d66528`
- **Deploy**: `supabase functions deploy make-server-73d66528`
- **Health**: `GET /make-server-73d66528/health`

### Переменные окружения (настроены)
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `SUPABASE_DB_URL`

---

## 📝 Последние критические исправления

### v3.3.6 (2025-11-18)
**Undo/Redo синхронизация изменённых событий**
- ✅ Разделение на CREATE + UPDATE в `syncRestoredEventsToServer()`
- ✅ Batch операции в одном запросе
- ✅ Защита от race condition с Full Sync
- ✅ Детальное логирование

### v3.3.5 (2025-11-18)
**Drag/Resize синхронизация**
- ✅ Блокировка Delta Sync при взаимодействии
- ✅ Блокировка после локальных изменений (2 сек)

### v3.3.3 (2025-11-18)
**Undo/Redo удалённых событий**
- ✅ `syncDeletedEventsToServer()` для синхронизации удалений
- ✅ Маркировка в `deletedEventIdsRef`
- ✅ Full Sync НЕ возвращает удалённые события

### v3.3.2 (2025-11-18)
**Undo/Redo синхронизация проектов**
- ✅ `resetProjectsSyncTimer()` блокирует polling на 2 секунды
- ✅ Проекты НЕ перезаписываются после Undo/Redo

### v3.3.1 (2025-11-18)
**Защита истории от коррупции**
- ✅ Блокировка сохранения событий без проектов
- ✅ Детальное логирование

---

## ✅ Чек-лист перед изменениями

1. ✅ Версия v3.3.6 стабильна
2. ✅ Все критические баги исправлены
3. ✅ Delta Sync работает корректно
4. ✅ Undo/Redo работает полностью (CREATE + UPDATE + DELETE)
5. ✅ Онлайн пользователи работают
6. ✅ Аватарки отображаются
7. ✅ Склейка событий работает корректно
8. ✅ Производительность оптимизирована

---

## 🔜 Что дальше?

### Попытка интеграции Supabase Realtime
**Причина**: предыдущие попытки (v1.9.2, v1.9.3) провалились из-за:
- Отсутствия настроек в Supabase UI
- Ошибки сборки `@supabase/supabase-js`
- Нестабильности WebSocket

**План**:
1. Проверить доступность `@supabase/supabase-js` в Figma Make
2. Настроить Realtime в Supabase Dashboard (через нейронку)
3. Попробовать Realtime Presence для онлайн пользователей
4. Попробовать Realtime Broadcast для Delta Sync
5. Fallback на HTTP polling если не сработает

**Преимущества Realtime**:
- ⚡ Мгновенные обновления (вместо 4 секунд)
- 📉 Минимальная нагрузка (WebSocket вместо polling)
- 🎯 Нативная интеграция с Supabase
- 🔄 Автоматический реконнект

---

**Сохранено**: 2025-11-18  
**Следующий шаг**: Настройка Supabase Realtime через нейронку  
**Fallback**: Текущая стабильная версия v3.3.6 с HTTP polling
