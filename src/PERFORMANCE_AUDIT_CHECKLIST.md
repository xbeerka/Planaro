# 🔍 Performance Audit Checklist v2.0

**Target:** SchedulerGridUnified.tsx  
**Date:** 2024-12-10  
**Version:** v2.0 (Virtualized)

---

## 1️⃣ Memory Leaks & Listener Cleanup

### ✅ Current Status (GOOD)

**Scroll Tracking useEffect (line 682-715):**
```typescript
useEffect(() => {
  const scrollEl = scrollRef?.current;
  if (!scrollEl) return;

  let rafId: number | null = null;
  
  const handleScroll = () => {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      setScrollTop(scrollEl.scrollTop);
      rafId = null;
    });
  };

  const handleResize = () => {
    setViewportHeight(scrollEl.clientHeight);
  };

  scrollEl.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleResize);

  return () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId); // ✅ GOOD
    }
    scrollEl.removeEventListener("scroll", handleScroll); // ✅ GOOD
    window.removeEventListener("resize", handleResize); // ✅ GOOD
  };
}, [scrollRef]);
```

**Status:**
- ✅ RAF is cancelled in cleanup
- ✅ Scroll listener is removed
- ✅ Resize listener is removed
- ✅ `passive: true` for scroll (performance win)
- ✅ Closure doesn't capture heavy objects

### 🔍 Checklist

- [x] useEffect cleanup functions present
- [x] RAF cancelled before component unmount
- [x] Event listeners removed in cleanup
- [x] No dangling setTimeout/setInterval
- [x] Passive scroll listeners used
- [ ] **TODO:** Heap snapshot test (see section below)

---

## 2️⃣ Accessibility (A11y)

### 🚨 Issues Found

**Problem 1: Missing ARIA labels on unified resource rows**
```typescript
// Current (line ~800-900):
<div
  className="resource-row"
  onClick={(e) => handleRowClick(e, resource.id)}
  // ❌ No role, aria-label, or keyboard support
>
```

**Problem 2: No keyboard navigation**
- Cannot Tab to resource rows
- Cannot create events with Enter/Space
- Cannot navigate weeks with Arrow keys

**Problem 3: No screen reader announcements**
- No aria-live for virtualization changes
- No description of current visible range
- No announcement when rows appear/disappear

### 🎯 Required Fixes

#### Fix 1: Add ARIA labels to resource rows
```typescript
<div
  className="resource-row"
  role="row"
  aria-label={`${resource.displayName}, ${gradeName}, Week 1 to 52`}
  tabIndex={0}
  onClick={(e) => handleRowClick(e, resource.id)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(e, resource.id);
    }
  }}
>
```

#### Fix 2: Add week cell accessibility
```typescript
// For each clickable week area:
<div
  role="gridcell"
  aria-label={`Week ${week + 1}, ${weekLabel(week)}`}
  tabIndex={-1} // Only parent row is in tab order
  onClick={(e) => onCellClick(resource.id, week, unitIndex)}
>
```

#### Fix 3: Add virtualization announcements
```typescript
const [announceText, setAnnounceText] = useState("");

useEffect(() => {
  setAnnounceText(
    `Showing ${visibleItems.length} of ${gridItems.length} resources`
  );
}, [visibleItems.length, gridItems.length]);

// In JSX:
<div role="status" aria-live="polite" className="sr-only">
  {announceText}
</div>
```

### 🔍 Checklist

- [ ] **TODO:** Add role="row" to resource rows
- [ ] **TODO:** Add aria-label with resource info
- [ ] **TODO:** Add tabIndex for keyboard navigation
- [ ] **TODO:** Add onKeyDown for Enter/Space
- [ ] **TODO:** Add role="gridcell" to week cells
- [ ] **TODO:** Add aria-live announcements for virtualization
- [ ] **TODO:** Test with screen reader (NVDA/JAWS/VoiceOver)
- [ ] **TODO:** Test keyboard-only navigation

---

## 3️⃣ React Performance Optimization

### 🚨 Issues Found

