# Event Neighbors v8.0 - Documentation Index

## 📚 Навигация по документации

### 🚀 Быстрый старт

| Документ | Описание | Время чтения |
|----------|----------|--------------|
| [`README_v8.0.md`](README_v8.0.md) | **START HERE!** Обзор и TL;DR | 5 мин |
| [`CHEATSHEET_v8.0.md`](CHEATSHEET_v8.0.md) | Quick Reference для разработчиков | 3 мин |
| [`EVENT_NEIGHBORS_v8.0_SUMMARY.md`](EVENT_NEIGHBORS_v8.0_SUMMARY.md) | Краткая сводка изменений | 5 мин |

### 📖 Полная документация

| Документ | Описание | Время чтения |
|----------|----------|--------------|
| [`EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md`](EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md) | **Полное описание архитектуры** (все 5 этапов, правила, примеры) | 20 мин |
| [`QUICK_TEST_NEIGHBORS_v8.0.md`](QUICK_TEST_NEIGHBORS_v8.0.md) | Шпаргалка для тестирования (как проверить каждый кейс) | 10 мин |
| [`TEST_CASES_v8.0.md`](TEST_CASES_v8.0.md) | Набор тестовых кейсов (5 основных тестов с ожиданиями) | 15 мин |

### 🔄 Миграция

| Документ | Описание | Время чтения |
|----------|----------|--------------|
| [`MIGRATION_GUIDE_v7_to_v8.md`](MIGRATION_GUIDE_v7_to_v8.md) | **Гайд по миграции** с v7.0 на v8.0 | 15 мин |

### 📝 История изменений

| Документ | Описание | Время чтения |
|----------|----------|--------------|
| [`CHANGELOG.md`](CHANGELOG.md) | История изменений (версия 8.0.0) | 5 мин |
| [`guidelines/Guidelines.md`](guidelines/Guidelines.md) | Обновленные guidelines проекта (v4.0.5) | 30 мин |

---

## 🎯 Что читать в зависимости от задачи

### Я новичок, хочу понять что это
1. **Начните с** [`README_v8.0.md`](README_v8.0.md) - обзор и TL;DR
2. **Посмотрите** [`CHEATSHEET_v8.0.md`](CHEATSHEET_v8.0.md) - основные правила
3. **Если интересно** [`EVENT_NEIGHBORS_v8.0_SUMMARY.md`](EVENT_NEIGHBORS_v8.0_SUMMARY.md) - что было сделано

### Я хочу использовать алгоритм
1. **Прочитайте** [`README_v8.0.md`](README_v8.0.md) - как использовать
2. **Включите DEBUG** в `/utils/eventNeighbors.ts:6`
3. **Запустите тесты** из [`QUICK_TEST_NEIGHBORS_v8.0.md`](QUICK_TEST_NEIGHBORS_v8.0.md)

### Я хочу понять архитектуру
1. **Полное описание** [`EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md`](EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md)
2. **Примеры** [`TEST_CASES_v8.0.md`](TEST_CASES_v8.0.md)
3. **Quick Reference** [`CHEATSHEET_v8.0.md`](CHEATSHEET_v8.0.md)

### Я хочу добавить новое правило
1. **Прочитайте** [`CHEATSHEET_v8.0.md`](CHEATSHEET_v8.0.md) - раздел "Добавление нового правила"
2. **Изучите** [`EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md`](EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md) - STAGE 3
3. **Тестируйте** по [`QUICK_TEST_NEIGHBORS_v8.0.md`](QUICK_TEST_NEIGHBORS_v8.0.md)

### Я мигрирую с v7.0
1. **Гайд по миграции** [`MIGRATION_GUIDE_v7_to_v8.md`](MIGRATION_GUIDE_v7_to_v8.md)
2. **Тест-кейсы** [`TEST_CASES_v8.0.md`](TEST_CASES_v8.0.md)
3. **Проблемы** [`QUICK_TEST_NEIGHBORS_v8.0.md`](QUICK_TEST_NEIGHBORS_v8.0.md) - раздел "Отладка"

### Я нашел баг
1. **Отладка** [`QUICK_TEST_NEIGHBORS_v8.0.md`](QUICK_TEST_NEIGHBORS_v8.0.md) - раздел "Отладка по этапам"
2. **Чек-лист** [`CHEATSHEET_v8.0.md`](CHEATSHEET_v8.0.md) - раздел "Отладка"
3. **Создайте issue** с логами и сценарием воспроизведения

### Я хочу протестировать
1. **Тест-кейсы** [`TEST_CASES_v8.0.md`](TEST_CASES_v8.0.md)
2. **Шпаргалка** [`QUICK_TEST_NEIGHBORS_v8.0.md`](QUICK_TEST_NEIGHBORS_v8.0.md)
3. **Чек-лист** [`CHEATSHEET_v8.0.md`](CHEATSHEET_v8.0.md)

---

## 🏗️ Структура документации

```
/
├─ README_v8.0.md ⭐
│   └─ Обзор и TL;DR (START HERE!)
│
├─ EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md ⭐⭐⭐
│   └─ Полное описание архитектуры (все 5 этапов)
│
├─ CHEATSHEET_v8.0.md ⭐
│   └─ Quick Reference для разработчиков
│
├─ QUICK_TEST_NEIGHBORS_v8.0.md ⭐⭐
│   └─ Шпаргалка для тестирования
│
├─ TEST_CASES_v8.0.md ⭐⭐
│   └─ Набор тестовых кейсов
│
├─ MIGRATION_GUIDE_v7_to_v8.md ⭐⭐
│   └─ Гайд по миграции с v7.0
│
├─ EVENT_NEIGHBORS_v8.0_SUMMARY.md ⭐
│   └─ Краткая сводка изменений
│
├─ EVENT_NEIGHBORS_v8.0_INDEX.md
│   └─ Этот файл (навигация)
│
├─ CHANGELOG.md
│   └─ История изменений (v8.0.0)
│
└─ guidelines/Guidelines.md
    └─ Guidelines проекта (v4.0.5)
```

