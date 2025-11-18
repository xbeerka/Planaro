# 📖 Шпаргалка разработчика - Polling System v1.9.4

## 🎯 Быстрая справка

### Интервалы polling

| Сущность | Интервал | Ref |
|----------|----------|-----|
| События | 10 сек | `lastLocalChangeRef` |
| Сотрудники | 15 сек | `lastResourcesChangeRef` |
| Департаменты | 15 сек | `lastDepartmentsChangeRef` |
| Проекты | 15 сек | `lastProjectsChangeRef` |

### Файл

Вся логика в: `/contexts/SchedulerContext.tsx`

---

## 🔧 Как добавить polling для новой сущности

### Шаг 1: Создать ref

```typescript
const lastMyEntityChangeRef = useRef<number>(0);
```

### Шаг 2: Создать useEffect

```typescript
useEffect(() => {
  if (!accessToken || !workspaceId || isLoadingMyEntity) return;

  console.log('🔄 Запуск автообновления моей сущности (polling каждые 15 секунд)');

  const pollMyEntity = async () => {
    try {
      // Защита от дублирования
      const timeSinceLastChange = Date.now() - lastMyEntityChangeRef.current;
      if (timeSinceLastChange < 2000) {
        console.log('⏭️ Пропуск polling - недавно было локальное изменение');
        return;
      }

      console.log('🔄 Polling: проверка обновлений...');
      const data = await myEntityApi.getAll(accessToken, workspaceId);
      
      // Обновление только при изменениях
      setMyEntity(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(data)) {
          console.log('✅ Обнаружены изменения, обновление UI');
          setStorageJSON(`cache_my_entity_${workspaceId}`, data);
          return data;
        }
        return prev;
      });
    } catch (error) {
      console.error('❌ Ошибка polling:', error);
    }
  };

  const timeoutId = setTimeout(pollMyEntity, 15000);
  const intervalId = setInterval(pollMyEntity, 15000);

  return () => {
    clearTimeout(timeoutId);
    clearInterval(intervalId);
    console.log('🔌 Автообновление остановлено');
  };
}, [accessToken, workspaceId, isLoadingMyEntity]);
```

### Шаг 3: Обновить CRUD операции

```typescript
const createMyEntity = useCallback(async (data) => {
  const created = await myEntityApi.create(data, accessToken);
  
  setMyEntity(prev => {
    const newData = [...prev, created];
    setStorageJSON(`cache_my_entity_${workspaceId}`, newData);
    return newData;
  });
  
  // ⚠️ ВАЖНО: Отметить локальное изменение
  lastMyEntityChangeRef.current = Date.now();
  
  console.log('✅ Сущность создана:', created.id);
}, [accessToken, workspaceId]);

const updateMyEntity = useCallback(async (id, data) => {
  const updated = await myEntityApi.update(id, data, accessToken);
  
  setMyEntity(prev => {
    const newData = prev.map(e => e.id === id ? updated : e);
    setStorageJSON(`cache_my_entity_${workspaceId}`, newData);
    return newData;
  });
  
  // ⚠️ ВАЖНО: Отметить локальное изменение
  lastMyEntityChangeRef.current = Date.now();
  
  console.log('✅ Сущность обновлена:', id);
}, [accessToken, workspaceId]);

const deleteMyEntity = useCallback(async (id) => {
  await myEntityApi.delete(id, accessToken);
  
  setMyEntity(prev => {
    const newData = prev.filter(e => e.id !== id);
    setStorageJSON(`cache_my_entity_${workspaceId}`, newData);
    return newData;
  });
  
  // ⚠️ ВАЖНО: Отметить локальное изменение
  lastMyEntityChangeRef.current = Date.now();
  
  console.log('✅ Сущность удалена:', id);
}, [accessToken, workspaceId]);
```

---

## 🐛 Отладка

### Включить детальные логи

Уже включено! Смотрите консоль браузера:

```
🔄 Polling: проверка обновлений событий...
✅ События: обнаружены изменения, обновление UI
⏭️ Пропуск polling - недавно было локальное изменение
```

### Проверить что polling работает

1. Откройте DevTools → Console
2. Найдите логи `🔄 Polling:`
3. Должны появляться каждые 10-15 секунд

### Проверить защиту от дублирования

1. Создайте событие
2. В течение 2 секунд должен появиться лог: `⏭️ Пропуск polling`

### Проверить обновления

1. Откройте приложение в 2 браузерах
2. В браузере A создайте событие
3. В браузере B смотрите логи:
   ```
   🔄 Polling: проверка обновлений событий...
   ✅ События: обнаружены изменения, обновление UI
   ```

---

## ⚠️ Частые ошибки

### Ошибка: Polling вызывается слишком часто

**Причина:** Забыли установить `lastXXXChangeRef.current = Date.now()`

**Решение:** Добавьте в конец каждой CRUD операции:
```typescript
lastMyEntityChangeRef.current = Date.now();
```

### Ошибка: Polling не работает

**Причина 1:** Не проверили `isLoading` в зависимостях useEffect

**Решение:**
```typescript
useEffect(() => {
  if (!accessToken || !workspaceId || isLoadingMyEntity) return;
  // ...
}, [accessToken, workspaceId, isLoadingMyEntity]);
```

**Причина 2:** Забыли очистить таймеры

**Решение:**
```typescript
return () => {
  clearTimeout(timeoutId);
  clearInterval(intervalId);
};
```

### Ошибка: UI обновляется даже без изменений

**Причина:** Неправильное сравнение (не используется `JSON.stringify`)

