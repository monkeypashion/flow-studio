import { create } from 'zustand';
import type {
  Group,
  Aspect,
  Track,
  Clip,
  Selection,
  ClipboardData,
  TimelineState,
  Job,
  ClipState,
  TimeRange,
  DragState,
  DataType
} from '../types/index';
import { mockBackend } from '../services/mockBackend';
import { toAbsoluteTimestamp, toRelativeSeconds } from '../utils/timeConversion';

interface AppStore {
  // Groups (Assets)
  groups: Group[];
  addGroup: (name?: string, assetId?: string) => string;
  removeGroup: (groupId: string) => void;
  updateGroup: (groupId: string, updates: Partial<Group>) => void;
  toggleGroupExpanded: (groupId: string) => void;
  toggleGroupVisible: (groupId: string) => void;

  // Aspects (within groups)
  addAspect: (groupId: string, name?: string, aspectType?: string) => string;
  removeAspect: (aspectId: string) => void;
  updateAspect: (aspectId: string, updates: Partial<Aspect>) => void;
  toggleAspectExpanded: (aspectId: string) => void;
  toggleAspectVisible: (aspectId: string) => void;

  // Tracks (Properties within aspects)
  tracks: Track[]; // Flat list for backward compatibility
  addTrack: (aspectId: string, name?: string, property?: string) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  toggleTrackVisible: (trackId: string) => void;
  reorderTracks: (aspectId: string, fromIndex: number, toIndex: number) => void;

  // Clips
  addClip: (trackId: string, clip: Omit<Clip, 'id'>) => string;
  removeClip: (clipId: string) => void;
  removeSelectedClips: () => void;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  moveClip: (clipId: string, targetTrackId: string, newTimeRange: TimeRange) => void;
  moveSelectedClips: (deltaTime: number, targetTrackId?: string, originalPositions?: Array<{ id: string; start: number; end: number }>) => void;
  copyClip: (clipId: string, targetTrackId: string, newTimeRange: TimeRange) => string;
  copySelectedClips: (targetStartTime: number, targetTrackId?: string) => void;
  duplicateClip: (clipId: string) => string;

