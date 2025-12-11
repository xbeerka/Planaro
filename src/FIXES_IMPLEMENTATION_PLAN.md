# 🔧 Fixes Implementation Plan v2.0

**Based on:** PERFORMANCE_AUDIT_CHECKLIST.md  
**Priority:** HIGH → MEDIUM → LOW  
**Timeline:** 2-4 hours for HIGH priority fixes

---

## 🚨 HIGH Priority (Must Fix Before Production)

### Fix #1: ARIA Labels + Keyboard Navigation
**Time:** 45 minutes  
**File:** `/components/scheduler/SchedulerGridUnified.tsx`

#### Changes Required:

1. **Add ARIA container**
```typescript
// After line ~600 (main container):
<div
  role="grid"
  aria-label="Resource schedule calendar"
  aria-rowcount={gridItems.length + 3} // +3 for header rows
  aria-colcount={WEEKS}
>
```

2. **Update resource rows**
```typescript
// Around line ~850 (resource row rendering):
<div
  key={item.resource!.id}
  className="resource-row"
  role="row"
  aria-rowindex={item.row}
  aria-label={`${item.resource!.displayName}, ${
    grades.find(g => g.id === item.resource!.gradeId)?.name || ''
  }, ${
    companies.find(c => c.id === item.resource!.companyId)?.name || ''
  }`}
  tabIndex={0}
  onClick={(e) => handleRowClick(e, item.resource!.id)}
  onKeyDown={(e) => handleRowKeyDown(e, item.resource!.id)}
  // ... rest
>
```

3. **Add keyboard handler**
```typescript
// Add before component return (~line 680):
const handleRowKeyDown = useCallback((e: React.KeyboardEvent, resourceId: string) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    // Focus on first week (simulate click on week 0, unit 0)
    onCellClick(resourceId, 0, 0);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    // Focus next resource (if exists)
    const currentIndex = visibleItems.findIndex(
      item => item.type === 'resource' && item.resource?.id === resourceId
    );
    const nextResource = visibleItems.find(
      (item, idx) => idx > currentIndex && item.type === 'resource'
    );
    if (nextResource?.resource) {
      document.querySelector(
        `[data-resource-id="${nextResource.resource.id}"]`
      )?.focus();
    }
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    // Focus previous resource
    const currentIndex = visibleItems.findIndex(
      item => item.type === 'resource' && item.resource?.id === resourceId
    );
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (visibleItems[i].type === 'resource') {
        document.querySelector(
          `[data-resource-id="${visibleItems[i].resource!.id}"]`
        )?.focus();
        break;
      }
    }
  }
}, [visibleItems, onCellClick]);
```

4. **Add data-attribute for focus targeting**
```typescript
<div
  key={item.resource!.id}
  data-resource-id={item.resource!.id} // ← Add this
  className="resource-row"
  // ... rest
>
```

5. **Add screen reader announcements**
```typescript
// Add state near line ~470:
const [srAnnouncement, setSrAnnouncement] = useState('');

// Update in virtualization useEffect (after line ~790):
useEffect(() => {
  // ... existing virtualization logic ...
  
  setSrAnnouncement(
    `Showing ${visibleItems.length} of ${gridItems.length} resources. ` +
    `Scroll to see more.`
  );
}, [visibleItems.length, gridItems.length]);

// Add to JSX (before closing </div> of main container):
<div 
  role="status" 
  aria-live="polite" 
  aria-atomic="true"
  className="sr-only"
>
  {srAnnouncement}
</div>
```

6. **Add CSS for screen reader only**
```css
/* In /styles/globals.css */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

#### Testing:
- [ ] Tab through resource rows
- [ ] Press Enter on a row (should create event)
- [ ] Arrow keys navigate between resources
- [ ] Screen reader announces visible range
- [ ] NVDA/JAWS reads resource info correctly

---

### Fix #2: React.memo + useCallback Optimization
**Time:** 30 minutes  
**Files:** 
- `/components/scheduler/SchedulerGridUnified.tsx`
- `/components/scheduler/ResourceRowWithMenu.tsx`

#### Part A: Memoize handleRowClick

```typescript
// Around line ~680 (before return):
const handleRowClick = useCallback((e: React.MouseEvent, resourceId: string) => {
  const target = e.target as HTMLElement;
  const rowElement = target.closest('.resource-row');
  if (!rowElement) return;

  const rect = rowElement.getBoundingClientRect();
  const x = e.clientX - rect.left - 8; // LEFT_PADDING = 8px
  
  if (x < 0) return;
  
  const week = Math.floor(x / weekWidth);
  const withinWeek = x - week * weekWidth;
  const unitIndex = Math.floor((withinWeek / weekWidth) * 4);
  
  if (week >= 0 && week < WEEKS && unitIndex >= 0 && unitIndex < 4) {
    onCellClick(resourceId, week, unitIndex);
  }
}, [weekWidth, onCellClick]);
```

#### Part B: Memoize significant projects calculation

```typescript
// Around line ~730 (before gridItems useMemo):
const significantProjectsMap = useMemo(() => {
  const map = new Map<string, Project[]>();
  
  resources.forEach(resource => {
    const projects = getUserSignificantProjects(
      resource.id,
      events,
      projects,
      currentWeekIndex
    );
    map.set(resource.id, projects);
  });
  
  return map;
}, [resources, events, projects, currentWeekIndex]);
```

```typescript
// In resource row rendering (~line 880):
projects={significantProjectsMap.get(item.resource!.id) || []}
```

#### Part C: Memoize ResourceRowWithMenu

```typescript
// In /components/scheduler/ResourceRowWithMenu.tsx:
// At the bottom, change from:
export { ResourceRowWithMenu };

