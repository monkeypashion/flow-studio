# REFACTOR REMINDER: Move to Absolute-Only Timestamp Storage

## Current State (Hybrid Approach)

**Date Implemented**: 2025-10-12

The codebase currently uses a **hybrid approach** for clip time storage:

- **Relative seconds** (`timeRange: { start: number, end: number }`) - Used for all calculations and rendering
- **Absolute timestamps** (`absoluteStartTime?: string, absoluteEndTime?: string`) - Optional fields that maintain time identity

### Why This Hybrid Approach Exists

This is a **temporary solution** to solve the clip time identity problem without requiring a massive refactor of the drag/drop/snap/resize logic in Clip.tsx.

**Problem Solved**:
- When the user changes the timeline date range (e.g., from Oct 12 to Oct 13), clips maintain their absolute time identity
- A clip at "Oct 12, 01:00-02:00" will correctly recalculate its relative position when the timeline changes to Oct 13
- The clip may go offscreen (negative relative seconds) but won't incorrectly "slide" to a different absolute time

**Trade-offs**:
- ✅ Low risk - only 3-4 functions modified
- ✅ Zero changes to complex drag/drop logic
- ✅ Solves the immediate problem
- ❌ Redundant storage (both formats stored)
- ❌ Not the cleanest architecture
- ❌ Requires conversions between formats

## Files Modified

### 1. `src/types/index.ts`
Added optional absolute timestamp fields to Clip interface:
```typescript
absoluteStartTime?: string; // ISO 8601 timestamp
absoluteEndTime?: string;   // ISO 8601 timestamp
```

### 2. `src/store/appStore.ts`
**Import added**:
```typescript
import { toAbsoluteTimestamp, toRelativeSeconds } from '../utils/timeConversion';
```

**Modified functions**:
- `addClip()` - Populates `absoluteStartTime` and `absoluteEndTime` when creating clips
- `setTimelineRange()` - Recalculates clip positions from absolute timestamps when date range changes
- `copyClip()` and `duplicateClip()` - Automatically inherit behavior from `addClip()`

### 3. `src/App.tsx`
Updated demo clips to use `getAllTracks()` and more realistic time positions

### 4. `src/utils/timeConversion.ts`
Helper functions for converting between absolute and relative time (already existed)

## Future Refactor Plan

### Goal: Move to Absolute-Only Storage

**Target**: Remove `timeRange: { start: number, end: number }` and use only absolute timestamps

**Benefits**:
- Single source of truth for time
- No redundant storage
- Cleaner architecture
- No risk of desync between relative and absolute

**Scope**: ~30+ locations in Clip.tsx plus all timeline components

### Estimated Effort: 6-8 hours

### Key Files to Refactor

1. **`src/types/index.ts`**
   - Change `TimeRange` interface to use ISO strings instead of numbers
   - Make `absoluteStartTime`/`absoluteEndTime` mandatory, remove optional `?`

2. **`src/components/Clip/Clip.tsx`** (Largest change - 30+ uses of timeRange)
   - Update all drag/drop logic to work with absolute timestamps
   - Update resize logic to calculate new absolute timestamps
   - Update snap logic to convert snapped positions to absolute timestamps
   - Update all coordinate calculations to use conversion helpers

3. **`src/store/appStore.ts`**
   - Update all clip operations (move, copy, paste, etc.)
   - Remove the hybrid conversion logic from `setTimelineRange()`
   - Update all functions that read/write timeRange

4. **`src/components/Timeline/Timeline.tsx`**
   - Update timeline markers and ruler logic
   - Update any coordinate → time calculations

5. **`src/components/Inspector/Inspector.tsx`**
   - Already updated to show absolute timestamps
   - Remove conversion logic once TimeRange uses strings

6. **`src/components/SelectionOverlay/SelectionOverlay.tsx`**
   - Update selection rectangle calculations if needed

### Testing Strategy

When performing the full refactor:

1. **Unit test** time conversion utilities thoroughly
2. **Manual test** all clip operations:
   - Create clips (drag to create)
   - Move clips (drag horizontally)
   - Resize clips (drag left/right edges)
   - Copy/paste clips
   - Multi-select operations
   - Date range changes (the original bug)
3. **Performance test** with 100+ clips to ensure conversions don't impact rendering
4. **Regression test** all snap-to-grid functionality

### Migration Strategy

**Option A: Clean break** (Recommended)
- Create new branch
- Change TimeRange interface to use strings
- Fix all TypeScript errors systematically
- Test thoroughly before merging

**Option B: Gradual migration**
- Add new fields with different names (e.g., `absoluteTimeRange`)
- Migrate components one by one
- Remove old fields once all components migrated
- Higher risk of bugs during transition

### When to Refactor

**Triggers for refactor**:
- When adding complex time-based features (e.g., time stretching, time warping)
- When performance issues arise from dual format conversions
- When the hybrid approach causes bugs or confusion
- During a planned architecture improvement sprint

**Don't refactor if**:
- The hybrid approach is working fine
- There's pressure to deliver new features quickly
- No one is touching the clip time logic

## Current Implementation Notes

### How Absolute Timestamps Are Calculated

In `appStore.ts` `addClip()`:
```typescript
const absoluteStartTime = toAbsoluteTimestamp(clipData.timeRange.start, startTime);
const absoluteEndTime = toAbsoluteTimestamp(clipData.timeRange.end, startTime);
```

### How Clips Maintain Position Across Date Changes

In `appStore.ts` `setTimelineRange()`:
```typescript
if (clip.absoluteStartTime && clip.absoluteEndTime) {
  const newRelativeStart = toRelativeSeconds(clip.absoluteStartTime, startTime);
  const newRelativeEnd = toRelativeSeconds(clip.absoluteEndTime, startTime);

  return {
    ...clip,
    timeRange: {
      start: newRelativeStart,
      end: newRelativeEnd,
    },
  };
}
```

### Edge Cases Handled

1. **Clips without absolute timestamps** - Old clips or clips created before this change will keep their relative positions (backward compatibility)
2. **Negative relative positions** - Clips with absolute times before the timeline start will have negative `timeRange.start` values and may go offscreen (this is correct behavior)
3. **Clips beyond timeline end** - Clips can extend past `timeline.duration` if their absolute time is after the timeline end (also correct)

## Questions for Future Implementer

- Should we add UI indicators for offscreen clips?
- Should the date picker automatically expand to include all clip times?
- How should we handle very old clips (years before timeline start)?
- Should we add a "fit all clips in view" button?

## References

- Original issue discussion: See conversation summary from 2025-10-12
- TimeRange interface: `src/types/index.ts:15-18`
- Conversion utilities: `src/utils/timeConversion.ts`
- Main clip component: `src/components/Clip/Clip.tsx`

---

**Remember**: This hybrid approach is a pragmatic solution. When the time comes for full refactor, allocate proper time and test thoroughly. The current implementation works correctly but isn't the final architecture.
