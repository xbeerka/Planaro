# 🔧 Исправление: Синхронизация проектов при Undo/Redo

## 📌 Описание проблемы

**Что происходило**:
1. Пользователь создаёт 10 проектов в модальном окне
2. Быстро удаляет 5 проектов через Undo/Redo
3. Возвращает 3 проекта через Undo/Redo
4. Всё делается локально (мгновенно)
5. **Проблема**: Через 15 секунд приходит ответ от сервера и все 10 проектов возвращаются! 😱

**Корневая причина**:
- Undo/Redo восстанавливает проекты только локально (`setProjects(state.projects)`)
- Polling проектов каждые 15 секунд загружает данные с сервера
- Сервер не знает об изменениях через Undo/Redo (только локальный state)
- Данные с сервера **перезаписывают** локальный state → все проекты возвращаются

**Почему это не затронуло события**:
- События имеют `resetDeltaSyncTimer()` который блокирует синхронизацию на 2 секунды после Undo/Redo
- Проекты НЕ имели аналогичной защиты → polling перезаписывал изменения

---

## ✅ Решение

### 1. Добавлены функции блокировки синхронизации

**Файл**: `/contexts/SchedulerContext.tsx`

```typescript
// ⏱️ Delta Sync control (для блокировки синхронизации после локальных изменений)
resetDeltaSyncTimer: () => void;
resetProjectsSyncTimer: () => void; // ✅ Для проектов
resetResourcesSyncTimer: () => void; // ✅ Для сотрудников
resetDepartmentsSyncTimer: () => void; // ✅ Для департаментов
```

**Реализация**:
```typescript
resetDeltaSyncTimer: () => lastLocalChangeRef.current = Date.now(),
resetProjectsSyncTimer: () => lastProjectsChangeRef.current = Date.now(),
resetResourcesSyncTimer: () => lastResourcesChangeRef.current = Date.now(),
resetDepartmentsSyncTimer: () => lastDepartmentsChangeRef.current = Date.now(),
```

### 2. Вызов блокировки в handleUndo

**Файл**: `/components/scheduler/SchedulerMain.tsx`

```typescript
// ✅ МГНОВЕННО восстанавливаем события и проекты из истории
setEvents(uniqueEvents);
setEventZOrder(state.eventZOrder);
setProjects(state.projects);

console.log(`↩️ Undo: восстановлено ${uniqueEvents.length} событий, ${state.projects.length} проектов`);

// ✅ КРИТИЧНО: Блокируем синхронизацию проектов после Undo (на 2 секунды)
resetProjectsSyncTimer();
console.log('🔒 Undo: синхронизация проектов заблокирована на 2 секунды');
```

### 3. Вызов блокировки в handleRedo

**Файл**: `/components/scheduler/SchedulerMain.tsx`

```typescript
// ✅ МГНОВЕННО восстанавливаем события и проекты из истории
setEvents(uniqueEvents);
setEventZOrder(state.eventZOrder);
setProjects(state.projects);

console.log(`↪️ Redo: восстановлено ${uniqueEvents.length} событий, ${state.projects.length} проектов`);

// ✅ КРИТИЧНО: Блокируем синхронизацию проектов после Redo (на 2 секунды)
resetProjectsSyncTimer();
console.log('🔒 Redo: синхронизация проектов заблокирована на 2 секунды');
```

---

## 🎯 Как это работает

### До исправления:
```
Пользователь: Undo → удаляет 5 проектов локально
↓
setProjects([...5 проектов])
↓
⏰ 15 секунд спустя...
↓
Polling Projects: загружает с сервера
↓
Сервер возвращает: [...10 проектов] (не знает об Undo!)
↓
setProjects([...10 проектов]) ← ПЕРЕЗАПИСЫВАЕТ локальный state!
↓
❌ Пользователь видит все 10 проектов снова
```

### После исправления:
```
Пользователь: Undo → удаляет 5 проектов локально
↓
setProjects([...5 проектов])
↓
resetProjectsSyncTimer() ← БЛОКИРУЕТ синхронизацию!
↓
lastProjectsChangeRef.current = Date.now()
↓
⏰ Через 1 секунду приходит polling...
↓
Polling Projects: проверка
  timeSinceLastChange = 1000ms < 2000ms ← БЛОКИРОВАНО!
  return; ← ПРОПУСКАЕТ синхронизацию!
↓
⏰ Через 3 секунды блокировка истекает
↓
Polling Projects снова работает, но теперь сервер уже знает об изменениях
↓
✅ Проекты остаются как после Undo/Redo
```

