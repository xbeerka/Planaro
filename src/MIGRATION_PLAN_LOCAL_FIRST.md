# Migration Plan v4.1.0: Local-First Architecture

## 🎯 Goal
Transition from "Optimistic UI + Immediate Consistency" to a true **Local-First Architecture**. 
This ensures that UI operations (Undo/Redo, Drag, Resize) are instantaneous and never blocked by network latency or race conditions. Changes are synchronized to the server in the background using a robust Sync Queue.

## 🏗 Architecture

### 1. State Management (The Source of Truth)
*   **Current**: `SchedulerContext` holds `events`, `SchedulerMain` holds `useHistory`.
*   **New**: `SchedulerContext` holds **BOTH** `events` and `History`.
*   **Principle**: The UI always renders from the local `events` state. Undo/Redo operates purely on this local state.

### 2. Sync Manager (The Background Worker)
*   A new hook `useSyncManager` replaces `useDebouncedSave`.
*   **Responsibility**:
    *   Queue operations (`create`, `update`, `delete`).
    *   Deduplicate changes (e.g., 10 moves of the same event = 1 update).
    *   Flush changes to server periodically (2-4s debounce).
    *   Handle network errors (Retry logic).
    *   **Smart Filter**: Knows which events are "dirty" (unsynced).

### 3. Smart Polling (Delta Sync)
*   **Problem**: Server overwrites local changes during polling.
*   **Solution**: Delta Sync checks `SyncManager`. If an event is in the Sync Queue (dirty), incoming server updates for that event are **IGNORED**.

### 4. Undo/Redo Integration
*   **Action**: User clicks Undo.
*   **Logic**:
    1.  Revert Local State (`events`).
    2.  Calculate Diff (Which events changed?).
    3.  Update Sync Queue:
        *   If event change is still in queue -> Remove it (Cancel operation).
        *   If event change is already sent -> Add inverse operation (e.g., Update back to old position).

## 📝 Implementation Steps

### Step 1: Create `useSyncManager`
*   Advanced version of `useDebouncedSave`.
*   Supports `queueChange`, `cancelChange`, `isDirty(id)`.
*   Handles the API `batch` call internally.

### Step 2: Move History to Context
*   Integrate `useOptimisticHistory` into `SchedulerContext`.
*   Expose `undo()` and `redo()` directly from Context.
*   Remove `useHistory` from `SchedulerMain`.

### Step 3: Refactor Operations
*   Update `createEvent`, `updateEvent`, `deleteEvent` in `SchedulerContext`.
*   **Flow**:
    1.  `setEvents(newEvents)` (Immediate UI update).
    2.  `history.pushState(...)` (Save snapshot).
    3.  `syncManager.queueChange(...)` (Schedule sync).

### Step 4: Update SchedulerMain
*   Simplify the component. It should just render `events` and bind handlers.
*   Remove all complex sync/history logic from the view layer.

## 🛡 Safety Mechanisms
*   **beforeunload**: Warn user if Sync Queue is not empty when closing tab.
*   **Max Queue Size**: Force flush if queue gets too large (>50 changes).
*   **Error Handling**: Toast notification if Sync fails after retries.

## 🚀 Benefits
*   **Zero Latency**: Drag & Drop and Undo/Redo are 60fps.
*   **No Race Conditions**: History doesn't depend on Server IDs.
*   **Offline-Ready**: Theoretically works offline (changes sync when online).
