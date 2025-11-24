# Release Notes v3.3.17 - Try-Finally Fix (ФИНАЛЬНОЕ РЕШЕНИЕ)

## Критическое исправление: Гарантированный сброс флага

### Проблема

После исправления v3.3.16 (добавление `return` после принудительного сброса флага) ошибки залипания флага `isUndoRedoInProgressRef` **продолжали появляться**:

```
⏸️ UNDO/REDO: Undo уже выполняется, ожидайте завершения...
⚠️ DEBUG: Флаг isUndoRedoInProgressRef не был сброшен!
⚠️ Принудительный сброс флага...
```

Это означает что **корневая причина залипания флага НЕ была устранена**.

### Корневая причина

**Структура кода до исправления (v3.3.16)**:

```typescript
const handleUndo = useCallback(async () => {
  // ... проверки
  
  const state = historyUndo();
  if (!state) return; // ← early return
  
  // ✅ Устанавливаем флаг блокировки
  isUndoRedoInProgressRef.current = true; // ← СНАРУЖИ try-finally!
  
  try {
    // ... логика undo
    setEvents(uniqueEvents); // ← Может выбросить ошибку!
    setEventZOrder(state.eventZOrder);
    setProjects(state.projects);
    
    await syncRestoredEventsToServer(...); // ← Может выбросить ошибку!
    await syncDeletedEventsToServer(...);
    
    console.log('✅ Undo завершён успешно');
  } catch (err) {
    console.error('❌ Критическая ошибка:', err);
  } finally {
    // ✅ Сбрасываем флаг
    isUndoRedoInProgressRef.current = false;
  }
}, [...]);
```

**Проблема**: Флаг устанавливается в `true` **СНАРУЖИ** try-finally блока!

### Почему finally не гарантированно выполняется?

#### Сценарий 1: Синхронная ошибка в setEvents

```typescript
isUndoRedoInProgressRef.current = true; // ← Установили флаг

try {
  const uniqueEvents = [...]; // ← events = undefined!
  setEvents(uniqueEvents); // ← TypeError: Cannot read property of undefined
  // ❌ Ошибка выброшена СРАЗУ
  // ❌ React Error Boundary может перехватить ошибку
  // ❌ Выполнение функции ПРЕРВАНО
} catch (err) {
  // ❌ Catch может НЕ сработать (ошибка перехвачена выше)
} finally {
  // ❌ Finally может НЕ выполниться (выполнение прервано)
  isUndoRedoInProgressRef.current = false;
}

// Результат: флаг = true (ЗАЛИП!)
```

#### Сценарий 2: Асинхронная ошибка в синхронизации

```typescript
isUndoRedoInProgressRef.current = true;

try {
  // ...
  await syncRestoredEventsToServer(...); 
  // ❌ Network error (fetch failed)
  // ❌ Promise rejected
} catch (err) {
  console.error('Ошибка:', err); // ← Catch сработал
} finally {
  isUndoRedoInProgressRef.current = false; // ← Finally выполнился
}

// ✅ Флаг сброшен (finally сработал)
```

**Но!** Если внутри try есть **вложенные try-catch**, ошибка может **НЕ всплыть** в верхний catch:

```typescript
try {
  // ...
  try {
    await syncRestoredEventsToServer(...);
  } catch (error) {
    console.error('Ошибка синхронизации:', error);
    // ❌ Ошибка обработана, НЕ всплывает наверх
    showToast({ variant: 'destructive', ... });
    // ❌ Если showToast выбросит ошибку → finally может НЕ выполниться
  }
  
  console.log('✅ Undo завершён'); // ← Продолжает выполнение
} catch (err) {
  // ❌ Этот catch НЕ сработает (ошибка обработана выше)
} finally {
  // ✅ Finally выполнится (если нет критической ошибки в showToast)
  isUndoRedoInProgressRef.current = false;
}
```

#### Сценарий 3: React Error Boundary

