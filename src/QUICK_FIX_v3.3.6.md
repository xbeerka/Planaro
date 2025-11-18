# v3.3.6: Быстрое исправление

## 🐛 Проблема

**Измененные события (высота, позиция) возвращались к старому состоянию через 30 секунд после Undo/Redo**

### Сценарий
1. Изменил высоту события на 2 units → сохранил
2. Сделал Undo → высота вернулась к 1 unit
3. Подождал 30 секунд
4. ❌ **ОШИБКА**: высота вернулась к 2 units (данные с сервера)

---

## ✅ Решение

**Расширили `syncRestoredEventsToServer()` для синхронизации CREATE + UPDATE**

### Было (v3.3.5)
```typescript
// ❌ Синхронизировались только новые события
const eventsToCreate = events.filter(e => !loadedEventIds.current.has(e.id));
if (eventsToCreate.length === 0) return; // ОШИБКА!
```

### Стало (v3.3.6)
```typescript
// ✅ Синхронизируются CREATE + UPDATE
const eventsToCreate: SchedulerEvent[] = [];
const eventsToUpdate: SchedulerEvent[] = [];

events.forEach(event => {
  const existsOnServer = loadedEventIds.current.has(event.id);
  if (!existsOnServer) {
    eventsToCreate.push(event); // Создать
  } else {
    eventsToUpdate.push(event); // ✅ Обновить!
  }
});

// 1 batch запрос: CREATE + UPDATE
const operations = [
  ...eventsToCreate.map(e => ({ op: 'create', ... })),
  ...eventsToUpdate.map(e => ({ op: 'update', ... }))
];
```

---

## 🎯 Результат

### Теперь работает правильно
1. Изменил высоту на 2 units → сохранил
2. Сделал Undo → высота вернулась к 1 unit
3. ✅ **Мгновенная синхронизация**: высота обновилась на сервере (UPDATE)
4. Подождал 30 секунд
5. ✅ **Full Sync**: загрузил правильные данные (1 unit)

---

## 📝 Изменения

### Файлы
- `/contexts/SchedulerContext.tsx` - `syncRestoredEventsToServer()`

### Логи
```javascript
// ✅ НОВЫЕ ЛОГИ
🔄 Событие X не найдено на сервере, нужно создать
🔄 Событие Y найдено на сервере, нужно обновить
📦 BATCH: 2 create + 5 update
✅ BATCH CREATE: создано 2 событий на сервере
✅ BATCH UPDATE: обновлено 5 событий на сервере
```

---

## 🧪 Тестирование

```bash
# Тест
1. Создай событие (высота 1 unit)
2. Измени высоту на 2 units → сохрани
3. Undo → высота вернулась к 1 unit
4. Подожди 35 секунд
5. ✅ Ожидаемый результат: высота остается 1 unit

# Проверь логи
console.log('🔄 Событие X найдено на сервере, нужно обновить');
console.log('📦 BATCH UPDATE: обновлено 1 событий на сервере');
```

---

## 📚 Документация

- **Детально**: `/UNDO_REDO_MODIFIED_EVENTS_FIX.md`
- **Тесты**: `/TEST_UNDO_REDO_v3.3.6.md`
- **Шпаргалка**: `/UNDO_REDO_SYNC_CHEATSHEET.md`
- **CHANGELOG**: `/CHANGELOG.md` v3.3.6
- **Guidelines**: `/guidelines/Guidelines.md` v3.3.6

---

**Версия**: v3.3.6  
**Дата**: 2025-11-18  
**Статус**: ✅ Готово к тестированию
