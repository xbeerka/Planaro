# Design Update v2 - Figma Redesign Applied

## 🎯 Задача

Обновить дизайн **существующих** компонентов календаря (не создавать новые!) в соответствии с новым макетом из Figma.

## ✅ Что изменено

### 1. **Header (Top-Left Cell)** - `SchedulerGrid.tsx`

**Было:**
- Серый фон `#f3f3f3`
- Высота 72px
- Простая кнопка "Назад" через `<ArrowLeft>` от lucide-react
- Dropdown меню профиля справа (удалено)

**Стало:**
- Белый фон `#fff`
- Высота 72px (не изменилась)
- Обновленная кнопка "Назад" с SVG стрелкой (rotate 180 + scale flip)
- Workspace название + dropdown индикатор (SVG chevron down)
- Год workspace под названием (`#868789` серый)
- Padding: `17px 5px 16px 5px`
- Border: `1px solid #f0f0f0`
- Border-radius top-left: `16px`

**Типография:**
- Font: `'Onest', sans-serif`
- Название: 14px, semibold, black
- Год: 12px, regular, `#868789`

---

### 2. **Department Headers** - `SchedulerGrid.tsx`

**Было:**
- Синий фон `#f0f5fa`
- Высота `config.rowH` (variable)
- Font-weight: 800, font-size: 14px
- Color: `#2c3e50`
- Border-bottom: `1px solid #e6eef8`
- Padding: `0 16px`

**Стало:**
- Белый фон `#fff`
- **Фиксированная** высота: `44px`
- Font: `'Onest', sans-serif`
- Font-weight: medium (500), font-size: 12px
- Color: `#868789` (серый)
- **UPPERCASE** текст
- Border-right: `1px solid #f0f0f0`
- Border-bottom: `1px solid #f0f0f0`
- Padding: `0 8px` (outer), `0 17px` (inner)
- Sticky top: `72px` (вместо `config.rowH * 2`)

---

### 3. **Resource Cards (User Rows)** - `SchedulerGrid.tsx`

**Было:**
- Высота: `config.eventRowH` (variable, usually 48-144px)
- Простой layout: avatar (32px round) + name + position
- Badges для company и grade (blue/purple)
- Border-bottom: `2px solid #000` для последнего в департаменте
- Padding: `0 16px`

**Стало:**
- **Фиксированная** высота: `144px`
- Новая структура:
  - **ProfileBox** wrapper с flex column
  - **Avatar**: 36px × 36px, `border-radius: 12px` (rounded square, не circle!)
  - Fallback avatar: серый фон `#f6f6f6` с инициалами
  - **Name**: 14px, font-medium, black, `line-height: 20px`
  - **Position**: 12px, regular, `#868789`, `line-height: 16px`
  - Gap между avatar и text: `12px`
  - Gap между name и position: `4px`
  - Padding: `0 8px` (outer), `17px 16px` (inner)
- Border-bottom:
  - Последний в департаменте: `1px solid #f0f0f0`
  - Остальные: внутренний border через псевдо-элемент
- Border-right: `1px solid #f0f0f0`
- **НЕТ badges** для grade/company (убрано из дизайна)
- **Placeholder для project badges** (закомментирован, будет добавлен позже)

**Типография:**
- Font: `'Onest', sans-serif`
- Name: 14px, medium, black
- Position: 12px, regular, `#868789`

---

### 4. **Calendar Cells** - `SchedulerGrid.tsx`

**Было:**
- Высота: `config.eventRowH` (variable)
- Border-bottom последнего в департаменте: `2px solid #000`

**Стало:**
- **Фиксированная** высота: `144px`
- Border-bottom последнего: `1px solid #f0f0f0` (не черный!)
- Остальные borders: `0.5px solid #dfe7ee`

---

## 🎨 Design Tokens (из Figma)

### Colors:
```css
--background-white: #ffffff
--border-light: #f0f0f0
--border-lighter: #dfe7ee
--text-black: #000000
--text-gray: #868789
--avatar-fallback-bg: #f6f6f6
```

