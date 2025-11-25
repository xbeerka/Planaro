# Resource Scheduler - Руководство по разработке

## 🎯 Общие принципы

### Архитектура
- **Трёхуровневая архитектура**: Frontend (React) → Backend (Supabase Edge Function на Hono) → Database (Supabase PostgreSQL)
- **Аутентификация**: Только корпоративные email @kode.ru
- **Персистентность**: 30-дневные сессии с автоматическим обновлением токенов
- **Структура воркспейсов**: Воркспейс → Департаменты → Сотрудники → События проектов

### Правила кода
- **Используй TypeScript** для всех новых файлов
- **Следуй существующей структуре** - не меняй организацию папок без необходимости
- **Все изменения только по кнопке "Сохранить"** - никаких автосохранений в модальных окнах
- **Логирование обязательно** - детальные console.log на важных этапах для диагностики
- **Параллельное выполнение** - используй Promise.all() для batch операций

## 🗄️ База данных

### Основные таблицы
- `workspaces` - воркспейсы с привязкой к году
- `workspaces_summary` - сводная информация (кол-во департаментов, дата обновления)
- `departments` - отделы с queue (порядок сортировки) в рамках воркспейса
- `users` - сотрудники с привязкой к департаменту, грейду и компании
- `projects` - проекты с цветами (backgroundColor, textColor) и workspace_id
- `events` - события с привязкой к сотруднику, проекту, паттерну
- `event_patterns` - паттерны событий (vacation, bench, etc.)
- `grades` - грейды сотрудников (junior, middle, senior, lead)
- `companies` - компании

### Правила работы с БД
- **Не создавай миграции** - используй существующую схему
- **Используй только KV Store** для дополнительных данных (через `/supabase/functions/server/kv_store.tsx`)
- **Traceability** - всегда логируй SQL запросы на сервере
- **Валидация на сервере** - проверяй обязательные поля (workspace_id, department_id и т.д.)
- **Presence система** - для отслеживания онлайн пользователей используй KV Store с TTL (2 минуты)

### Стандарт временных ID

**Для событий (SchedulerEvent)**:
- **Формат**: `ev_temp_${timestamp}_${random}`
- **Пример**: `ev_temp_1732005123456_78901`
- **Проверка**: `id.startsWith('ev_temp_')` ← **КРИТИЧНО: с подчеркиванием в конце!**
- **Причина**: Паттерн `'ev_temp'` (без подчеркивания) может пропустить некорректные ID типа `ev_tempo_XXX`

**Для других сущностей** (модалки управления):
- **Департаменты**: `temp-${Date.now()}-${Math.random()}`
- **Проекты**: `temp-${Date.now()}-${Math.random()}`
- **Пользователи**: `temp-${Date.now()}-${Math.random()}`
- **Проверка**: `id.startsWith('temp-')` или проверка по наличию `tempId` в объекте

## 🎨 UI/UX Правила

### Календарь
- **52 недели в году** - понедельник как начало недели
- **Динамические размеры**: weekWidth (48-220px), rowHeight (48-144px)
- **Унифицированные отступы**: `cellPadding = gap` (одиночные события имеют одинаковые отступы 4px со всех сторон)
- **Sticky заголовки** - месяцы, недели и имена ресурсов
- **Маркер текущей недели** - красная вертикальная линия (z-index: 145)
- **Автоскролл к текущей неделе** - только для воркспейсов текущего года

### События
- **Drag & Drop** - курсорное позиционирование, snap-to-grid для недель
  - **Drag от точки захвата (v1.4.0)** - при захвате события вычисляется за какой юнит взялись (offsetUnit), этот юнит следует за курсором
  - **Определение строки по курсору** - событие переносится на новую строку только когда курсор реально на ней
  - **Математика**: `offsetUnit = floor(offsetY / unitStride)` при startDrag, `unitStart = floor(withinRow / unitStride) - offsetUnit` при move
- **Resize** - 4 направления (top, bottom, left, right) с плавной анимацией
- **Gap Handles (v1.5.0)** - двусторонний resize границ между событиями при зажатой Cmd/Ctrl
  - При зажатой Cmd/Ctrl появляются синие пипки на промежутках между событиями
  - Вертикальные handles: между событиями сверху-снизу (одна неделя, касаются)
  - Горизонтальные handles: между событиями слева-справа (касаются, перекрываются)
  - Drag handle изменяет оба события одновременно (граница двигается)
  - Валидация: события не могут исчезнуть или выйти за пределы
- **Режим ножниц** - разделение событий на границах недель
- **Z-order управление** - клик для поднятия события наверх
- **Анимации** - transition 0.15s cubic-bezier для плавности
- **Pending состояние** - opacity 0.6 + diagonal stripes для событий в процессе сохранения
- **Sticky названия проектов** - при горизонтальном скролле название события остается видимым (position: sticky на .ev-name, background: inherit)
- **Спиннер загрузки** - использует textColor проекта из БД, размер 10px, с border-color opacity 20% и border-top-color 100%

### Модальные окна
- **Сохранение только по кнопке в футере** - никаких onChange автосохранений, никаких встроенных кнопок в формах
- **Единообразный UX** - при нажатии "Добавить" появляется новая строка в списке (можно добавить хоть 10 пустых)
- **Локальное состояние для новых** - новые элементы хранятся в массиве localNew* до сохранения, не создаются в БД сразу
- **Локальное состояние для удаленных** - удаленные элементы помечаются в массиве deletedIds, удаление на сервере происходит при "Сохранить"
- **Порядок сохранения**: 1) Удаление (deletedIds), 2) Создание (валидные localNew*), 3) Обновление (существующие с изменениями)
- **Умная кнопка "Сохранить"** - выполняет все операции в правильном порядке через Promise.all()
- **Кнопка "Отмена"** - всегда закрывает модалку целиком с проверкой hasChanges
- **Автоматическое отслеживание изменений** - hasChanges учитывает новые строки, deletedIds и изменения существующих
- **Визуальное выделение новых строк** - фон bg-blue-50, рамка border-2 border-blue-300
- **Корзина для любых строк** - удаление помечает элемент, реальное удаление при "Сохранить"
- **Confirm для удаления** - с предупреждением "Удаление будет выполнено после нажатия Сохранить"
- **Валидация перед открытием** - проверка наличия проектов перед созданием событий
- **Toast уведомления** - вместо alert() использовать toast (success, error, warning, info)
- **Параллельное сохранение** - Promise.all() для массовых изменений
- **Умная сортировка проектов (v1.6.0)** - проекты в модалке создания событий сортируются по последнему использованию
  - Хранится локально в localStorage для каждого воркспейса
  - Утилита `/utils/projectUsageTracking.ts` управляет очередью использования
  - При выборе проекта вызывается `trackProjectUsage(workspaceId, projectId)`
  - При создании/вставке события проект автоматически поднимается в начало списка
  - По умолчанию НЕ выбран первый проект (пустой state вместо `projects[0]?.id`)

## 🔐 Аутентификация и безопасность

### Кириллица и Unicode
- **JWT декодирование**: Всегда используй `/utils/jwt.ts` вместо прямого вызова `atob()`
- **Модуль `/utils/jwt.ts`**:
  - `decodeSupabaseJWT(token)` - декодирование Supabase токена с типизацией
  - `getDisplayNameFromToken(token)` - получить displayName с поддержкой кириллицы
  - `getEmailFromToken(token)` - получить email из токена
  - `getUserIdFromToken(token)` - получить user ID из токена
