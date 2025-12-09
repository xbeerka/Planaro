import { SchedulerEvent, Project } from "../types/scheduler";

// ============================================
// CONFIGURATION
// ============================================
const DEBUG = false; // Set to true for detailed logging

// ============================================
// CONSTANTS (BITMASKS)
// ============================================
export const MASK_ROUND_TL = 1 << 0; // 1
export const MASK_ROUND_TR = 1 << 1; // 2
export const MASK_ROUND_BL = 1 << 2; // 4
export const MASK_ROUND_BR = 1 << 3; // 8

export const MASK_FULL_LEFT    = 1 << 4; // 16
export const MASK_PARTIAL_LEFT = 1 << 5; // 32
export const MASK_BOTH_LEFT    = 1 << 6; // 64

export const MASK_FULL_RIGHT    = 1 << 7; // 128
export const MASK_PARTIAL_RIGHT = 1 << 8; // 256
export const MASK_BOTH_RIGHT    = 1 << 9; // 512

export const MASK_HIDE_NAME     = 1 << 10; // 1024

// ============================================
// TYPES
// ============================================

export interface EventNeighborsInfo {
  flags: number;
  expandLeftMultiplier: number;
  expandRightMultiplier: number;
  innerTopLeftProjectId?: string;
  innerBottomLeftProjectId?: string;
  innerTopRightProjectId?: string;
  innerBottomRightProjectId?: string;
}

// NEW: Grid-Based Index Structure
interface GridSystem {
  // Maps resourceId string -> integer index (0..N)
  resourceMap: Map<string, number>;
  // 2D Array: [resourceIndex][weekIndex] -> List of Events
  grid: SchedulerEvent[][][];
  // Max week index found (for bounds checking)
  maxWeek: number;
}

// ============================================
// STAGE 1: GEOMETRY (Facts Collection)
// ============================================

/** Geometry data for one side of an event */
interface SideGeometry {
  neighbors: SchedulerEvent[]; // Same-project neighbors
  otherProjectNeighbors: SchedulerEvent[]; // Different-project neighbors
  
  // Coverage facts
  hasFull: boolean; // Neighbor covers event fully (same top & bottom)
  hasPartial: boolean; // Neighbor covers part of event
  hasBoth: boolean; // Multiple neighbors cover top & bottom
  
  hasTopCovered: boolean;
  hasBottomCovered: boolean;
  
  alignedTop: boolean; // At least one neighbor has same top
  alignedBottom: boolean; // At least one neighbor has same bottom
  
  innerTopProjectId?: string; // Project ID of neighbor creating inner top corner
  innerBottomProjectId?: string; // Project ID of neighbor creating inner bottom corner
  
  hasInnerConnection: boolean; // ANY same-project neighbor overlaps vertically
}

/** Complete geometry data for an event */
interface EventGeometry {
  event: SchedulerEvent;
  left: SideGeometry;
  right: SideGeometry;
}

// ============================================
// STAGE 2: TOPOLOGY (Pattern Recognition)
// ============================================

/** Vertical stack pattern (one event directly above another) */
interface StackPattern {
  topEvent: SchedulerEvent;
  bottomEvent: SchedulerEvent;
  side: "left" | "right";
  
  // Configuration (based on inner/outer corners)
  topHasInnerBottom: boolean; // Top event has inner corner at bottom (форма Б)
  topHasOuterBottom: boolean; // Top event has outer corner at bottom (форма В)
  
  bottomHasInnerTop: boolean; // Bottom event has inner corner at top (форма Г)
  bottomHasOuterTop: boolean; // Bottom event has outer corner at top (форма А)
}

/** Topology classification result */
interface EventTopology {
  event: SchedulerEvent;
  
  // Horizontal gluing (same height, touching horizontally)
  hasHorizontalGlue: boolean;
  
  // Vertical stacks (different projects, touching vertically)
  stacksAbove: StackPattern[];
  stacksBelow: StackPattern[];
  