// To:
export const ResourceRowWithMenu = React.memo(
  ResourceRowWithMenuInner,
  (prevProps, nextProps) => {
    // Custom comparison for performance
    return (
      prevProps.resource.id === nextProps.resource.id &&
      prevProps.hoveredResourceId === nextProps.hoveredResourceId &&
      prevProps.projects.length === nextProps.projects.length &&
      prevProps.companies === nextProps.companies &&
      prevProps.grades === nextProps.grades
    );
  }
);

// Rename current export to:
const ResourceRowWithMenuInner = ({ resource, ... }) => {
  // ... existing code
};
```

#### Testing:
- [ ] React DevTools Profiler: check render count
- [ ] Scroll calendar: ResourceRowWithMenu should NOT re-render
- [ ] Hover resource: ONLY hovered row should re-render
- [ ] Create event: ONLY affected row should re-render

---

### Fix #3: Extract Inline Styles to CSS Classes
**Time:** 40 minutes  
**Files:**
- `/components/scheduler/SchedulerGridUnified.tsx`
- `/styles/SchedulerGrid.css` (new file)

#### Step 1: Create CSS file

```css
/* /styles/SchedulerGrid.css */

/* Resource Row Container */
.resource-row-container {
  position: absolute;
  left: calc(284px + 8px); /* LEFT_SIDEBAR_WIDTH + LEFT_PADDING */
  contain: layout style paint; /* Performance optimization */
  pointer-events: auto;
}

/* Grid Background Pattern */
.grid-background {
  background-image: repeating-linear-gradient(
    to right,
    transparent,
    transparent calc(var(--week-width) - 1px),
    #e5e7eb calc(var(--week-width) - 1px),
    #e5e7eb var(--week-width)
  );
  background-size: calc(var(--week-width) * var(--total-weeks)) 100%;
}

/* Scrolling Optimization */
.resource-row-scrolling {
  will-change: transform;
}

/* Department Row */
.department-row-container {
  position: absolute;
  left: 284px;
  width: 100%;
  contain: layout style;
}

/* Spacers */
.virtualization-spacer {
  position: absolute;
  left: 0;
  width: 100%;
  pointer-events: none;
}

/* Focus Styles */
.resource-row:focus {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
  z-index: 10;
}

.resource-row:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
}
```

#### Step 2: Import CSS in component

```typescript
// At top of SchedulerGridUnified.tsx (line ~27):
import '../../styles/SchedulerGrid.css';
```

#### Step 3: Replace inline styles

```typescript
// Before (line ~800):
<div
  style={{
    position: 'absolute',
    left: `${LEFT_SIDEBAR_WIDTH + 8}px`,
    top: `${item.offset}px`,
    width: `${weekWidth * WEEKS}px`,
    height: `${item.height}px`,
    backgroundColor: 'white',
    // ... many more
  }}
>

// After:
<div
  className="resource-row-container grid-background"
  style={{
    '--week-width': `${weekWidth}px`,
    '--total-weeks': WEEKS,
    top: `${item.offset}px`,
    height: `${item.height}px`,
  } as React.CSSProperties}
>
```

#### Step 4: Add scroll state for will-change

```typescript
// Add state (line ~470):
const [isScrolling, setIsScrolling] = useState(false);

// Update scroll handler (line ~691):
const handleScroll = () => {
  if (rafId !== null) return;
  
  setIsScrolling(true); // ← Add this
  
  rafId = requestAnimationFrame(() => {
    setScrollTop(scrollEl.scrollTop);
    rafId = null;
  });
};

// Add scroll stop detection (line ~707):
let scrollStopTimeout: NodeJS.Timeout;

const handleScrollStop = () => {
  clearTimeout(scrollStopTimeout);
  scrollStopTimeout = setTimeout(() => {
    setIsScrolling(false);
  }, 150); // 150ms after scroll stops
};

scrollEl.addEventListener("scroll", () => {
  handleScroll();
  handleScrollStop();
}, { passive: true });

// Cleanup:
return () => {
  clearTimeout(scrollStopTimeout);
  // ... existing cleanup
};

