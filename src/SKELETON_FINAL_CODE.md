# Skeleton Loader - Final Code Changes

## Change 1: Update gridItems type and add skeleton logic

**File:** `/components/scheduler/SchedulerGridUnified.tsx`  
**Line:** ~735-780

**Replace:**
```typescript
// Построение структуры grid (departments + resources) с вычислением offsets
const gridItems = useMemo(() => {
  const items: Array<{
    type: "department" | "resource";
    dept?: Department;
    resource?: Resource;
    row: number;
    offset: number; // Y-coordinate from top of data section
    height: number;
  }> = [];

  let currentRow = 4; // Row 1=Header, Row 2=Month, Row 3=Week, Row 4+=Data
  let currentOffset = 0;

  filteredDepartments.forEach((dept) => {
    const deptResources = sortResourcesByGrade(
      filteredResources.filter(
        (r) => r.departmentId === dept.id,
      ),
    );

    // Department row
    items.push({
      type: "department",
      dept,
      row: currentRow,
      offset: currentOffset,
      height: DEPARTMENT_ROW_HEIGHT,
    });
    currentRow++;
    currentOffset += DEPARTMENT_ROW_HEIGHT;

    // Resource rows
    deptResources.forEach((resource) => {
      items.push({
        type: "resource",
        resource,
        row: currentRow,
        offset: currentOffset,
        height: RESOURCE_ROW_HEIGHT,
      });
      currentRow++;
      currentOffset += RESOURCE_ROW_HEIGHT;
    });
  });

  return items;
}, [filteredDepartments, filteredResources]);
```

**With:**
```typescript
// Построение структуры grid (departments + resources) с вычислением offsets
const gridItems = useMemo(() => {
  const items: Array<{
    type: "department" | "resource" | "skeleton";
    dept?: Department;
    resource?: Resource;
    row: number;
    offset: number; // Y-coordinate from top of data section
    height: number;
  }> = [];

  // ✨ SKELETON STATE - показываем скелетоны во время загрузки
  if (isLoading) {
    const SKELETON_ROW_COUNT = 10;
    for (let i = 0; i < SKELETON_ROW_COUNT; i++) {
      items.push({
        type: "skeleton",
        row: 4 + i, // Start from row 4 (after headers)
        offset: i * RESOURCE_ROW_HEIGHT,
        height: RESOURCE_ROW_HEIGHT,
      });
    }
    return items;
  }

  let currentRow = 4; // Row 1=Header, Row 2=Month, Row 3=Week, Row 4+=Data
  let currentOffset = 0;

  filteredDepartments.forEach((dept) => {
    const deptResources = sortResourcesByGrade(
      filteredResources.filter(
        (r) => r.departmentId === dept.id,
      ),
    );

    // Department row
    items.push({
      type: "department",
      dept,
      row: currentRow,
      offset: currentOffset,
      height: DEPARTMENT_ROW_HEIGHT,
    });
    currentRow++;
    currentOffset += DEPARTMENT_ROW_HEIGHT;

    // Resource rows
    deptResources.forEach((resource) => {
      items.push({
        type: "resource",
        resource,
        row: currentRow,
        offset: currentOffset,
        height: RESOURCE_ROW_HEIGHT,
      });
      currentRow++;
      currentOffset += RESOURCE_ROW_HEIGHT;
    });
  });

  return items;
}, [filteredDepartments, filteredResources, isLoading]);
```

---

## Change 2: Render skeletons in visibleItems loop

**File:** `/components/scheduler/SchedulerGridUnified.tsx`  
**Line:** ~1180 (inside visibleItems.map)

**Add BEFORE department rendering:**
```typescript
{visibleItems.map((item, index) => {
  // ✨ SKELETON ROW
  if (item.type === "skeleton") {
    return (
      <React.Fragment key={`skeleton-${item.row}`}>
        {/* Skeleton Name (Left) */}
        <div
          style={{
            gridColumn: 1,
            gridRow: item.row,
            position: "sticky",
            left: 0,
            height: `${RESOURCE_ROW_HEIGHT}px`,
            backgroundColor: "#fff",
            zIndex: 200,
          }}
        >
          <div className="w-full h-full flex items-center pl-2">
            <div className="w-full h-full border-l border-r border-[#f0f0f0]">
              <ResourceRowSkeleton />
            </div>
          </div>
        </div>

        {/* Skeleton Row (52 weeks) - Empty white background */}
        <div
          style={{
            gridColumn: "3 / -1",
            gridRow: item.row,
            height: `${RESOURCE_ROW_HEIGHT}px`,
            backgroundColor: "#fff",
            backgroundImage: `repeating-linear-gradient(
              to right,
              transparent 0,
              transparent calc(${config.weekPx}px - 0.5px),
              #DFE7EE calc(${config.weekPx}px - 0.5px),
              #DFE7EE ${config.weekPx}px
            )`,
            backgroundSize: `${config.weekPx}px 100%`,
            backgroundPosition: "0 0",
          }}
        />
      </React.Fragment>
    );
  }

  // EXISTING: Department rendering
  if (item.type === "department" && item.dept) {
    // ...
  }
  
  // EXISTING: Resource rendering
  if (item.type === "resource" && item.resource) {
    // ...
  }

  return null;
})}
```

---

## Summary

**Files Changed:**
1. `/components/scheduler/ResourceRowSkeleton.tsx` - Created ✅
2. `/components/scheduler/SchedulerGridUnified.tsx` - Updated (2 changes) ⏸️
3. `/components/scheduler/SchedulerMain.tsx` - Updated ✅

**Next Step:**
Apply Change 1 and Change 2 to SchedulerGridUnified.tsx
