# Panning Fix - Testing Guide

## Problem Summary
After splitting SchedulerGrid into two panels (left + right), panning stopped working:
- **Left panel**: Cursor changes to `grabbing` but nothing scrolls
- **Right panel**: No cursor change, no reaction to middle mouse button

## Root Cause
1. `schedulerRef` pointed to a wrapper div with NO overflow (doesn't scroll)
2. `gridRef` (via useImperativeHandle) points to `rightRef` which DOES scroll
3. `usePanning` was using the wrong ref

## Solution Implemented

### 1. Changed ref passed to usePanning
**File**: `/components/scheduler/SchedulerMain.tsx`
```typescript
// OLD: usePanning(schedulerRef, isSpacePressed);
// NEW: usePanning(gridRef, isSpacePressed);
```

### 2. Rewrote usePanning hook
**File**: `/hooks/usePanning.ts`
- Added capture phase event listeners (`true` flag)
- Added detailed logging for debugging
- Improved checks for interactive elements
- Global cursor management via `document.body.style.cursor`

### 3. Improved scroll synchronization
**File**: `/components/scheduler/SchedulerGrid.tsx`
- Added `requestAnimationFrame` for smooth sync
- Better comments explaining the architecture

### 4. Added diagnostic logging
**File**: `/components/scheduler/SchedulerGrid.tsx`
- useEffect on mount logs ref status and scrollability

## Testing Steps

### Test 1: Middle Mouse Button Panning
1. Open scheduler calendar
2. Press and hold middle mouse button (scroll wheel click)
3. **Expected**: Cursor changes to `grabbing`, grid scrolls in both directions
4. **Check console**: Should see logs:
   ```
   📐 SchedulerGrid mounted: { leftRef: 'OK', rightRef: 'OK', isScrollable: true }
   🖱️ Panning started: { button: 1, buttonName: 'middle', ... }
   🖱️ Panning move: { dx: ..., dy: ..., ... }
   🖱️ Panning ended
   ```

### Test 2: Panning on Left Panel (Resources)
1. Position cursor over left panel (resource names/avatars)
2. Press and hold middle mouse button
3. Move mouse
4. **Expected**: Grid scrolls (vertical only visible on left, but both axes scroll on right)

### Test 3: Panning on Right Panel (Timeline)
1. Position cursor over right panel (weeks/events)
2. Press and hold middle mouse button
3. Move mouse
4. **Expected**: Grid scrolls in both directions smoothly

### Test 4: Space + Left Click Panning
1. Press and hold Space key
2. **Expected**: Cursor changes to `grab`
3. Click and hold left mouse button
4. **Expected**: Cursor changes to `grabbing`
5. Move mouse
6. **Expected**: Grid scrolls in both directions

### Test 5: Panning doesn't interfere with events
1. Press Space key
2. Try to click on an event
3. **Expected**: Panning should work, NOT drag the event
4. Release Space, click event
5. **Expected**: Event can be selected/dragged normally

### Test 6: Wheel scroll still works
1. Position cursor over left panel
2. Use mouse wheel to scroll vertically
3. **Expected**: Both panels scroll vertically in sync
4. Position cursor over right panel
5. Use mouse wheel
6. **Expected**: Right panel scrolls, left panel follows

## Console Logs to Look For

### Success Indicators ✅
```
📐 SchedulerGrid mounted: { leftRef: 'OK', rightRef: 'OK', isScrollable: true }
🖱️ Panning started: { button: 1, buttonName: 'middle', scrollLeft: 0, scrollTop: 0 }
🖱️ Panning move: { dx: -150, dy: -80, newScrollLeft: 150, newScrollTop: 80 }
🖱️ Panning ended
```

### Failure Indicators ❌
```
⚠️ usePanning: scrollableRef.current is null
📐 SchedulerGrid mounted: { rightRef: 'NULL' }
📐 SchedulerGrid mounted: { isScrollable: false }
```

## Architecture Notes

### Panel Structure
```
<div> ← Outer wrapper
  <div ref={leftRef}> ← Left panel (z-index: 300)
    - overflowY: auto
    - overflowX: hidden
    - Fixed width 284px
  </div>
  
  <div ref={rightRef}> ← Right panel (scrollable master)
    - overflow: auto
    - Left: 284px, Right: 0
    - Grid with max-content width
  </div>
</div>
```

### Event Flow
1. User clicks middle button on **any** area
2. Document mousedown listener (capture phase) catches event
3. Check if scrollableRef (rightRef) is valid
4. Store initial scroll position
5. On mousemove: Calculate delta, apply to rightRef.scrollLeft/scrollTop
6. Left panel follows via scroll sync (onRightScroll)

### Key Points
- **Right panel is the master** (has overflow: auto)
- **Left panel is a slave** (syncs scrollTop from right)
- **Panning always scrolls right panel**, regardless of where click started
- **Z-index doesn't matter** because we use capture phase listeners on document

## Rollback Plan

If panning still doesn't work, revert:
1. `/components/scheduler/SchedulerMain.tsx:531` → `usePanning(schedulerRef, ...)`
2. `/hooks/usePanning.ts` → restore from git history
3. Consider alternative architecture with wrapper container

## Next Steps

- [ ] Test all 6 scenarios above
- [ ] Check console logs for errors
- [ ] Verify smooth scrolling performance
- [ ] Remove debug useEffect after confirmation
- [ ] Consider adding visual indicator when panning mode is active