**Problem 1: Inline event handlers in map**
```typescript
// Current (line ~850):
{visibleItems.map((item, index) => {
  if (item.type === 'resource') {
    return (
      <div
        key={item.resource!.id}
        onClick={(e) => handleRowClick(e, item.resource!.id)}
        // ❌ New function on every render
      >
```

**Problem 2: No React.memo for expensive child components**
```typescript
// ResourceRowWithMenu is NOT memoized
<ResourceRowWithMenu
  resource={item.resource!}
  // ... many props
/>
```

**Problem 3: Unstable props (inline objects/arrays)**
```typescript
// Example:
projects={getUserSignificantProjects(...)} // ❌ Recalculated every render
```

### 🎯 Required Fixes

#### Fix 1: Stable event handlers with useCallback
```typescript
const handleRowClick = useCallback((e: React.MouseEvent, resourceId: string) => {
  const target = e.target as HTMLElement;
  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left - LEFT_PADDING;
  
  if (x < 0) return;
  
  const week = Math.floor(x / weekWidth);
  const withinWeek = x - week * weekWidth;
  const unitIndex = Math.floor((withinWeek / weekWidth) * 4);
  
  if (week >= 0 && week < WEEKS && unitIndex >= 0 && unitIndex < 4) {
    onCellClick(resourceId, week, unitIndex);
  }
}, [weekWidth, onCellClick]);
```

#### Fix 2: Memoize ResourceRowWithMenu
```typescript
// In ResourceRowWithMenu.tsx:
export const ResourceRowWithMenu = React.memo(({ resource, ... }) => {
  // component code
}, (prevProps, nextProps) => {
  // Custom comparison if needed
  return prevProps.resource.id === nextProps.resource.id &&
         prevProps.hoveredResourceId === nextProps.hoveredResourceId;
});
```

#### Fix 3: Memoize significant projects calculation
```typescript
const significantProjectsMap = useMemo(() => {
  const map = new Map<string, Project[]>();
  visibleItems.forEach(item => {
    if (item.type === 'resource') {
      map.set(
        item.resource!.id,
        getUserSignificantProjects(item.resource!.id, events, projects, currentWeekIndex)
      );
    }
  });
  return map;
}, [visibleItems, events, projects, currentWeekIndex]);

// Then use:
projects={significantProjectsMap.get(item.resource!.id) || []}
```

### 🔍 Checklist

- [ ] **TODO:** Wrap handleRowClick in useCallback
- [ ] **TODO:** Memoize ResourceRowWithMenu component
- [ ] **TODO:** Memoize getUserSignificantProjects calls
- [ ] **TODO:** Extract inline event handlers
- [ ] **TODO:** Stabilize props with useMemo/useCallback
- [ ] **TODO:** Add React DevTools Profiler check

---

## 4️⃣ CSS Optimization

### 🚨 Issues Found

**Problem 1: Inline styles in render**
```typescript
// Current:
<div style={{
  position: 'absolute',
  left: `${LEFT_SIDEBAR_WIDTH + 8}px`,
  top: `${item.offset}px`,
  width: `${weekWidth * WEEKS}px`,
  height: `${item.height}px`,
  // ... many more
}}>
```

**Problem 2: Missing CSS containment**
```typescript
// Resource rows should have:
contain: 'layout style paint';
will-change: 'transform'; // Only during scroll
```

**Problem 3: Repeated style calculations**
```typescript
// Repeated in every row:
left: `${LEFT_SIDEBAR_WIDTH + 8}px`
width: `${weekWidth * WEEKS}px`
```

### 🎯 Required Fixes

#### Fix 1: Extract to CSS classes
```css
/* In globals.css or SchedulerGrid.module.css */

.resource-row-container {
  position: absolute;
  left: calc(284px + 8px); /* LEFT_SIDEBAR_WIDTH + LEFT_PADDING */
  contain: layout style paint;
}

.resource-row-scrolling {
  will-change: transform;
}

.grid-background {
  background-image: repeating-linear-gradient(
    to right,
    transparent,
    transparent calc(var(--week-width) - 1px),
    #e5e7eb calc(var(--week-width) - 1px),
    #e5e7eb var(--week-width)
  );
}
```