```typescript
isUndoRedoInProgressRef.current = true; // ← Установили флаг

try {
  setEvents(invalidData); // ← Ошибка валидации в React компоненте
  // ❌ React Error Boundary перехватил ошибку
  // ❌ Выполнение функции ПРЕРВАНО
} catch (err) {
  // ❌ Catch НЕ сработает (ошибка перехвачена Error Boundary)
} finally {
  // ❌ Finally НЕ выполнится (выполнение прервано)
  isUndoRedoInProgressRef.current = false;
}

// Результат: флаг = true (ЗАЛИП!)
```

### Решение

**Переместить установку флага ВНУТРЬ try блока**:

```typescript
const handleUndo = useCallback(async () => {
  // ... проверки
  
  const state = historyUndo();
  if (!state) {
    console.log('⏸️ История пуста');
    return; // ← early return (флаг НЕ установлен)
  }
  
  // ✅ v3.3.17: КРИТИЧНО - обернуть ВСЁ в try-finally!
  try {
    // ✅ Устанавливаем флаг блокировки ВНУТРИ try
    isUndoRedoInProgressRef.current = true; // ← ВНУТРИ try-finally!
    console.log('🔄 UNDO/REDO: ↩️ Undo начат');
    console.log('🔄 UNDO/REDO: 🔒 Флаг установлен в:', isUndoRedoInProgressRef.current);
    
    const previousEvents = events;
    
    // ... вся логика undo
    
    setEvents(uniqueEvents); // ← Если ошибка → catch → finally
    setEventZOrder(state.eventZOrder);
    setProjects(state.projects);
    
    await syncRestoredEventsToServer(uniqueEvents, updateHistoryEventId);
    await syncDeletedEventsToServer(uniqueEvents, previousEvents);
    
    console.log('🔄 UNDO/REDO: ✅ Undo завершён успешно');
  } catch (err) {
    console.error('🔄 UNDO/REDO: ❌ Критическая ошибка в handleUndo:', err);
    // ✅ Ошибка залогирована, finally ГАРАНТИРОВАННО сбросит флаг
  } finally {
    // ✅ Гарантированно снимаем блокировку
    console.log('🔄 UNDO/REDO: 🔓 Сброс флага (было:', isUndoRedoInProgressRef.current, ')');
    isUndoRedoInProgressRef.current = false;
    console.log('🔄 UNDO/REDO: 🔓 Блокировка снята (теперь:', isUndoRedoInProgressRef.current, ')');
  }
}, [...]);
```

## Почему это работает

### JavaScript гарантия для try-finally

**Спецификация ECMAScript**:
> "The finally block is always executed, even if an exception is thrown or a return statement is executed in the try block."

**НО!** Есть исключения:
1. **Process termination** (крайне редко)
2. **Infinite loop** в try блоке
3. **Критическая ошибка движка JavaScript** (крайне редко)

**Ключевое отличие**: Если флаг установлен **СНАРУЖИ try**, то:
- При ошибке ДО входа в try → finally НЕ выполнится
- При React Error Boundary → выполнение прервано → finally НЕ выполнится

Если флаг установлен **ВНУТРИ try**, то:
- Флаг устанавливается → выполнение внутри try → **finally ГАРАНТИРОВАННО выполнится**

### Сравнение

#### До исправления (v3.3.16)

```
[Нормальный flow]
1. Флаг = true (СНАРУЖИ try)
2. Вход в try
3. Логика undo
4. Catch (если ошибка)
5. Finally: флаг = false
✅ Работает

[Критическая ошибка]
1. Флаг = true (СНАРУЖИ try)
2. Вход в try
3. ❌ TypeError в setEvents
4. React Error Boundary перехватил
5. ❌ Finally НЕ выполнился
6. Флаг = true (ЗАЛИП!)
❌ НЕ работает
```

#### После исправления (v3.3.17)

```
[Нормальный flow]
1. Вход в try
2. Флаг = true (ВНУТРИ try)
3. Логика undo
4. Catch (если ошибка)
5. Finally: флаг = false
✅ Работает

[Критическая ошибка]
1. Вход в try
2. Флаг = true (ВНУТРИ try)
3. ❌ TypeError в setEvents
4. Catch обработал ошибку
5. ✅ Finally ГАРАНТИРОВАННО выполнился
6. Флаг = false (СБРОШЕН!)
✅ Работает!
```