  // Shape classification
  hasInnerCorners: boolean; // Event has any inner corners (форма Б или Г)
  hasOuterCorners: boolean; // Event has any outer corners (форма А или В)
}

// ============================================
// STAGE 3: RULES (Expansion Logic)
// ============================================

/** Expansion decision for one event */
interface ExpansionDecision {
  event: SchedulerEvent;
  expandLeft: number; // Multiplier (0, 1, 2, etc.)
  expandRight: number; // Multiplier (0, 1, 2, etc.)
  reason: string; // Debug reason
}

// ============================================
// UTILITY FUNCTIONS (GRID OPTIMIZED)
// ============================================

export function buildGridSystem(events: SchedulerEvent[]): GridSystem {
  const resourceMap = new Map<string, number>();
  let resourceCounter = 0;
  let maxWeek = 0;

  // 1. Analyze dimensions & map resources
  for (const event of events) {
    if (!resourceMap.has(event.resourceId)) {
      resourceMap.set(event.resourceId, resourceCounter++);
    }
    const endWeek = event.startWeek + event.weeksSpan;
    if (endWeek > maxWeek) maxWeek = endWeek;
  }

  // 2. Initialize 2D Grid (Sparse-safe initialization)
  // grid[resourceIndex] -> Array of Weeks
  const grid: SchedulerEvent[][][] = new Array(resourceCounter);
  for (let i = 0; i < resourceCounter; i++) {
    // Create array for weeks. 
    // Note: If maxWeek is huge (e.g. 1000), this is fine for JS engine.
    grid[i] = new Array(maxWeek + 1); 
  }

  // 3. Populate Grid (Rasterization)
  for (const event of events) {
    const rIndex = resourceMap.get(event.resourceId)!;
    const start = event.startWeek;
    const end = start + event.weeksSpan;
    
    for (let w = start; w < end; w++) {
      if (!grid[rIndex][w]) {
        grid[rIndex][w] = [event];
      } else {
        grid[rIndex][w].push(event);
      }
    }
  }

  return { resourceMap, grid, maxWeek };
}

function getEventsFromGrid(
  sys: GridSystem, 
  resourceId: string, 
  week: number
): SchedulerEvent[] {
  const rIndex = sys.resourceMap.get(resourceId);
  if (rIndex === undefined) return []; // Resource not in grid
  if (week < 0 || week > sys.maxWeek) return []; // Out of bounds

  const events = sys.grid[rIndex][week];
  return events || [];
}

function getTop(event: SchedulerEvent): number {
  return event.unitStart;
}

function getBottom(event: SchedulerEvent): number {
  return event.unitStart + event.unitsTall - 1;
}

function checkVerticalOverlap(
  event1Top: number, event1Bottom: number,
  event2Top: number, event2Bottom: number,
): boolean {
  return event1Top <= event2Bottom && event2Top <= event1Bottom;
}

function findNeighbors(
  sys: GridSystem,
  event: SchedulerEvent,
  side: "left" | "right",
  filterOptions?: {
    sameProject?: boolean;
    differentProject?: boolean;
  },
): SchedulerEvent[] {
  const eventTop = getTop(event);
  const eventBottom = getBottom(event);
  const targetWeek = side === "left" ? event.startWeek - 1 : event.startWeek + event.weeksSpan;
  
  // O(1) Access via Grid
  const candidates = getEventsFromGrid(sys, event.resourceId, targetWeek);
  
  if (!candidates || candidates.length === 0) return [];

  // Small N filter (usually 0-5 items)
  return candidates.filter((neighbor) => {
    if (neighbor.id === event.id) return false;
    if (filterOptions?.sameProject && neighbor.projectId !== event.projectId) return false;
    if (filterOptions?.differentProject && neighbor.projectId === event.projectId) return false;

    // Note: Horizontal check is implicitly done by grid lookup (targetWeek)
    // Just check vertical overlap
    const neighborTop = getTop(neighbor);
    const neighborBottom = getBottom(neighbor);
    return checkVerticalOverlap(eventTop, eventBottom, neighborTop, neighborBottom);
  });
}