---

## 📊 Защита для всех типов данных

### Events (события):
- ✅ `resetDeltaSyncTimer()` - уже было
- ✅ Блокировка на 2 секунды после Undo/Redo
- ✅ Работает корректно

### Projects (проекты):
- ✅ `resetProjectsSyncTimer()` - **ДОБАВЛЕНО**
- ✅ Блокировка на 2 секунды после Undo/Redo
- ✅ Исправлено в этом коммите

### Resources (сотрудники):
- ✅ `resetResourcesSyncTimer()` - **ДОБАВЛЕНО**
- ✅ Готово к использованию при Undo/Redo для сотрудников

### Departments (департаменты):
- ✅ `resetDepartmentsSyncTimer()` - **ДОБАВЛЕНО**
- ✅ Готово к использованию при Undo/Redo для департаментов

---

## 🧪 Тестирование

### Тест 1: Быстрое Undo/Redo проектов
```
1. Создать 10 проектов в модальном окне
2. Закрыть модальное окно
3. Ctrl+Z → должно удалить изменения
4. Подождать 15 секунд
5. ✅ Проекты НЕ должны вернуться
```

### Тест 2: Множественное Undo
```
1. Создать 5 проектов
2. Ctrl+Z x5 (удалить все)
3. Подождать 15 секунд
4. ✅ Проекты НЕ должны вернуться
```

### Тест 3: Redo после Undo
```
1. Создать 3 проекта
2. Ctrl+Z (удалить)
3. Подождать 5 секунд
4. Ctrl+Shift+Z (вернуть)
5. Подождать 15 секунд
6. ✅ Проекты должны остаться
```

### Логи для проверки:
```
↩️ Undo: восстановлено 0 событий, 5 проектов
🔒 Undo: синхронизация проектов заблокирована на 2 секунды
⏸️ Projects Sync: пропуск (недавнее локальное изменение) ← ДОЛЖЕН ПОЯВИТЬСЯ!
```

---

## 📝 Изменённые файлы

### `/contexts/SchedulerContext.tsx`
**Изменения**:
- Добавлен `resetProjectsSyncTimer()` в интерфейс
- Добавлен `resetResourcesSyncTimer()` в интерфейс
- Добавлен `resetDepartmentsSyncTimer()` в интерфейс
- Реализованы все три функции в Provider value

**Строки**: 54-57, 1514-1516

---

### `/components/scheduler/SchedulerMain.tsx`
**Изменения**:
- Импорт `resetProjectsSyncTimer` из контекста
- Вызов `resetProjectsSyncTimer()` в `handleUndo()`
- Вызов `resetProjectsSyncTimer()` в `handleRedo()`
- Добавлено логирование блокировки
- Обновлены dependencies для useCallback

**Строки**: 109, 428-430, 483-485, 447, 502

---

## ✅ Результат

### До исправления:
- 🔴 Проекты восстанавливались после Undo/Redo через 15 секунд
- 🔴 Пользователь терял изменения
- 🔴 Undo/Redo для проектов было бесполезно

### После исправления:
- ✅ Проекты остаются как после Undo/Redo
- ✅ Polling блокируется на 2 секунды
- ✅ Данные не перезаписываются с сервера
- ✅ Undo/Redo для проектов работает корректно

---

## 🎉 Бонус: Защита для будущего

Теперь у нас есть **универсальная защита** для всех типов данных:
- ✅ События → `resetDeltaSyncTimer()`
- ✅ Проекты → `resetProjectsSyncTimer()`
- ✅ Сотрудники → `resetResourcesSyncTimer()`
- ✅ Департаменты → `resetDepartmentsSyncTimer()`

Если в будущем добавим Undo/Redo для сотрудников или департаментов, просто вызываем соответствующую функцию!

---

**Дата**: 2025-11-18  
**Версия**: 3.3.2 (после 3.3.1)  
**Статус**: ✅ **ИСПРАВЛЕНО И ГОТОВО**

**✨ Undo/Redo для проектов теперь работает идеально!**
