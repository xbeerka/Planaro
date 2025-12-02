# Quick Test - Redesign v2 (Existing Components Updated)

## 🎯 What Changed

Обновлены **существующие** компоненты календаря (SchedulerGrid):
- Header (top-left cell)
- Department headers
- Resource cards (user rows)
- Cell heights и borders

## ✅ Visual Checklist (2 минуты)

### 1. Header (Top-Left Corner)
- [ ] **Белый фон** (было серый #f3f3f3)
- [ ] **Высота 72px**
- [ ] **Кнопка "Назад"**: черная стрелка влево (SVG)
- [ ] **Workspace название**: черный, 14px, semibold
- [ ] **Chevron down** рядом с названием
- [ ] **Год workspace**: серый (#868789), 12px, под названием
- [ ] **Border radius** top-left: 16px
- [ ] **Нет dropdown профиля** (удалено из header)

### 2. Department Headers
- [ ] **Белый фон** (было синий #f0f5fa)
- [ ] **Высота 44px** (fixed, не variable)
- [ ] **UPPERCASE** текст (было normal case)
- [ ] **Серый цвет** (#868789, было темно-синий)
- [ ] **Шрифт Onest**, medium, 12px
- [ ] **Borders**: светло-серые (#f0f0f0)
- [ ] **Sticky** при скролле (top: 72px)

### 3. Resource Cards (User Rows)
- [ ] **Высота 144px** (fixed, не variable)
- [ ] **Avatar**: 36px × 36px
- [ ] **Avatar shape**: **rounded square** (12px radius, НЕ circle!)
- [ ] **Avatar fallback**: серый фон (#f6f6f6) с инициалами
- [ ] **Name**: черный, 14px, medium, truncate
- [ ] **Position**: серый (#868789), 12px, regular, truncate
- [ ] **Gap между avatar и text**: 12px
- [ ] **Gap между name и position**: 4px
- [ ] **НЕТ company/grade badges** (удалены из дизайна)
- [ ] **Borders**: светло-серые (#f0f0f0), НЕ черные!

### 4. Calendar Cells
- [ ] **Высота 144px** (все ячейки одинаковые)
- [ ] **Border последнего в департаменте**: светло-серый (НЕ черный 2px!)
- [ ] **Events рендерятся** правильно

### 5. Typography (Onest Font)
- [ ] **Шрифт Onest** применяется везде (fallback: sans-serif)
- [ ] **Font weights**: medium (500), semibold (600), regular (400)
- [ ] **Font sizes**: 12px, 14px

---

## 🔍 Detailed Check

### Header Section:
```
┌─────────────────────────────┐
│ [←] Planaro [v]             │ ← 72px height
│     2024                    │
└─────────────────────────────┘
```

**Check:**
1. Click кнопку "Назад" → возврат к списку workspaces
2. Название workspace отображается полностью (truncate если длинное)
3. Год workspace серый, под названием

---

### Department Headers:
```
┌─────────────────────────────┐
│ BACKEND TEAM                │ ← 44px height, UPPERCASE, gray
├─────────────────────────────┤
│ [Avatar] Name               │
│          Position           │ ← 144px height
├─────────────────────────────┤
```

**Check:**
1. Department name UPPERCASE (было normal case)
2. Серый цвет #868789 (было темно-синий)
3. Sticky при вертикальном скролле

---

### Resource Cards:
```
┌─────────────────────────────┐
│  ┌──┐  Шпак Александр       │
│  │  │  Александрович         │ ← 144px height
│  └──┘  Senior Python-раз... │
│                              │
└─────────────────────────────┘
  ^36px  ^12px gap
  rounded
```

**Check:**
1. Avatar **rounded square**, НЕ circle! (border-radius: 12px)
2. Если нет аватарки → серый фон с инициалами
3. Name черный, position серый
4. НЕТ badges (company/grade удалены)
5. Truncate длинных имен и позиций

---

## ❌ What Should NOT Be There

1. ❌ **Company badge** (purple, было в старом дизайне)
2. ❌ **Grade badge** (blue, было в старом дизайне)
3. ❌ **Черные жирные borders** (2px solid #000)
4. ❌ **Profile dropdown в header** (перенесен в Toolbar)
5. ❌ **Circle avatars** (теперь rounded square!)

---

## 🐛 Known Issues (Ignore)

1. **Toolbar controls** (weekPx, eventRowH) не влияют на левую колонку (fixed heights)
2. **Project badges** пока не показываются (закомментировано)
3. **Dropdown workspace switcher** не кликабельный (future)

---

## 🎯 Success Criteria

✅ **PASS** if:
- Все элементы соответствуют новому дизайну
- Onest font загружается
- Heights фиксированные (144px для resource rows)
- Borders светло-серые, НЕ черные
- Avatar rounded square, НЕ circle
- Department headers UPPERCASE

❌ **FAIL** if:
- Старый дизайн (синий фон departments, круглые avatars)
- Черные жирные borders остались
- Heights variable (меняются через Toolbar)
- Company/grade badges все еще видны
- Font НЕ Onest (или не загрузился)

---

## 📸 Compare with Figma

Откройте Figma дизайн и сравните:
1. Colors (white bg, gray borders)
2. Typography (Onest font, sizes, weights)
3. Spacing (gaps, paddings)
4. Avatar shape (rounded square!)
5. Department headers (UPPERCASE, gray)

---

## 💡 Quick Fixes

### If Onest font не загрузился:
1. Проверь Network tab → Google Fonts request
2. Проверь `@import` в `/styles/globals.css`
3. Fallback: sans-serif (будет работать, но не идеально)

### If heights не 144px:
1. Проверь что `height: '144px'` (string, не number!)
2. Проверь что НЕ используется `config.eventRowH`

### If avatars круглые (circle):
1. Проверь `border-radius: '12px'` (НЕ `borderRadius: '50%'`)

---

**Estimated Time**: ~2 minutes  
**Status**: Ready to test 🎉  
**Version**: 2.0.0