// ============================================
// STAGE 1 IMPLEMENTATION: GEOMETRY
// ============================================

function analyzeSideGeometry(
  event: SchedulerEvent,
  neighbors: SchedulerEvent[],
): Omit<SideGeometry, "neighbors" | "otherProjectNeighbors"> {
  const eventTop = getTop(event);
  const eventBottom = getBottom(event);

  let hasFull = false;
  let hasTopCovered = false;
  let hasBottomCovered = false;
  let innerTopProjectId: string | undefined;
  let innerBottomProjectId: string | undefined;
  let alignedTop = false;
  let alignedBottom = false;

  for (const neighbor of neighbors) {
    const nTop = getTop(neighbor);
    const nBottom = getBottom(neighbor);

    if (nTop === eventTop && nBottom === eventBottom) hasFull = true;

    if (nTop <= eventTop && eventTop <= nBottom) {
      hasTopCovered = true;
      if (nTop < eventTop) innerTopProjectId = neighbor.projectId;
    }

    if (nTop <= eventBottom && eventBottom <= nBottom) {
      hasBottomCovered = true;
      if (nBottom > eventBottom) innerBottomProjectId = neighbor.projectId;
    }

    if (nTop === eventTop) alignedTop = true;
    if (nBottom === eventBottom) alignedBottom = true;
  }

  const hasPartial = (hasTopCovered || hasBottomCovered) && !hasFull;
  const hasBoth = hasTopCovered && hasBottomCovered && !hasFull && neighbors.length >= 2;
  const hasInnerConnection = neighbors.length > 0; // Any neighbor = inner connection

  return {
    hasFull, hasPartial, hasBoth,
    hasTopCovered, hasBottomCovered,
    innerTopProjectId, innerBottomProjectId,
    alignedTop, alignedBottom,
    hasInnerConnection,
  };
}

function collectGeometry(
  events: SchedulerEvent[],
  sys: GridSystem,
): Map<string, EventGeometry> {
  if (DEBUG) console.log("📐 STAGE 1: Collecting Geometry (Grid Optimized)...");
  
  const geometryMap = new Map<string, EventGeometry>();

  for (const event of events) {
    const leftNeighbors = findNeighbors(sys, event, "left", { sameProject: true });
    const rightNeighbors = findNeighbors(sys, event, "right", { sameProject: true });
    
    const leftOtherProject = findNeighbors(sys, event, "left", { differentProject: true });
    const rightOtherProject = findNeighbors(sys, event, "right", { differentProject: true });

    const leftGeometry = analyzeSideGeometry(event, leftNeighbors);
    const rightGeometry = analyzeSideGeometry(event, rightNeighbors);

    geometryMap.set(event.id, {
      event,
      left: { ...leftGeometry, neighbors: leftNeighbors, otherProjectNeighbors: leftOtherProject },
      right: { ...rightGeometry, neighbors: rightNeighbors, otherProjectNeighbors: rightOtherProject },
    });
  }

  if (DEBUG) console.log(`✅ STAGE 1 Complete: ${geometryMap.size} events analyzed`);
  return geometryMap;
}

// ============================================
// STAGE 2 IMPLEMENTATION: TOPOLOGY
// ============================================

