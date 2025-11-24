# Undo/Redo Try-Finally Fix v3.3.17

## Проблема

После исправления v3.3.16 (добавление `return` после сброса флага) ошибки залипания флага `isUndoRedoInProgressRef` **продолжают появляться**:

```
⏸️ UNDO/REDO: Undo уже выполняется, ожидайте завершения...
⚠️ DEBUG: Флаг isUndoRedoInProgressRef не был сброшен!
⚠️ Принудительный сброс флага...
```

## Анализ корневой причины

### Структура кода до исправления (v3.3.16)

```typescript
const handleUndo = useCallback(async () => {
  // ... flush pending changes
  
  // Проверка pending операций
  if (hasPendingOperations()) {
    return; // ← early return
  }
  
  // Проверка залипшего флага
  if (isUndoRedoInProgressRef.current) {
    isUndoRedoInProgressRef.current = false;
    return; // ← early return с исправлением v3.3.16
  }
  
  const state = historyUndo();
  if (!state) return; // ← early return если история пуста
  
  // ✅ Устанавливаем флаг блокировки
  isUndoRedoInProgressRef.current = true; // ← СНАРУЖИ try-finally!
  
  try {
    // ... логика undo
  } catch (err) {
    console.error('Критическая ошибка:', err);
  } finally {
    // ✅ Сбрасываем флаг
    isUndoRedoInProgressRef.current = false;
  }
}, [...]);
```

### Проблема: Флаг устанавливается СНАРУЖИ try-finally

**Сценарий 1: Ошибка в установке состояния**

```typescript
isUndoRedoInProgressRef.current = true; // ← Установили флаг

try {
  const previousEvents = events;
  // ...
  setEvents(uniqueEvents); // ← ОШИБКА! (например, события некорректны)
  setEventZOrder(state.eventZOrder);
  setProjects(state.projects);
  // ...
} catch (err) {
  console.error('Критическая ошибка:', err); // ← Ошибка обработана
} finally {
  isUndoRedoInProgressRef.current = false; // ← Флаг сброшен
}
```

**НО!** Если ошибка происходит **синхронно в setEvents**, то:
- Флаг установлен в `true`
- Ошибка выброшена
- **React может прервать выполнение функции** до входа в finally
- Флаг остаётся `true`

**Сценарий 2: Асинхронная ошибка**

```typescript
isUndoRedoInProgressRef.current = true;

try {
  // ...
  await syncRestoredEventsToServer(uniqueEvents, updateHistoryEventId);
  // ← ОШИБКА! Network error или отклонённый промис
} catch (err) {
  console.error('Ошибка:', err);
} finally {
  isUndoRedoInProgressRef.current = false;
}
```

**НО!** Если await выбрасывает ошибку которая **НЕ обработана внутренним try-catch**, она может **всплыть наверх** и прервать выполнение до finally.

**Сценарий 3: Критическая ошибка JavaScript**

```typescript
isUndoRedoInProgressRef.current = true;

try {
  const previousEvents = events; // ← events = undefined!
  previousEvents.filter(...); // ← TypeError: Cannot read property 'filter' of undefined
} catch (err) {
  console.error('Критическая ошибка:', err);
} finally {
  isUndoRedoInProgressRef.current = false;
}
```

В теории finally **должен** выполниться, но на практике:
- Критические ошибки в React могут прервать выполнение
- Error boundaries могут перехватить ошибку
- Флаг остаётся `true`

## Решение

### Переместить установку флага ВНУТРЬ try-finally

