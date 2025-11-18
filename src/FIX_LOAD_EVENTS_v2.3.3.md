# 🔧 Fix: loadEvents is not defined

## ❌ Проблема

При генерации тестовых событий появлялась ошибка:
```
❌ Ошибка генерации тестовых событий: ReferenceError: loadEvents is not defined
```

## 🔍 Причина

В коде `SchedulerMain.tsx` была добавлена строка:
```typescript
await loadEvents();
```

Но функция `loadEvents()` не была определена в компоненте и не была импортирована из контекста.

## ✅ Решение

Заменил вызов несуществующей функции на прямую загрузку событий через API:

### Было (v2.3.3 с ошибкой)
```typescript
// Перезагружаем все события с сервера
console.log('🔄 Перезагрузка всех событий с сервера...');
await loadEvents(); // ❌ ReferenceError: loadEvents is not defined
```

### Стало (v2.3.3 исправлено)
```typescript
// Перезагружаем все события с сервера чтобы получить финальное состояние
console.log('🔄 Перезагрузка всех событий с сервера...');
try {
  const { eventsApi } = await import('../../services/api');
  const freshEvents = await eventsApi.getAll(accessToken || undefined, workspace.id);
  setEvents(freshEvents);
  console.log(`✅ Перезагружено ${freshEvents.length} событий с сервера`);
} catch (error) {
  console.error('❌ Ошибка перезагрузки событий:', error);
}
```

## 📝 Технические детали

### Почему нет функции loadEvents?

В `SchedulerContext.tsx` события загружаются через `useEffect`:
```typescript
// Load events
useEffect(() => {
  const load = async () => {
    const data = await eventsApi.getAll(accessToken, workspaceId);
    setEventsState(data);
    setLoadedEventIds(new Set(data.map(e => e.id)));
  };
  load();
}, [accessToken, workspaceId]);
```

Эта функция `load` **не экспортируется** из контекста, поэтому недоступна в `SchedulerMain`.

### Доступные методы из контекста

В `SchedulerMain` из контекста доступны:
- `setEvents` - устанавливает события в state
- `createEvent` - создаёт одно событие
- `updateEvent` - обновляет событие
- `deleteEvent` - удаляет событие
- `events` - текущие события

Но **нет** метода для перезагрузки всех событий с сервера.

### Решение - прямой вызов API

Вместо вызова несуществующей функции:
1. Импортируем `eventsApi` динамически
2. Вызываем `eventsApi.getAll()` напрямую
3. Обновляем state через `setEvents()`

Это эквивалентно тому что делает контекст, но выполняется явно в компоненте.

## 🧪 Тестирование

1. Откройте календарь воркспейса
2. Нажмите "Генерировать события"
3. Дождитесь завершения генерации
4. **Ожидаемый результат**:
   - ✅ Нет ошибки `ReferenceError: loadEvents is not defined`
   - ✅ В консоли: `🔄 Перезагрузка всех событий с сервера...`
   - ✅ В консоли: `✅ Перезагружено XXX событий с сервера`
   - ✅ События отображаются в календаре

## 📦 Изменённые файлы

- ✅ `/components/scheduler/SchedulerMain.tsx` - исправлена логика перезагрузки
- ✅ `/READY_v2.3.3.md` - добавлен пункт в чеклист
- ✅ `/FIX_LOAD_EVENTS_v2.3.3.md` - этот файл (документация исправления)

## 🎉 Статус

✅ **ИСПРАВЛЕНО** - генерация событий работает без ошибок

---

**Версия**: 2.3.3 (исправлено)  
**Дата**: 2025-10-21  
**Тип**: Bugfix