- **Проблема**: `atob()` работает только с Latin1 (ASCII), не поддерживает кириллицу
- **Решение**: atob() → Uint8Array → TextDecoder('utf-8') → правильная UTF-8 строка

### Session Management
- **30-дневные сессии** - при входе создается session_id со сроком действия 30 дней
- **Автоматическое обновление токенов** - сервер использует refresh_token для обновления access_token (живет 1 час)
- **Периодическая проверка** - каждые 10 минут клиент проверяет сессию, сервер автоматически обновляет токены
- **IndexedDB** для ханения access_token и session_id на клиенте
- **KV Store** для хранения session_id, access_token, refresh_token, expires_at на сервере
- **Server-side валидация** - каждый защищённый endpoint проверяет Authorization header
- **Проверка email домена** - только @kode.ru

### API Endpoints Pattern
```typescript
// Публичный endpoint (здоровье сервера)
app.get("/make-server-73d66528/health", ...)

// Защищённый endpoint (требует auth)
app.get("/make-server-73d66528/resources", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  const { data: { user } } = await supabaseAuth.auth.getUser(accessToken);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  // ... логика
})
```

### Работа с JWT на клиенте
```typescript
import { decodeSupabaseJWT, getDisplayNameFromToken } from '../utils/jwt';

// Декодирование токена с поддержкой кириллицы
const payload = decodeSupabaseJWT(accessToken);
console.log('User ID:', payload?.sub);
console.log('Email:', payload?.email);
console.log('Display Name:', payload?.user_metadata?.name); // ✅ Кириллица работает

// Быстрое получение данных
const displayName = getDisplayNameFromToken(accessToken);
const email = getEmailFromToken(accessToken);
const userId = getUserIdFromToken(accessToken);
```

## 📦 Структура проекта

### Frontend
```
/components
  /auth - AuthScreen с поддержкой OTP и обычного входа
  /scheduler - основные компоненты календаря
  /workspace - список и создание воркспейсов
  /ui - shadcn компоненты

/contexts
  - SchedulerContext.tsx - глобальное состояние (события, проекты, ресурсы)
  - FilterContext.tsx - фильтры департаментов и проектов
  - SettingsContext.tsx - настройки размеров

/hooks
  - useEventInteractions.ts - drag, drop, resize
  - useHistory.ts - undo/redo
  - useKeyboardShortcuts.ts - хоткеи
  - usePanning.ts - панорамирование

/services/api - API клиенты для всех endpoint'ов

/types
  - scheduler.ts - все TypeScript интерфейсы
```

### Backend
```
/supabase/functions/server
  - index.tsx - Hono сервер со всеми routes
  - kv_store.tsx - утилиты для KV тблицы (НЕ ИЗМЕНЯТЬ)
```

## ⚡ Производительность

### Оптимизации
- **CSS Grid** для эффективного рендеринга сетки
- **GPU acceleration** - translateZ(0) для событий
- **will-change** - только для анимируемых свойств
- **Debounced updates** - при перетаскивании
- **Параллельные запросы** - Promise.all() для batch операций
- **Умное кэширование** - workspaces list в IndexedDB
- **React.memo** - для компонентов, которые могут ре-рендериться часто (OnlineUsers, SchedulerEvent)
- **useMemo/useCallback** - для стабильности пропсов и предотвращения лишних ре-ренде��ов
- **Режим производительности** - отключает отступы (`gap = 0`, `cellPadding = 0`), паттерны и скругления для максимальной производительности

### Избегай
- ❌ Последовательные циклы с await - используй Promise.all()
- ❌ Лишние ре-рендеры - memo для тяжёлых компонентов
- ❌ Inline функции в map() - определяй заранее
- ❌ IIFE в пропсах - вычисляй значения через useMemo/useCallback
- ❌ Избыточные console.log в рендер-функциях - логируй только при изменениях

## 🎹 Клавиатурные сокращения

- `Ctrl/Cmd + Z` - Отмена
- `Ctrl/Cmd + Shift + Z` или `Ctrl/Cmd + Y` - Повтор
- `Space + drag` - Панорамирование
- `Ctrl/Cmd + scroll` - Зум
- `Esc` - Закрытие модалок
- `?` - Справка по хоткеям
- `Ctrl/Cmd + hold` - Режим перемещения (скрывает ручки resize)

## ↩️ Система Undo/Redo

### Архитектура истории
- **Хук**: `/hooks/useHistory.ts` - управление стеком истории
- **Максимум записей**: 50 состояний (MAX_HISTORY)
- **Что сохраняется**: события, eventZOrder (z-index), проекты

### Важные правила
- **КРИТИЧНО**: ВСЕГДА передавай проекты при вызове `saveHistory()` и `resetHistory()`
  ```typescript
  // ✅ Правильно
  saveHistory(events, eventZOrder, projects);
  resetHistory(events, eventZOrder, projects);
  
  // ❌ НЕПРАВИЛЬНО - приведёт к ошибкам Undo/Redo
  saveHistory(events, eventZOrder);
  resetHistory(events, eventZOrder);
  ```

- **Защита от коррупции**: История НЕ сохраняется если есть события но НЕТ проектов
- **Инициализация**: Происходит ТОЛЬКО после загрузки всех данных (events + projects)
- **Сброс при модалках**: После сохранения в UsersManagementModal/ProjectsManagementModal
- **Flush pending перед drag** (v3.3.7): ВСЕГДА вызывай `flushPendingChanges()` в начале drag/resize операций
  ```typescript
  // ✅ Правильно - flush pending ПЕРЕД началом drag
  flushPendingChanges().catch(err => console.error('❌ Ошибка flush:', err));
  // ... drag logic
  
  // ❌ НЕПРАВИЛЬНО - события с временными ID попадут в историю
  // ... drag logic (без flush)
  ```

- **Flush pending перед Undo/Redo** (v3.3.14): КРИТИЧНО для предотвращения полосок загрузки после undo
  ```typescript
  // ✅ Правильно - флашим pending ПЕРЕД undo/redo
  const handleUndo = async () => {
    await flushPendingChanges(); // Сохраняем все изменения!
    
    const hasPendingEvents = events.some(e => e.id.startsWith('ev_temp_'));
    if (hasPendingEvents) {
      console.warn('⏸️ UNDO: Заблокировано');
      return; // блокируем Undo (БЕЗ toast)
    }
    // ... обычная логика Undo
  };
  
  // ❌ НЕПРАВИЛЬНО - без flush pending события показывают полоски после undo
  // Drag → pending save (2 сек) → Undo → событие восстанавливается но pending save продолжается!
  ```

- **Блокировка Undo/Redo для pending событий** (v3.3.12, v3.3.20): КРИТИЧНО для предотвращения "воскрешения" событий
  ```typescript
  // ✅ Правильно - блокируем Undo/Redo если есть события в процессе создания
  const handleUndo = async () => {
    // v3.3.20: Блокировка ОБЯЗАТЕЛЬНА в handleUndo И handleRedo (симметрия!)
    const hasPendingEvents = events.some(e => e.id.startsWith('ev_temp_'));
    if (hasPendingEvents) {
      console.log('⏸️ UNDO: Заблокировано - есть события в процессе создания');
      queueMicrotask(() => {
        showToast({
          type: 'warning',
          message: 'Подождите',
          description: 'Дождитесь завершения создания событий'
        });
      });
      return;
    }
    // ... обычная логика Undo
  };
  
  // ❌ НЕПРАВИЛЬНО - без блокировки события "воскресают" через Delta Sync
  // Undo удаляет событие из стейта → createEvent завершается → Delta Sync загружает из БД
  ```