```typescript
const handleUndo = useCallback(async () => {
  // ... flush pending changes
  
  if (hasPendingOperations()) {
    return;
  }
  
  if (isUndoRedoInProgressRef.current) {
    isUndoRedoInProgressRef.current = false;
    queueMicrotask(() => {
      showToast({
        type: 'info',
        message: 'Повторите попытку',
        description: 'Предыдущая операция была сброшена'
      });
    });
    return;
  }
  
  const state = historyUndo();
  if (!state) {
    console.log('🔄 UNDO/REDO: ⏸️ История пуста, Undo невозможен');
    return;
  }
  
  // ✅ v3.3.17: КРИТИЧНО - обернуть ВСЁ в try-finally!
  try {
    // ✅ Устанавливаем флаг блокировки ВНУТРИ try
    isUndoRedoInProgressRef.current = true; // ← ВНУТРИ try-finally!
    console.log('🔄 UNDO/REDO: ↩️ Undo начат');
    console.log('🔄 UNDO/REDO: 🔒 Флаг установлен в:', isUndoRedoInProgressRef.current);
    
    const previousEvents = events;
    
    // ... вся логика undo
    
    setEvents(uniqueEvents);
    setEventZOrder(state.eventZOrder);
    setProjects(state.projects);
    
    await syncRestoredEventsToServer(uniqueEvents, updateHistoryEventId);
    await syncDeletedEventsToServer(uniqueEvents, previousEvents);
    
    console.log('🔄 UNDO/REDO: ✅ Undo завершён успешно');
  } catch (err) {
    console.error('🔄 UNDO/REDO: ❌ Критическая ошибка в handleUndo:', err);
    // ✅ Ошибка залогирована, finally сбросит флаг
  } finally {
    // ✅ Гарантированно снимаем блокировку
    console.log('🔄 UNDO/REDO: 🔓 Сброс флага isUndoRedoInProgressRef (было:', isUndoRedoInProgressRef.current, ')');
    isUndoRedoInProgressRef.current = false;
    console.log('🔄 UNDO/REDO: 🔓 Блокировка снята (теперь:', isUndoRedoInProgressRef.current, ')');
  }
}, [...]);
```

## Почему это работает

### До исправления (v3.3.16)

```
[Выполнение]
1. Флаг = true (СНАРУЖИ try)
2. Вход в try блок
3. ❌ ОШИБКА! (например, setEvents выбросил исключение)
4. React Error Boundary перехватил ошибку
5. ❌ Finally НЕ выполнился (выполнение прервано)
6. Флаг = true (ЗАЛИП!)

[Следующий вызов]
7. Флаг всё ещё true
8. Срабатывает принудительный сброс
9. return → выход
```

### После исправления (v3.3.17)

```
[Выполнение]
1. Вход в try блок
2. Флаг = true (ВНУТРИ try)
3. ❌ ОШИБКА! (например, setEvents выбросил исключение)
4. Catch обработал ошибку
5. ✅ Finally ГАРАНТИРОВАННО выполнился
6. Флаг = false (СБРОШЕН!)

[Следующий вызов]
7. Флаг = false
8. Проверка пройдена
9. Undo выполняется нормально
```

## Детальное логирование

```typescript
try {
  isUndoRedoInProgressRef.current = true;
  console.log('🔄 UNDO/REDO: 🔒 Флаг установлен в:', isUndoRedoInProgressRef.current);
  // ...
} catch (err) {
  console.error('🔄 UNDO/REDO: ❌ Критическая ошибка:', err);
} finally {
  console.log('🔄 UNDO/REDO: 🔓 Сброс флага (было:', isUndoRedoInProgressRef.current, ')');
  isUndoRedoInProgressRef.current = false;
  console.log('🔄 UNDO/REDO: 🔓 Блокировка снята (теперь:', isUndoRedoInProgressRef.current, ')');
}
```

**Логи при ошибке**:
```
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ❌ Критическая ошибка: TypeError: ...
🔄 UNDO/REDO: 🔓 Сброс флага (было: true)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)
```

**Логи при успехе**:
```
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ✅ Undo завершён успешно
🔄 UNDO/REDO: 🔓 Сброс флага (было: true)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)
```

## Тестирование

### Тест 1: Симуляция ошибки в setEvents

```javascript
// В консоли браузера:
const originalSetEvents = window.setEvents;
window.setEvents = () => {
  throw new Error('Test error in setEvents');
};

// Нажмите Ctrl+Z
// Ожидаемые логи:
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ❌ Критическая ошибка: Error: Test error in setEvents
🔄 UNDO/REDO: 🔓 Сброс флага (было: true)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)

// Восстановите setEvents
window.setEvents = originalSetEvents;

// Нажмите Ctrl+Z ещё раз
// Ожидаемое поведение:
✅ Undo выполняется нормально (флаг не залип)
```

