# ✅ UNDO/REDO Race Condition Fix v3.3.11

## 🎯 Проблема
При быстром нажатии Ctrl+Z несколько раз подряд возникала race condition:
1. Первый Undo начинает восстановление событий с сервера (async)
2. Второй Undo запускается ДО завершения первого
3. Оба Undo пытаются синхронизировать события одновременно
4. Возможны конфликты данных, дублирование запросов, некорректные состояния

## ✅ Решение
Добавлена блокировка одновременных операций Undo/Redo через `isUndoRedoInProgressRef`:

```typescript
const isUndoRedoInProgressRef = useRef<boolean>(false);

const handleUndo = useCallback(async () => {
  // ✅ v3.3.11: КРИТИЧНО - блокируем одновременные Undo операции
  if (isUndoRedoInProgressRef.current) {
    console.warn('⏸️ UNDO/REDO: Undo уже выполняется, ожидайте завершения...');
    return; // ← Блокируем повторный вызов
  }
  
  const state = historyUndo();
  if (!state) return;
  
  // ✅ Устанавливаем флаг блокировки
  isUndoRedoInProgressRef.current = true;
  console.log('🔄 UNDO/REDO: ↩️ Undo начат - мгновенное восстановление из истории');
  
  try {
    // ... вся логика undo ...
  } finally {
    // ✅ v3.3.11: Гарантированно снимаем блокировку даже при ошибках
    isUndoRedoInProgressRef.current = false;
    console.log('🔄 UNDO/REDO: 🔓 Блокировка снята');
  }
}, [...]);

const handleRedo = useCallback(async () => {
  // ✅ v3.3.11: КРИТИЧНО - блокируем одновременные Redo операции
  if (isUndoRedoInProgressRef.current) {
    console.warn('⏸️ UNDO/REDO: Redo уже выполняется, ожидайте завершения...');
    return;
  }
  
  const state = historyRedo();
  if (!state) return;
  
  // ✅ Устанавливаем флаг блокировки
  isUndoRedoInProgressRef.current = true;
  console.log('🔄 UNDO/REDO: ↪️ Redo начат - мгновенное восстановление из истории');
  
  try {
    // ... вся логика redo ...
  } finally {
    // ✅ v3.3.11: Гарантированно снимаем блокировку даже при ошибках
    isUndoRedoInProgressRef.current = false;
    console.log('🔄 UNDO/REDO: 🔓 Блокировка снята');
  }
}, [...]);
```

## 🔧 Изменения

### 1. Новый Ref для блокировки
```typescript
// ✅ v3.3.11: Защита от race condition в Undo/Redo
const isUndoRedoInProgressRef = useRef<boolean>(false);
```

### 2. Проверка в начале функций
```typescript
if (isUndoRedoInProgressRef.current) {
  console.warn('⏸️ UNDO/REDO: Undo/Redo уже выполняется, ожидайте завершения...');
  return; // Блокируем повторный вызов
}
```

### 3. Установка блокировки
```typescript
isUndoRedoInProgressRef.current = true;
```

### 4. Гарантированное снятие блокировки
```typescript
try {
  // ... логика undo/redo ...
} finally {
  isUndoRedoInProgressRef.current = false; // ← ВСЕГДА снимаем блокировку
}
```

## 📊 Преимущества

### ✅ Защита от race conditions
- Невозможно запустить второй Undo/Redo пока первый не завершится
- Предотвращает конфликты при синхронизации с сервером
- Защита от дублирования запросов

### ✅ Graceful degradation
- `finally` блок гарантирует снятие блокировки даже при ошибках
- Логирование: пользователь видит предупреждение в консоли
- Система не "зависает" даже если что-то пошло не так

### ✅ Минимальные изменения
- Не меняет существующую логику Undo/Redo
- Добавлен только один `useRef` и проверка в начале функций
- Совместимо со всеми существующими исправлениями (v3.3.1-v3.3.10)

## 🧪 Тестирование

