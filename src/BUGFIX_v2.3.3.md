# 🐛 Bugfix v2.3.3 - loadEvents is not defined

## Проблема
```
❌ Ошибка генерации тестовых событий: ReferenceError: loadEvents is not defined
```

## Решение
Заменил несуществующую функцию `loadEvents()` на прямой вызов API:

```typescript
// ❌ Было
await loadEvents();

// ✅ Стало
const { eventsApi } = await import('../../services/api');
const freshEvents = await eventsApi.getAll(accessToken || undefined, workspace.id);
setEvents(freshEvents);
```

## Проверка
1. Генерация событий → "Генерировать события"
2. Дождитесь завершения
3. ✅ Нет ошибки `loadEvents is not defined`
4. ✅ События корректно загружены с сервера

## Файлы
- ✅ `/components/scheduler/SchedulerMain.tsx` - исправлено
- ✅ `/FIX_LOAD_EVENTS_v2.3.3.md` - полная документация
- ✅ `/CHANGELOG.md` - обновлён

---

**Статус**: ✅ ИСПРАВЛЕНО  
**Версия**: 2.3.3