**Легенда:**
- ⭐ - Обязательно к прочтению
- ⭐⭐ - Важно для понимания
- ⭐⭐⭐ - Полная документация

---

## 📊 Типы документов

### Tutorial (Обучение)
- [`README_v8.0.md`](README_v8.0.md) - Обзор
- [`EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md`](EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md) - Полное описание

### How-to (Инструкции)
- [`QUICK_TEST_NEIGHBORS_v8.0.md`](QUICK_TEST_NEIGHBORS_v8.0.md) - Как тестировать
- [`MIGRATION_GUIDE_v7_to_v8.md`](MIGRATION_GUIDE_v7_to_v8.md) - Как мигрировать
- [`CHEATSHEET_v8.0.md`](CHEATSHEET_v8.0.md) - Как добавить правило

### Reference (Справочники)
- [`CHEATSHEET_v8.0.md`](CHEATSHEET_v8.0.md) - Quick Reference
- [`TEST_CASES_v8.0.md`](TEST_CASES_v8.0.md) - Тест-кейсы

### Explanation (Объяснения)
- [`EVENT_NEIGHBORS_v8.0_SUMMARY.md`](EVENT_NEIGHBORS_v8.0_SUMMARY.md) - Что было сделано
- [`CHANGELOG.md`](CHANGELOG.md) - История изменений

---

## 🎯 Рекомендуемый порядок изучения

### Уровень 1: Базовое понимание (15 мин)
1. [`README_v8.0.md`](README_v8.0.md) - 5 мин
2. [`CHEATSHEET_v8.0.md`](CHEATSHEET_v8.0.md) - 3 мин
3. [`EVENT_NEIGHBORS_v8.0_SUMMARY.md`](EVENT_NEIGHBORS_v8.0_SUMMARY.md) - 5 мин

### Уровень 2: Практическое использование (30 мин)
1. [`QUICK_TEST_NEIGHBORS_v8.0.md`](QUICK_TEST_NEIGHBORS_v8.0.md) - 10 мин
2. [`TEST_CASES_v8.0.md`](TEST_CASES_v8.0.md) - 15 мин
3. Практика: запустить тесты в браузере - 5 мин

### Уровень 3: Глубокое понимание (45 мин)
1. [`EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md`](EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md) - 20 мин
2. Изучение кода `/utils/eventNeighbors.ts` - 15 мин
3. [`MIGRATION_GUIDE_v7_to_v8.md`](MIGRATION_GUIDE_v7_to_v8.md) - 10 мин

### Уровень 4: Экспертиза (60+ мин)
1. Все предыдущие уровни
2. [`CHANGELOG.md`](CHANGELOG.md) - 5 мин
3. [`guidelines/Guidelines.md`](guidelines/Guidelines.md) - 30 мин
4. Практика: добавить новое правило - 30+ мин

---

## 🔗 Внешние ссылки

### Код
- Основной алгоритм: `/utils/eventNeighbors.ts`
- Использование: `/components/scheduler/SchedulerGrid.tsx`
- Типы: `/types/scheduler.ts`

### Связанные концепции
- Drag & Drop: `/hooks/useEventInteractions.ts`
- Gap Handles: `/hooks/useGapInteractions.ts`
- Undo/Redo: `/hooks/useHistory.ts`

### Проект
- Guidelines: `/guidelines/Guidelines.md`
- Changelog: `/CHANGELOG.md`

---

## 📞 Поддержка

### Нашли ошибку в документации?
Создайте issue или PR с исправлением.

### Хотите добавить примеры?
Добавьте в [`TEST_CASES_v8.0.md`](TEST_CASES_v8.0.md)

### Хотите улучшить объяснение?
Отредактируйте [`EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md`](EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md)

---

## ✅ Checklist для документации

### Перед релизом
- [x] README создан
- [x] Полная архитектура описана
- [x] Тест-кейсы подготовлены
- [x] Миграционный гайд написан
- [x] Cheatsheet создан
- [x] Summary написан
- [x] Index создан
- [x] CHANGELOG обновлен
- [x] Guidelines обновлен

### После релиза
- [ ] Feedback от пользователей
- [ ] Дополнительные примеры
- [ ] FAQ секция
- [ ] Видео-туториалы (опционально)

---

## 🎉 Заключение

**Event Neighbors v8.0** - это полная переписка алгоритма на чистую архитектуру.

### Ключевые документы
1. **START HERE:** [`README_v8.0.md`](README_v8.0.md)
2. **Full Description:** [`EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md`](EVENT_NEIGHBORS_v8.0_CLEAN_ARCHITECTURE.md)
3. **Quick Reference:** [`CHEATSHEET_v8.0.md`](CHEATSHEET_v8.0.md)

### Готовы начать?
```bash
# 1. Включите DEBUG
# /utils/eventNeighbors.ts:6 → const DEBUG = true;

# 2. Откройте приложение
# http://localhost:3000

# 3. Откройте консоль
# F12

# 4. Создайте события
# Проверьте логи!
```

**Удачи в изучении! 🚀**

---

**Версия**: 8.0  
**Дата**: 2025-11-29  
**Тип**: Documentation Index  
**Статус**: Complete
