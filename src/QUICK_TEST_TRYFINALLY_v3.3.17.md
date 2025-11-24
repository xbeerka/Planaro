# Quick Test - Try-Finally Fix v3.3.17

## Быстрый тест (30 секунд)

### Тест 1: Нормальный Undo/Redo

```
1. Открыть календарь
2. Создать событие
3. Подождать 2 секунды
4. Нажать Ctrl+Z (Undo)

✅ Ожидаемые логи:
🔄 UNDO/REDO: ↩️ Undo начат - мгновенное восстановление из истории
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ✅ Undo завершён успешно
🔄 UNDO/REDO: 🔓 Сброс флага isUndoRedoInProgressRef (было: true)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)

✅ Поведение: Событие удалено, флаг сброшен
```

### Тест 2: Быстрый повторный Undo (проверка залипания)

```
1. Создать 3 события
2. Подождать 2 секунды
3. Нажать Ctrl+Z → Ctrl+Z → Ctrl+Z (быстро подряд)

✅ Ожидаемое поведение:
- Первый Undo: выполнен
- Второй Undo: выполнен
- Третий Undo: выполнен
- ❌ НЕТ сообщений о залипшем флаге
- ❌ НЕТ toast "Повторите попытку"

✅ Каждый Undo логирует:
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
... (логика undo)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)
```

### Тест 3: Симуляция ошибки (advanced)

```
1. Открыть консоль браузера (F12)
2. Выполнить код:

// Перехватываем setEvents для симуляции ошибки
const _setEvents = window._setEvents || [];
window._setEventsOriginal = window.setEvents;
window.setEvents = (eventsOrUpdater) => {
  if (_setEvents.length > 0 && _setEvents[0] === 'ERROR') {
    _setEvents.shift();
    throw new Error('⚠️ TEST: Симуляция ошибки в setEvents');
  }
  window.setEventsOriginal(eventsOrUpdater);
};

// Планируем ошибку при следующем Undo
window._setEvents.push('ERROR');

3. Создать событие
4. Подождать 2 секунды
5. Нажать Ctrl+Z

✅ Ожидаемые логи:
🔄 UNDO/REDO: ↩️ Undo начат
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ❌ Критическая ошибка в handleUndo: Error: ⚠️ TEST: Симуляция ошибки в setEvents
🔄 UNDO/REDO: 🔓 Сброс флага isUndoRedoInProgressRef (было: true)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)

✅ Поведение: Ошибка обработана, флаг сброшен!

6. Нажать Ctrl+Z ещё раз (БЕЗ планирования ошибки)

✅ Ожидаемое поведение:
🔄 UNDO/REDO: ↩️ Undo начат
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ✅ Undo завершён успешно
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)

✅ Undo работает после ошибки! (флаг НЕ залип)

7. Восстановить оригинальный setEvents:

window.setEvents = window.setEventsOriginal;
delete window.setEventsOriginal;
delete window._setEvents;
```

## Что проверяем

### ✅ Нормальный flow
- Флаг устанавливается в `true` внутри try
- Undo выполняется успешно
- Флаг сбрасывается в `false` в finally
- **Результат**: Работает как ожидается

### ✅ Быстрые повторные Undo
- Каждый Undo устанавливает и сбрасывает флаг
- Нет race conditions
- Нет блокировок
- **Результат**: Все Undo выполняются подряд

### ✅ Ошибка внутри try блока
- Флаг установлен в `true`
- Ошибка выброшена (например, в setEvents)
- Catch обработал ошибку
- **Finally ГАРАНТИРОВАННО выполнился**
- Флаг сброшен в `false`
- **Результат**: Следующий Undo работает (флаг не залип)

## Сравнение с предыдущими версиями

### v3.3.15 (ДО исправления)
```
Ошибка в Undo → флаг залип → Undo заблокирован навсегда
❌ Требовалась перезагрузка страницы
```

### v3.3.16 (промежуточное исправление)
```
Залипание → принудительный сброс → toast "Повторите попытку" → Undo работает
⚠️ Залипание всё ещё возможно при критических ошибках
⚠️ Требуется повторная попытка
```

### v3.3.17 (финальное исправление)
```
Ошибка → catch → finally сбрасывает флаг → Undo работает сразу
✅ Залипание НЕВОЗМОЖНО
✅ Повторная попытка НЕ требуется
```

## Критерии успеха

✅ **Тест 1 пройден**: Нормальный Undo работает, логи корректны

✅ **Тест 2 пройден**: Быстрые повторные Undo работают без блокировок

✅ **Тест 3 пройден**: После ошибки Undo продолжает работать (флаг не залип)

✅ **НЕТ сообщений**: "⏸️ UNDO/REDO: Undo уже выполняется"

✅ **НЕТ toast**: "Повторите попытку"

## Время тестирования

- Тест 1: 10 секунд
- Тест 2: 10 секунд
- Тест 3: 60 секунд (включая setup)
- **Всего**: ~80 секунд

### Тест 4: Симуляция ошибки в showToast (advanced)

```
1. Открыть консоль браузера (F12)
2. Выполнить код:

// Перехватываем showToast для симуляции ошибки
window.showToastOriginal = window.showToast;
window.showToast = () => {
  throw new Error('⚠️ TEST: Ошибка в showToast');
};

// Симулируем network error (чтобы вызвать showToast)
window.fetchOriginal = window.fetch;
window.fetch = (...args) => {
  if (args[0].includes('/events/batch')) {
    return Promise.reject(new Error('Failed to fetch'));
  }
  return window.fetchOriginal(...args);
};

3. Создать событие
4. Подождать 2 секунды
5. Нажать Ctrl+Z

✅ Ожидаемые логи:
🔄 UNDO/REDO: ↩️ Undo начат
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ❌ Ошибка синхронизации с сервером: Error: Failed to fetch
🔄 UNDO/REDO: ✅ Undo завершён успешно (локально)
🔄 UNDO/REDO: 🔓 Сброс флага isUndoRedoInProgressRef (было: true)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)

// ✅ В следующем tick:
🔄 UNDO/REDO: ❌ Ошибка показа toast: Error: ⚠️ TEST: Ошибка в showToast

✅ Поведение: 
- Ошибка в showToast залогирована
- Флаг сброшен (ошибка произошла ПОСЛЕ finally)
- Undo работает

6. Нажать Ctrl+Z ещё раз (БЕЗ восстановления)

✅ Ожидаемое поведение:
🔄 UNDO/REDO: ↩️ Undo начат
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
... (ошибка showToast повторяется)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)

✅ Undo работает даже с ошибками в showToast! (флаг НЕ залип)

7. Восстановить оригинальные функции:

window.showToast = window.showToastOriginal;
window.fetch = window.fetchOriginal;
delete window.showToastOriginal;
delete window.fetchOriginal;
```

## Версия

v3.3.17 v2 (2025-11-19) - с защитой showToast