- **Обновление ID в истории после создания на сервере** (v3.3.20): КРИТИЧНО для разблокировки Redo
  ```typescript
  // ✅ Правильно - обновляем историю в syncRestoredEventsToServer
  if (updateHistoryEventId && results.created.length > 0) {
    console.log(`📝 История: обновление ID для ${results.created.length} созданных событий...`);
    
    const tempToRealIdMap = new Map<string, string>();
    eventsToCreate.forEach((tempEvent, index) => {
      const createdEvent = results.created[index];
      if (createdEvent) {
        tempToRealIdMap.set(tempEvent.id, createdEvent.id);
        console.log(`   ${tempEvent.id} → ${createdEvent.id}`);
      }
    });
    
    tempToRealIdMap.forEach((realId, tempId) => {
      updateHistoryEventId(tempId, realId);
    });
  }
  
  // ❌ НЕПРАВИЛЬНО - история остаётся с временными ID
  // Redo восстанавливает событие с ev_temp_XXX → блокировка → toast висит навсегда
  ```

- **Очистка pending операций при Undo/Redo** (v3.3.10): КРИТИЧНО для предотвращения race conditions
  ```typescript
  // ✅ Правильно - очищаем pending операции для удалённых событий
  const currentIds = new Set(state.events.map(e => e.id));
  const deletedEvents = previousEvents.filter(e => !currentIds.has(e.id));
  
  deletedEvents.forEach(event => {
    cancelPendingChange(event.id); // Очищаем debounced save queue
  });
  
  // ❌ НЕПРАВИЛЬНО - debounced save попытается UPDATE удалённого события
  // (пропущена очистка pending операций)
  ```

- **НЕ используй IIFE для async операций с событиями** (v3.3.7):
  ```typescript
  // ❌ НЕПРАВИЛЬНО - fire-and-forget IIFE
  const handlePaste = useCallback(() => {
    (async () => {
      const createdEvent = await createEvent(tempEvent);
      // ... history save
    })(); // ← функция завершается СРАЗУ!
  }, [...]);
  
  // ✅ ПРАВИЛЬНО - async функция дожидается завершения
  const handlePaste = useCallback(async () => {
    const createdEvent = await createEvent(tempEvent);
    // ... history save
    // ← функция завершается ПОСЛЕ создания и сохранения истории
  }, [...]);
  ```

### Операции с историей
1. **saveHistory** - сохраняет текущее состояние в стек
   - Вызывается после каждого изменения событий
   - Автоматически берёт проекты из предыдущего состояния если не переданы
   - Блокирует сохранение если events.length > 0 && projects.length === 0

2. **resetHistory** - сбрасывает весь стек и создаёт новое начальное состояние
   - Вызывается после начальной загрузки данных
   - Вызывается после сохранения изменений в модалках

3. **undo/redo** - восстановление состояния из стека
   - Блокирует восстановление если state содержит события без проектов
   - Последовательное восстановление множественных событий (защита от race conditions)
   - Обновление ID в истории после создания событий на сервере

### Обновление ID в истории
- **updateHistoryEventId** - заменяет временный ID на реальный во ВСЕЙ истории
- **updateHistoryProjectId** - аналогично для проектов
- Вызывается после успешного создания объекта на сервере

## 🎨 Цветовая система

### Проекты
- **КРИТИЧНО**: БД использует camelCase для колонок: `backgroundColor`, `textColor` (НЕ snake_case!)
- При INSERT/UPDATE используй точные названия колонок из БД
- Автогенерация цветов: HSL (hue: 0-360, sat: 60-90%, light: 45-65%)
- Умный контраст: автоматический выбор белого/черного текста
- Клик на preview блок для генерации новых цветов

### Паттерны событий
- `vacation` - серый с диагональными полосками
- Остальные паттерны используют цвет проекта

### Фильтрация проектов
- **Частичная прозрачность (dimmed events)** - при активном фильтре проектов:
  - События выбранных проектов: отображаются нормально (100% opacity, оригинальные цвета)
  - События других проектов: `backgroundColor: #AAA`, `color: #333`, `opacity: 0.2`
  - Паттерны в `backgroundImage` сохраняются (накладываются поверх серого фона)
  - Плавный переход через `transition: opacity 0.2s ease` (globals.css)
  - Логика определения dimmed: проверяется в SchedulerMain.tsx, передается как проп в SchedulerEvent.tsx

## 📝 Логирование

### Правила
- **Эмоджи для категорий**: 🔐 auth, 💾 save, 🌐 API, ❌ error, ✅ success
- **Детальный контекст**: всегда логируй ID, количество, тип операции
- **Суперконсольные логи**: на сервере для диагностики токенов и сессий
- **Production-ready**: логи должны помогать отлаживать проблемы пользователей

### Примеры
```typescript
console.log('🔐 Вход пользователя:', email);
console.log('💾 Сохранение 5 изменений параллельно...');
console.error('❌ Ошибка создания проекта:', error.message);
console.log('✅ Событие создано:', eventId);
```

## 🧭 Навигация и роутинг

### URL Structure
- `/` - список воркспейсов (WorkspaceListScreen)
- `/workspace/:id` - календарь воркспейса (SchedulerMain)

### Простой роутинг на основе History API
1. **Выбор воркспейса** (`handleSelectWorkspace`):
   - Обновляет state: `setSelectedWorkspace(workspace)`
   - Обновляет URL: `window.history.pushState(null, '', '/workspace/:id')`
   - Обновляет title: `document.title = '${workspace.name} - Planaro'`

2. **Возврат к списку** (`handleBackToWorkspaces`):
   - Сбрасывает state: `setSelectedWorkspace(null)`
   - Обновляет URL: `window.history.pushState(null, '', '/')`
   - Сбрасывает title: `document.title = 'Planaro - Управление рабочими пространствами'`

3. **Навигация браузером** (popstate):
   - При клике "Назад/Вперед" браузера срабатывает обработчик popstate
   - Проверяет текущий URL (`window.location.pathname`)
   - Если `/` - сбрасывает selectedWorkspace
   - Если `/workspace/:id` - загружает воркспейс из API

4. **Прямая ссылка / Обновление страницы**:
   - При монтировании после авторизации срабатывает useEffect
   - Проверяет URL, загружает нужный воркспейс или показывает список
   - Предотвращает повторную загрузку если воркспейс уже в state

### Важно
- Используй `String(workspace.id)` для сравнения ID (может быть number или string)
- Не нужны флаги или дополнительные state - всё работает через URL как источник истины
- При обновлении страницы пользователь остаётся на той же странице благодаря URL

## 🚀 Deployment

### Edge Function
- **Название**: `make-server-73d66528`
- **Deploy команда**: `supabase functions deploy make-server-73d66528`
- **Health check**: `GET /make-server-73d66528/health`
- **Логи**: Supabase Dashboard → Edge Functions → Logs

### Переменные окружения (уже настроены)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

## 🧪 Тестирование

### Перед commit
1. ✅ Проверь что сервер деплоится без ошибок
2. ✅ Проверь авторизацию (вход/выход)
3. ✅ Проверь создание/редактирование/удаление в каждой модалке
4. ✅ Проверь Drag & Drop событий
5. ✅ Проверь Undo/Redo
6. ✅ Проверь режим ножниц
7. ✅ Обнови CHANGELOG.md

### Если что-то сломалось
1. Проверь логи в консоли браузера
2. Проверь логи Edge Function в Supabase Dashboard
3. Проверь что токены сохраняются в IndexedDB (DevTools → Application)
4. Проверь что workspace_id передаётся во всех запросах

## 📚 Важные файлы для понимания

