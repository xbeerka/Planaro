# ♿ Accessibility Quick Start Guide

**Time Required:** 40 minutes implementation + 30 minutes testing  
**Skill Level:** Intermediate React + TypeScript  
**Status:** Optional (recommended for WCAG 2.1 AA compliance)

---

## 🎯 What You'll Add

1. **Keyboard Navigation** - Tab, Enter, Arrow keys
2. **ARIA Labels** - Screen reader descriptions
3. **Focus Management** - Visual focus indicators (already styled)
4. **Live Regions** - Screen reader announcements

---

## 📋 Prerequisites

- ✅ v2.0 virtualization already deployed
- ✅ CSS classes already added (`/styles/globals.css`)
- ✅ State variables already added (`srAnnouncement`)
- ✅ `useCallback` already imported

---

## 🚀 Implementation (40 minutes)

### Step 1: Add Keyboard Handler (5 min)

**File:** `/components/scheduler/SchedulerGridUnified.tsx`  
**Location:** After line ~680 (after state declarations)

**Copy this code:**
```typescript
// Keyboard navigation handler
const handleRowKeyDown = useCallback((
  e: React.KeyboardEvent, 
  resourceId: string
) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    // Create event on first week/unit
    onCellClick(resourceId, 0, 0);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    // Focus next resource
    const currentIndex = visibleItems.findIndex(
      item => item.type === 'resource' && item.resource?.id === resourceId
    );
    const nextResource = visibleItems.find(
      (item, idx) => idx > currentIndex && item.type === 'resource'
    );
    if (nextResource?.resource) {
      const element = document.querySelector(
        `[data-resource-id="${nextResource.resource.id}"]`
      ) as HTMLElement;
      element?.focus();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    // Focus previous resource
    const currentIndex = visibleItems.findIndex(
      item => item.type === 'resource' && item.resource?.id === resourceId
    );
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (visibleItems[i].type === 'resource') {
        const element = document.querySelector(
          `[data-resource-id="${visibleItems[i].resource!.id}"]`
        ) as HTMLElement;
        element?.focus();
        break;
      }
    }
  }
}, [visibleItems, onCellClick]);
```

**Verify:** No TypeScript errors ✓

---

### Step 2: Update Screen Reader Announcement (5 min)

**File:** `/components/scheduler/SchedulerGridUnified.tsx`  
**Location:** After virtualization useMemo (line ~820)

**Copy this code:**
```typescript
// Update screen reader announcement when visible items change
useEffect(() => {
  const resourceCount = visibleItems.filter(item => item.type === 'resource').length;
  const totalResources = gridItems.filter(item => item.type === 'resource').length;
  
  setSrAnnouncement(
    `Showing ${resourceCount} of ${totalResources} resources. Scroll to see more.`
  );
}, [visibleItems.length, gridItems.length, visibleItems, gridItems]);
```

**Verify:** 
- Open DevTools Console
- Scroll calendar
- Check state updates in React DevTools ✓

---

### Step 3: Add ARIA Attributes (20 min)

**File:** `/components/scheduler/SchedulerGridUnified.tsx`  
**Location:** Resource row rendering (line ~1142-1189)

**Find this code:**
```typescript
<div
  className="cell resource-row event-row"
  style={{
    gridColumn: "3 / -1",
    gridRow: item.row,
    height: `${RESOURCE_ROW_HEIGHT}px`,
    backgroundColor: "#fff",
    cursor: "pointer",
    // ... rest of styles
  }}
  data-resource-id={item.resource!.id}
  onClick={(e) => {
    // ... click handler
  }}
  onContextMenu={(e) => {
    // ... context menu handler
  }}
  onMouseMove={(e) => {
    // ... mouse move handler
  }}
  onMouseLeave={onCellMouseLeave}
/>
```

**Replace with:**
```typescript
<div
  className="cell resource-row event-row"
  role="row"
  aria-label={`${item.resource!.displayName}, ${
    grades.find(g => g.id === item.resource!.gradeId)?.name || ''
  }, ${
    companies.find(c => c.id === item.resource!.companyId)?.name || ''
  }`}
  tabIndex={0}
  style={{
    gridColumn: "3 / -1",
    gridRow: item.row,
    height: `${RESOURCE_ROW_HEIGHT}px`,
    backgroundColor: "#fff",
    cursor: "pointer",
    // ... rest of styles
  }}
  data-resource-id={item.resource!.id}
  onClick={(e) => {
    // ... click handler
  }}
  onKeyDown={(e) => handleRowKeyDown(e, item.resource!.id)}
  onContextMenu={(e) => {
    // ... context menu handler
  }}
  onMouseMove={(e) => {
    // ... mouse move handler
  }}
  onMouseLeave={onCellMouseLeave}
/>
```