function findVerticalStacks(
  event: SchedulerEvent,
  sys: GridSystem,
  geometryMap: Map<string, EventGeometry>,
  direction: "above" | "below",
  side: "left" | "right",
): StackPattern[] {
  const stacks: StackPattern[] = [];
  
  // Find all different-project events that touch us vertically on same weeks
  const candidateSet = new Set<SchedulerEvent>();
  const endWeek = event.startWeek + event.weeksSpan;
  
  for (let w = event.startWeek; w < endWeek; w++) {
    const eventsOnWeek = getEventsFromGrid(sys, event.resourceId, w);
    for (const e of eventsOnWeek) {
      if (e.id !== event.id && e.projectId !== event.projectId) {
        candidateSet.add(e);
      }
    }
  }
  
  const stackedEvents = Array.from(candidateSet);
  
  for (const otherEvent of stackedEvents) {
    const touching = direction === "above"
      ? getBottom(otherEvent) === getTop(event) - 1
      : getTop(otherEvent) === getBottom(event) + 1;
    
    if (!touching) continue;
    
    const [topEvent, bottomEvent] = direction === "above" 
      ? [otherEvent, event] 
      : [event, otherEvent];
    
    const topGeometry = geometryMap.get(topEvent.id);
    const bottomGeometry = geometryMap.get(bottomEvent.id);
    
    if (!topGeometry || !bottomGeometry) continue;
    
    const topSide = side === "left" ? topGeometry.left : topGeometry.right;
    const bottomSide = side === "left" ? bottomGeometry.left : bottomGeometry.right;
    
    // Determine configuration
    const topHasInnerBottom = topSide.innerBottomProjectId !== undefined;
    const topHasOuterBottom = topSide.neighbors.some(n => getBottom(n) <= getBottom(topEvent));
    
    const bottomHasInnerTop = bottomSide.innerTopProjectId !== undefined;
    const bottomHasOuterTop = bottomSide.neighbors.some(n => getTop(n) >= getTop(bottomEvent));
    
    stacks.push({
      topEvent,
      bottomEvent,
      side,
      topHasInnerBottom,
      topHasOuterBottom,
      bottomHasInnerTop,
      bottomHasOuterTop,
    });
  }
  
  return stacks;
}

function classifyTopology(
  events: SchedulerEvent[],
  sys: GridSystem,
  geometryMap: Map<string, EventGeometry>,
): Map<string, EventTopology> {
  if (DEBUG) console.log("🔍 STAGE 2: Classifying Topology...");
  
  const topologyMap = new Map<string, EventTopology>();

  for (const event of events) {
    const geometry = geometryMap.get(event.id);
    if (!geometry) continue;

    const hasHorizontalGlue = geometry.left.hasInnerConnection || geometry.right.hasInnerConnection;
    
    const stacksAboveLeft = findVerticalStacks(event, sys, geometryMap, "above", "left");
    const stacksAboveRight = findVerticalStacks(event, sys, geometryMap, "above", "right");
    const stacksBelowLeft = findVerticalStacks(event, sys, geometryMap, "below", "left");
    const stacksBelowRight = findVerticalStacks(event, sys, geometryMap, "below", "right");
    
    const stacksAbove = [...stacksAboveLeft, ...stacksAboveRight];
    const stacksBelow = [...stacksBelowLeft, ...stacksBelowRight];
    
    const hasInnerCorners = !!(
      geometry.left.innerTopProjectId ||
      geometry.left.innerBottomProjectId ||
      geometry.right.innerTopProjectId ||
      geometry.right.innerBottomProjectId
    );
    
    const hasOuterCorners = !hasInnerCorners && hasHorizontalGlue;

    topologyMap.set(event.id, {
      event,
      hasHorizontalGlue,
      stacksAbove,
      stacksBelow,
      hasInnerCorners,
      hasOuterCorners,
    });
  }

  if (DEBUG) console.log(`✅ STAGE 2 Complete: ${topologyMap.size} events classified`);
  return topologyMap;
}

// ============================================
// STAGE 3: RULES (Expansion Logic)
// ============================================