### Тест 1: Быстрые множественные Undo
```
1. Создать 5 событий
2. Нажать Ctrl+Z 5 раз быстро (< 100ms между нажатиями)
3. ✅ Ожидаемый результат:
   - В консоли появится 1 сообщение "Undo начат"
   - Затем 4 сообщения "⏸️ UNDO/REDO: Undo уже выполняется"
   - События восстанавливаются ПОСЛЕДОВАТЕЛЬНО (по одному)
   - Нет ошибок синхронизации с сервером
```

### Тест 2: Быстрые Undo + Redo
```
1. Создать 3 события
2. Нажать Ctrl+Z (undo)
3. СРАЗУ нажать Ctrl+Shift+Z (redo) - не дожидаясь завершения
4. ✅ Ожидаемый результат:
   - Redo блокируется пока Undo не завершится
   - В консоли: "⏸️ UNDO/REDO: Redo уже выполняется"
   - После завершения Undo можно выполнить Redo
```

### Тест 3: Undo с ошибкой сервера
```
1. Отключить сервер (останови Edge Function)
2. Создать событие
3. Нажать Ctrl+Z (undo)
4. ✅ Ожидаемый результат:
   - Событие удаляется из UI мгновенно
   - В консоли: "❌ Ошибка синхронизации с сервером"
   - Блокировка ВСЕГДА снимается (видно в консоли: "🔓 Блокировка снята")
   - Можно снова нажать Ctrl+Z для следующего Undo
```

## 🔥 Критические моменты

### ⚠️ КРИТИЧНО: finally блок ОБЯЗАТЕЛЕН
```typescript
try {
  // ... логика ...
} finally {
  // ✅ КРИТИЧНО: ВСЕГДА снимаем блокировку, даже при throw
  isUndoRedoInProgressRef.current = false;
}
```

### ⚠️ КРИТИЧНО: useRef вместо useState
```typescript
// ✅ ПРАВИЛЬНО - useRef (без ре-рендеров)
const isUndoRedoInProgressRef = useRef<boolean>(false);

// ❌ НЕПРАВИЛЬНО - useState вызовет ре-рендеры
const [isUndoRedoInProgress, setIsUndoRedoInProgress] = useState(false);
```

### ⚠️ КРИТИЧНО: Проверка В НАЧАЛЕ функции
```typescript
// ✅ ПРАВИЛЬНО - проверка ДО historyUndo()
if (isUndoRedoInProgressRef.current) return;
const state = historyUndo();

// ❌ НЕПРАВИЛЬНО - historyUndo() уже изменит стек истории
const state = historyUndo();
if (isUndoRedoInProgressRef.current) return;
```

## 📝 Changelog

### v3.3.11 (2025-11-18)
- ✅ Добавлен `isUndoRedoInProgressRef` для блокировки одновременных операций
- ✅ Проверка блокировки в начале `handleUndo` и `handleRedo`
- ✅ Гарантированное снятие блокировки через `finally` блок
- ✅ Логирование блокировки/разблокировки для диагностики
- ✅ Исправлены отступы в try блоках функций Undo/Redo

## 🎓 Важные уроки

### 1. Async операции требуют блокировки
- Быстрые хоткеи (Ctrl+Z) могут вызвать функцию ДО завершения предыдущего вызова
- `useRef` идеален для флагов блокировки (без ре-рендеров)

### 2. finally блок критичен для надёжности
- Гарантирует очистку даже при ошибках
- Предотвращает "зависание" системы

### 3. Логирование важно для диагностики
- Эмоджи помогают быстро найти нужные логи (🔄, ⏸️, 🔓)
- Детальные сообщения помогают понять что происходит

## 🔗 Связанные исправления
- v3.3.10: Очистка pending операций при Undo/Redo
- v3.3.9: Блокировка временных событий
- v3.3.8: BATCH create/update detection
- v3.3.7: Sync history before drag
- v3.3.3: Full Sync удалённых событий
- v3.3.2: Синхронизация проектов
- v3.3.1: Защита истории от событий без проектов

---

**Автор**: AI Assistant  
**Дата**: 2025-11-18  
**Версия**: v3.3.11 FINAL
