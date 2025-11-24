# Quick Test: Cannot Update While Rendering Fix v3.3.18

## Цель

Проверить что исправлен React warning "Cannot update a component while rendering a different component".

## Время тестирования

⏱️ **30 секунд**

## Тест 1: Базовая проверка - Выход из воркспейса

### Шаги

```
1. Открыть приложение (F5 для очистки)
2. Войти в любой воркспейс
3. Открыть консоль браузера (F12)
4. Нажать кнопку "← Управление рабочими пространствами"
```

### ✅ Ожидаемое поведение

**Визуально**:
- Плавный возврат к списку воркспейсов
- Данные очищены (календарь исчез)
- Нет визуальных артефактов

**Логи в консоли**:
```
🧹 чистка данных при выходе из воркспейса
```

**НЕТ warnings**:
```
❌ НЕ должно быть:
Warning: Cannot update a component (`SchedulerMain`) while rendering a different component (`SchedulerProvider`). 
To locate the bad setState() call inside `SchedulerProvider`...
```

### ❌ Проблемное поведение (до исправления)

```
⚠️ Warning: Cannot update a component (`SchedulerMain`) while rendering...
    at SchedulerProvider (contexts/SchedulerContext.tsx:95:36)
```

---

## Тест 2: Переключение между воркспейсами

### Шаги

```
1. Открыть воркспейс A
2. Дождаться загрузки данных (события видны)
3. Нажать "Назад"
4. Открыть воркспейс B
5. Проверить консоль
```

### ✅ Ожидаемое поведение

**Визуально**:
- Данные воркспейса A исчезли
- Данные воркспейса B загрузились
- Плавный переход

**Логи**:
```
🧹 чистка данных при выходе из воркспейса
📦 Загрузка данных воркспейса B...
✅ События загружены: X событий
```

**НЕТ warnings** в консоли

---

## Тест 3: Быстрое переключение (Stress Test)

### Шаги

```
1. Открыть воркспейс
2. Сразу нажать "Назад" (не дожидаясь загрузки)
3. Проверить консоль
```

### ✅ Ожидаемое поведение

**Визуально**:
- Возврат к списку воркспейсов
- Нет ошибок, нет артефактов

**Логи**:
```
🧹 чистка данных при выходе из воркспейса
```

**НЕТ warnings** в консоли

---

## Тест 4: React StrictMode (Optional - для разработчиков)

### Проверка StrictMode

```javascript
// В App.tsx убедитесь что React.StrictMode включён (если используется)
<React.StrictMode>
  <App />
</React.StrictMode>
```

### Шаги

```
1. Убедиться что StrictMode включён
2. Повторить Тест 1 (выход из воркспейса)
3. Проверить консоль
```

### ✅ Ожидаемое поведение

**В StrictMode** (development):
- ❌ НЕТ error: "Cannot update component during an existing state transition"
- ❌ НЕТ warning: "Cannot update a component while rendering"

**Примечание**: StrictMode может удваивать логи (это нормально), но НЕ должно быть warnings/errors.

---

## Автоматическая проверка (для CI/CD)

### Скрипт для проверки консольных ошибок

```javascript
// В браузерной консоли (для автоматизации тестов):

// Перехватываем console.warn
const originalWarn = console.warn;
const warnings = [];

console.warn = (...args) => {
  warnings.push(args.join(' '));
  originalWarn(...args);
};

// Выполнить Тест 1-3
// ...

// Проверить warnings
if (warnings.some(w => w.includes('Cannot update a component'))) {
  console.error('❌ ТЕСТ НЕ ПРОЙДЕН: Найдены React warnings');
  console.log('Warnings:', warnings);
} else {
  console.log('✅ ТЕСТ ПРОЙДЕН: Нет React warnings');
}

// Восстановить
console.warn = originalWarn;
```

---

## Критерии успеха

### ✅ Успех (тест пройден)

1. **Нет React warnings** в консоли:
   - ❌ "Cannot update a component while rendering"
   - ❌ "Cannot update component during an existing state transition"

2. **Функциональность работает**:
   - Выход из воркспейса работает
   - Переключение между воркспейсами работает
   - Данные очищаются корректно

3. **Производительность**:
   - Нет задержек (queueMicrotask ~0ms)
   - Плавные переходы

### ❌ Неудача (тест не пройден)

1. **React warnings** в консоли:
   ```
   Warning: Cannot update a component (`SchedulerMain`) while rendering...
   ```

2. **Ошибки**:
   - TypeError, ReferenceError и т.д.

3. **Функциональные проблемы**:
   - Данные не очищаются
   - Артефакты при переходах

---

## Дополнительная диагностика

### Если тест НЕ пройден

1. **Проверить версию файла**:
   ```javascript
   // В консоли:
   console.log('Файл обновлён?', /queueMicrotask/.test(
     // Проверить что queueMicrotask добавлен в SchedulerContext.tsx
   ));
   ```

2. **Проверить stack trace**:
   - Открыть DevTools → Console
   - Развернуть warning
   - Проверить stack trace
   - Найти где вызывается setState

3. **Проверить React версию**:
   ```javascript
   console.log('React version:', React.version);
   // Должна быть 18.x.x или выше
   ```

---

## Версия

v3.3.18 (2025-11-19)

## Связанные документы

- `/CANNOT_UPDATE_WHILE_RENDERING_FIX_v3.3.18.md` - подробное объяснение
- `/CHANGELOG.md` - changelog entry
- `/contexts/SchedulerContext.tsx:544-557` - исправленный код

## Заметки

- **queueMicrotask** - это современный Web API (поддерживается во всех браузерах 2020+)
- Задержка ~0ms (мгновенное выполнение после завершения рендера)
- Батching работает (5 setState объединяются в 1 ре-рендер)
- StrictMode может удваивать логи (это нормально для development режима)