function applyExpansionRules(
  events: SchedulerEvent[],
  geometryMap: Map<string, EventGeometry>,
  topologyMap: Map<string, EventTopology>,
): Map<string, ExpansionDecision> {
  if (DEBUG) console.log("⚙️ STAGE 3: Applying Expansion Rules...");
  
  const decisions = new Map<string, ExpansionDecision>();
  
  // Initialize all with 0 expansion
  for (const event of events) {
    decisions.set(event.id, {
      event,
      expandLeft: 0,
      expandRight: 0,
      reason: "default",
    });
  }
  
  // RULE 1: Base horizontal glue expansion
  for (const event of events) {
    const geometry = geometryMap.get(event.id);
    if (!geometry) continue;
    
    const decision = decisions.get(event.id)!;
    
    if (geometry.left.hasInnerConnection) {
      decision.expandLeft = 1;
      decision.reason = "horizontal-glue-left";
      if (DEBUG) console.log(`⬅️ RULE 1: Event week=${event.startWeek} units=${event.unitStart}-${event.unitStart + event.unitsTall - 1} expandLeft=1 (${geometry.left.neighbors.length} left neighbors)`);
    }
    
    if (geometry.right.hasInnerConnection) {
      decision.expandRight = 1;
      decision.reason = "horizontal-glue-right";
      if (DEBUG) console.log(`➡️ RULE 1: Event week=${event.startWeek} units=${event.unitStart}-${event.unitStart + event.unitsTall - 1} expandRight=1 (${geometry.right.neighbors.length} right neighbors)`);
    }
  }
  
  // RULE 2: Vertical stacking rules (А/Б/В/Г)
  for (const event of events) {
    const topology = topologyMap.get(event.id);
    if (!topology) continue;
    
    // Check if we are the BOTTOM event in a stack (форма А or Г)
    for (const stack of topology.stacksAbove) {
      if (stack.bottomEvent.id !== event.id) continue;
      
      const topDecision = decisions.get(stack.topEvent.id)!;
      const bottomDecision = decisions.get(event.id)!;
      
      // Configuration: Б over А
      if (stack.topHasInnerBottom && stack.bottomHasOuterTop) {
        // Fix: If bottom event is glued (wall), do not apply roof rule.
        if (topology.hasHorizontalGlue) continue;

        if (stack.side === "left") {
          topDecision.expandLeft = Math.max(topDecision.expandLeft, 1);
          topDecision.reason = "stack-rule-B-over-A-left";
          
          // Reset neighbors of top event
          const topGeometry = geometryMap.get(stack.topEvent.id);
          if (topGeometry) {
            for (const neighbor of topGeometry.left.neighbors) {
              const neighborDecision = decisions.get(neighbor.id);
              if (neighborDecision) {
                neighborDecision.expandRight = 0;
                neighborDecision.reason = "stack-rule-B-neighbor-reset";
              }
            }
          }
        } else {
          topDecision.expandRight = Math.max(topDecision.expandRight, 1);
          topDecision.reason = "stack-rule-B-over-A-right";
          
          // Reset neighbors of top event
          const topGeometry = geometryMap.get(stack.topEvent.id);
          if (topGeometry) {
            for (const neighbor of topGeometry.right.neighbors) {
              const neighborDecision = decisions.get(neighbor.id);
              if (neighborDecision) {
                neighborDecision.expandLeft = 0;
                neighborDecision.reason = "stack-rule-B-neighbor-reset";
              }
            }
          }
        }
        
        if (DEBUG) console.log(`📐 RULE: Б ${stack.topEvent.id} over А ${event.id} (${stack.side})`);
      }
      
      // Configuration: В over Г
      if (stack.topHasOuterBottom && stack.bottomHasInnerTop) {
        if (stack.side === "left") {
          topDecision.expandLeft = 0;
          topDecision.reason = "stack-rule-V-over-G-left";
          
          // Boost neighbors of top event
          const topGeometry = geometryMap.get(stack.topEvent.id);
          if (topGeometry) {
            for (const neighbor of topGeometry.left.neighbors) {
              const neighborDecision = decisions.get(neighbor.id);
              if (neighborDecision) {
                neighborDecision.expandRight += 1;
                neighborDecision.reason = "stack-rule-V-neighbor-boost";
              }
            }
          }
        } else {
          topDecision.expandRight = 0;
          topDecision.reason = "stack-rule-V-over-G-right";
          
          // Boost neighbors of top event
          const topGeometry = geometryMap.get(stack.topEvent.id);
          if (topGeometry) {
            for (const neighbor of topGeometry.right.neighbors) {
              const neighborDecision = decisions.get(neighbor.id);
              if (neighborDecision) {
                neighborDecision.expandLeft += 1;
                neighborDecision.reason = "stack-rule-V-neighbor-boost";
              }
            }
          }
        }
        
        if (DEBUG) console.log(`📐 RULE: В ${stack.topEvent.id} over Г ${event.id} (${stack.side})`);
      }
    }
  }
  
  // RULE 3: Biting (pressure from other projects)
  for (const event of events) {
    const geometry = geometryMap.get(event.id);
    if (!geometry) continue;
    
    const decision = decisions.get(event.id)!;
    
    // LEFT: Check pressure from other projects
    if (geometry.left.neighbors.length === 0) { // No same-project neighbor
      let totalPressure = 0;
      
      for (const otherEvent of geometry.left.otherProjectNeighbors) {
        const otherDecision = decisions.get(otherEvent.id);
        if (otherDecision) {
          // Fix: Only count actual expansion as pressure.
          totalPressure += otherDecision.expandRight;
        }
      }
      
      if (totalPressure >= 2) {
        decision.expandLeft -= 1;
        decision.reason = "biting-left";
        if (DEBUG) console.log(`🔪 BITING: ${event.id} left (pressure=${totalPressure})`);
      }
    }
    
    // RIGHT: Check pressure from other projects
    if (geometry.right.neighbors.length === 0) { // No same-project neighbor
      let totalPressure = 0;
      
      for (const otherEvent of geometry.right.otherProjectNeighbors) {
        const otherDecision = decisions.get(otherEvent.id);
        if (otherDecision) {
          // Fix: Only count actual expansion as pressure.
          totalPressure += otherDecision.expandLeft;
        }
      }
      
      if (totalPressure >= 2) {
        decision.expandRight -= 1;
        decision.reason = "biting-right";
        if (DEBUG) console.log(`🔪 BITING: ${event.id} right (pressure=${totalPressure})`);
      }
    }
  }
  
  if (DEBUG) console.log(`✅ STAGE 3 Complete: ${decisions.size} expansion decisions made`);
  return decisions;
}