**Changes:**
1. Added `role="row"`
2. Added `aria-label` with resource info
3. Added `tabIndex={0}` for keyboard focus
4. Added `onKeyDown` handler

**Verify:**
- Press Tab key
- Focus outline appears on resource rows ✓
- Press Enter/Space creates event ✓

---

### Step 4: Add Screen Reader Live Region (10 min)

**File:** `/components/scheduler/SchedulerGridUnified.tsx`  
**Location:** Before closing `</div>` of main container (line ~1350)

**Find this code:**
```typescript
        {/* FAKE BOTTOM FIX */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            width: `${LEFT_SIDEBAR_WIDTH}px`,
            height: "25px",
            zIndex: 400,
            pointerEvents: "none",
          }}
        >
          <Fakebottomfix />
        </div>
      </div> {/* ← Main container closing tag */}
    );
  },
);
```

**Insert BEFORE the closing `</div>`:**
```typescript
        {/* FAKE BOTTOM FIX */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            width: `${LEFT_SIDEBAR_WIDTH}px`,
            height: "25px",
            zIndex: 400,
            pointerEvents: "none",
          }}
        >
          <Fakebottomfix />
        </div>

        {/* Screen Reader Announcement */}
        <div 
          role="status" 
          aria-live="polite" 
          aria-atomic="true"
          className="sr-only"
        >
          {srAnnouncement}
        </div>
      </div> {/* ← Main container closing tag */}
    );
  },
);
```

**Verify:**
- Element exists in DOM (inspect in DevTools) ✓
- Element is visually hidden (`.sr-only` class) ✓
- Content updates on scroll ✓

---

## ✅ Testing (30 minutes)

### Manual Testing (20 min)

#### Test 1: Tab Navigation
1. Open calendar
2. Press Tab key repeatedly
3. **Expected:** Focus moves between resource rows
4. **Visual:** Blue outline appears around focused row
5. **Result:** ✓ Pass / ❌ Fail

#### Test 2: Enter Key
1. Tab to a resource row
2. Press Enter or Space
3. **Expected:** Event creation modal appears
4. **Result:** ✓ Pass / ❌ Fail

#### Test 3: Arrow Keys
1. Tab to a resource row
2. Press Arrow Down
3. **Expected:** Focus moves to next resource
4. Press Arrow Up
5. **Expected:** Focus moves to previous resource
6. **Result:** ✓ Pass / ❌ Fail

#### Test 4: Screen Reader (if available)
1. Enable NVDA (Windows) or VoiceOver (Mac)
2. Tab to a resource row
3. **Expected:** Hears "John Doe, Senior, Company Name"
4. Scroll calendar
5. **Expected:** Hears "Showing X of Y resources"
6. **Result:** ✓ Pass / ❌ Fail

---

### Automated Testing (10 min)

#### Test 1: Check ARIA Attributes
```javascript
// Open DevTools Console
const resourceRows = document.querySelectorAll('.resource-row');
const firstRow = resourceRows[0];

console.log('Role:', firstRow.getAttribute('role')); // Should be "row"
console.log('Label:', firstRow.getAttribute('aria-label')); // Should have name
console.log('TabIndex:', firstRow.getAttribute('tabIndex')); // Should be "0"

// Result: All present ✓
```

#### Test 2: Check Screen Reader Div
```javascript
// Open DevTools Console
const srDiv = document.querySelector('.sr-only');

console.log('Exists:', !!srDiv); // Should be true
console.log('Text:', srDiv.textContent); // Should have "Showing X of Y"
console.log('Hidden:', srDiv.offsetWidth === 1); // Should be true

// Result: All correct ✓
```

#### Test 3: Check Focus Outline
```javascript
// Open DevTools Console
const resourceRow = document.querySelector('.resource-row');
resourceRow.focus();

// Check DevTools Styles tab
// Should have: outline: 2px solid #3b82f6

// Result: Outline visible ✓
```

---

## 🐛 Troubleshooting

### Issue 1: Tab doesn't focus rows
**Symptom:** Pressing Tab skips over resource rows

**Fix:**
1. Check `tabIndex={0}` is present on resource rows
2. Verify no `tabIndex={-1}` on parent elements
3. Check CSS doesn't have `pointer-events: none`

**Solution:**
```typescript
// Make sure this is on the resource row div:
tabIndex={0}
```

---

### Issue 2: Enter key doesn't work
**Symptom:** Pressing Enter on focused row does nothing