### Обязательно изучи
1. `/types/scheduler.ts` - все интерфейсы
2. `/contexts/SchedulerContext.tsx` - глобальное состояние
3. `/supabase/functions/server/index.tsx` - все API endpoints
4. `/components/scheduler/SchedulerGrid.tsx` - рендеринг календарной сетки
5. `/hooks/useEventInteractions.ts` - логика drag & drop
6. `/utils/jwt.ts` - работа с JWT токенами (важно для кириллицы!)

### Защищённые файлы (НЕ ИЗМЕНЯТЬ)
- `/supabase/functions/server/kv_store.tsx`
- `/utils/supabase/info.tsx`
- `/components/figma/ImageWithFallback.tsx`

## 🔄 Воркфлоу для новых фич

1. **Планирование** - убедись что фича не ломает существующее
2. **Типы** - добавь/обнови интерфейсы в `/types/scheduler.ts`
3. **API** - добавь endpoint в `/supabase/functions/server/index.tsx`
4. **Сервис** - создай API клиент в `/services/api/*.ts`
5. **UI** - создай компонент в `/components/`
6. **Тестирование** - проверь основные сценарии
7. **Документация** - обнови CHANGELOG.md
8. **Логирование** - добавь диагностические логи

## 💡 Best Practices

### DO ✅
- Используй существующие shadcn компоненты
- Добавляй детальные логи для диагностики
- Делай валидацию на сервере
- Используй TypeScript интерфейсы
- Делай параллельные запросы через Promise.all()
- Сохраняй настройки в cookies/IndexedDB
- Используй `/utils/jwt.ts` для декодирования токенов (поддержка кириллицы)

### DON'T ❌
- Не создавай новые таблицы БД
- Не делай автосохранение в модалках
- Не меняй защищённые файлы
- Не используй alert() - используй toast
- Не делай последовательные await в циклах
- Не забывай про workspace_id в запросах
- Не используй `atob()` напрямую для JWT - используй `/utils/jwt.ts`

---

**Версия документа**: 1.8.6 (2025-10-21)
**Последнее обновление**: 
- **Профиль пользователя с аватаркой**:
  - Профильное меню в хедере с аватаркой, displayName и dropdown
  - Модальное окно редактирования профиля (displayName + аватарка)
  - Загрузка аватарки при регистрации (необязательно)
  - Публичный bucket `make-73d66528-avatars` в Supabase Storage
  - Серверные endpoints: `/profile/upload-avatar`, `/profile/update`
  - Обновлённый `/auth/signup` с поддержкой multipart/form-data
- **Кириллица**: Исправлена декодировка JWT токенов с русскими именами (TextDecoder UTF-8)
- **URL Роутинг (упрощённый)**: Нативная навигация через History API без сложных флагов
  - "/" - список воркспейсов
  - "/workspace/:id" - календарь конкретного воркспейса
  - Кнопка "назад" в браузере работает корректно
  - Поддержка прямых ссылок и обновления страницы
  - URL как единственный источник истины (убраны флаги isProgrammaticNavigation и state currentPath)
- **Кэширование онлайн пользователей**: TTL 45 секунд, мгновенное отображение при загрузке страницы
- **Presence система** - отслеживание онлайн пользователей:
  - **Как работает**:
    1. Пользователь открывает календарь воркспейса (SchedulerMain)
    2. OnlineUsers компонент отправляет heartbeat каждые 30 секунд
    3. Сервер извлекает `displayName` и `avatarUrl` из `user.user_metadata` (из токена):
       ```typescript
       const presenceData = {
         userId: user.id,
         email: user.email,
         displayName: user.user_metadata?.display_name || user.user_metadata?.name,
         avatarUrl: user.user_metadata?.avatar_url, // ← КРИТИЧНО! Без этого нет аватарок
         lastSeen: new Date().toISOString()
       };
       ```
    4. Presence сохраняется в KV Store с TTL **60 секунд** (автоматически удаляется если нет heartbeat)
    5. **При закрытии календаря** OnlineUsers отправляет explicit `DELETE /presence/leave/:workspaceId` → мгновенное удаление
    6. WorkspaceListScreen делает batch запрос каждые 15 секунд для всех воркспейсов
  - **Отображение в карточках воркспейсов** (WorkspaceUsers):
    - Показываются ТОЛЬКО пользователи ВНУТРИ воркспейса (отправляют heartbeat, есть в presence)
    - Текущий пользователь показывается ТОЛЬКО если он внутри этого воркспейса
    - Текущий пользователь выделяется зеленым градиентом с меткой "(вы)"
    - Другие пользователи - синий градиент
    - Аватарки для ВСЕХ приходят из presence данных (включая текущего пользователя)
  - **Отображение внутри календаря** (OnlineUsers):
    - **КРИТИЧНО**: Текущий ползователь ВСЕГДА берется ИЗ ТОКЕНА (не из presence!)
    - Логика объединения: `[currentUser (токен), ...otherUsers (presence без текущего)]`
    - Это гарантирует что avatarUrl текущего пользователя всегда актуальная
    - Другие пользователи подгружаются из кэша (мгновенно), затем обновляются с сервера
    - Если текущий пользователь пришел с сервера - он ФИЛЬТРУЕТСЯ и заменяется данными из токена
    - **Оптимизация загрузки**:
      1. При входе в календарь → читаем кэш `cache_online_users_batch` (загруженный WorkspaceListScreen)
      2. Если кэш валиден (TTL 45 сек) → показываем данные мгновенно (0ms задержка)
      3. В фоне делаем запрос к `/presence/online/:workspaceId` → обновляем данные
      4. Периодическое обновление каждые 15 секунд (без кэша, прямой запрос)
    - **Результат**: Нет задержки при входе в календарь, пользователи показываются сразу
  - **ВАЖНО: Обновление токена после изменения профиля**:
    - После сохранения displayName или avatarUrl в ProfileModal → страница перезагружается через 2 секунды
    - Это необходимо для получения свежего JWT токена с обновлёнными user_metadata
    - Без перезагрузки старый токен останется и аватарка не появится в presence
    - Toast уведомление предупреждает пользователя о перезагрузке
  - **Batch оптимизация**: 1 запрос вместо N → снижение нагрузки в 15 раз
  - **Кэширование онлайн пользователей**:
    - Ключ кэша: `cache_online_users_batch`
    - TTL: 45 секунд
    - При загрузке экрана: сначала показываются кэшированные данные (мгновенно), затем обновляются с сервера в фоне
    - Предотвращает "появление" блока с пользователями после загрузки воркспейсов
    - Кэш очищается при выходе из системы
  - **Graceful leave** (v1.8.8):
    - При закрытии календаря (размонтирование OnlineUsers) отправляется `DELETE /presence/leave/:workspaceId`
    - Мгновенное удаление presence из KV Store → пользователь исчезает из онлайн списка сразу
    - Fallback: если leave не дошёл (сетевая ошибка) → автоудаление через 60 сек по TTL
    - Endpoint: `app.delete("/make-server-73d66528/presence/leave/:workspaceId")`
    - Логирование: `👋 Leave от {email} из workspace {id}`
  - **Двухуровневая защита от "мигания"** (v1.8.8 v2):
    - **Уровень 1 - Очистка кэша**: `handleBackToWorkspaces()` мгновенно очищает `cache_online_users_batch`
    - **Уровень 2 - Временная блокировка**: Устанавливает флаг `suppress_current_user_presence` (TTL 5 сек)
    - WorkspaceListScreen проверяет блокировку при загрузке кэша И при batch запросах
    - Фильтрует текущего пользователя даже если он пришёл с сервера (защита от "гонки условий")
    - Решает проблему: быстро вошли в календарь (<1 сек) → heartbeat → сразу назад → без блокировки было бы "мигание"
    - Graceful degradation: блокировка истекает через 5 сек, batch запрос обновит данные