#### Fix 2: Use CSS variables for dynamic values
```typescript
<div
  className="resource-row-container"
  style={{
    '--week-width': `${weekWidth}px`,
    '--total-weeks': WEEKS,
    top: `${item.offset}px`,
    height: `${item.height}px`,
  } as React.CSSProperties}
>
```

#### Fix 3: Add will-change only during scroll
```typescript
const [isScrolling, setIsScrolling] = useState(false);

useEffect(() => {
  let scrollTimeout: NodeJS.Timeout;
  
  const handleScroll = () => {
    setIsScrolling(true);
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => setIsScrolling(false), 150);
    
    // ... existing scroll logic
  };
  
  // ... rest of useEffect
  
  return () => {
    clearTimeout(scrollTimeout);
    // ... existing cleanup
  };
}, []);

// In className:
className={`resource-row ${isScrolling ? 'resource-row-scrolling' : ''}`}
```

### 🔍 Checklist

- [ ] **TODO:** Move inline styles to CSS classes
- [ ] **TODO:** Add CSS containment for resource rows
- [ ] **TODO:** Use CSS variables for dynamic values
- [ ] **TODO:** Add will-change only during scroll (remove after)
- [ ] **TODO:** Extract repeated style values
- [ ] **TODO:** Minimize style object creation in render

---

## 5️⃣ Heap Snapshot Testing

### 📊 Test Procedure

#### Step 1: Baseline Snapshot
1. Open Firefox DevTools → Memory
2. Clear all snapshots
3. Click "Take snapshot" → Label: "Baseline"
4. Record heap size: `______ MiB`

#### Step 2: Load Calendar (First Time)
1. Navigate to workspace with 338 resources
2. Wait for initial render
3. Take snapshot → Label: "After Load"
4. Record heap size: `______ MiB`
5. Calculate delta: `______ MiB`

#### Step 3: Scroll Test (10 cycles)
1. Scroll to bottom (slowly)
2. Scroll to top (slowly)
3. Wait 2 seconds
4. Repeat 10 times
5. Take snapshot → Label: "After 10 Scrolls"
6. Record heap size: `______ MiB`
7. **Expected:** ≈ same as "After Load" (±10%)

#### Step 4: Navigation Test
1. Go back to workspace list
2. Wait 5 seconds
3. Take snapshot → Label: "After Back"
4. Record heap size: `______ MiB`
5. **Expected:** ≈ close to "Baseline" (±20%)

#### Step 5: Re-open Test
1. Open same workspace again
2. Wait for render
3. Take snapshot → Label: "After Re-open"
4. Record heap size: `______ MiB`
5. **Expected:** ≈ same as "After Load" (±10%)

#### Step 6: Long Run Test (5 minutes)
1. Scroll randomly for 5 minutes
2. Create/delete events
3. Take snapshot → Label: "After 5min Use"
4. Record heap size: `______ MiB`
5. **Expected:** < "After Load" + 50%

### 📋 Results Template
```
Baseline:           ______ MiB
After Load:         ______ MiB  (+______ MiB)
After 10 Scrolls:   ______ MiB  (+______ MiB) ← Should be ≈0
After Back:         ______ MiB  (-______ MiB) ← Should be ≈ Baseline
After Re-open:      ______ MiB  (+______ MiB) ← Should be ≈ After Load
After 5min Use:     ______ MiB  (+______ MiB) ← Should be < +50%
```

### 🚨 Red Flags
- **Memory grows >20% after scrolling** → RAF not cancelled or closure leak
- **Memory doesn't drop after navigation** → Event listeners not removed
- **Memory grows continuously** → setInterval/setTimeout leak
- **Detached DOM nodes >100** → React refs not cleaned up

### 🔍 Checklist

- [ ] **TODO:** Run baseline snapshot
- [ ] **TODO:** Test scroll cycles (check for leaks)
- [ ] **TODO:** Test navigation back/forth
- [ ] **TODO:** Test long run (5 minutes)
- [ ] **TODO:** Check for detached DOM nodes
- [ ] **TODO:** Verify RAF cancellation
- [ ] **TODO:** Verify listener cleanup

---

