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
  - При зажатой Cmd/Ctrl появляют��я синие пипки на промежутках между событиями
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
- **IndexedDB** для хранения access_token и session_id на клиенте
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
  - kv_store.tsx - утилиты для KV таблицы (НЕ ИЗМЕНЯТЬ)
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
- **useMemo/useCallback** - для стабильности пропсов и предотвращения лишних ре-рендеров
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
- `?` - Справка по х��ткеям
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
  - Собы��ия выбранных проектов: отображаются нормально (100% opacity, оригинальные цвета)
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

4. **Прямая ссылка / Обн��вление страницы**:
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
- Не делай авт��сохранение в модалках
- Не меняй защищённые файлы
- Не используй alert() - используй toast
- Не делай последовательные await в циклах
- Не забывай про workspace_id в запросах
- Не используй `atob()` напрямую для JWT - используй `/utils/jwt.ts`

---

**Версия документа**: 8.7.0 (2025-12-02)
**Статус**: STABLE (Phonetic & Highlight Fix)
**Последнее обновление**: 
- **Smart Search Phonetic Fix (v8.7.0)**:
  - ✅ **Transliteration**: Добавлено правило `кс` -> `x`. Решает проблему поиска "Гэлакси" -> "Galaxy".
  - ✅ **Phonetic**: Добавлено правило `eng` -> `ing`. Решает проблему поиска "Инглиш" -> "English".
  - ✅ **Phonetic Normalization**: Улучшена нормализация `x` -> `ks` для обратной совместимости.
  - ✅ **Highlight Fix**: Запрещена подсветка токенов короче 3 символов в середине слов. Решает проблему подсветки "en**GL**ish" по запросу "гэл".
  - ✅ **Файлы**: `/utils/search.ts`, `/utils/highlightMatch.tsx`.
- **Smart Search Skeleton Fix (v8.6.0)**:
  - ✅ **Strict Skeleton**: Поиск по скелету согласных (Consonant Skeleton) теперь поддерживает только точное совпадение (`===`) или начало слова (`startsWith`).
  - ✅ **No Skeleton Includes**: Запрещен поиск подстроки внутри скелета (`includes`). Это устранило ложные срабатывания, когда "LiteFi" (ltf) находился внутри "Platform" (p**ltf**rm).
  - ✅ **Separated Variants**: Обычные варианты (fuzzy, translit) и скелетные варианты обрабатываются раздельно с разной логикой.
  - ✅ **Файлы**: `/utils/search.ts`.
- **Smart Search Tuning (v8.5.0)**:
  - ✅ **Tighter Thresholds**: 2 ошибки теперь допускаются только для слов длиной 7+ символов (ранее 5+). Это устраняет ложные совпадения для слов средней длины ("ливери" -> "LiteFinance").
  - ✅ **Distance Scoring**: В итоговый балл теперь добавляется `dist` (количество ошибок). Точные совпадения ранжируются выше приблизительных.
  - ✅ **Файлы**: `/utils/search.ts`, `/utils/highlightMatch.tsx`.
- **Smart Search Final Fix (v8.4.0)**:
  - ✅ **Damerau-Levenshtein**: Алгоритм расстояния теперь учитывает перестановки (transpositions), исправляя опечатки типа "lihte" -> "light".
  - ✅ **Consonant Skeleton**: Добавлен поиск по "скелету" слова (без гласных). "Лайтфин" (ltfn) находит "LiteFinance" (ltfnnc) даже при полном несовпадении гласных.
  - ✅ **Translit Order**: Исправлен порядок транслитерации. Длинные ключи ('shch') теперь гарантированно обрабатываются раньше коротких ('sch').
  - ✅ **No Length Cutoff**: Убрано жесткое ограничение по разнице длин, мешавшее поиску сокращений.
  - ✅ **Strict Substring**: Сохранена строгая логика для середины слова (защита от ложных срабатываний).
  - ✅ **Файлы**: `/utils/search.ts`, `/utils/highlightMatch.tsx`.
- **Smart Search Fix (v8.3.0)**:
  - ✅ **Strict Substring Matching**: Введена строгая проверка для совпадений в середине слова. Допускается на 1 ошибку меньше, чем для начала слова. Это устраняет ложные срабатывания (например, "Лайтфи" -> "Platform").
  - ✅ **Prefix Lenience**: Для начала слова (префикса) сохранены мягкие пороги ошибок (2 ошибки для 5+ букв), что критично для поиска с опечатками и транслитерацией.
  - ✅ **Highlight Word Start**: Подсветка теперь корректно определяет начала слов и применяет соответствующие пороги ошибок.
  - ✅ **Файлы**: `/utils/search.ts`, `/utils/highlightMatch.tsx`.
- **Smart Search Fix (v8.2.0)**:
  - ✅ **Double Phonetic Normalization**: Теперь нормализуется не только запрос, но и целевая строка (`target`). Это позволяет находить "Лайтфи" (Litfi) в "LiteFinance" (Litfinans) через префиксное совпадение.
  - ✅ **Threshold Tuning**: Смягчены пороги ошибок. Для слов длиной 5+ символов допускается 2 ошибки (было 1). Это критично для незаконченных транслитерированных запросов.
  - ✅ **Highlight Sync**: Логика подсветки синхронизирована с новыми порогами поиска.
  - ✅ **Файлы**: `/utils/search.ts`, `/utils/highlightMatch.tsx`.