- **Оптимизация**: React.memo, useMemo, batching, кэширование, мгновенное отображение

### Collaborative Cursors (v3.4.0) ✅ НОВАЯ ВЕРСИЯ
- **Supabase Realtime Presence** - отображение курсоров других пользователей в реальном времени
- **Архитектура**:
  - **Frontend**: `/utils/supabase/client.ts` - Supabase клиент с lazy loading
  - **Context**: `/contexts/PresenceContext.tsx` - управление presence состоянием
  - **Component**: `/components/scheduler/RealtimeCursors.tsx` - отображение курсоров
  - **Integration**: `App.tsx` → `PresenceProvider` → `SchedulerMain` → `RealtimeCursors`
- **Как работает**:
  1. `PresenceProvider` подключается к Realtime каналу `workspace:{id}:presence`
  2. При движении мыши вызывает `updateCursor(x, y)` (throttle 50ms)
  3. Отправляет broadcast с `{ type: 'cursor_update', user_id, email, x, y, timestamp }`
  4. Получает позиции других пользователей через Realtime
  5. `RealtimeCursors` отображает курсоры с плавной анимацией
- **Технические детали**:
  - **Channel**: `workspace:{workspaceId}:presence` (приватный)
  - **Events**: `presence_update` (broadcast), `join` (presence), `leave` (presence)
  - **Throttle**: 50ms (максимум 20 обновлений/сек)
  - **Timeout**: 5 секунд (автоудаление неактивных курсоров)
  - **Координаты**: относительно viewport (clientX, clientY)
  - **RLS**: проверка через `workspace_members` таблицу
- **Оптимизации**:
  - Lazy loading `@supabase/supabase-js` (загружается только когда нужно)
  - Graceful fallback если Realtime недоступен (приложение работает без курсоров)
  - Throttle 50ms → снижение нагрузки на сеть
  - `eventsPerSecond: 20` в Realtime config → защита от перегрузки
  - Автоматическая очистка устаревших курсоров каждую секунду
  - Не показывается свой курсор (фильтруется по email)
  - Автоматический реконнект через Supabase Realtime
- **Визуальный стиль**:
  - SVG курсор с цветом на основе email (HSL hash)
  - Имя пользователя в цветном badge рядом с курсором
  - `pointer-events: none` → курсоры не блокируют клики
  - `transition: transform 100ms ease-out` → плавное движение
  - Индикатор подключения в dev режиме
- **Требования Supabase**:
  - Realtime включён для таблиц (`events`, `users`, `projects`, `departments`, `workspaces`)
  - RLS политики для `workspace_members` и `realtime.messages`
  - Таблица `workspace_members` с колонками: `workspace_id`, `user_id`, `role`
- **Документация**: `/SUPABASE_REALTIME_INTEGRATION_v3.4.0.md`, `/QUICK_TEST_REALTIME_v3.4.0.md`

---

### Delta Sync автообновление событий (v3.3.0) ⚡
- **Delta Sync + Full Sync** - умная двухуровневая синхронизация событий
- **Интервалы синхронизации**:
  - **Delta Sync**: каждые 4 секунды (только изменённые события) ⚡
  - **Full Sync**: каждые 30 секунд (все события + обнаружение удалений) 🔄
  - **Сотрудники**: каждые 15 секунд (полная синхронизация)
  - **Департаменты**: каждые 15 секунд (полная синхронизация)
  - **Проекты**: каждые 15 секунд (полная синхронизация)
- **Как работает Delta Sync**:
  1. Каждые 4 секунды запрашивает ТОЛЬКО изменённые события с последнего timestamp
  2. Применяет изменения к текущему состоянию (merge)
  3. Каждые 30 секунд делает Full Sync для обнаружения удалений другими пользователями
  4. Пропускает синхронизацию при взаимодействии пользователя (drag/resize)
  5. Пропускает синхронизацию если было локальное изменение < 2 секунд назад
- **Технические детали**:
  - Endpoint: `GET /events/changes?workspace_id=X&since=TIMESTAMP`
  - Response: `{ events: [...], timestamp: "ISO_STRING" }`
  - Timestamp сохраняется в `lastSyncTimestampRef` для следующего запроса
  - Ref: `isUserInteracting` блокирует синхронизацию во время drag/drop/resize
  - Ref: `deletedEventIdsRef` защищает от "воскрешения" удалённых событий
- **Оптимизации**:
  - Delta Sync передаёт только изменённые данные (минимальный трафик)
  - Full Sync только каждые 30 секунд (обнаружение удалений)
  - Блокировка синхронизацию при взаимодействии (нет конфликтов)
  - Пропуск синхронизацию после локальных изменений (нет "мигания")
  - Мгновенное применение изменений (merge вместо replace)
- **Преимущества**:
  - ⚡ Изменения появляются через 4 секунды (очень быстро!)
  - 📉 Минимальный трафик (только изменённые события)
  - 🛡️ Защита от конфликтов при drag/drop
  - 🔄 Обнаружение удалений через Full Sync
  - 🎯 Простая HTTP архитектура
  - Документация: `/DELTA_SYNC_v3.3.0.md`, `/SIMPLE_POLLING_READY.md`

---

**Версия документа**: 3.4.0 (2025-11-19)
**Последнее обновление**: 
- **Блокировка Undo/Redo для pending событий** (v3.3.20 - КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ):
  - ✅ **Проблема 1**: Можно было нажать Undo когда событие грузится
  - ✅ **Исправление 1**: Добавлена проверка временных ID в handleUndo (симметрия с handleRedo)
  - ✅ **Проблема 2**: Нельзя было нажать Redo после того как событие загрузилось (toast висел)
  - ✅ **Корневая причина**: История НЕ обновлялась после создания на сервере
  - ✅ **Исправление 2**: Обновление ID в истории в syncRestoredEventsToServer
  - ✅ State обновлялся: `ev_temp_123` → `e12345`
  - ✅ История теперь обновляется: `ev_temp_123` → `e12345`
  - ✅ При Redo восстанавливается событие с реальным ID (НЕ блокируется)
  - Затронутые файлы: `/components/scheduler/SchedulerMain.tsx:411-444`, `/contexts/SchedulerContext.tsx:1349-1370`
  - Документация: `/UNDO_REDO_PENDING_BLOCK_FIX_v3.3.20.md`, `/QUICK_TEST_UNDO_PENDING_v3.3.20.md`
- **Pending состояние после Undo + убран toast warning** (v3.3.14 - КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ):
  - ✅ Исправлена проблема: события показывают полоски загрузки после Undo
  - ✅ Причина: Debounced save продолжает выполняться после Undo (pending операция в очереди)
  - ✅ Решение: `await flushPendingChanges()` в начало `handleUndo` и `handleRedo`
  - ✅ Все pending изменения сохраняются ПЕРЕД undo/redo → очередь пуста → нет полосок
  - ✅ Убрали toast warning при блокировке pending событий (только console.log)
  - ✅ События мгновенно восстанавливаются без артефактов
  - Затронутые файлы: `/components/scheduler/SchedulerMain.tsx:400-620`
  - Документация: `/UNDO_PENDING_FLUSH_FIX_v3.3.14.md`, `/QUICK_TEST_UNDO_PENDING_v3.3.14.md`
