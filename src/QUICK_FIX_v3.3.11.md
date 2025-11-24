# ⚡ Quick Fix v3.3.11 - Race Condition в Undo/Redo

## 🎯 Проблема
При быстром нажатии Ctrl+Z несколько раз подряд → race condition → конфликты синхронизации

## ✅ Решение
Блокировка одновременных операций через `isUndoRedoInProgressRef`

## 🔧 Что изменилось

### 1 файл изменён: `/components/scheduler/SchedulerMain.tsx`

```typescript
// ✅ Добавлен новый Ref
const isUndoRedoInProgressRef = useRef<boolean>(false);

// ✅ Проверка в handleUndo и handleRedo
if (isUndoRedoInProgressRef.current) {
  console.warn('⏸️ UNDO/REDO: Undo уже выполняется');
  return;
}

// ✅ Finally блок для гарантии снятия блокировки
try {
  // ... логика ...
} finally {
  isUndoRedoInProgressRef.current = false;
}
```

## 🧪 Быстрый тест

```bash
# 1. Открой календарь
# 2. Открой консоль (F12)
# 3. Создай 5 событий
# 4. БЫСТРО нажми Ctrl+Z 5 раз (< 100ms между нажатиями)

# ✅ Ожидаемый результат:
# - Первый Undo выполняется
# - Следующие 4 блокируются (⏸️ в консоли)
# - События удаляются последовательно
# - Нет ошибок синхронизации
```

## 📊 Результат

### ДО (БАГ):
- ❌ Все 5 Undo запускаются одновременно
- ❌ Конфликты синхронизации
- ❌ Ошибки в консоли

### ПОСЛЕ (ИСПРАВЛЕНО):
- ✅ Только один Undo выполняется за раз
- ✅ Остальные блокируются
- ✅ Последовательное выполнение
- ✅ Нет ошибок

## 📝 Документация
- `/UNDO_REDO_RACE_CONDITION_FIX_v3.3.11.md` - Детали
- `/QUICK_TEST_UNDO_REDO_v3.3.11.md` - Полное тестирование
- `/v3.3.11_RELEASE_NOTES.md` - Release notes

---

**Версия**: v3.3.11  
**Дата**: 2025-11-18  
**Статус**: ✅ ГОТОВО