**Fix:**
1. Check `onKeyDown={handleRowKeyDown}` is present
2. Verify `e.preventDefault()` is called
3. Check `onCellClick` is defined

**Solution:**
```typescript
// Make sure handleRowKeyDown is defined and attached:
onKeyDown={(e) => handleRowKeyDown(e, item.resource!.id)}
```

---

### Issue 3: Screen reader doesn't announce
**Symptom:** No announcement when scrolling

**Fix:**
1. Check `.sr-only` div exists in DOM
2. Verify `srAnnouncement` state updates
3. Check `role="status"` and `aria-live="polite"`

**Solution:**
```typescript
// Make sure useEffect updates announcement:
useEffect(() => {
  setSrAnnouncement(`Showing ${resourceCount} of ${totalResources} resources`);
}, [visibleItems.length, gridItems.length, visibleItems, gridItems]);
```

---

### Issue 4: Arrow keys don't navigate
**Symptom:** Arrow keys don't move focus between rows

**Fix:**
1. Check `e.preventDefault()` is called
2. Verify `visibleItems` dependency in useCallback
3. Check `document.querySelector` finds elements

**Solution:**
```typescript
// Make sure to cast element and focus:
const element = document.querySelector(
  `[data-resource-id="${nextResource.resource.id}"]`
) as HTMLElement;
element?.focus();
```

---

## ✅ Completion Checklist

### Code Changes
- [ ] `handleRowKeyDown` added and compiles
- [ ] Screen reader announcement `useEffect` added
- [ ] `role="row"` added to resource rows
- [ ] `aria-label` added to resource rows
- [ ] `tabIndex={0}` added to resource rows
- [ ] `onKeyDown` handler added to resource rows
- [ ] `.sr-only` div added to main container

### Testing
- [ ] Tab navigation works
- [ ] Enter key creates event
- [ ] Arrow Up/Down navigate rows
- [ ] Focus outline visible
- [ ] Screen reader div exists in DOM
- [ ] Screen reader announcement updates on scroll
- [ ] (Optional) Tested with NVDA/JAWS/VoiceOver

### Documentation
- [ ] Commit message: "feat: add keyboard navigation and ARIA labels"
- [ ] Update CHANGELOG.md with v2.1 changes
- [ ] Mark AUDIT_PROGRESS_v2.0.md as complete

---

## 🚀 Deployment

After all tests pass:

1. **Commit changes:**
   ```bash
   git add .
   git commit -m "feat: add keyboard navigation and ARIA labels (v2.1)

   - Add keyboard handler for Tab, Enter, Arrow keys
   - Add ARIA labels with resource info
   - Add screen reader live region
   - Focus styles already in place from v2.0
   
   Closes accessibility improvement epic"
   ```

2. **Push to production:**
   ```bash
   git push origin main
   ```

3. **Monitor:**
   - Check error logs for TypeScript errors
   - Test keyboard navigation live
   - Verify screen reader works

---

## 📊 Success Criteria

### WCAG 2.1 AA Compliance ✅
- [x] **2.1.1 Keyboard** - All functionality available via keyboard
- [x] **2.1.2 No Keyboard Trap** - Focus can move away from rows
- [x] **2.4.3 Focus Order** - Logical tab order (top to bottom)
- [x] **2.4.7 Focus Visible** - Clear visual focus indicator
- [x] **4.1.2 Name, Role, Value** - ARIA labels describe purpose
- [x] **4.1.3 Status Messages** - Screen reader announcements

### User Experience ✅
- ✅ Keyboard users can navigate calendar
- ✅ Screen reader users hear resource info
- ✅ Focus is visually obvious
- ✅ Virtualization doesn't break accessibility

---

## 🎉 Done!

Your calendar now supports:
- ✅ Keyboard navigation (Tab, Enter, Arrows)
- ✅ Screen readers (NVDA, JAWS, VoiceOver)
- ✅ WCAG 2.1 AA compliance
- ✅ Focus management
- ✅ All without breaking virtualization performance!

**Total time invested:** 40 min implementation + 30 min testing = **70 minutes**

**Users impacted positively:**
- Keyboard-only users (~5%)
- Screen reader users (~1%)
- Anyone with accessibility preferences

---

**Questions?** Check `/PERFORMANCE_AUDIT_CHECKLIST.md` section 2️⃣ for detailed explanations.

**Need help?** Review `/FIXES_IMPLEMENTATION_PLAN.md` Fix #1 for step-by-step guide.

**Want to test more?** See `/PERFORMANCE_AUDIT_CHECKLIST.md` section 2️⃣ for full testing checklist.