  // Selection
  selection: Selection;
  selectClip: (clipId: string, multi?: boolean, range?: boolean) => void;
  deselectClip: (clipId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectTrackClips: (trackId: string) => void;
  selectClipRange: (fromClipId: string, toClipId: string) => void;

  // Clipboard
  clipboard: ClipboardData | null;
  copySelection: () => void;
  paste: (trackId: string, time: number) => void;
  cut: () => void;

  // Timeline
  timeline: TimelineState;
  setZoom: (zoom: number) => void;
  setScroll: (x: number, y: number) => void;
  setPlayhead: (position: number) => void;
  toggleGridSnap: () => void;
  setTimelineRange: (startTime: string, duration: number) => void;

  // Navigator viewport
  setViewport: (start: number, duration: number) => void;
  panViewport: (deltaSeconds: number) => void;
  zoomViewport: (newDuration: number, centerTime?: number) => void;

  // UI panels visibility
  inspectorVisible: boolean;
  jobQueueVisible: boolean;
  toggleInspector: () => void;
  toggleJobQueue: () => void;

  // Jobs
  jobs: Job[];
  addJob: (job: Job) => void;
  updateJob: (jobId: string, updates: Partial<Job>) => void;
  removeJob: (jobId: string) => void;
  clearCompletedJobs: () => void;

  // Drag state
  dragState: DragState;
  setDragState: (state: Partial<DragState>) => void;

  // Ghost clip state (for copy preview) - supports multiple ghosts for multi-select
  ghostClips: Array<{
    clipId: string;
    left: number;
    width: number;
    top: number;
    isIncompatible: boolean;
  }>;
  setGhostClips: (ghosts: AppStore['ghostClips']) => void;

  // Snap indicator (shows vertical line when clips align)
  snapIndicatorPosition: number | null; // Time position in seconds
  setSnapIndicator: (position: number | null) => void;

  // Progress handling
  handleProgress: (clipId: string, progress: number, state: ClipState) => void;

  // Utility
  getClip: (clipId: string) => Clip | undefined;
  getTrack: (trackId: string) => Track | undefined;
  getAspect: (aspectId: string) => Aspect | undefined;
  getGroup: (groupId: string) => Group | undefined;
  getSelectedClips: () => Clip[];
  getAllTracks: () => Track[]; // Get all tracks from all aspects in all groups
}

const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  groups: [
    {
      id: 'group_1',
      name: 'Conveyor',
      assetId: 'a70b1afa834c452cbabfc40f2f0aae3e',
      expanded: true,
      visible: true,
      index: 0,
      aspects: [
        {
          id: 'aspect_1',
          groupId: 'group_1',
          name: 'OEE_Data',
          aspectType: 'dynamic',
          expanded: true,
          visible: true,
          index: 0,
          tracks: [
            {
              id: 'track_1',
              aspectId: 'aspect_1',
              name: 'GoodParts',
              property: 'GoodParts',
              unit: 'count',
              dataType: 'Long' as DataType,
              index: 0,
              muted: false,
              locked: false,
              visible: true,
              height: 80,
              clips: [],
            },
            {
              id: 'track_2',
              aspectId: 'aspect_1',
              name: 'BadParts',
              property: 'BadParts',
              unit: 'count',
              dataType: 'Long' as DataType,
              index: 1,
              muted: false,
              locked: false,
              visible: true,
              height: 80,
              clips: [],
            },
            {
              id: 'track_3',
              aspectId: 'aspect_1',
              name: 'OrderID',
              property: 'OrderID',
              unit: undefined,
              dataType: 'String' as DataType,
              index: 2,
              muted: false,
              locked: false,
              visible: true,
              height: 80,
              clips: [],
            },
            {
              id: 'track_4',
              aspectId: 'aspect_1',
              name: 'ProductCode',
              property: 'ProductCode',
              unit: undefined,
              dataType: 'String' as DataType,
              index: 3,
              muted: false,
              locked: false,
              visible: true,
              height: 80,
              clips: [],
            },
            {
              id: 'track_5',
              aspectId: 'aspect_1',
              name: 'Status',
              property: 'Status',
              unit: undefined,
              dataType: 'String' as DataType,
              index: 4,
              muted: false,
              locked: false,
              visible: true,
              height: 80,
              clips: [],
            },
          ],
        },
        {
          id: 'aspect_2',
          groupId: 'group_1',
          name: 'OEE_KPIs',
          aspectType: 'dynamic',
          expanded: true,
          visible: true,
          index: 1,
          tracks: [
            {
              id: 'track_6',
              aspectId: 'aspect_2',
              name: 'Availability',
              property: 'Availability',
              unit: '%',
              dataType: 'Double' as DataType,
              index: 0,
              muted: false,
              locked: false,
              visible: true,
              height: 80,
              clips: [],
            },
            {
              id: 'track_7',
              aspectId: 'aspect_2',
              name: 'Performance',
              property: 'Performance',
              unit: '%',
              dataType: 'Double' as DataType,
              index: 1,
              muted: false,
              locked: false,
              visible: true,
              height: 80,
              clips: [],
            },
            {
              id: 'track_8',
              aspectId: 'aspect_2',
              name: 'Quality',
              property: 'Quality',
              unit: '%',
              dataType: 'Double' as DataType,
              index: 2,
              muted: false,
              locked: false,
              visible: true,
              height: 80,
              clips: [],
            },
            {
              id: 'track_9',
              aspectId: 'aspect_2',
              name: 'OEE',
              property: 'OEE',
              unit: '%',
              dataType: 'Double' as DataType,
              index: 3,
              muted: false,
              locked: false,
              visible: true,
              height: 80,
              clips: [],
            },
          ],
        },
        {
          id: 'aspect_3',
          groupId: 'group_1',
          name: 'Electric_Motor_Data',
          aspectType: 'dynamic',
          expanded: true,
          visible: true,
          index: 2,
          tracks: [
            {
              id: 'track_10',
              aspectId: 'aspect_3',
              name: 'Speed_RPM',
              property: 'Speed_RPM',
              unit: 'rpm',
              dataType: 'Double' as DataType,
              index: 0,
              muted: false,
              locked: false,
              visible: true,
              height: 80,
              clips: [],
            },
            {
              id: 'track_11',
              aspectId: 'aspect_3',
              name: 'Torque',
              property: 'Torque',
              unit: 'Nm',
              dataType: 'Double' as DataType,
              index: 1,
              muted: false,
              locked: false,
              visible: true,
              height: 80,
              clips: [],
            },
            {
              id: 'track_12',
              aspectId: 'aspect_3',
              name: 'Temperature',
              property: 'Temperature',
              unit: '°C',
              dataType: 'Double' as DataType,
              index: 2,
              muted: false,
              locked: false,
              visible: true,
              height: 80,
              clips: [],
            },
            {
              id: 'track_13',
              aspectId: 'aspect_3',
              name: 'Running_Hours',
              property: 'Running_Hours',
              unit: 'hours',
              dataType: 'Double' as DataType,
              index: 3,
              muted: false,
              locked: false,
              visible: true,
              height: 80,
              clips: [],
            },
            {
              id: 'track_14',
              aspectId: 'aspect_3',
              name: 'Bearing_Fault_Detection',
              property: 'Bearing_Fault_Detection',
              unit: undefined,
              dataType: 'Boolean' as DataType,
              index: 4,
              muted: false,
              locked: false,
              visible: true,
              height: 80,
              clips: [],
            },
          ],
        },
      ],
    },
  ],

  // Backward compatibility - flat track list
  tracks: [],

  selection: {
    clipIds: new Set(),
    lastSelectedClipId: undefined,
  },

  clipboard: null,

  timeline: {
    zoom: 50, // pixels per second
    scrollX: 0,
    scrollY: 0,
    duration: 86400, // 24 hours (full day) - total duration from date picker
    playheadPosition: 0,
    gridSnap: true,
    snapInterval: 1,
    startTime: (() => {
      // Default to today at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today.toISOString();
    })(),

    // Navigator viewport - initially show entire duration
    viewportStart: 0,
    viewportDuration: 86400, // Same as duration initially (show everything - full 24 hours)
  },