### Typography (Onest):
```css
--font-family: 'Onest', sans-serif
--font-size-12: 12px
--font-size-14: 14px
--font-weight-regular: 400
--font-weight-medium: 500
--font-weight-semibold: 600
```

### Spacing:
```css
--header-height: 72px
--department-height: 44px
--resource-height: 144px
--avatar-size: 36px
--border-radius-avatar: 12px
--border-radius-header: 16px
--gap-avatar-text: 12px
--gap-name-position: 4px
```

---

## 📦 Файлы изменены

### Modified:
- `/components/scheduler/SchedulerGrid.tsx` (3 секции):
  1. Top-left header (lines ~385-433)
  2. Department headers (lines ~167-190)
  3. Resource cards (lines ~224-316)
  4. Calendar cells height (lines ~319-330)

### Added:
- `/imports/svg-6tttvsqq3d.ts` - SVG paths for icons
- `/styles/globals.css` - Import Onest font from Google Fonts

---

## 🔍 Key Design Changes

### 1. **Фиксированные высоты** (вместо variable):
- Header: 72px
- Department: 44px
- Resource row: 144px

**Важно:** Это означает что настройки `weekPx` и `eventRowH` из Toolbar больше НЕ влияют на высоту левой колонки! Нужно будет синхронизировать либо вернуть variable heights.

### 2. **Borders**:
- Все borders теперь `1px solid #f0f0f0` (light gray)
- Убраны жирные черные borders (`2px solid #000`)

### 3. **Avatar**:
- Изменен с circle (`border-radius: 50%`) на rounded square (`border-radius: 12px`)
- Увеличен размер: 32px → 36px

### 4. **Typography**:
- Весь текст теперь через Onest font
- Department headers теперь UPPERCASE
- Более тонкие font-weights (medium вместо bold)

### 5. **Упрощение**:
- Убраны badges для company/grade (были в старом дизайне)
- Убран dropdown профиля из header (перенесен в Toolbar)

---

## 🐛 Known Issues

### 1. **Высота rows не синхронизирована**:
- Левая колонка (sidebar): фиксированная 144px
- Календарные ячейки: фиксированная 144px
- **НО:** Toolbar все еще позволяет менять `eventRowH`!

**Решение:**
- Либо убрать контролы высоты из Toolbar
- Либо вернуть variable heights в sidebar

### 2. **Onest font может не загрузиться**:
- Используется Google Fonts CDN
- Fallback на sans-serif

**Решение:**
- Добавить local font files
- Или убедиться что CDN доступен

### 3. **Project badges закомментированы**:
- В новом дизайне есть цветные badges проектов
- Сейчас они закомментированы (нужно подключить events data)

**Решение:**
- Раскомментировать код
- Добавить логику получения проектов из events

### 4. **Dropdown workspace switcher не работает**:
- В header есть chevron down, но он не кликабельный
- Нужно добавить функционал смены workspace

---

## ✅ Testing Checklist

- [ ] Header показывает workspace name + год
- [ ] Кнопка "Назад" работает
- [ ] Department headers uppercase, серые, sticky
- [ ] Resource cards: avatar 36px, rounded square
- [ ] Resource cards: name + position, правильные цвета
- [ ] Высота всех rows: 144px
- [ ] Borders светло-серые (#f0f0f0)
- [ ] Onest font загружается и применяется
- [ ] Нет company/grade badges (удалены)
- [ ] Layout не сломан, календарь работает

---

## 🚀 Next Steps

### High Priority:
1. Синхронизировать высоты (убрать controls или вернуть variable)
2. Добавить project badges из events data
3. Протестировать на разных разрешениях

### Medium Priority:
4. Добавить workspace dropdown switcher
5. Добавить поиск пользователей (из первого дизайна)
6. Улучшить loading states

### Low Priority:
7. Локальные шрифты вместо CDN
8. Анимации transitions
9. Hover states для карточек

---

**Status**: ✅ Ready for testing  
**Version**: 2.0.0  
**Last Updated**: 2024-12-02
