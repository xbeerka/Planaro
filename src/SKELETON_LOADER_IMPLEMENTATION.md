# 💀 Skeleton Loader Implementation

**Date:** 2024-12-10  
**Status:** 🟡 IN PROGRESS  
**Version:** v2.2 (Performance + Accessibility + Loading UX)

---

## 🎯 Goal

Add skeleton loaders during workspace data loading for better perceived performance.

---

## ✅ What's Implemented

### 1. ResourceRowSkeleton Component ✅
**File:** `/components/scheduler/ResourceRowSkeleton.tsx`

**Features:**
- ✅ Matches RESOURCE_ROW_HEIGHT (144px)
- ✅ Avatar skeleton (36x36px, rounded 12px)
- ✅ Name skeleton (136x14px)
- ✅ Role skeleton (96x10px)
- ✅ 2x Project badges skeletons (48x18px each)
- ✅ Pulsing animation (`animate-pulse`)
- ✅ Opacity 50% for badges (same as design)
- ✅ Border styling matching real cells

**Exact positions from Figma:**
- Avatar: `left-[24px] top-[38px]`
- Name/Role: `left-[72px] top-[38px]`
- Badges: `left-[24px] top-[86px]`

---

### 2. SchedulerGrid Props Updated ✅
**File:** `/components/scheduler/SchedulerGridUnified.tsx`

**Added:**
```typescript
interface SchedulerGridProps {
  // ... existing props
  isLoading?: boolean; // ← NEW
}
```

---

### 3. SchedulerMain Integration ✅
**File:** `/components/scheduler/SchedulerMain.tsx`

**Added:**
```typescript
<SchedulerGrid
  // ... existing props
  isLoading={isLoading} // ← PASSED FROM CONTEXT
/>
```

`isLoading` comes from SchedulerContext and is true when ANY of these are loading:
- `isLoadingDepartments`
- `isLoadingResources`
- `isLoadingProjects`
- `isLoadingGrades`
- `isLoadingEventPatterns`
- `isLoadingCompanies`
- `isLoadingEvents`

---

## ⏳ Next Steps

### 4. Show Skeletons in SchedulerGrid ⏸️
**File:** `/components/scheduler/SchedulerGridUnified.tsx`

**Logic:**
```typescript
// When isLoading, show ~10 skeleton rows instead of real data
const SKELETON_ROW_COUNT = 10;

const skeletonItems = isLoading ? Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => ({
  type: 'skeleton' as const,
  row: 4 + i, // Start from row 4 (after headers)
  offset: i * RESOURCE_ROW_HEIGHT,
  height: RESOURCE_ROW_HEIGHT,
})) : [];

const gridItems = useMemo(() => {
  if (isLoading) {
    return skeletonItems; // Show skeletons
  }
  
  // ... normal logic (departments + resources)
}, [filteredDepartments, filteredResources, isLoading]);
```

**Rendering:**
```typescript
{visibleItems.map((item) => {
  if (item.type === 'skeleton') {
    return (
      <React.Fragment key={`skeleton-${item.row}`}>
        {/* Left: Skeleton */}
        <div style={{ gridColumn: 1, gridRow: item.row, ... }}>
          <SidePaddedBox>
            <ResourceRowSkeleton />
          </SidePaddedBox>
        </div>
        
        {/* Right: Empty row (52 weeks) */}
        <div style={{ gridColumn: '3 / -1', gridRow: item.row, ... }} />
      </React.Fragment>
    );
  }
  
  // ... existing department/resource rendering
})}
```

---

## 📊 Expected Result

### Before (current)
- ❌ Blank screen during loading
- ❌ No feedback to user
- ❌ Feels slow

### After (with skeletons)
- ✅ Skeleton animation during loading
- ✅ Clear visual feedback
- ✅ Perceived performance improved
- ✅ Professional look

---

## 🎨 Visual Design

**Skeleton Appearance:**
- Gray boxes with `animate-pulse`
- Matches exact layout of real cells
- Smooth transition to real data
- No layout shift

**Duration:**
- Shows while `isLoading === true`
- Automatically hides when data loads
- Transition handled by React (re-render)

---

## 🚀 Deployment Plan

1. ✅ Create ResourceRowSkeleton component
2. ✅ Add isLoading prop to SchedulerGrid
3. ✅ Pass isLoading from SchedulerMain
4. ⏸️ Implement skeleton rendering logic
5. ⏸️ Test loading states
6. ⏸️ Deploy v2.2

---

**Status:** 75% complete (3/4 steps done)  
**Next:** Implement rendering logic (15 min)  
**ETA:** v2.2 ready in 20 minutes