// ============================================
// STAGE 4: CORNER ROUNDING & FLAGS
// ============================================

function determineCornerRounding(
  event: SchedulerEvent,
  geometry: EventGeometry,
): number {
  let flags = MASK_ROUND_TL | MASK_ROUND_TR | MASK_ROUND_BL | MASK_ROUND_BR;
  
  // Left side
  const leftCoverage = geometry.left;
  if (leftCoverage.hasFull || leftCoverage.innerTopProjectId || leftCoverage.alignedTop) {
    flags &= ~MASK_ROUND_TL;
  }
  if (leftCoverage.hasFull || leftCoverage.innerBottomProjectId || leftCoverage.alignedBottom) {
    flags &= ~MASK_ROUND_BL;
  }
  
  // Right side
  const rightCoverage = geometry.right;
  if (rightCoverage.hasFull || rightCoverage.innerTopProjectId || rightCoverage.alignedTop) {
    flags &= ~MASK_ROUND_TR;
  }
  if (rightCoverage.hasFull || rightCoverage.innerBottomProjectId || rightCoverage.alignedBottom) {
    flags &= ~MASK_ROUND_BR;
  }
  
  // Coverage flags
  if (leftCoverage.hasFull) flags |= MASK_FULL_LEFT;
  if (leftCoverage.hasPartial) flags |= MASK_PARTIAL_LEFT;
  if (leftCoverage.hasBoth) flags |= MASK_BOTH_LEFT;
  
  if (rightCoverage.hasFull) flags |= MASK_FULL_RIGHT;
  if (rightCoverage.hasPartial) flags |= MASK_PARTIAL_RIGHT;
  if (rightCoverage.hasBoth) flags |= MASK_BOTH_RIGHT;
  
  return flags;
}