- **Исправлен паттерн временных ID в cleanup** (v3.3.13 - КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ):
  - ✅ Исправлена проблема: Orphaned events cleanup пытался удалить временные события через API
  - ✅ Причина: Неправильный паттерн проверки `!event.id.startsWith('ev_temp')` вместо `!event.id.startsWith('ev_temp_')`
  - ✅ Решение: Добавлено подчеркивание в конце паттерна для корректной проверки
  - ✅ Временные события теперь корректно пропускаются в cleanup
  - ✅ Нет ложных DELETE запросов к API
  - ✅ Нет ошибок `Cannot delete temporary events via API`
  - Затронутые файлы: `/contexts/SchedulerContext.tsx:964`
  - Документация: `/TEMP_ID_PATTERN_FIX_v3.3.13.md`, `/QUICK_TEST_TEMP_ID_v3.3.13.md`, `/RELEASE_NOTES_v3.3.13.md`
- **Блокировка Undo для pending событий** (v3.3.12 - КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ):
  - ✅ Исправлена проблема: события "воскресали" после быстрого Undo сразу после создания
  - ✅ Причина: Race condition между createEvent (создание в БД), Undo (удаление из стейта) и Delta Sync (загрузка из БД)
  - ✅ Решение: Блокировка Undo/Redo если есть события с временными ID (`ev_temp_*`)
  - ✅ Toast уведомление "Подождите, дождитесь завершения создания событий"
  - ✅ Типичная задержка ~500ms (время создания на сервере)
  - ✅ События НЕ "воскресают" из БД
  - Документация: `/UNDO_PENDING_EVENTS_FIX_v3.3.12.md`, `/QUICK_TEST_UNDO_PENDING_v3.3.12.md`, `/RELEASE_NOTES_v3.3.12.md`
- **Race Condition в Undo/Redo** (v3.3.11 - КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ):
  - ✅ Исправлена race condition при быстром нажатии Ctrl+Z несколько раз подряд
  - ✅ Причина: Второй Undo запускался ДО завершения первого → конфликты синхронизации
  - ✅ Решение: Блокировка одновременных операций через `isUndoRedoInProgressRef`
  - ✅ Проверка блокировки в начале `handleUndo` и `handleRedo`
  - ✅ Гарантированное снятие блокировки через `finally` блок
  - ✅ Логирование блокировки для диагностики
  - Документация: `/UNDO_REDO_RACE_CONDITION_FIX_v3.3.11.md`
- **Конфликт Undo и Debounced Save** (v3.3.10 - КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ):
  - ✅ Исправлена ошибка: `❌ BATCH update: событие e37367 не найдено в БД` при Undo после создания
  - ✅ Причина: Race condition между Undo (удаляет событие) и debounced save (пытается UPDATE)
  - ✅ Решение: Очистка pending операций для удалённых событий в `handleUndo()` и `handleRedo()`
  - ✅ Вызов `cancelPendingChange()` для каждого удалённого события ДО синхронизации удалений
  - ✅ Добавлена зависимость `cancelPendingChange` в useCallback
  - ✅ Undo/Redo работает без ошибок
  - Документация: `/UNDO_DEBOUNCED_SAVE_CONFLICT_FIX_v3.3.10.md`
- **Блокировка взаимодействий с временными событиями** (v3.3.9 - КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ):
  - ✅ Исправлена ошибка: при Undo после быстрого drag временного события оно удаляется
  - ✅ Причина: drag завершался ДО создания события на сервере → история сохраняла временный ID
  - ✅ Решение: блокировка drag/resize для событий с `id.startsWith('ev_temp_')`
  - ✅ История ВСЕГДА содержит реальные ID
  - ✅ Undo/Redo работает корректно
  - ✅ Задержка ~500ms между созданием и drag (незаметна)
  - Документация: `/TEMP_EVENTS_INTERACTION_BLOCK_v3.3.9.md`
- **BATCH create/update detection** (v3.3.8 - КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ):
  - ✅ Исправлена ошибка: `❌ BATCH update: событие не найдено в БД`
  - ✅ Причина: ВСЕ batch операции помечались как `op: 'update'`, даже для несуществующих событий
  - ✅ Решение: определение `op: 'create' | 'update'` на основе `loadedEventIds.current.has(id)`
  - ✅ Передача `id` в `data` для CREATE операций (для UPSERT на сервере)
  - ✅ Добавление созданных событий в `loadedEventIds` после успешного batch create
  - ✅ Детальное логирование: `📦 BATCH: событие e37356 → update (isLoaded=true)`
  - ✅ Защита от race conditions между createEvent и drag
  - Документация: `/BATCH_CREATE_UPDATE_FIX_v3.3.8.md`
- **Sync history before drag** (v3.3.7 - ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ):
  - ✅ Критическое исправление: события больше не удаляются при undo после быстрого drag
  - ✅ **Часть 1**: Flush pending changes перед drag/resize/gap drag
    - Добавлен вызов `flushPendingChanges()` в начале всех drag операций
  - ✅ **Часть 2**: Синхронное сохранение истории через Promise
    - `saveHistory()` теперь вызывается через `await Promise.resolve()`
    - Гарантирует что история сохранится ДО того как пользователь начнёт drag
  - ✅ **Часть 3**: Убран IIFE в handlePaste (НОВОЕ)
    - Сделали `handlePaste` async функцией (было: useCallback с IIFE)
    - Убрали fire-and-forget `(async () => { ... })()`
    - Событие всегда имеет реальный ID (НЕ временный!) при drag
  - Результат: при undo событие восстанавливается (НЕ удаляется)
  - Документация: `/SYNC_HISTORY_BEFORE_DRAG_v3.3.7.md`, `/QUICK_FIX_IIFE_v3.3.7.md`
- **Supabase Realtime Integration** (v3.4.0):
  - ✅ Collaborative Cursors через Supabase Realtime Presence
  - ✅ Новый `/utils/supabase/client.ts` с lazy loading
  - ✅ Новый `/contexts/PresenceContext.tsx` для управления presence
  - ✅ Новый `/components/scheduler/RealtimeCursors.tsx` для отображения курсоров
  - ✅ Graceful fallback если `@supabase/supabase-js` недоступен
  - ✅ RLS безопасность через `workspace_members`
  - ✅ Автоматический реконнект
  - Документация: `/SUPABASE_REALTIME_INTEGRATION_v3.4.0.md`, `/QUICK_TEST_REALTIME_v3.4.0.md`
- **Full Sync возвращает измененные события после Undo/Redo ИСПРАВЛЕНО** (v3.3.6):
  - ✅ Расширена функция `syncRestoredEventsToServer()` - теперь синхронизирует CREATE + UPDATE
  - ✅ Разделение событий на две группы: `eventsToCreate` (нет на сервере) и `eventsToUpdate` (есть на сервере)
  - ✅ Batch операции: `op: 'create'` + `op: 'update'` в одном запросе
  - ✅ Измененные события (высота, позиция) больше НЕ перезаписываются данными с сервера
  - ✅ Full Sync через 30 секунд загружает правильные данные
  - Документация: `/UNDO_REDO_MODIFIED_EVENTS_FIX.md`, `/CHANGELOG.md` v3.3.6
- **React Warning "Cannot update component while rendering" ИСПРАВЛЕН** (v3.3.3):
  - ✅ Заменён `const [hasCachedData, setHasCachedData]` на `const hasCachedDataRef = useRef(false)`
  - ✅ Все 7 вызовов `setHasCachedData(true)` заменены на `hasCachedDataRef.current = true`
  - ✅ Нет конкурентных setState → warning исчез
  - ✅ Производительность улучшена (ref быстрее state)
  - Документация: `/CHANGELOG.md` v3.3.3