  jobs: [],

  dragState: {
    isDragging: false,
    dragType: null,
    startPosition: { x: 0, y: 0 },
    startTimeRange: { start: 0, end: 0 },
    currentPosition: { x: 0, y: 0 },
  },

  ghostClips: [],

  snapIndicatorPosition: null,

  // UI panels visibility
  inspectorVisible: true,
  jobQueueVisible: true,

  // Group methods
  addGroup: (name, assetId) => {
    const groupId = `group_${generateId()}`;
    set((state) => ({
      groups: [...state.groups, {
        id: groupId,
        name: name || `Asset ${state.groups.length + 1}`,
        assetId: assetId,
        expanded: true,
        visible: true,
        index: state.groups.length,
        aspects: [],
      }],
    }));
    return groupId;
  },

  removeGroup: (groupId) => set((state) => ({
    groups: state.groups.filter(g => g.id !== groupId),
  })),

  updateGroup: (groupId, updates) => set((state) => ({
    groups: state.groups.map(g =>
      g.id === groupId ? { ...g, ...updates } : g
    ),
  })),

  toggleGroupExpanded: (groupId) => set((state) => ({
    groups: state.groups.map(g =>
      g.id === groupId ? { ...g, expanded: !g.expanded } : g
    ),
  })),

  toggleGroupVisible: (groupId) => set((state) => ({
    groups: state.groups.map(g =>
      g.id === groupId ? { ...g, visible: !g.visible } : g
    ),
  })),

  // Aspect methods
  addAspect: (groupId, name, aspectType) => {
    const aspectId = `aspect_${generateId()}`;
    set((state) => {
      const group = state.groups.find(g => g.id === groupId);
      if (!group) return state;

      const newAspect: Aspect = {
        id: aspectId,
        groupId,
        name: name || `Aspect ${group.aspects.length + 1}`,
        aspectType,
        expanded: true,
        visible: true,
        index: group.aspects.length,
        tracks: [],
      };

      return {
        groups: state.groups.map(g =>
          g.id === groupId
            ? { ...g, aspects: [...g.aspects, newAspect] }
            : g
        ),
      };
    });
    return aspectId;
  },

  removeAspect: (aspectId) => set((state) => ({
    groups: state.groups.map(g => ({
      ...g,
      aspects: g.aspects.filter(a => a.id !== aspectId)
        .map((a, i) => ({ ...a, index: i })), // Re-index after removal
    })),
  })),

  updateAspect: (aspectId, updates) => set((state) => ({
    groups: state.groups.map(g => ({
      ...g,
      aspects: g.aspects.map(a =>
        a.id === aspectId ? { ...a, ...updates } : a
      ),
    })),
  })),

  toggleAspectExpanded: (aspectId) => set((state) => ({
    groups: state.groups.map(g => ({
      ...g,
      aspects: g.aspects.map(a =>
        a.id === aspectId ? { ...a, expanded: !a.expanded } : a
      ),
    })),
  })),

  toggleAspectVisible: (aspectId) => set((state) => ({
    groups: state.groups.map(g => ({
      ...g,
      aspects: g.aspects.map(a =>
        a.id === aspectId ? { ...a, visible: !a.visible } : a
      ),
    })),
  })),

  // Track methods (now working within aspects)
  addTrack: (aspectId, name, property) => set((state) => {
    let aspectFound = false;
    const newGroups = state.groups.map(g => ({
      ...g,
      aspects: g.aspects.map(a => {
        if (a.id === aspectId) {
          aspectFound = true;
          const newTrack: Track = {
            id: `track_${generateId()}`,
            aspectId,
            name: name || `Property ${a.tracks.length + 1}`,
            property,
            index: a.tracks.length,
            muted: false,
            locked: false,
            visible: true,
            height: 80,
            clips: [],
          };
          return { ...a, tracks: [...a.tracks, newTrack] };
        }
        return a;
      }),
    }));

    return aspectFound ? { groups: newGroups } : state;
  }),

  removeTrack: (trackId) => set((state) => ({
    groups: state.groups.map(g => ({
      ...g,
      aspects: g.aspects.map(a => ({
        ...a,
        tracks: a.tracks.filter(t => t.id !== trackId)
          .map((t, i) => ({ ...t, index: i })), // Re-index after removal
      })),
    })),
  })),

  updateTrack: (trackId, updates) => set((state) => ({
    groups: state.groups.map(g => ({
      ...g,
      aspects: g.aspects.map(a => ({
        ...a,
        tracks: a.tracks.map(t =>
          t.id === trackId ? { ...t, ...updates } : t
        ),
      })),
    })),
  })),

  toggleTrackVisible: (trackId) => set((state) => ({
    groups: state.groups.map(g => ({
      ...g,
      aspects: g.aspects.map(a => ({
        ...a,
        tracks: a.tracks.map(t =>
          t.id === trackId ? { ...t, visible: !t.visible } : t
        ),
      })),
    })),
  })),

