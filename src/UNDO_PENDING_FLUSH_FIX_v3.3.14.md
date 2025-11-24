# 🔧 UNDO Pending Flush Fix v3.3.14

## Проблема

**Сценарий:**
1. Создал событие → сохранено на сервере ✅
2. Передвинул событие → **debounced save** (2 сек задержка) → операция в очереди
3. Быстро делаю Undo (< 2 сек) → событие возвращается к старой позиции
4. **НО pending операция всё ещё в очереди!** → через 2 сек срабатывает
5. Событие показывает **полоски загрузки** (pending state) 😱

**Причина:**
- Undo восстанавливает старое состояние
- НО не очищает pending операции для изменённых событий
- Debounced save продолжает выполняться

## Решение v3.3.14

### 1. Flush Pending перед Undo/Redo

Добавили вызов `await flushPendingChanges()` в начало `handleUndo` и `handleRedo`:

```typescript
const handleUndo = useCallback(async () => {
  // ✅ v3.3.14: Сначала флашим все pending изменения
  // Это гарантирует что все изменения сохранены перед undo
  try {
    await flushPendingChanges();
    console.log('✅ UNDO: Pending изменения сохранены перед undo');
  } catch (err) {
    console.error('❌ UNDO: Ошибка flush pending:', err);
  }
  
  // ... остальной код undo
}, [..., flushPendingChanges]);
```

### 2. Убрали Toast Warning

Убрали лишний toast уведомление при блокировке undo для pending событий:

```typescript
// ❌ БЫЛО:
if (hasPendingEvents) {
  console.warn('⏸️ UNDO: Заблокировано');
  showToast({
    title: 'Подождите',
    description: 'Дождитесь завершения создания событий',
    variant: 'warning'
  });
  return;
}

// ✅ СТАЛО:
if (hasPendingEvents) {
  console.warn('⏸️ UNDO: Заблокировано - есть события в процессе создания');
  // Только console.log для диагностики (без toast)
  return;
}
```

## Результат

**До исправления:**
1. Drag события → Undo → **полоски загрузки** → событие "прыгает"
2. Лишний toast warning при попытке undo

**После исправления:**
1. Drag события → **flush pending (сохранение!)** → Undo → **БЕЗ полосок!** ✅
2. События мгновенно восстанавливаются без артефактов
3. Нет лишних toast уведомлений

## Как работает

```
UNDO БЕЗ FLUSH (СТАРОЕ):
┌─────────────────────────────────────────────────────┐
│ Drag → pending save (2 сек) → UNDO → restore state  │
│                                └─> ⏳ Pending всё ещё в очереди!
│                                └─> 💾 Save срабатывает
│                                └─> 🔄 Полоски загрузки
└─────────────────────────────────────────────────────┘

UNDO С FLUSH (НОВОЕ):
┌─────────────────────────────────────────────────────┐
│ Drag → pending save → UNDO → FLUSH (мгновенно!) →   │
│                        └─> ✅ Все изменения сохранены
│                        └─> 🧹 Очередь пуста
│                        └─> 🔙 Restore state
│                        └─> ✅ БЕЗ полосок!
└─────────────────────────────────────────────────────┘
```

## Затронутые файлы

- `/components/scheduler/SchedulerMain.tsx:400-509` - `handleUndo` с flush
- `/components/scheduler/SchedulerMain.tsx:511-620` - `handleRedo` с flush

## Тестирование

1. ✅ Создай событие
2. ✅ Быстро drag (< 2 сек)
3. ✅ Быстро Ctrl+Z
4. ✅ Событие возвращается БЕЗ полосок загрузки
5. ✅ Нет toast warning

## Версия

**v3.3.14** (2025-11-19)