- **Full Sync возвращает удалённые события после Undo/Redo ИСПРАВЛЕНО** (v3.3.3):
  - ✅ Новая функция `syncDeletedEventsToServer(currentEvents, previousEvents)`
  - ✅ Сравнивает события до/после Undo/Redo, находит удалённые
  - ✅ Помечает в `deletedEventIdsRef` + удаляет на сервере через `eventsApi.delete()`
  - ✅ Full Sync НЕ возвращает удалённые события благодаря `deletedEventIdsRef`
  - ✅ Вызов в `handleUndo()` и `handleRedo()` с сохранением `previousEvents`
  - Документация: `/UNDO_REDO_DELETED_EVENTS_SYNC.md`, `/CHANGELOG.md` v3.3.3
- **Синхронизация проектов при Undo/Redo** (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v3.3.2):
  - ✅ Добавлены функции блокировки синхронизации: `resetProjectsSyncTimer()`, `resetResourcesSyncTimer()`, `resetDepartmentsSyncTimer()`
  - ✅ Вызов `resetProjectsSyncTimer()` в `handleUndo()` и `handleRedo()`
  - ✅ Проекты НЕ перезаписываются данными с сервера после Undo/Redo
  - ✅ Блокировка polling на 2 секунды защищает локальные изменения
  - Документация: `/UNDO_REDO_PROJECTS_SYNC_FIX.md`, `/CHANGELOG.md` v3.3.2
- **Защита истории от сохранения событий без проектов** (v3.3.1):
  - ✅ Исправлены вызовы `resetHistory()` в модалках - ВСЕГДА передаём проекты
  - ✅ Добавлена защита в `saveHistory()` - блокирует сохранение events без projects
  - ✅ Новая секция в Guidelines: "↩️ Система Undo/Redo" с важными правилами
  - ✅ Детальное логирование для диагностики проблем с историей
  - Документация: `/UNDO_REDO_FIX_SUMMARY.md`, `/CHANGELOG.md` v3.3.1
- **Delta Sync автообновление v3.3.0** (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ):
  - ✅ Восстановлен быстрый Delta Sync: каждые 4 секунды (было 10 секунд)
  - ✅ Full Sync: каждые 30 секунд вместо 60 секунд
  - ✅ Убрана динамическая смена интервалов (была сложная, не работала)
  - ✅ Изменения появляются через 4 секунды (было 10-30 секунд)
  - ✅ Простая и надёжная логика: фиксированный интервал 4 сек для delta
  - ✅ Endpoint `/events/changes` для получения только изменённых событий
  - Документация: `/guidelines/Guidelines.md` v3.3.0, `/CHANGELOG.md` v3.3.0
- **Оптимизация алгоритма склейки событий v6.0** (ПРОИЗВОДИТЕЛЬНОСТЬ):
  - ✅ Индексация событий: O(1) вместо O(n) для поиска соседей
  - ✅ Утилитарные функции: -200 строк дублирования кода
  - ✅ Меньше проходов: 4 вместо 5 (-20%)
  - ✅ Оптимизация кода: 545 строк вместо 691 (-21%)
  - ✅ DEBUG режим: опциональные логи (const DEBUG = false)
  - ✅ Производительность: ~45x ускорение для 100 событий!
  - ✅ Без изменений логики: те же 7 правил склейки, обратная совместимость
  - Документация: `/EVENT_NEIGHBORS_v6.0_OPTIMIZATION.md`, `/CHANGELOG.md` v6.0
- **Откусывание только при двойном gap v5.23** (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ):
  - ✅ ПРОХОД 5 теперь откусывает только при `expandMultiplier >= 2` (ДВОЙНОЙ gap!)
  - ✅ Обычная склейка событий разных проектов (`expandRight = 1`) больше НЕ откусывается
  - ✅ Вклинивание срабатывает только для событий с двойным расширением
  - ✅ Визуально: нет нежелательных зазоров между проектами
  - ✅ Логика вклинивания стала предсказуемой и правильной
  - Документация: `/EVENT_GLUING_v5.23_FINAL.md`, `/CHANGELOG.md` v5.23
- **Правильная неделя для поиска соседей справа v5.22** (КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ):
  - ✅ ПРОХОД 3 для `roundBottomRight` теперь ищет на ПОСЛЕДНЕЙ неделе события (`startWeek + weeksSpan - 1`)
  - ✅ `roundBottomLeft` ищет на СТАРТОВОЙ неделе события (`startWeek`)
  - ✅ Логика: внешний угол справа смотрит на ПОСЛЕДНЮЮ неделю, внешний угол слева — на ПЕРВУЮ
  - ✅ Работает для событий ЛЮБОЙ длины (1 неделя или 10 недель)
  - ✅ Поджатие справа теперь срабатывает для коротких событий
  - ✅ Компенсация в ПРОХОДЕ 4 гарантирует расширение соседей
  - Документация: `/EVENT_GLUING_v5.22_FINAL.md`, `/CHANGELOG.md` v5.22
- **Упрощённая логика склейки событий v3.1** (ФИНАЛЬНАЯ ВЕРСИЯ):
  - ✅ Полная склейка для одинаковой высоты и позиции (hasFullLeftNeighbor)
  - ✅ Расширение на gap + убирание padding для полной склейки
  - ✅ Позитивная логика: `roundTopLeft = true` означает "скруглён"
  - ✅ hasInner* вычисляются локально из innerTopLeftColor (не сохраняются в объект)
  - ✅ Убрали removeTopLeftRadius и т.д. (негативная логика)
  - ✅ Единый источник истины: цвета определяют наличие внутренних углов
  - Документация: `/EVENT_GLUING_v3.1_FINAL.md`
- **Корректное восстановление DOM стилей при ресайзе** (v2.3.13):
  - ✅ Исправлено смещение событий при клике на ручку ресайза без изменения размера
  - ✅ Сохранение исходных стилей (startLeft, startTop, startWidth, startHeight) в startResize
  - ✅ Восстановление точных исходных стилей при hasChanged = false
  - ✅ Pixel-perfect позиционирование без округлений
  - Документация: `/CHANGELOG.md` v2.3.13
- **Умна�� горизонтальная склейка событий** (v2.3.12):
  - ✅ Боковые padding убираются только при полной склейке по высоте (оба угла)
  - ✅ `hasFullLeftNeighbor = hasTopLeft && hasBottomLeft` (было: `hasAnyLeft = hasTopLeft || hasBottomLeft`)
  - ✅ В середине горизонтальной склейки отступы остаются (4px), если unitsTall различается
  - ✅ Симметричные отступы между юнитами даже при склейке
  - Документация: `/CHANGELOG.md` v2.3.12
- **Pixel-Perfect позиционирование событий** (v2.3.11):
  - ✅ Минимальный gap увеличен с 0.5px до 1px
  - ✅ `unitContentH = Math.floor(...)` для округления до целых пикселей
  - ✅ Все координаты Y теперь целые числа (нет субпиксельного рендеринга)
  - ✅ События идеально выровнены на всех размерах строки
  - Документация: `/UNIFIED_PADDING_v2.3.9.md` (обновлён v2.3.11)
- **Математически правильные внутренние скругления** (v2.3.10):
  - ✅ `innerRadius = borderRadius + gap` (компенсирует отступ между событиями)
  - ✅ При rowHeight ≥ 144px: внешний 10px, внутренний 14px
  - ✅ Адаптивно для всех размеров строки
  - Документация: `/UNIFIED_PADDING_v2.3.9.md` (обновлён)
