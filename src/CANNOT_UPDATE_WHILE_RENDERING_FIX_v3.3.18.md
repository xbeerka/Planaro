# Cannot Update While Rendering Fix v3.3.18

## Проблема

После исправления v3.3.17 (защита showToast), появилась **НОВАЯ ошибка**:

```
Warning: Cannot update a component (`SchedulerMain`) while rendering a different component (`SchedulerProvider`). 
To locate the bad setState() call inside `SchedulerProvider`, follow the stack trace as described in https://reactjs.org/link/setstate-in-render
    at SchedulerProvider (contexts/SchedulerContext.tsx:95:36)
    at AppContent (App.tsx:15:48)
```

## Анализ

### React Warning "Cannot update while rendering"

Эта ошибка возникает когда:
1. Компонент A рендерится
2. Во время рендера компонента A вызывается **setState** в компоненте B
3. React выбрасывает warning (или error в StrictMode)

### Корневая причина

**Код до исправления** (SchedulerContext.tsx строки 544-553):

```typescript
useEffect(() => {
  if (!accessToken) {
    setIsLoadingEvents(false);
    return;
  }
  
  // Если workspaceId нет - очищаем все данные
  if (!workspaceId) {
    console.log('🧹 чистка данных при выходе из воркспейса');
    
    // 🔥 ПРОБЛЕМА: Синхронные setState подряд во время useEffect
    setEventsState([]);     // ← setState #1
    setDepartments([]);     // ← setState #2
    setResources([]);       // ← setState #3
    setProjects([]);        // ← setState #4
    loadedEventIds.current = new Set();
    setIsLoadingEvents(false); // ← setState #5
    return;
  }
  
  // ... load logic
}, [accessToken, workspaceId]);
```

### Почему это вызывает ошибку?

**Сценарий**:
1. SchedulerProvider начинает рендериться
2. `workspaceId` изменился (например, стал `undefined`)
3. useEffect запускается **синхронно** (React 18 может запустить useEffect синхронно при первом рендере)
4. Внутри useEffect вызываем **5 setState подряд**
5. React пытается обновить state **во время рендера** SchedulerProvider
6. Это вызывает update в SchedulerMain (потребляет context)
7. React выбрасывает warning: "Cannot update SchedulerMain while rendering SchedulerProvider"

### Почему именно это место?

```typescript
// При выходе из воркспейса:
1. App.tsx вызывает handleBackToWorkspaces()
2. setSelectedWorkspace(null) → workspaceId становится undefined
3. SchedulerProvider ре-рендерится с workspaceId=undefined
4. useEffect срабатывает СИНХРОННО (зависимость изменилась)
5. if (!workspaceId) → true
6. 5 setState подряд → React warning
```

## Решение: queueMicrotask

### Код после исправления

```typescript
useEffect(() => {
  if (!accessToken) {
    setIsLoadingEvents(false);
    return;
  }
  
  // Если workspaceId нет - очищаем все данные
  if (!workspaceId) {
    console.log('🧹 чистка данных при выходе из воркспейса');
    
    // ✅ Откладываем setState на следующий tick чтобы избежать "Cannot update while rendering"
    queueMicrotask(() => {
      setEventsState([]);
      setDepartments([]);
      setResources([]);
      setProjects([]);
      loadedEventIds.current = new Set();
      setIsLoadingEvents(false);
    });
    
    return;
  }
  
  // ... load logic
}, [accessToken, workspaceId]);
```

### Почему это работает?

#### Без queueMicrotask (проблема)

```
[Синхронное выполнение]
1. useEffect запускается
2. if (!workspaceId) → true
3. setEventsState([]) → СИНХРОННО обновляет state
4. setDepartments([]) → СИНХРОННО обновляет state
5. setResources([]) → СИНХРОННО обновляет state
6. setProjects([]) → СИНХРОННО обновляет state
7. setIsLoadingEvents(false) → СИНХРОННО обновляет state
8. ❌ React пытается ре-рендерить ВО ВРЕМЯ рендера → warning
```

#### С queueMicrotask (решение)

```
[Текущий tick - синхронное выполнение]
1. useEffect запускается
2. if (!workspaceId) → true
3. queueMicrotask регистрирует callback
4. return (выход из useEffect)
5. ✅ Рендер SchedulerProvider завершается

[Следующий microtask - после завершения рендера]
6. callback выполняется
7. setEventsState([]) → обновляет state (рендер уже завершён)
8. setDepartments([]) → обновляет state
9. setResources([]) → обновляет state
10. setProjects([]) → обновляет state
11. setIsLoadingEvents(false) → обновляет state
12. ✅ React ре-рендерит (рендер ЗАВЕРШЁН, можно обновлять)
```

### Ключевое отличие

| Вариант | setState вызывается | Рендер завершён | React warning |
|---------|---------------------|-----------------|---------------|
| **Без queueMicrotask** | Во время useEffect (синхронно) | ❌ НЕТ (рендер в процессе) | ✅ ДА |
| **С queueMicrotask** | В следующем microtask | ✅ ДА (рендер завершён) | ❌ НЕТ |

## Почему queueMicrotask, а не setTimeout?

### queueMicrotask (выбрано)

```
Выполняется: Сразу после текущего task (перед следующим event loop)
Задержка: ~0ms (мгновенно)
Порядок: Гарантирован (FIFO)
Приоритет: Высокий
Когда: После завершения рендера, но ДО следующего event
```