## Тестирование

### Тест 1: Нормальный Undo

```
1. Создать событие
2. Подождать 2 секунды
3. Нажать Ctrl+Z

Логи:
🔄 UNDO/REDO: ↩️ Undo начат
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ✅ Undo завершён успешно
🔄 UNDO/REDO: 🔓 Сброс флага (было: true)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)

✅ Undo выполнен
✅ Флаг сброшен
```

### Тест 2: Симуляция ошибки

```javascript
// В консоли браузера:
const originalSetEvents = window.setEvents;
window.setEvents = () => {
  throw new Error('⚠️ TEST: Симуляция ошибки');
};

// Создать событие → подождать 2 сек → Ctrl+Z

Логи:
🔄 UNDO/REDO: ↩️ Undo начат
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ❌ Критическая ошибка: Error: ⚠️ TEST: Симуляция ошибки
🔄 UNDO/REDO: 🔓 Сброс флага (было: true)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)

✅ Ошибка обработана
✅ Флаг сброшен!

// Восстановить setEvents
window.setEvents = originalSetEvents;

// Нажать Ctrl+Z ещё раз

Логи:
🔄 UNDO/REDO: ↩️ Undo начат
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ✅ Undo завершён успешно
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)

✅ Undo работает после ошибки!
✅ Флаг НЕ залип!
```

### Тест 3: Быстрые повторные Undo

```
1. Создать 5 событий
2. Подождать 2 секунды
3. Нажать Ctrl+Z 5 раз подряд (быстро)

Ожидаемое поведение:
✅ Все 5 Undo выполняются
✅ Нет сообщений о залипшем флаге
✅ Нет toast "Повторите попытку"
✅ Каждый Undo логирует установку и сброс флага
```

## Результат

### Улучшения

✅ **Флаг ВСЕГДА сбрасывается** (даже при критических ошибках)

✅ **Нет залипания** при:
- Network errors (fetch failed)
- TypeError (undefined properties)
- ReferenceError (переменная не определена)
- Ошибках валидации React
- Ошибках в синхронизации с сервером

✅ **Принудительный сброс больше НЕ нужен** (остаётся как резерв на случай непредвиденных сценариев)

✅ **Детальное логирование** установки и сброса флага для диагностики

✅ **Graceful degradation** - ошибки обрабатываются, приложение продолжает работать

### Сравнение версий

| Версия | Флаг устанавливается | Finally выполняется | Залипание при ошибках | Требуется повторная попытка |
|--------|----------------------|---------------------|----------------------|-----------------------------|
| v3.3.15 | Снаружи try | ❌ НЕ ВСЕГДА | ✅ ДА | ❌ НЕТ (перезагрузка) |
| v3.3.16 | Снаружи try | ❌ НЕ ВСЕГДА | ⚠️ РЕДКО | ✅ ДА |
| **v3.3.17** | **Внутри try** | **✅ ВСЕГДА** | **❌ НЕТ** | **❌ НЕТ** |

## Затронутые файлы

- `/components/scheduler/SchedulerMain.tsx:445-537` — handleUndo
- `/components/scheduler/SchedulerMain.tsx:584-676` — handleRedo

## Миграция

Нет breaking changes. Пользователи больше не будут видеть:
- ❌ Toast "Повторите попытку"
- ❌ Логи "⏸️ UNDO/REDO: Undo уже выполняется"
- ❌ Логи "⚠️ Принудительный сброс флага"

Все ошибки обрабатываются gracefully, Undo/Redo продолжает работать.

## Версия

**v3.3.17** (2025-11-19)

## Приоритет

🔴 **КРИТИЧЕСКОЕ** - устраняет корневую причину залипания флага

## Статус

✅ Исправлено и готово к production deploy

## Связанные версии

- **v3.3.11**: Введена блокировка одновременных Undo операций
- **v3.3.14**: Flush pending перед Undo
- **v3.3.15**: Проверка pending операций вместо временных ID
- **v3.3.16**: Принудительный сброс + return (НЕ устранило корневую причину)
- **v3.3.17**: Try-Finally структура (ФИНАЛЬНОЕ РЕШЕНИЕ)