- **Унифицированные отступы для событий** (v2.3.9):
  - ✅ `cellPadding = gap` (вместо `gap / 2`)
  - ✅ Одиночные события имеют симметричные отступы 4px со всех сторон
  - ✅ Между событиями разных недель: 8px (хорошо видно)
  - ✅ Склейка событий работает как прежде (padding убирается)
  - Документация: `/UNIFIED_PADDING_v2.3.9.md`
- **Delta Sync автообновление v3.3.0** (v1.9.4 → v3.3.0):
  - ✅ Быстрая синхронизация событий: Delta Sync каждые 4 секунды ⚡
  - ✅ Full Sync каждые 30 секунд для обнаружения удалений 🔄
  - ✅ Минимальный трафик: только изменённые события в Delta Sync
  - ✅ Защита от конфликтов при drag/drop и после локальных изменений
  - ✅ Сотрудники, Департаменты, Проекты: каждые 15 секунд
  - ✅ Нагрузка: 29 req/min/user (умеренная)
  - ✅ Простая HTTP архитектура без WebSocket
  - Документация: `/DELTA_SYNC_v3.3.0.md`, `/QUICK_DELTA_SYNC.md`, `/TEST_DELTA_SYNC.md`, `/SYNC_INTERVALS_CHEATSHEET.md`
- **Supabase Realtime Integration** (v3.4.0):
  - ✅ **Collaborative Cursors ВКЛЮЧЕНЫ** через Supabase Realtime Presence
  - ✅ Graceful fallback если `@supabase/supabase-js` недоступен
  - ✅ Автоматический реконнект через Supabase SDK
  - ✅ RLS безопасность через `workspace_members`
  - ✅ Задержка ~50-100ms (мгновенные обновления)
  - ⚠️ Если Realtime недоступен → курсоры отключены (приложение работает стабильно)
  - Документация: `/SUPABASE_REALTIME_INTEGRATION_v3.4.0.md`
- **Старые версии (deprecated)**:
  - v1.9.3: Realtime Broadcast через `@supabase/supabase-js` - ОТКЛОНЕНО (ошибка сборки)
  - v1.9.2: Native WebSocket - ОТКЛЮЧЁН (нестабильная работа в Edge Functions)
  - v1.9.0: WebSocket через Edge Function `/cursors/:workspaceId` - УСТАРЕЛО
  - Старый код сохранён в `/components/scheduler/CursorPresence.tsx` (не удалять!)
- **Онлайн пользователи работают** (v1.8.8+):
  - ✅ HTTP-based presence система стабильна
  - ✅ Heartbeat каждые 30 секунд
  - ✅ Graceful leave при закрытии календаря
  - ✅ Batch запросы и кэширование (TTL 45 сек)

---

**Версия документа**: 4.0.0 (2025-11-25)
**Статус**: STABLE (Clean Rollback)
**Последнее обновление**: 
- **SchedulerMain.tsx Cleanup & Fix**:
  - ✅ Выполнен откат к стабильной версии компонента
  - ✅ Устранены дублирования кода в конце файла
  - ✅ Добавлен корректный export default SchedulerMain
  - ✅ Исправлены циклические зависимости и проблемы с Undo/Redo
  - ✅ Удален лишний код автосохранения истории (теперь только явное сохранение)
  - ✅ Стабильная работа Drag & Drop, Resize и Gap Handles

---

**Версия документа**: 1.5.0 (2025-11-18)
**Последнее обновление**: 
- **Gap Handles - Двусторонний Resize** (v1.5.0):
  - ✅ При зажатой Cmd/Ctrl появляются синие пипки на промежутках между событиями
  - ✅ Вертикальные handles: между событиями сверху-снизу (курсор ns-resize)
  - ✅ Горизонтальные handles: между событиями слева-справа (курсор ew-resize)
  - ✅ Drag handle изменяет оба события одновременно
  - ✅ Валидация: минимум 1 unit/week, не выходить за пределы
  - ✅ Undo/Redo поддерживается, polling блокируется на 2 сек
  - Документация: `/GAP_HANDLES_v1.5.0.md`
- **Drag & Drop от точки захвата** (v1.4.0):
  - ✅ При захвате события вычисляется за какой юнит взялись (offsetUnit)
  - ✅ Этот юнит следует за курсором при перемещении
  - ✅ Строка определяется по реальной позиции курсора (без offset)
  - ✅ Событие переносится на новую строку только когда курсор на ней
  - ✅ Интуитивное поведение без неожиданных прыжков
  - Документация: `/CHANGELOG.md` v1.4.0
- **UX оптимизация - убраны toast уведомления** (v1.4.0):
  - ✅ Убраны toast при копировании/вставке/создании событий
  - ✅ Меньше визуального шума
  - ✅ Пользователь видит результат на календаре
  - ✅ Фокус на критических сообщениях
  - Документация: `/CHANGELOG.md` v1.4.0
- **Supabase Realtime Integration** (v3.4.0):
  - ✅ Collaborative Cursors через Supabase Realtime Presence
  - ✅ Новый `/utils/supabase/client.ts` с lazy loading
  - ✅ Новый `/contexts/PresenceContext.tsx` для управления presence
  - ✅ Новый `/components/scheduler/RealtimeCursors.tsx` для отображения курсоров
  - ✅ Integration: `App.tsx` → `PresenceProvider` → `SchedulerMain` → `RealtimeCursors`
  - ✅ Как работает:
    1. `PresenceProvider` подключается к Realtime каналу `workspace:{id}:presence`
    2. При движении мыши вызывает `updateCursor(x, y)` (throttle 50ms)
    3. Отправляет broadcast с `{ type: 'cursor_update', user_id, email, x, y, timestamp }`
    4. Получает позиции других пользователей через Realtime
    5. `RealtimeCursors` отображает курсоры с плавной анимацией
  - ✅ Технические детали:
    - **Channel**: `workspace:{workspaceId}:presence` (приватный)
    - **Events**: `presence_update` (broadcast), `join` (presence), `leave` (presence)
    - **Throttle**: 50ms (максимум 20 обновлений/сек)
    - **Timeout**: 5 секунд (автоудаление неактивных курсоров)
    - **Координаты**: относительно viewport (clientX, clientY)
    - **RLS**: проверка через `workspace_members` таблицу
  - ✅ Оптимизации:
    - Lazy loading `@supabase/supabase-js` (загружается только когда нужно)
    - Graceful fallback если Realtime недоступен (приложение работает без курсоров)
    - Throttle 50ms → снижение нагрузки на сеть
    - `eventsPerSecond: 20` в Realtime config → защита от перегрузки
    - Автоматическая очистка устаревших курсоров каждую секунду
    - Не показывается свой курсор (фильтруется по email)
    - Автоматический реконнект через Supabase Realtime
  - ✅ Визуальный стиль:
    - SVG курсор с цветом на основе email (HSL hash)
    - Имя пользователя в цветном badge рядом с курсором
    - `pointer-events: none` → курсоры не блокируют клики
    - `transition: transform 100ms ease-out` → плавное движение
    - Индикатор подключения в dev режиме
  - ✅ Требования Supabase:
    - Realtime включён для таблиц (`events`, `users`, `projects`, `departments`, `workspaces`)
    - RLS политики для `workspace_members` и `realtime.messages`
    - Таблица `workspace_members` с колонками: `workspace_id`, `user_id`, `role`
  - ✅ Документация: `/SUPABASE_REALTIME_INTEGRATION_v3.4.0.md`, `/QUICK_TEST_REALTIME_v3.4.0.md`