  reorderTracks: (aspectId, fromIndex, toIndex) => set((state) => ({
    groups: state.groups.map(g => ({
      ...g,
      aspects: g.aspects.map(a => {
        if (a.id !== aspectId) return a;

        const newTracks = [...a.tracks];
        const [movedTrack] = newTracks.splice(fromIndex, 1);
        newTracks.splice(toIndex, 0, movedTrack);

        return {
          ...a,
          tracks: newTracks.map((t, i) => ({ ...t, index: i })),
        };
      }),
    })),
  })),

  // Clip methods
  addClip: (trackId, clipData) => {
    const clipId = `clip_${generateId()}`;

    // Get the track to inherit its unit and data type
    const track = get().getTrack(trackId);

    // Get timeline state for absolute timestamp calculation
    const { startTime } = get().timeline;

    // Calculate absolute timestamps from relative timeRange
    // TODO: Hybrid approach - for future refactor, move to absolute-only storage
    const absoluteStartTime = toAbsoluteTimestamp(clipData.timeRange.start, startTime);
    const absoluteEndTime = toAbsoluteTimestamp(clipData.timeRange.end, startTime);

    const newClip: Clip = {
      ...clipData,
      id: clipId,
      trackId,
      unit: track?.unit, // Inherit unit from track
      dataType: track?.dataType, // Inherit data type from track
      state: clipData.state || 'idle',
      progress: clipData.progress || 0,
      selected: false,
      absoluteStartTime, // Store absolute time identity
      absoluteEndTime,   // Store absolute time identity
    };

    set((state) => ({
      groups: state.groups.map(group => ({
        ...group,
        aspects: group.aspects.map(aspect => ({
          ...aspect,
          tracks: aspect.tracks.map(track =>
            track.id === trackId
              ? { ...track, clips: [...track.clips, newClip] }
              : track
          ),
        })),
      })),
    }));

    // Start mock upload
    if (newClip.state === 'idle') {
      mockBackend.uploadClip(clipId, newClip.name);
    }

    return clipId;
  },

  removeClip: (clipId) => set((state) => ({
    groups: state.groups.map(group => ({
      ...group,
      aspects: group.aspects.map(aspect => ({
        ...aspect,
        tracks: aspect.tracks.map(track => ({
          ...track,
          clips: track.clips.filter(c => c.id !== clipId),
        })),
      })),
    })),
    selection: {
      ...state.selection,
      clipIds: new Set([...state.selection.clipIds].filter(id => id !== clipId)),
    },
  })),

