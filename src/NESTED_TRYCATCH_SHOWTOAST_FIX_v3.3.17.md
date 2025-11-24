# Nested Try-Catch ShowToast Fix v3.3.17

## Проблема

После исправления v3.3.17 (перенос флага внутрь try), ошибки залипания **продолжали появляться**:

```
⏸️ UNDO/REDO: Undo уже выполняется, ожидайте завершения...
⚠️ DEBUG: Флаг isUndoRedoInProgressRef не был сброшен!
⚠️ Принудительный сброс флага...
❌ Failed to fetch (попытка 1/3)
```

## Анализ: Вложенные try-catch блоки

### Структура кода до дополнительного исправления

```typescript
try {
  // ✅ Установка флага ВНУТРИ try
  isUndoRedoInProgressRef.current = true;
  
  // ... логика undo
  
  // ⚠️ Вложенный try-catch для синхронизации
  try {
    await syncRestoredEventsToServer(uniqueEvents, updateHistoryEventId);
    console.log('✅ События синхронизированы');
  } catch (error) {
    console.error('❌ Ошибка синхронизации:', error);
    
    // 🔥 ПРОБЛЕМА: showToast может выбросить ошибку!
    showToast({
      title: 'Ошибка восстановления',
      description: 'Не удалось синхронизировать события с сервером',
      variant: 'destructive'
    });
  }
  
  // ... остальная логика
  
} catch (err) {
  console.error('❌ Критическая ошибка:', err);
} finally {
  // ✅ Сброс флага
  isUndoRedoInProgressRef.current = false;
}
```

### Сценарий залипания

**Шаг 1**: Network error в синхронизации
```typescript
try {
  await syncRestoredEventsToServer(...); // ← Failed to fetch
  // ❌ Ошибка выброшена
} catch (error) {
  console.error('Ошибка:', error); // ✅ Ошибка залогирована
  showToast({...}); // ← Пытаемся показать toast
}
```

**Шаг 2**: Ошибка в showToast
```typescript
catch (error) {
  console.error('Ошибка:', error);
  
  // 🔥 ПРОБЛЕМА: React component был unmounted!
  showToast({...}); // ← Выбрасывает TypeError: Cannot read property of undefined
  
  // ❌ Ошибка произошла В САМОМ catch блоке
  // ❌ Вложенный catch НЕ может обработать (ошибка произошла внутри)
  // ❌ Ошибка всплывает наверх
}
```

**Шаг 3**: Всплытие ошибки
```typescript
try {
  // ... вложенный try-catch
  // ❌ Ошибка всплыла из вложенного catch
  
  // ⚠️ Код ниже может НЕ выполниться!
  console.log('✅ Undo завершён успешно');
  
} catch (err) {
  // ✅ Внешний catch ДОЛЖЕН поймать ошибку
  console.error('❌ Критическая ошибка:', err);
} finally {
  // ✅ Finally ДОЛЖЕН выполниться
  isUndoRedoInProgressRef.current = false;
}
```

### Почему finally может НЕ выполниться?

**Теоретически**: JavaScript гарантирует выполнение finally

**Практически**: Есть edge cases:

1. **React Error Boundary**:
   - Если showToast выбрасывает ошибку валидации React
   - Error Boundary может перехватить ошибку
   - Выполнение функции **прервано**
   - Finally НЕ выполнился

2. **Асинхронная ошибка в toast component**:
   - showToast вызывает setState
   - setState триггерит ре-рендер
   - Ре-рендер выбрасывает ошибку (например, undefined property)
   - Ошибка происходит **асинхронно** (в следующем tick)
   - Внешний catch НЕ может поймать (уже завершился)
   - Finally выполнился, НО...
   - **Новый вызов handleUndo начинается ДО завершения асинхронной ошибки**
   - Race condition!

3. **Update component while rendering**:
   - showToast вызывается во время обработки ошибки
   - React находится в процессе рендеринга
   - showToast пытается обновить state
   - React выбрасывает: "Cannot update component while rendering"
   - Эта ошибка может прервать выполнение

## Решение: queueMicrotask + try-catch

### Код после исправления

```typescript
try {
  await syncRestoredEventsToServer(uniqueEvents, updateHistoryEventId);
  console.log('✅ События синхронизированы');
} catch (error) {
  console.error('❌ Ошибка синхронизации:', error);
  
  // ✅ v3.3.17: Защита showToast
  queueMicrotask(() => {
    try {
      showToast({
        title: 'Ошибка восстановления',
        description: 'Не удалось синхронизировать события с сервером',
        variant: 'destructive'
      });
    } catch (toastErr) {
      console.error('❌ Ошибка показа toast:', toastErr);
      // ✅ Ошибка залогирована, НЕ всплывает
    }
  });
  
  // ✅ Выполнение продолжается (showToast отложен)
}
```

### Почему это работает

#### 1. queueMicrotask откладывает выполнение

```
[Текущий tick]
1. catch ловит ошибку синхронизации
2. queueMicrotask регистрирует callback
3. Выход из catch (БЕЗ вызова showToast)
4. Выполнение продолжается
5. finally выполняется
6. Флаг сброшен
7. handleUndo завершён

[Следующий microtask]
8. showToast вызывается
9. Если ошибка - ловится внутренним try-catch
10. Ошибка НЕ всплывает (handleUndo уже завершён)
```

#### 2. Внутренний try-catch ловит ошибки toast

```typescript
queueMicrotask(() => {
  try {
    showToast({...}); // ← Может выбросить ошибку
  } catch (toastErr) {
    console.error('Ошибка toast:', toastErr);
    // ✅ Ошибка обработана
    // ✅ НЕ всплывает наверх
  }
  // ✅ callback завершён без ошибок
});
```

#### 3. Предотвращает "Cannot update component while rendering"

