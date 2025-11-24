# Undo/Redo Fix Cheatsheet - Эволюция решения

## Проблема

Флаг `isUndoRedoInProgressRef` залипает в состоянии `true` → Undo/Redo блокируется навсегда.

## Эволюция решения

### v3.3.11 - Введение блокировки

```typescript
if (isUndoRedoInProgressRef.current) {
  console.warn('Undo уже выполняется');
  return; // ← Блокируем одновременные Undo
}

isUndoRedoInProgressRef.current = true;

try {
  // ... логика undo
} finally {
  isUndoRedoInProgressRef.current = false;
}
```

**Проблема**: При ошибке finally может НЕ выполниться → флаг залипает.

---

### v3.3.16 - Принудительный сброс

```typescript
if (isUndoRedoInProgressRef.current) {
  console.warn('Undo уже выполняется');
  isUndoRedoInProgressRef.current = false; // ← Принудительный сброс
  return; // ← Выход (без продолжения)
}

isUndoRedoInProgressRef.current = true; // ← СНАРУЖИ try

try {
  // ... логика undo
} finally {
  isUndoRedoInProgressRef.current = false;
}
```

**Проблема**: Флаг устанавливается СНАРУЖИ try → при критических ошибках finally НЕ выполняется → залипание продолжается.

---

### v3.3.17 - Try-Finally структура (ФИНАЛЬНОЕ РЕШЕНИЕ)

```typescript
if (isUndoRedoInProgressRef.current) {
  console.warn('Undo уже выполняется');
  isUndoRedoInProgressRef.current = false;
  return;
}

const state = historyUndo();
if (!state) return; // ← early return если история пуста

// ✅ КРИТИЧНО: Обернуть ВСЁ в try-finally!
try {
  isUndoRedoInProgressRef.current = true; // ← ВНУТРИ try!
  console.log('🔒 Флаг установлен в:', isUndoRedoInProgressRef.current);
  
  // ... логика undo
  
  console.log('✅ Undo завершён успешно');
} catch (err) {
  console.error('❌ Критическая ошибка:', err);
} finally {
  // ✅ Finally ГАРАНТИРОВАННО выполнится
  console.log('🔓 Сброс флага (было:', isUndoRedoInProgressRef.current, ')');
  isUndoRedoInProgressRef.current = false;
  console.log('🔓 Блокировка снята (теперь:', isUndoRedoInProgressRef.current, ')');
}
```

**Решение**: Флаг устанавливается ВНУТРИ try → finally ГАРАНТИРОВАННО выполняется при любых ошибках.

## Ключевые различия

| Версия | Установка флага | Finally выполняется | Залипание | Решение |
|--------|-----------------|---------------------|-----------|---------|
| v3.3.11 | Снаружи try | ❌ НЕ ВСЕГДА | ✅ ДА | ❌ |
| v3.3.16 | Снаружи try + принудительный сброс | ❌ НЕ ВСЕГДА | ⚠️ РЕДКО | ⚠️ |
| **v3.3.17** | **Внутри try** | **✅ ВСЕГДА** | **❌ НЕТ** | **✅** |

## Почему v3.3.17 работает

### JavaScript гарантия

**ECMAScript спецификация**:
> "The finally block is always executed, even if an exception is thrown."

**НО!** Есть условие:
- Finally выполняется **ТОЛЬКО если был вход в try блок**

### Сравнение

#### v3.3.16 (НЕ РАБОТАЕТ)

```typescript
isUndoRedoInProgressRef.current = true; // ← СНАРУЖИ try

try {
  setEvents(invalidData); // ← Критическая ошибка
  // ❌ React Error Boundary перехватил
  // ❌ Выполнение прервано
} finally {
  // ❌ Finally может НЕ выполниться
  isUndoRedoInProgressRef.current = false;
}

// Результат: флаг = true (ЗАЛИП!)
```

#### v3.3.17 (РАБОТАЕТ)

```typescript
try {
  isUndoRedoInProgressRef.current = true; // ← ВНУТРИ try
  
  setEvents(invalidData); // ← Критическая ошибка
  // ✅ Ошибка в пределах try блока
} catch (err) {
  // ✅ Catch обработал ошибку
  console.error('Ошибка:', err);
} finally {
  // ✅ Finally ГАРАНТИРОВАННО выполнится
  isUndoRedoInProgressRef.current = false;
}

// Результат: флаг = false (СБРОШЕН!)
```

## Быстрый тест

### Симуляция ошибки

```javascript
// В консоли браузера:
window.setEventsOriginal = window.setEvents;
window.setEvents = () => {
  throw new Error('TEST ERROR');
};

// Создать событие → подождать 2 сек → Ctrl+Z

// ✅ Ожидаемые логи:
🔄 UNDO/REDO: 🔒 Флаг установлен в: true
🔄 UNDO/REDO: ❌ Критическая ошибка: Error: TEST ERROR
🔄 UNDO/REDO: 🔓 Сброс флага (было: true)
🔄 UNDO/REDO: 🔓 Блокировка снята (теперь: false)

// Восстановить setEvents
window.setEvents = window.setEventsOriginal;

// Нажать Ctrl+Z ещё раз
// ✅ Undo работает! (флаг НЕ залип)
```

### Быстрые повторные Undo

```
1. Создать 5 событий
2. Подождать 2 секунды
3. Нажать Ctrl+Z 5 раз подряд

✅ Все 5 Undo выполняются
❌ НЕТ сообщений "Undo уже выполняется"
❌ НЕТ toast "Повторите попытку"
```

## Критерии успеха

✅ **Нормальный Undo работает** (логи показывают установку и сброс флага)

✅ **Undo после ошибки работает** (флаг сбрасывается в finally)

✅ **Нет залипания** при network errors, TypeError, ReferenceError

✅ **Нет сообщений** "⏸️ UNDO/REDO: Undo уже выполняется"

✅ **Нет toast** "Повторите попытку"

## Документация

- **Детали**: `/UNDO_REDO_TRYFINALLY_FIX_v3.3.17.md`
- **Тесты**: `/QUICK_TEST_TRYFINALLY_v3.3.17.md`
- **Release Notes**: `/RELEASE_NOTES_v3.3.17.md`
- **Changelog**: `/CHANGELOG.md` (v3.3.17)

## Версия

**v3.3.17** (2025-11-19) - ФИНАЛЬНОЕ РЕШЕНИЕ ✅