- **Fuzzy Highlight System (v8.1.0)**:
  - ✅ **Levenshtein Highlight**: Подсветка текста переписана с RegExp на поиск нечетких подстрок. Теперь "Лайт" подсвечивает "Lite", а "Фидбэк" — "Feedback".
  - ✅ **Range Merging**: Умное объединение пересекающихся диапазонов подсветки.
  - ✅ **CamelCase Splitting**: Поиск теперь разбивает CamelCase названия ("LiteFinance" → "Lite Finance"), что значительно улучшает поиск по частям ("Лайт" находит "Lite").
  - ✅ **Silent E Normalization**: Улучшена фонетика для английских слов (удаление немой 'e' на конце), что помогает сопоставлять "Lite" и "Lit" (из транслита "Layt").
  - ✅ **Файлы**: `/utils/highlightMatch.tsx` (переписан), `/utils/search.ts` (улучшен).
- **Mega-Super Smart Search (v8.0.0)**:
  - ✅ **Token-based Architecture**: Полная переработка алгоритма. Вместо генерации тысяч вариантов строки используется умное сравнение токенов. Скорость работы увеличена в 10-50 раз.
  - ✅ **Acronym Support**: Поддержка поиска по аббревиатурам (запрос `ВТБ` или `VTB` найдет `Vnesh Torg Bank` по первым буквам слов).
  - ✅ **Visual Normalization**: Обработка визуально похожих символов (`0` ↔ `o`, `1` ↔ `l`, `$` ↔ `s`). Полезно для опечаток с цифрами.
  - ✅ **Expanded Transliteration**: Добавлены сложные правила: `x` → `ks`, `q` → `kv`/`k`, `w` → `v`, `ts` → `ц`.
  - ✅ **Optimization**: В `SimpleEventModal` удалено дублирование вычислений. Score считается 1 раз на элемент. Сохраняется сортировка по частоте использования при равном релевантности.
  - ✅ **Файлы**: `/utils/search.ts` (полностью переписан), `/components/scheduler/SimpleEventModal.tsx`.
- **Smart Search System (v7.0.0)**:
  - ✅ **Агрессивная фонетическая нормализация**: Упрощение дифтонгов (`aj` → `i`, `ej` → `i`) для улучшения поиска (например, "Лайт" → "LiteFinance", "Фидбэк" → "Feedback").
  - ✅ **Sliding Window алгоритм**: Поиск подстрок с учетом опечаток внутри длинных названий.
  - ✅ **Levenshtein Distance**: Нечеткий поиск с допуском ошибок.
  - ✅ **Relevance Sorting**: Весовая сортировка: Точное > Начало > Слово > Fuzzy.
  - ✅ **Auto Layout**: Автоматическое переключение раскладки (ghbdtn ↔ привет).
  - ✅ **Файлы**: `/utils/search.ts`, `/components/scheduler/SimpleEventModal.tsx`.
- **Event Neighbors v8.0.2 (Biting Logic Fix)**:
  - ✅ **Проблема**: Центральное событие получало лишнее уменьшение ширины (-1 gap), если сбоку было 2 и более соседей, даже если они не расширялись.
  - ✅ **Причина**: В расчете `pressure` (Rule 3) использовалось `Math.max(1, expand)`, что считало каждый соседний проект за единицу давления по умолчанию.
  - ✅ **Решение**: Убрано `Math.max(1, ...)`. Теперь давление создает только реальное расширение соседа (`expand > 0`).
  - ✅ **Результат**: Множественные соседи без расширения больше не "кусают" центральное событие. Откусывание срабатывает только при реальной угрозе наложения.
- **Event Neighbors v8.0.1 (Roof Bug Fix)**:
  - ✅ **Проблема**: "Крыша" (Scenario A) - событие не получало дополнительный отступ справа, когда его сосед снизу (форма Б) был частью "стены" (склеен горизонтально).
  - ✅ **Причина**: Правило 2 (Б над А) сбрасывало расширение соседей верхнего события, не учитывая, что нижнее событие может быть частью стены.
  - ✅ **Решение**: Добавлена проверка `if (topology.hasHorizontalGlue) continue;` в STAGE 3.
  - ✅ **Результат**: Склеенные стены (Rule 1) имеют приоритет над формой крыши (Rule 2). Соседи верхнего события корректно расширяются (+1 gap) против стены.
  - ✅ **Чистая архитектура**: Исправление локализовано в STAGE 3, не затрагивает другие этапы.
- **Event Neighbors v8.0 - ПОЛНАЯ ПЕРЕРАБОТКА**:
  - ✅ **Чистая архитектура**: Разделение на 5 независимых этапов (STAGE 1-5)
  - ✅ **STAGE 1 - GEOMETRY**: Сбор геометрических фактов без принятия решений
  - ✅ **STAGE 2 - TOPOLOGY**: Классификация паттернов (А/Б/В/Г формы)
  - ✅ **STAGE 3 - RULES**: Явное применение правил расширения (независимо)
  - ✅ **STAGE 4 - CORNER FLAGS**: Определение скруглений углов
  - ✅ **STAGE 5 - NAME HIDING**: Логика скрытия названий
  - ✅ **Предсказуемость**: Каждое правило изолировано, результат не зависит от порядка
  - ✅ **Документация**: `/EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md`