// ============================================
// STAGE 5: NAME HIDING
// ============================================

function determineNameHiding(
  events: SchedulerEvent[],
  geometryMap: Map<string, EventGeometry>,
  finalInfo: Map<string, EventNeighborsInfo>,
): void {
  if (DEBUG) console.log("👁️ STAGE 5: Determining Name Hiding...");
  
  // Sort events by time (resource + week) to process left-to-right
  const sortedEvents = [...events].sort((a, b) => {
    if (a.resourceId !== b.resourceId) return a.resourceId.localeCompare(b.resourceId);
    return a.startWeek - b.startWeek;
  });
  
  for (const event of sortedEvents) {
    const info = finalInfo.get(event.id);
    if (!info) continue;
    
    // Logic: If short event (<= 2 weeks) has a visible left neighbor, hide name
    if (event.weeksSpan <= 2) {
      const geometry = geometryMap.get(event.id);
      if (!geometry) continue;
      
      const leftNeighbors = geometry.left.neighbors;
      
      if (leftNeighbors.length > 0) {
        const leftNeighbor = leftNeighbors[0];
        const leftNeighborInfo = finalInfo.get(leftNeighbor.id);
        
        const leftVisible = leftNeighborInfo && !(leftNeighborInfo.flags & MASK_HIDE_NAME);
        
        if (leftVisible) {
          info.flags |= MASK_HIDE_NAME; // Hide
        } else {
          info.flags &= ~MASK_HIDE_NAME; // Show
        }
      } else {
        info.flags &= ~MASK_HIDE_NAME; // Show
      }
    } else {
      info.flags &= ~MASK_HIDE_NAME; // Show
    }
  }
  
  if (DEBUG) console.log("✅ STAGE 5 Complete: Name hiding determined");
}

// ============================================
// MAIN ALGORITHM
// ============================================

export function calculateEventNeighbors(
  inputEvents: SchedulerEvent[],
  projects: Project[], // Kept for signature compatibility
  precomputedIndex?: any // Deprecated: Grid is built internally
): Map<string, EventNeighborsInfo> {
  if (DEBUG) console.log("🚀 calculateEventNeighbors v9.0 (Grid Optimized)");

  const events = [...inputEvents].sort((a, b) => {
    if (a.resourceId !== b.resourceId) return a.resourceId.localeCompare(b.resourceId);
    return a.startWeek - b.startWeek;
  });

  // STAGE 0: Build Grid System (O(N) Rasterization)
  const gridSystem = buildGridSystem(events);
  
  // STAGE 1: Collect geometric facts (O(1) lookup per side)
  const geometryMap = collectGeometry(events, gridSystem);
  
  // STAGE 2: Classify topology patterns
  const topologyMap = classifyTopology(events, gridSystem, geometryMap);
  
  // STAGE 3: Apply expansion rules
  const expansionDecisions = applyExpansionRules(events, geometryMap, topologyMap);
  
  // STAGE 4: Build final result with corner rounding
  const finalInfo = new Map<string, EventNeighborsInfo>();
  
  for (const event of events) {
    const geometry = geometryMap.get(event.id);
    const decision = expansionDecisions.get(event.id);
    
    if (!geometry || !decision) continue;
    
    const flags = determineCornerRounding(event, geometry);
    
    finalInfo.set(event.id, {
      flags,
      expandLeftMultiplier: decision.expandLeft,
      expandRightMultiplier: decision.expandRight,
      innerTopLeftProjectId: geometry.left.innerTopProjectId,
      innerBottomLeftProjectId: geometry.left.innerBottomProjectId,
      innerTopRightProjectId: geometry.right.innerTopProjectId,
      innerBottomRightProjectId: geometry.right.innerBottomProjectId,
    });
  }
  
  // STAGE 5: Determine name hiding
  determineNameHiding(events, geometryMap, finalInfo);

  if (DEBUG) console.log("✅ v9.0 Finished! Results:", finalInfo.size);

  return finalInfo;
}