  updateClip: (clipId, updates) => set((state) => ({
    groups: state.groups.map(group => ({
      ...group,
      aspects: group.aspects.map(aspect => ({
        ...aspect,
        tracks: aspect.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip =>
            clip.id === clipId ? { ...clip, ...updates } : clip
          ),
        })),
      })),
    })),
  })),

  moveClip: (clipId, targetTrackId, newTimeRange) => set((state) => {
    // Find the clip to move
    let clipToMove: Clip | undefined;
    let sourceTrackId: string | undefined;
    let sourceTrack: Track | undefined;

    for (const group of state.groups) {
      for (const aspect of group.aspects) {
        for (const track of aspect.tracks) {
          const clip = track.clips.find(c => c.id === clipId);
          if (clip) {
            clipToMove = clip;
            sourceTrackId = track.id;
            sourceTrack = track;
            break;
          }
        }
        if (clipToMove) break;
      }
      if (clipToMove) break;
    }

    if (!clipToMove || !sourceTrackId || !sourceTrack) {
      return state;
    }

    // Find target track to check unit compatibility
    let targetTrack: Track | undefined;
    for (const group of state.groups) {
      for (const aspect of group.aspects) {
        const track = aspect.tracks.find(t => t.id === targetTrackId);
        if (track) {
          targetTrack = track;
          break;
        }
      }
      if (targetTrack) break;
    }

    if (!targetTrack) {
      return state;
    }

    // Check unit and data type compatibility - prevent move if they don't match
    if (sourceTrack.unit !== targetTrack.unit) {
      console.warn(`Cannot move clip: unit mismatch (${sourceTrack.unit} → ${targetTrack.unit})`);
      return state; // Don't allow the move
    }

    if (sourceTrack.dataType !== targetTrack.dataType) {
      console.warn(`Cannot move clip: data type mismatch (${sourceTrack.dataType} → ${targetTrack.dataType})`);
      return state; // Don't allow the move
    }

    // Don't do anything if moving to the same track (just update position instead)
    if (sourceTrackId === targetTrackId) {
      return {
        groups: state.groups.map(group => ({
          ...group,
          aspects: group.aspects.map(aspect => ({
            ...aspect,
            tracks: aspect.tracks.map(track =>
              track.id === targetTrackId
                ? {
                    ...track,
                    clips: track.clips.map(c =>
                      c.id === clipId
                        ? { ...c, timeRange: newTimeRange }
                        : c
                    ),
                  }
                : track
            ),
          })),
        })),
      };
    }

    // Create updated clip with new track and time
    const movedClip: Clip = {
      ...clipToMove,
      trackId: targetTrackId,
      timeRange: newTimeRange,
    };

    // Update groups/aspects/tracks: remove from source, add to target
    return {
      groups: state.groups.map(group => ({
        ...group,
        aspects: group.aspects.map(aspect => ({
          ...aspect,
          tracks: aspect.tracks.map(track => {
            if (track.id === sourceTrackId) {
              // Remove from source track
              return {
                ...track,
                clips: track.clips.filter(c => c.id !== clipId),
              };
            } else if (track.id === targetTrackId) {
              // Add to target track
              return {
                ...track,
                clips: [...track.clips, movedClip],
              };
            }
            // Other tracks remain unchanged
            return track;
          }),
        })),
      })),
    };
  }),

  copyClip: (clipId, targetTrackId, newTimeRange) => {
    const clip = get().getClip(clipId);
    if (!clip) return '';

    // Get source and target tracks to check unit compatibility
    const sourceTrack = get().getTrack(clip.trackId);
    const targetTrack = get().getTrack(targetTrackId);

    if (!sourceTrack || !targetTrack) return '';

    // Check unit and data type compatibility - prevent copy if they don't match
    if (sourceTrack.unit !== targetTrack.unit) {
      console.warn(`Cannot copy clip: unit mismatch (${sourceTrack.unit} → ${targetTrack.unit})`);
      return ''; // Don't allow the copy
    }

    if (sourceTrack.dataType !== targetTrack.dataType) {
      console.warn(`Cannot copy clip: data type mismatch (${sourceTrack.dataType} → ${targetTrack.dataType})`);
      return ''; // Don't allow the copy
    }

    const newClipId = get().addClip(targetTrackId, {
      ...clip,
      name: `${clip.name} (Copy)`,
      timeRange: newTimeRange,
    });

    return newClipId;
  },

  duplicateClip: (clipId) => {
    const clip = get().getClip(clipId);
    if (!clip) return '';

    const newClipId = get().addClip(clip.trackId, {
      ...clip,
      name: `${clip.name} (Copy)`,
      timeRange: {
        start: clip.timeRange.end + 1,
        end: clip.timeRange.end + (clip.timeRange.end - clip.timeRange.start) + 1,
      },
    });

    return newClipId;
  },

  // Multi-clip operations
  removeSelectedClips: () => {
    const selectedIds = [...get().selection.clipIds];
    selectedIds.forEach(id => get().removeClip(id));
  },

  moveSelectedClips: (deltaTime, targetTrackId, originalPositions) => {
    const selectedClips = get().getSelectedClips();
    if (selectedClips.length === 0) return;

    // If moving to a different track, check compatibility for all clips
    if (targetTrackId) {
      const targetTrack = get().getTrack(targetTrackId);
      if (!targetTrack) return;

      // Check if all clips can be moved to target track
      for (const clip of selectedClips) {
        const sourceTrack = get().getTrack(clip.trackId);
        if (!sourceTrack) continue;

        // Check compatibility
        if (sourceTrack.unit !== targetTrack.unit ||
            sourceTrack.dataType !== targetTrack.dataType) {
          console.warn(`Cannot move all clips: unit/data type mismatch`);
          return; // Cancel the entire operation if any clip is incompatible
        }
      }
    }

    // Move each selected clip based on its ORIGINAL position
    selectedClips.forEach(clip => {
      // Find the original position for this clip
      const originalPos = originalPositions?.find(p => p.id === clip.id);
      if (!originalPos) return;

      // Calculate new position from original + delta
      const newTimeRange = {
        start: Math.max(0, originalPos.start + deltaTime),
        end: Math.max(0, originalPos.end + deltaTime),
      };

      if (targetTrackId && targetTrackId !== clip.trackId) {
        // Move to different track
        get().moveClip(clip.id, targetTrackId, newTimeRange);
      } else {
        // Just update time on same track
        get().updateClip(clip.id, { timeRange: newTimeRange });
      }
    });
  },

  copySelectedClips: (targetStartTime, targetTrackId) => {
    const selectedClips = get().getSelectedClips();
    if (selectedClips.length === 0) return;

    // Sort clips by start time to maintain relative positions
    const sortedClips = [...selectedClips].sort((a, b) =>
      a.timeRange.start - b.timeRange.start
    );

    // Find the earliest clip to use as reference
    const minStart = sortedClips[0].timeRange.start;

    // Copy each selected clip, maintaining relative offsets from the first clip
    sortedClips.forEach(clip => {
      const relativeOffset = clip.timeRange.start - minStart;
      const duration = clip.timeRange.end - clip.timeRange.start;

      const newTimeRange = {
        start: Math.max(0, targetStartTime + relativeOffset),
        end: Math.max(0, targetStartTime + relativeOffset + duration),
      };

      // IMPORTANT: When copying multiple clips from different tracks,
      // keep each clip on its ORIGINAL track (ignore targetTrackId)
      // Only use targetTrackId if all clips are from the same track
      const allOnSameTrack = selectedClips.every(c => c.trackId === selectedClips[0].trackId);
      const destTrackId = (allOnSameTrack && targetTrackId) ? targetTrackId : clip.trackId;

      get().copyClip(clip.id, destTrackId, newTimeRange);
    });
  },

  // Selection methods
  selectClip: (clipId, multi = false, range = false) => {
    // Handle range selection (shift-click)
    if (range) {
      const lastSelectedId = get().selection.lastSelectedClipId;
      if (lastSelectedId && lastSelectedId !== clipId) {
        get().selectClipRange(lastSelectedId, clipId);
        return;
      }
      // If no last selection or clicking same clip, fall through to normal selection
    }

    set((state) => {
      const newSelection = multi
        ? new Set(state.selection.clipIds).add(clipId)
        : new Set([clipId]);

      return {
        selection: {
          ...state.selection,
          clipIds: newSelection,
          lastSelectedClipId: clipId, // Update anchor point
        },
        groups: state.groups.map(group => ({
          ...group,
          aspects: group.aspects.map(aspect => ({
            ...aspect,
            tracks: aspect.tracks.map(track => ({
              ...track,
              clips: track.clips.map(clip => ({
                ...clip,
                selected: newSelection.has(clip.id),
              })),
            })),
          })),
        })),
      };
    });
  },

  selectClipRange: (fromClipId, toClipId) => set((state) => {
    // Find both clips and get all clips in between
    const allClips: Array<{ clip: Clip; globalIndex: number }> = [];
    let globalIndex = 0;

    // Collect all clips with their global indices (in display order)
    state.groups.forEach(group => {
      group.aspects.forEach(aspect => {
        aspect.tracks.forEach(track => {
          track.clips.forEach(clip => {
            allClips.push({ clip, globalIndex });
            globalIndex++;
          });
        });
      });
    });

    // Find indices of from and to clips
    const fromIndex = allClips.findIndex(c => c.clip.id === fromClipId);
    const toIndex = allClips.findIndex(c => c.clip.id === toClipId);

    if (fromIndex === -1 || toIndex === -1) {
      return state; // Can't find one of the clips
    }

    // Get range (inclusive), handling both directions
    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);
    const clipsInRange = allClips.slice(startIndex, endIndex + 1);

    // Add all clips in range to selection
    const newSelection = new Set(state.selection.clipIds);
    clipsInRange.forEach(({ clip }) => {
      newSelection.add(clip.id);
    });

    return {
      selection: {
        ...state.selection,
        clipIds: newSelection,
        lastSelectedClipId: toClipId, // Update anchor to the newly clicked clip
      },
      groups: state.groups.map(group => ({
        ...group,
        aspects: group.aspects.map(aspect => ({
          ...aspect,
          tracks: aspect.tracks.map(track => ({
            ...track,
            clips: track.clips.map(clip => ({
              ...clip,
              selected: newSelection.has(clip.id),
            })),
          })),
        })),
      })),
    };
  }),

  deselectClip: (clipId) => set((state) => {
    const newSelection = new Set(state.selection.clipIds);
    newSelection.delete(clipId);

    return {
      selection: { ...state.selection, clipIds: newSelection },
      groups: state.groups.map(group => ({
        ...group,
        aspects: group.aspects.map(aspect => ({
          ...aspect,
          tracks: aspect.tracks.map(track => ({
            ...track,
            clips: track.clips.map(clip => ({
              ...clip,
              selected: newSelection.has(clip.id),
            })),
          })),
        })),
      })),
    };
  }),

  selectAll: () => set((state) => {
    const allClipIds = state.groups.flatMap(g =>
      g.aspects.flatMap(a =>
        a.tracks.flatMap(t => t.clips.map(c => c.id))
      )
    );
    return {
      selection: { ...state.selection, clipIds: new Set(allClipIds) },
      groups: state.groups.map(group => ({
        ...group,
        aspects: group.aspects.map(aspect => ({
          ...aspect,
          tracks: aspect.tracks.map(track => ({
            ...track,
            clips: track.clips.map(clip => ({ ...clip, selected: true })),
          })),
        })),
      })),
    };
  }),

  clearSelection: () => set((state) => ({
    selection: { ...state.selection, clipIds: new Set() },
    groups: state.groups.map(group => ({
      ...group,
      aspects: group.aspects.map(aspect => ({
        ...aspect,
        tracks: aspect.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip => ({ ...clip, selected: false })),
        })),
      })),
    })),
  })),

  selectTrackClips: (trackId) => set((state) => {
    let targetTrack: Track | undefined;
    for (const group of state.groups) {
      for (const aspect of group.aspects) {
        const track = aspect.tracks.find(t => t.id === trackId);
        if (track) {
          targetTrack = track;
          break;
        }
      }
      if (targetTrack) break;
    }
    if (!targetTrack) return state;

    const trackClipIds = targetTrack.clips.map(c => c.id);
    return {
      selection: { ...state.selection, clipIds: new Set(trackClipIds) },
      groups: state.groups.map(group => ({
        ...group,
        aspects: group.aspects.map(aspect => ({
          ...aspect,
          tracks: aspect.tracks.map(track => ({
            ...track,
            clips: track.clips.map(clip => ({
              ...clip,
              selected: trackClipIds.includes(clip.id),
            })),
          })),
        })),
      })),
    };
  }),

  // Clipboard methods
  copySelection: () => set((state) => {
    const selectedClips = state.getSelectedClips();
    if (selectedClips.length === 0) return state;

    return {
      clipboard: {
        clips: selectedClips.map(c => ({ ...c })),
        sourceTrackId: selectedClips[0].trackId,
      },
    };
  }),

  paste: (trackId, time) => set((state) => {
    if (!state.clipboard) return state;

    const newClips: Clip[] = state.clipboard.clips.map(clip => {
      const duration = clip.timeRange.end - clip.timeRange.start;
      return {
        ...clip,
        id: `clip_${generateId()}`,
        trackId,
        timeRange: {
          start: time,
          end: time + duration,
        },
        selected: false,
      };
    });

    return {
      groups: state.groups.map(group => ({
        ...group,
        aspects: group.aspects.map(aspect => ({
          ...aspect,
          tracks: aspect.tracks.map(track =>
            track.id === trackId
              ? { ...track, clips: [...track.clips, ...newClips] }
              : track
          ),
        })),
      })),
    };
  }),

  cut: () => {
    get().copySelection();
    const selectedIds = [...get().selection.clipIds];
    selectedIds.forEach(id => get().removeClip(id));
  },

  // Timeline methods
  setZoom: (zoom) => set((state) => {
    // Allow zoom to go very low for large durations, but cap at 200 for zoom in
    // Minimum of 0.01 allows viewing up to 100,000+ seconds in reasonable space
    const clampedZoom = Math.max(0.01, Math.min(200, zoom));

    // When zoom changes, recalculate scrollX to keep the viewport aligned
    // Formula: scrollX = viewportStart × zoom
    const newScrollX = state.timeline.viewportStart * clampedZoom;

    console.log('[setZoom] Setting zoom:', { oldZoom: state.timeline.zoom, newZoom: clampedZoom, viewportStart: state.timeline.viewportStart, newScrollX });

    return {
      timeline: {
        ...state.timeline,
        zoom: clampedZoom,
        scrollX: newScrollX, // Update scroll to match new zoom
      },
    };
  }),

  setScroll: (x, y) => set((state) => {
    // Calculate viewport start from scroll position
    // Formula: viewportStart = scrollX / zoom
    const newViewportStart = x / state.timeline.zoom;

    return {
      timeline: {
        ...state.timeline,
        scrollX: x,
        scrollY: y,
        viewportStart: newViewportStart,  // Sync viewport with scroll
      },
    };
  }),

  setPlayhead: (position) => set((state) => ({
    timeline: { ...state.timeline, playheadPosition: position },
  })),

  toggleGridSnap: () => set((state) => ({
    timeline: { ...state.timeline, gridSnap: !state.timeline.gridSnap },
  })),

  setTimelineRange: (startTime, duration) => set((state) => {
    console.log('[setTimelineRange] Starting with duration:', duration);

    // Ensure minimum 1 second duration
    const validDuration = Math.max(1, duration);

    // Auto-adjust zoom to keep timeline width reasonable
    // Maximum timeline width: 2,000 pixels (ultra-conservative for stability)
    // With 14 tracks × 80px height, we want to keep total layout area manageable
    const MAX_TIMELINE_WIDTH = 2000;
    const currentZoom = state.timeline.zoom;
    const projectedWidth = validDuration * currentZoom;

    let newZoom = currentZoom;
    if (projectedWidth > MAX_TIMELINE_WIDTH) {
      // Calculate zoom that keeps width at maximum
      newZoom = MAX_TIMELINE_WIDTH / validDuration;
      // Allow zoom to go below normal minimum (10) if needed for large durations
      newZoom = Math.max(0.01, Math.min(200, newZoom));
      console.log(`[setTimelineRange] Auto-adjusting zoom from ${currentZoom} to ${newZoom} (duration=${validDuration}s, width=${Math.floor(validDuration * newZoom)}px)`);
    }

    // TODO: Hybrid approach - recalculate clip positions from absolute timestamps
    // when timeline date range changes (for future refactor, see REFACTOR_REMINDER.md)
    const updatedGroups = state.groups.map(group => ({
      ...group,
      aspects: group.aspects.map(aspect => ({
        ...aspect,
        tracks: aspect.tracks.map(track => ({
          ...track,
          clips: track.clips.map(clip => {
            // If clip has absolute timestamps, recalculate relative position
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
            // Old clips without absolute timestamps keep their relative positions
            return clip;
          }),
        })),
      })),
    }));

    console.log('[setTimelineRange] Updating state...');
    return {
      groups: updatedGroups,
      timeline: {
        ...state.timeline,
        startTime,
        duration: validDuration,
        zoom: newZoom,
        playheadPosition: 0, // Reset playhead to start
        scrollX: 0, // Reset scroll to beginning

        // Reset viewport to show entire duration
        viewportStart: 0,
        viewportDuration: validDuration,
      },
    };
  }),

  // Navigator viewport methods
  setViewport: (start, duration) => set((state) => {
    // Clamp start to valid range
    const clampedStart = Math.max(0, Math.min(start, state.timeline.duration - duration));

    // Clamp duration to valid range (can't be larger than total duration)
    const clampedDuration = Math.max(1, Math.min(duration, state.timeline.duration));

    // Calculate scrollX to match viewport position
    // Formula: scrollX = viewportStart * zoom
    const newScrollX = clampedStart * state.timeline.zoom;

    console.log('[setViewport] Setting viewport:', { start: clampedStart, duration: clampedDuration, scrollX: newScrollX });

    return {
      timeline: {
        ...state.timeline,
        viewportStart: clampedStart,
        viewportDuration: clampedDuration,
        scrollX: newScrollX,  // Sync timeline scroll with viewport
      },
    };
  }),

  panViewport: (deltaSeconds) => set((state) => {
    const newStart = state.timeline.viewportStart + deltaSeconds;

    // Clamp to valid range [0, duration - viewportDuration]
    const clampedStart = Math.max(
      0,
      Math.min(newStart, state.timeline.duration - state.timeline.viewportDuration)
    );

    console.log('[panViewport] Panning viewport by', deltaSeconds, 'seconds. New start:', clampedStart);

    return {
      timeline: {
        ...state.timeline,
        viewportStart: clampedStart,
      },
    };
  }),

  zoomViewport: (newDuration, centerTime) => set((state) => {
    // Clamp duration to valid range
    const clampedDuration = Math.max(1, Math.min(newDuration, state.timeline.duration));

    // If centerTime provided, try to keep it centered in the viewport
    let newStart = state.timeline.viewportStart;
    if (centerTime !== undefined) {
      // Calculate new start to keep centerTime in the same relative position
      const oldRelativePos = (centerTime - state.timeline.viewportStart) / state.timeline.viewportDuration;
      newStart = centerTime - (clampedDuration * oldRelativePos);
    } else {
      // Otherwise, zoom from the center of current viewport
      const currentCenter = state.timeline.viewportStart + state.timeline.viewportDuration / 2;
      newStart = currentCenter - clampedDuration / 2;
    }

    // Clamp start to valid range
    const clampedStart = Math.max(
      0,
      Math.min(newStart, state.timeline.duration - clampedDuration)
    );

    console.log('[zoomViewport] Zooming viewport to duration:', clampedDuration, 'New start:', clampedStart);

    return {
      timeline: {
        ...state.timeline,
        viewportStart: clampedStart,
        viewportDuration: clampedDuration,
      },
    };
  }),

  // Job methods
  addJob: (job) => set((state) => ({ jobs: [...state.jobs, job] })),

  updateJob: (jobId, updates) => set((state) => ({
    jobs: state.jobs.map(j => (j.id === jobId ? { ...j, ...updates } : j)),
  })),

  removeJob: (jobId) => set((state) => ({
    jobs: state.jobs.filter(j => j.id !== jobId),
  })),

  clearCompletedJobs: () => set((state) => ({
    jobs: state.jobs.filter(j => j.state === 'running' || j.state === 'pending'),
  })),

  // Drag state
  setDragState: (updates) => set((state) => ({
    dragState: { ...state.dragState, ...updates },
  })),

  // Ghost clips
  setGhostClips: (ghosts) => set(() => ({ ghostClips: ghosts })),

  // Snap indicator
  setSnapIndicator: (position) => set(() => ({ snapIndicatorPosition: position })),

  // Progress handling
  handleProgress: (clipId, progress, state) => {
    get().updateClip(clipId, { progress, state });
  },

  // Utility methods
  getClip: (clipId) => {
    const state = get();
    for (const group of state.groups) {
      for (const aspect of group.aspects) {
        for (const track of aspect.tracks) {
          const clip = track.clips.find(c => c.id === clipId);
          if (clip) return clip;
        }
      }
    }
    return undefined;
  },

  getTrack: (trackId) => {
    const state = get();
    for (const group of state.groups) {
      for (const aspect of group.aspects) {
        const track = aspect.tracks.find(t => t.id === trackId);
        if (track) return track;
      }
    }
    return undefined;
  },

  getAspect: (aspectId) => {
    const state = get();
    for (const group of state.groups) {
      const aspect = group.aspects.find(a => a.id === aspectId);
      if (aspect) return aspect;
    }
    return undefined;
  },

  getGroup: (groupId) => {
    return get().groups.find(g => g.id === groupId);
  },

  getSelectedClips: () => {
    const state = get();
    const clips: Clip[] = [];
    state.groups.forEach(group => {
      group.aspects.forEach(aspect => {
        aspect.tracks.forEach(track => {
          track.clips.forEach(clip => {
            if (state.selection.clipIds.has(clip.id)) {
              clips.push(clip);
            }
          });
        });
      });
    });
    return clips;
  },

  getAllTracks: () => {
    const state = get();
    const tracks: Track[] = [];
    state.groups.forEach(group => {
      group.aspects.forEach(aspect => {
        tracks.push(...aspect.tracks);
      });
    });
    return tracks;
  },

  // UI panel toggle methods
  toggleInspector: () => set((state) => ({
    inspectorVisible: !state.inspectorVisible,
  })),

  toggleJobQueue: () => set((state) => ({
    jobQueueVisible: !state.jobQueueVisible,
  })),
}));