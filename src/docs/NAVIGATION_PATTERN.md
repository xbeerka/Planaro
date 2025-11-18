# Паттерн навигации с флагом isProgrammaticNavigation

## Проблема

При реализации URL роутинга через History API возникла проблема "двойной загрузки":

1. Пользователь кликает на воркспейс
2. `handleSelectWorkspace()` вызывает `setSelectedWorkspace()` и `setCurrentPath()`
3. Изменение `currentPath` триггерит useEffect восстановления
4. useEffect пытается загрузить воркспейс **снова** из API
5. Из-за асинхронности React батчинга проверка `selectedWorkspace.id === workspaceId` может не сработать
6. Воркспейс загружается дважды или появляется ошибка "Воркспейс не найден"

## Решение: флаг isProgrammaticNavigation

Используем `useRef` флаг для разделения двух типов навигации:

### Программная навигация (через UI)
```typescript
const handleSelectWorkspace = async (workspace: Workspace) => {
  setSelectedWorkspace(workspace);
  
  // ✅ Помечаем как программную навигацию
  isProgrammaticNavigation.current = true;
  
  window.history.pushState({ workspaceId: workspace.id }, '', `/workspace/${workspace.id}`);
  setCurrentPath(`/workspace/${workspace.id}`);
};
```

### Навигация браузером (back/forward/прямая ссылка)
```typescript
useEffect(() => {
  // ✅ Проверяем флаг
  if (isProgrammaticNavigation.current) {
    console.log('🔄 Программная навигация, пропуск восстановления');
    isProgrammaticNavigation.current = false; // Сбрасываем флаг
    return;
  }
  
  // Только здесь выполняем загрузку воркспейса из API
  const match = window.location.pathname.match(/^\/workspace\/([^\/]+)$/);
  if (match) {
    loadWorkspaceFromAPI(match[1]);
  }
}, [currentPath]);
```

## Поток данных

### Сценарий 1: Клик по воркспейсу (UI)
```
1. handleSelectWorkspace() вызван
2. isProgrammaticNavigation.current = true ✅
3. setSelectedWorkspace(workspace) - воркспейс установлен
4. window.history.pushState() - URL обновлен
5. setCurrentPath() - состояние обновлено
6. useEffect сработал
7. Проверка: isProgrammaticNavigation.current === true ✅
8. Сброс флага: isProgrammaticNavigation.current = false
9. return - выход без загрузки ✅
```

### Сценарий 2: Кнопка "Назад" в браузере
```
1. Пользователь нажал "Назад"
2. window.popstate событие
3. setCurrentPath('/') в обработчике popstate
4. useEffect сработал
5. Проверка: isProgrammaticNavigation.current === false ✅
6. Выполняется восстановление - сброс selectedWorkspace ✅
```

### Сценарий 3: Прямая ссылка /workspace/123
```
1. Пользователь открыл /workspace/123
2. App монтируется, currentPath = '/workspace/123'
3. useEffect сработал
4. Проверка: isProgrammaticNavigation.current === false ✅
5. Загрузка воркспейса из API ✅
6. setSelectedWorkspace(workspace) - воркспейс установлен ✅
```

## Почему useRef, а не useState?

- `useState` вызывал бы ре-рендер при изменении флага
- `useRef` меняется синхронно, без ре-рендера
- `useRef.current` доступен сразу в том же тике event loop
- Идеально для координации между разными useEffect и handlers

## Применение паттерна

Всегда используй этот паттерн когда:
1. Есть программная навигация (через setState + history.pushState)
2. Есть useEffect который реагирует на изменение URL/path
3. Нужно избежать "двойной обработки" одного и того же события

```typescript
// ❌ БЕЗ флага - двойная загрузка
const handleSelect = (item) => {
  setSelectedItem(item);
  setPath(`/item/${item.id}`);
  // useEffect загрузит item снова из API - ПРОБЛЕМА!
};

// ✅ С флагом - одна загрузка
const handleSelect = (item) => {
  setSelectedItem(item);
  isProgrammaticNav.current = true; // Помечаем
  setPath(`/item/${item.id}`);
  // useEffect пропустит загрузку - ОК!
};
```

## Отладка

Логи помогут понять что происходит:

```typescript
if (isProgrammaticNavigation.current) {
  console.log('🔄 Программная навигация, пропуск восстановления');
  isProgrammaticNavigation.current = false;
  return;
}

console.log('🔗 Восстановление из URL:', path);
```

Ожидаемые логи при клике по воркспейсу:
```
📂 Выбран воркспейс: Test Workspace
🔄 Программная навигация, пропуск восстановления
```

Ожидаемые логи при кнопке "Назад":
```
🔙 Навигация назад/вперед, новый путь: /
🔙 URL на главной, сброс выбранного воркспейса
```

## Альтернативы (не рекомендуется)

### Вариант 1: Убрать currentPath из зависимостей
❌ Не работает - useEffect не будет реагировать на изменения URL

### Вариант 2: Добавить selectedWorkspace в зависимости
❌ Создаст бесконечный цикл или лишние ре-рендеры

### Вариант 3: setTimeout для отложенной проверки
❌ Хак, не надежно, race conditions

## Вывод

Флаг `isProgrammaticNavigation` - это чистое, надежное решение для координации между программной навигацией и восстановлением состояния из URL. Используй его всегда когда есть риск "двойной обработки".