### Тест 2: Симуляция network error

```javascript
// Отключите интернет
// Создайте событие
// Подождите 2 секунды
// Нажмите Ctrl+Z

// Ожидаемые логи:
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ❌ Ошибка синхронизации с сервером: TypeError: Failed to fetch
🔄 UNDO/REDO: ✅ Undo завершён успешно (локально)
🔄 UNDO/REDO: 🔓 Сброс флага (было: true)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)

// Включите интернет
// Нажмите Ctrl+Z ещё раз
// Ожидаемое поведение:
✅ Undo выполняется нормально (флаг не залип)
```

### Тест 3: Нормальный flow

```
1. Создать событие
2. Подождать 2 секунды
3. Нажать Ctrl+Z

Ожидаемые логи:
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ✅ Undo завершён успешно
🔄 UNDO/REDO: 🔓 Сброс флага (было: true)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)

✅ Undo выполнен без ошибок
✅ Флаг корректно сброшен
```

## Затронутые файлы

- `/components/scheduler/SchedulerMain.tsx:445-537` — handleUndo
- `/components/scheduler/SchedulerMain.tsx:584-676` — handleRedo

## Ключевые изменения

| До (v3.3.16) | После (v3.3.17) |
|--------------|-----------------|
| Флаг устанавливается СНАРУЖИ try | Флаг устанавливается ВНУТРИ try |
| Finally может НЕ выполниться при критических ошибках | Finally ГАРАНТИРОВАННО выполнится |
| Флаг может залипнуть при ошибках | Флаг ВСЕГДА сбрасывается |
| Принудительный сброс срабатывает часто | Принудительный сброс больше НЕ нужен (резерв) |

## Приоритет

🔴 **КРИТИЧЕСКОЕ** - устраняет корневую причину залипания флага

## Версия

**v3.3.17** (2025-11-19)

## Дополнительное исправление: Защита showToast

### Проблема с вложенными try-catch

После переноса флага внутрь try-finally, обнаружена **дополнительная проблема**:

```typescript
try {
  await syncRestoredEventsToServer(...);
} catch (error) {
  console.error('Ошибка синхронизации:', error);
  showToast({...}); // ← Может выбросить ошибку!
}
```

**Сценарий**:
1. `syncRestoredEventsToServer` выбрасывает ошибку (network error)
2. Вложенный catch ловит ошибку
3. Вызывает `showToast`
4. **`showToast` выбрасывает НОВУЮ ошибку** (например, React component unmounted)
5. Эта ошибка **НЕ обработана** вложенным catch (произошла В САМОМ catch)
6. Ошибка всплывает наверх
7. Внешний catch может не успеть сработать
8. Finally может НЕ выполниться

### Решение

**Обернуть showToast в queueMicrotask + try-catch**:

```typescript
try {
  await syncRestoredEventsToServer(uniqueEvents, updateHistoryEventId);
  console.log('✅ События синхронизированы');
} catch (error) {
  console.error('❌ Ошибка синхронизации:', error);
  
  // ✅ v3.3.17: Обернём showToast для защиты
  queueMicrotask(() => {
    try {
      showToast({
        title: 'Ошибка восстановления',
        description: 'Не удалось синхронизировать события',
        variant: 'destructive'
      });
    } catch (toastErr) {
      console.error('❌ Ошибка показа toast:', toastErr);
    }
  });
}
```

**Почему это работает**:
1. `queueMicrotask` откладывает выполнение showToast на следующий tick
2. Даже если showToast выбросит ошибку, она произойдёт **ПОСЛЕ** завершения handleUndo
3. Finally **ГАРАНТИРОВАННО** выполнится (выполнение уже прошло)
4. Внутренний try-catch вокруг showToast ловит ошибки toast
5. Ошибка логируется, но НЕ всплывает наверх

## Статус

✅ Исправлено (включая защиту showToast) и готово к тестированию