## 6️⃣ WebWorker Offloading (Optional)

### 🎯 Heavy Computations to Offload

**Candidate 1: getUserSignificantProjects**
- CPU-intensive: filters + weights + sorting
- Called for EVERY visible resource
- Can be parallelized

**Candidate 2: sortResourcesByGrade**
- Array sorting with grade comparison
- Called for every department

**Candidate 3: Virtual range calculation**
- Binary search + offset calculation
- Currently fast enough, but could be offloaded

### 🔧 Implementation Example

```typescript
// /workers/resourceCalculations.worker.ts
self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data;
  
  if (type === 'CALCULATE_SIGNIFICANT_PROJECTS') {
    const { resourceId, events, projects, currentWeekIndex } = data;
    const result = getUserSignificantProjects(resourceId, events, projects, currentWeekIndex);
    self.postMessage({ type: 'RESULT', resourceId, result });
  }
};

// In component:
const worker = useMemo(() => new Worker(new URL('./workers/resourceCalculations.worker.ts', import.meta.url)), []);

useEffect(() => {
  worker.onmessage = (e) => {
    const { resourceId, result } = e.data;
    setSignificantProjects(prev => ({
      ...prev,
      [resourceId]: result
    }));
  };
  
  return () => worker.terminate();
}, [worker]);
```

### 🔍 Checklist

- [ ] **OPTIONAL:** Profile heavy computations (DevTools Performance)
- [ ] **OPTIONAL:** Identify tasks >50ms
- [ ] **OPTIONAL:** Create WebWorker for significant projects
- [ ] **OPTIONAL:** Test worker overhead vs. performance gain
- [ ] **OPTIONAL:** Fallback for browsers without Worker support

---

## 7️⃣ Long Task Profiling

### 📊 Test Procedure

1. Open Firefox DevTools → Performance
2. Start recording
3. Scroll calendar (top → bottom → top)
4. Stop recording
5. Look for red bars (>50ms tasks)

### 🎯 Expected Results

**Good:**
- Most frames <16ms (60fps)
- No tasks >50ms during scroll
- RAF callbacks <10ms

**Bad:**
- Tasks >100ms (janky scroll)
- Repeated long tasks (need optimization)
- Idle time <50% (CPU saturated)

### 🔍 Checklist

- [ ] **TODO:** Record scroll performance profile
- [ ] **TODO:** Identify tasks >50ms
- [ ] **TODO:** Optimize or offload heavy tasks
- [ ] **TODO:** Verify 60fps during scroll
- [ ] **TODO:** Check idle time >50%

---

## 📝 Summary

### ✅ Currently Good
1. ✅ RAF cleanup in useEffect
2. ✅ Event listener removal
3. ✅ Passive scroll listeners
4. ✅ Virtual range calculation (binary search)
5. ✅ Stable component structure

### 🚨 Needs Fixes
1. ❌ Missing ARIA labels and keyboard navigation
2. ❌ No React.memo for expensive components
3. ❌ Inline event handlers (not memoized)
4. ❌ Inline styles (should be CSS classes)
5. ❌ No screen reader announcements
6. ❌ Missing heap snapshot test

### 🎯 Priority Order
1. **HIGH:** ARIA labels + keyboard navigation (accessibility blocker)
2. **HIGH:** React.memo + useCallback (performance regression risk)
3. **MEDIUM:** Heap snapshot test (verify no leaks)
4. **MEDIUM:** CSS classes (performance + maintainability)
5. **LOW:** WebWorker (only if profiling shows need)
6. **LOW:** will-change optimization (minor gain)

---

## ✅ Sign-Off Checklist

Before marking v2.0 as production-ready:

- [ ] All HIGH priority fixes completed
- [ ] Heap snapshot test passed (no leaks)
- [ ] Screen reader test passed (NVDA/JAWS)
- [ ] Keyboard navigation test passed
- [ ] React Profiler shows no regressions
- [ ] Long task profiling shows 60fps
- [ ] Cross-browser testing (Firefox, Chrome, Safari)
- [ ] Mobile testing (touch scroll)

---

**Next Steps:** Start with ARIA fixes (highest priority for accessibility compliance).