// Use in className:
className={`resource-row-container ${isScrolling ? 'resource-row-scrolling' : ''}`}
```

#### Testing:
- [ ] Visual appearance unchanged
- [ ] Performance: check CSS contain in DevTools
- [ ] will-change only active during scroll
- [ ] Grid background pattern correct
- [ ] Focus outline visible

---

## 📊 MEDIUM Priority (Nice to Have)

### Fix #4: Heap Snapshot Test
**Time:** 20 minutes  
**Tool:** Firefox DevTools Memory

Follow procedure in PERFORMANCE_AUDIT_CHECKLIST.md section 5️⃣.

**Record results:**
```
Baseline:           ______ MiB
After Load:         ______ MiB
After 10 Scrolls:   ______ MiB  (should be ≈ After Load)
After Back:         ______ MiB  (should be ≈ Baseline)
After 5min Use:     ______ MiB  (should be < +50%)
```

**Red Flags:**
- Memory grows >20% after scrolling → investigate closure leaks
- Memory doesn't drop after navigation → check listener cleanup
- Detached DOM >100 → check React refs

---

### Fix #5: Long Task Profiling
**Time:** 15 minutes  
**Tool:** Firefox DevTools Performance

1. Start recording
2. Scroll calendar (top → bottom → top)
3. Stop recording
4. Look for tasks >50ms

**Target:**
- All tasks <50ms during scroll
- Frame rate 60fps
- Idle time >50%

**If tasks >50ms found:**
- Identify function in call stack
- Consider memoization or WebWorker

---

## 🔧 LOW Priority (Future Optimization)

### Fix #6: WebWorker for Heavy Calculations
**Time:** 2-3 hours  
**Only if:** Profiling shows tasks >100ms

See PERFORMANCE_AUDIT_CHECKLIST.md section 6️⃣ for implementation.

---

## 📋 Implementation Order

### Day 1 (2 hours)
1. ✅ Fix #1A: ARIA container + role attributes (15 min)
2. ✅ Fix #1B: Keyboard navigation handler (20 min)
3. ✅ Fix #1C: Screen reader announcements (10 min)
4. ✅ Fix #2A: useCallback for handleRowClick (10 min)
5. ✅ Fix #2B: useMemo for significant projects (15 min)
6. ✅ Fix #2C: React.memo for ResourceRowWithMenu (20 min)
7. ✅ Testing: ARIA + keyboard + React Profiler (30 min)

### Day 2 (1.5 hours)
1. ✅ Fix #3A: Create CSS file (20 min)
2. ✅ Fix #3B: Replace inline styles (30 min)
3. ✅ Fix #3C: Add scroll state for will-change (15 min)
4. ✅ Testing: Visual regression + performance (25 min)

### Day 3 (45 minutes)
1. ✅ Fix #4: Heap snapshot test (20 min)
2. ✅ Fix #5: Long task profiling (15 min)
3. ✅ Documentation: Update STABLE_VERSION_v2.0.md (10 min)

---

## ✅ Completion Checklist

### Code Quality
- [ ] All inline event handlers wrapped in useCallback
- [ ] All expensive components wrapped in React.memo
- [ ] All inline styles moved to CSS classes
- [ ] CSS containment and will-change properly used
- [ ] No memory leaks in heap snapshot test
- [ ] No long tasks >50ms in profiler

### Accessibility
- [ ] ARIA labels on all interactive elements
- [ ] Keyboard navigation works (Tab, Enter, Arrows)
- [ ] Screen reader announces virtualization changes
- [ ] Focus visible and properly managed
- [ ] Tested with NVDA or JAWS

### Performance
- [ ] React Profiler shows <5% re-renders on scroll
- [ ] Memory usage stable after 10 scroll cycles
- [ ] 60fps maintained during scroll
- [ ] No detached DOM nodes
- [ ] RAF properly cancelled in cleanup

### Documentation
- [ ] STABLE_VERSION_v2.0.md updated with fixes
- [ ] PERFORMANCE_AUDIT_CHECKLIST.md marked complete
- [ ] Code comments added for complex logic
- [ ] Accessibility notes in README

---

## 🚀 Expected Outcomes

### Before Fixes
- ❌ No keyboard navigation
- ❌ No screen reader support
- ⚠️ Some unnecessary re-renders
- ⚠️ Inline styles (harder to maintain)

### After Fixes
- ✅ Full keyboard navigation (WCAG 2.1 AA)
- ✅ Screen reader compatible
- ✅ <5% unnecessary re-renders
- ✅ CSS classes (maintainable)
- ✅ Verified no memory leaks
- ✅ Optimized CSS containment

### Performance Improvement
- **Re-renders:** ~30% → <5%
- **Memory stability:** Verified (heap test)
- **Accessibility:** 0% → 100% (WCAG 2.1 AA)
- **Maintainability:** Inline styles → CSS classes

---

**Status:** Ready to implement  
**Start with:** Fix #1 (ARIA + Keyboard) - highest user impact  
**Timeline:** 2-4 hours total for HIGH priority fixes