```
[БЕЗ queueMicrotask]
1. Обработка ошибки (React в процессе обработки)
2. showToast → setState
3. ❌ React выбрасывает "Cannot update component while rendering"

[С queueMicrotask]
1. Обработка ошибки (React в процессе обработки)
2. queueMicrotask регистрирует callback
3. Обработка завершена
4. React завершил обработку
5. showToast → setState
6. ✅ Можно обновлять state (React не в процессе рендеринга)
```

## Сравнение

| Вариант | showToast вызывается | Ошибка в showToast | Finally выполняется | Флаг сбрасывается |
|---------|----------------------|---------------------|---------------------|-------------------|
| **v3.3.16** (снаружи try) | Сразу в catch | Всплывает → может прервать | ❌ НЕ ВСЕГДА | ❌ НЕТ |
| **v3.3.17 v1** (внутри try, БЕЗ queueMicrotask) | Сразу в catch | Всплывает → может прервать | ⚠️ ПОЧТИ ВСЕГДА | ⚠️ ОБЫЧНО |
| **v3.3.17 v2** (внутри try + queueMicrotask) | В следующем tick | Ловится внутренним catch | ✅ ВСЕГДА | ✅ ДА |

## Тестирование

### Тест 1: Симуляция network error

```javascript
// В консоли браузера:

// Симулируем network error
const originalFetch = window.fetch;
window.fetch = (...args) => {
  if (args[0].includes('/events/batch')) {
    return Promise.reject(new Error('Failed to fetch'));
  }
  return originalFetch(...args);
};

// Создать событие → подождать 2 сек → Ctrl+Z

// ✅ Ожидаемые логи:
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ❌ Ошибка синхронизации с сервером: Error: Failed to fetch
🔄 UNDO/REDO: ✅ Undo завершён успешно (локально)
🔄 UNDO/REDO: 🔓 Сброс флага (было: true)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)

// ✅ Toast показан (в следующем tick)
// ✅ Флаг сброшен
// ✅ Undo работает

// Восстановить fetch
window.fetch = originalFetch;

// Нажать Ctrl+Z ещё раз
// ✅ Undo работает нормально (флаг НЕ залип)
```

### Тест 2: Симуляция ошибки в showToast

```javascript
// Перехватываем showToast
const originalShowToast = window.showToast;
window.showToast = () => {
  throw new Error('⚠️ TEST: Ошибка в showToast');
};

// Симулируем network error (чтобы вызвать showToast)
const originalFetch = window.fetch;
window.fetch = (...args) => {
  if (args[0].includes('/events/batch')) {
    return Promise.reject(new Error('Failed to fetch'));
  }
  return originalFetch(...args);
};

// Создать событие → подождать 2 сек → Ctrl+Z

// ✅ Ожидаемые логи:
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ❌ Ошибка синхронизации с сервером: Error: Failed to fetch
🔄 UNDO/REDO: ✅ Undo завершён успешно (локально)
🔄 UNDO/REDO: 🔓 Сброс флага (было: true)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)

// ✅ В следующем tick:
🔄 UNDO/REDO: ❌ Ошибка показа toast: Error: ⚠️ TEST: Ошибка в showToast

// ✅ Ошибка залогирована
// ✅ Флаг сброшен (ошибка произошла ПОСЛЕ)
// ✅ Undo работает

// Восстановить
window.showToast = originalShowToast;
window.fetch = originalFetch;

// Нажать Ctrl+Z ещё раз
// ✅ Undo работает! (флаг НЕ залип)
```

## Критерии успеха

✅ **Network error в синхронизации**:
- Ошибка залогирована
- Toast показан (в следующем tick)
- Флаг сброшен
- Следующий Undo работает

✅ **Ошибка в showToast**:
- Ошибка залогирована
- Флаг сброшен
- Следующий Undo работает

✅ **Нет сообщений**:
- ❌ "⏸️ UNDO/REDO: Undo уже выполняется"
- ❌ "⚠️ Принудительный сброс флага"

✅ **Нет toast**:
- ❌ "Повторите попытку"

## Затронутые файлы

- `/components/scheduler/SchedulerMain.tsx:508-530` — handleUndo (syncRestoredEventsToServer catch)
- `/components/scheduler/SchedulerMain.tsx:654-676` — handleRedo (syncRestoredEventsToServer catch)

## Ключевые изменения

### До (v3.3.17 v1)

```typescript
} catch (error) {
  console.error('Ошибка:', error);
  showToast({...}); // ← Может выбросить ошибку → всплывёт наверх
}
```

### После (v3.3.17 v2)

```typescript
} catch (error) {
  console.error('Ошибка:', error);
  
  // ✅ v3.3.17: queueMicrotask + try-catch
  queueMicrotask(() => {
    try {
      showToast({...}); // ← Ошибка ловится внутренним catch
    } catch (toastErr) {
      console.error('Ошибка toast:', toastErr);
    }
  });
}
```

## Почему queueMicrotask, а не setTimeout?

### queueMicrotask (выбрано)

```
Выполняется: ПЕРЕД следующим task (сразу после текущего)
Задержка: ~0ms
Порядок: Гарантирован (FIFO)
Приоритет: Высокий
```

### setTimeout(fn, 0)

```
Выполняется: В следующем task (минимум через 4ms в браузерах)
Задержка: ~4ms
Порядок: НЕ гарантирован (зависит от других timers)
Приоритет: Низкий
```

**Результат**: queueMicrotask показывает toast быстрее и предсказуемее.

## Версия

**v3.3.17 v2** (2025-11-19) - с защитой showToast

## Приоритет

🔴 **КРИТИЧЕСКОЕ** - устраняет последнюю причину залипания флага

## Статус

✅ Исправлено и готово к production deploy