**Решение:**
```typescript
setState(prev => {
  if (JSON.stringify(prev) !== JSON.stringify(data)) {
    return data; // ✅ Обновить
  }
  return prev; // ✅ Не обновлять
});
```

### Ошибка: Кэш не обновляется

**Причина:** `setStorageJSON` вызывается вне `setState`

**Решение:**
```typescript
setState(prev => {
  const newData = [...prev, created];
  
  // ✅ ВНУТРИ setState
  setStorageJSON(`cache_${workspaceId}`, newData);
  
  return newData;
});
```

---

## 📊 Мониторинг производительности

### Проверить нагрузку на сервер

**DevTools → Network → XHR**

За 1 минуту должно быть ~18 запросов:
- `/events` - 6 запросов
- `/resources` - 4 запроса
- `/departments` - 4 запроса
- `/projects` - 4 запроса

### Проверить использование памяти

**DevTools → Memory → Take heap snapshot**

Проверьте что нет утечек памяти:
- Интервалы должны очищаться при размонтировании компонента
- Нет бесконечного роста массивов

### Проверить ре-рендеры

**React DevTools → Profiler**

- Polling НЕ должен вызывать ре-рендеры если данные не изменились
- `JSON.stringify` сравнение предотвращает лишние обновления

---

## 🎯 Best Practices

### ✅ DO

```typescript
// Используйте функциональный setState
setState(prev => {
  const newData = transform(prev);
  return newData;
});

// Устанавливайте ref после каждого изменения
lastMyEntityChangeRef.current = Date.now();

// Логируйте важные события
console.log('✅ Сущность создана:', id);

// Сравнивайте через JSON.stringify
if (JSON.stringify(prev) !== JSON.stringify(data)) { ... }

// Очищайте таймеры
return () => {
  clearTimeout(timeoutId);
  clearInterval(intervalId);
};
```

### ❌ DON'T

```typescript
// НЕ используйте прямой setState
setState(newData); // ❌ Может быть stale

// НЕ забывайте обновлять ref
// lastMyEntityChangeRef.current = Date.now(); // ❌ Забыли!

// НЕ сравнивайте объекты напрямую
if (prev !== data) { ... } // ❌ Всегда true!

// НЕ делайте лишние запросы
// if (true) { pollMyEntity(); } // ❌ Без защиты от дублирования

// НЕ забывайте очищать таймеры
// return () => {}; // ❌ Утечка памяти!
```

---

## 📝 Примеры кода

### Минимальный polling (копипаста)

```typescript
// 1. Ref
const lastMyChangeRef = useRef<number>(0);

// 2. UseEffect
useEffect(() => {
  if (!accessToken || !workspaceId || isLoading) return;

  const poll = async () => {
    if (Date.now() - lastMyChangeRef.current < 2000) return;
    
    const data = await api.getAll(accessToken, workspaceId);
    
    setState(prev => {
      if (JSON.stringify(prev) !== JSON.stringify(data)) {
        setStorageJSON(`cache_${workspaceId}`, data);
        return data;
      }
      return prev;
    });
  };

  const t = setTimeout(poll, 15000);
  const i = setInterval(poll, 15000);
  return () => { clearTimeout(t); clearInterval(i); };
}, [accessToken, workspaceId, isLoading]);

// 3. CRUD
const create = useCallback(async (data) => {
  const created = await api.create(data, accessToken);
  setState(prev => [...prev, created]);
  lastMyChangeRef.current = Date.now(); // ⚠️ ВАЖНО
}, [accessToken]);
```

---

## 🚀 Расширенные возможности

### Кастомный интервал

```typescript
const POLL_INTERVAL = 20000; // 20 секунд

const t = setTimeout(poll, POLL_INTERVAL);
const i = setInterval(poll, POLL_INTERVAL);
```

### Динамический интервал

```typescript
const getInterval = () => {
  // Медленнее если пользователь неактивен
  const inactive = Date.now() - lastActivityRef.current > 60000;
  return inactive ? 30000 : 15000;
};
```

### Exponential backoff при ошибках

```typescript
const [errorCount, setErrorCount] = useState(0);

const poll = async () => {
  try {
    const data = await api.getAll();
    setErrorCount(0); // Сброс при успехе
  } catch (error) {
    setErrorCount(prev => prev + 1);
    
    // Увеличиваем интервал при ошибках
    const backoff = Math.min(60000, 15000 * Math.pow(2, errorCount));
    console.log(`⚠️ Ошибка, retry через ${backoff}ms`);
  }
};
```

### Batch polling (несколько сущностей одновременно)

```typescript
const pollAll = async () => {
  const [events, users, deps, projs] = await Promise.all([
    eventsApi.getAll(token, wsId),
    usersApi.getAll(token, wsId),
    depsApi.getAll(token, wsId),
    projsApi.getAll(token, wsId)
  ]);
  
  // Обновить все одновременно
  setEvents(events);
  setUsers(users);
  setDeps(deps);
  setProjs(projs);
};
```

---

## 📚 Связанная документация

- `/SIMPLE_POLLING_READY.md` - оригинальная документация
- `/SIMPLE_POLLING_EXTENDED_v1.9.4.md` - расширенная документация
- `/QUICK_TEST_v1.9.4.md` - руководство по тестированию
- `/DEPLOY_POLLING_v1.9.4.md` - инструкции по развертыванию

---

**Версия**: 1.9.4  
**Дата**: 2025-10-21  
**Для вопросов**: см. `/contexts/SchedulerContext.tsx` строки 83-555