### setTimeout(fn, 0)

```
Выполняется: В следующем task (минимум через 4ms в браузерах)
Задержка: ~4ms (заметная задержка)
Порядок: НЕ гарантирован (зависит от других timers)
Приоритет: Низкий
Когда: Через 4ms минимум
```

**Результат**: queueMicrotask очищает state **мгновенно** (0ms) без React warnings.

## Альтернативные решения (не выбраны)

### 1. React.startTransition (не подходит)

```typescript
React.startTransition(() => {
  setEventsState([]);
  setDepartments([]);
  // ...
});
```

❌ **Почему нет**: startTransition предназначен для **низкоприоритетных** обновлений UI, которые можно прервать. Очистка данных при выходе - **высокоприоритетная** операция.

### 2. Batched setState (не работает)

```typescript
// React 18 автоматически батчит setState
setEventsState([]);
setDepartments([]);
setResources([]);
setProjects([]);
```

❌ **Почему нет**: Batching НЕ помогает если setState вызывается **во время рендера**. Ошибка всё равно будет.

### 3. Один объединённый setState (сложно)

```typescript
// Один общий state для всех данных
const [state, setState] = useState({
  events: [],
  departments: [],
  resources: [],
  projects: []
});

setState({ events: [], departments: [], resources: [], projects: [] });
```

❌ **Почему нет**: Требует полного рефакторинга context, нарушает существующую архитектуру.

### 4. queueMicrotask ✅ (выбрано)

```typescript
queueMicrotask(() => {
  setEventsState([]);
  setDepartments([]);
  setResources([]);
  setProjects([]);
  setIsLoadingEvents(false);
});
```

✅ **Почему ДА**:
- Минимальные изменения кода (1 строка обёртки)
- Мгновенное выполнение (~0ms задержка)
- Предотвращает React warning
- Не нарушает существующую архитектуру
- Работает с React 18+

## Тестирование

### Тест 1: Выход из воркспейса

```
1. Открыть приложение
2. Войти в воркспейс
3. Нажать кнопку "Назад" (← Управление рабочими пространствами)

✅ Ожидаемое поведение:
- Возврат к списку воркспейсов
- НЕТ warning в консоли
- Данные очищены (нет событий, проектов, сотрудников)
- Плавный переход без артефактов

✅ Ожидаемые логи:
🧹 чистка данных при выходе из воркспейса

❌ НЕ должно быть:
Warning: Cannot update a component (`SchedulerMain`) while rendering...
```

### Тест 2: Переключение между воркспейсами

```
1. Открыть воркспейс A
2. Нажать "Назад"
3. Открыть воркспейс B

✅ Ожидаемое поведение:
- Данные воркспейса A очищены
- Данные воркспейса B загружены
- НЕТ warning в консоли
- Плавный переход

✅ Ожидаемые логи:
🧹 чистка данных при выходе из воркспейса
📦 Загрузка данных воркспейса B...
```

### Тест 3: Быстрое переключение (stress test)

```javascript
// В консоли браузера:

// Открыть воркспейс
const workspace = { id: '123', name: 'Test' };
handleSelectWorkspace(workspace);

// Быстро закрыть (через 100ms)
setTimeout(() => {
  handleBackToWorkspaces();
}, 100);

// ✅ Ожидаемое: НЕТ warning
// ✅ Данные очищены корректно
```

## Затронутые файлы

- `/contexts/SchedulerContext.tsx:544-557` — Load events useEffect

## Критерии успеха

✅ **Нет React warnings**:
- ❌ "Cannot update a component while rendering"
- ❌ "Cannot update component during an existing state transition"

✅ **Функциональность сохранена**:
- Данные очищаются при выходе из воркспейса
- Очистка происходит мгновенно (~0ms)
- Нет визуальных артефактов

✅ **Производительность**:
- queueMicrotask добавляет ~0ms задержки
- Batching работает (5 setState объединяются в 1 ре-рендер)

## Версия

**v3.3.18** (2025-11-19)

## Приоритет

🟠 **ВАЖНОЕ** - устраняет React warning, но не критическое для функциональности

## Статус

✅ Исправлено и готово к тестированию

## Связанные исправления

Эта проблема проявилась после:
- v3.3.17 v2 - защита showToast через queueMicrotask
- Повышенная чувствительность к синхронным setState во время рендера

## Уроки

1. **Избегай синхронных setState в useEffect** если они могут выполниться во время первого рендера
2. **queueMicrotask - универсальный инструмент** для откладывания setState после завершения рендера
3. **React 18+ более строгий** к setState во время рендера (в StrictMode может бросить error вместо warning)
4. **Batching НЕ спасает** от "Cannot update while rendering" - нужно откладывать на следующий tick

## Почему не useLayoutEffect?

```typescript
// Не поможет - useLayoutEffect тоже может запуститься синхронно
useLayoutEffect(() => {
  if (!workspaceId) {
    setEventsState([]); // ❌ Всё ещё во время рендера
  }
}, [workspaceId]);
```

**Причина**: useLayoutEffect запускается **ДО отрисовки**, но **всё ещё во время commit фазы**. setState в useLayoutEffect может вызвать "Cannot update while rendering" если происходит во время рендера другого компонента.

**queueMicrotask** откладывает выполнение **ПОСЛЕ commit фазы** → гарантированно безопасно.
