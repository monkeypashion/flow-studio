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
  DataType,
  TenantCredential,
  DataJob
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
  settingsVisible: boolean;
  toggleInspector: () => void;
  toggleJobQueue: () => void;
  toggleSettings: () => void;

  // UI view modes
  showAssets: boolean;
  showAspects: boolean;
  showOnlyVisible: boolean; // Filter sidebar to show only visible items
  hoveredItem: { type: 'group' | 'aspect' | 'track'; id: string } | null; // Item being hovered in sidebar
  selectedItem: { type: 'group' | 'aspect' | 'track'; id: string } | null; // Item clicked/selected in sidebar
  toggleShowAssets: () => void;
  toggleShowAspects: () => void;
  toggleShowOnlyVisible: () => void;
  setHoveredItem: (item: { type: 'group' | 'aspect' | 'track'; id: string } | null) => void;
  setSelectedItem: (item: { type: 'group' | 'aspect' | 'track'; id: string } | null) => void;

  // UI layout
  treeWidth: number;
  setTreeWidth: (width: number) => void;
  trackHeaderWidth: number;
  setTrackHeaderWidth: (width: number) => void;

  // Tenant Credentials
  tenants: TenantCredential[];
  addTenant: (tenant: Omit<TenantCredential, 'id' | 'createdAt'>) => void;
  updateTenant: (tenantId: string, updates: Partial<TenantCredential>) => void;
  deleteTenant: (tenantId: string) => void;
  setDefaultTenant: (tenantId: string) => void;
  testTenantConnection: (tenantId: string) => Promise<{ success: boolean; message: string }>;
  loadAssetsFromCredential: (tenantId: string, assetTypeId?: string) => Promise<{ success: boolean; message: string; totalAssets?: number }>;
  loadTenantsFromStorage: () => void;
  saveTenantsToStorage: () => void;

  // Data Jobs (workflow jobs with asset configurations)
  dataJobs: DataJob[];
  activeJobId: string | null;
  addDataJob: (name?: string) => string;
  removeDataJob: (jobId: string) => void;
  renameDataJob: (jobId: string, name: string) => void;
  setActiveJob: (jobId: string | null) => void;
  toggleDataJobExpanded: (jobId: string) => void;
  collapseAllGroupsInJob: (jobId: string) => void;
  toggleJobVisibility: (jobId: string) => void;
  addAssetsToJob: (jobId: string, groups: Group[]) => void;
  saveDataJobsToStorage: () => void;
  loadDataJobsFromStorage: () => void;

  // Jobs (background tasks - will be deprecated)
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

  // Multi-select drag incompatibility (when trying to move/copy multiple clips across tracks)
  isMultiSelectDragIncompatible: boolean;
  setMultiSelectDragIncompatible: (incompatible: boolean) => void;

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
  // Initial state - no demo data
  groups: [],

  // Backward compatibility - flat track list
  tracks: [],

  selection: {
    clipIds: new Set(),
    lastSelectedClipId: undefined,
  },

  clipboard: null,

  timeline: {
    // Calculate initial zoom to fit entire duration in typical screen width
    // Typical width: 1400px container - 192px headers (default) = 1208px available
    // This will be recalculated by ResizeObserver once DOM is ready
    // Note: Uses default 192px for initial calculation, actual value from trackHeaderWidth state
    zoom: (() => {
      const TYPICAL_CONTAINER_WIDTH = 1400;
      const TRACK_HEADER_WIDTH = 192; // Use default for initial load
      const availableWidth = TYPICAL_CONTAINER_WIDTH - TRACK_HEADER_WIDTH;
      const duration = 86400; // 24 hours
      return availableWidth / duration; // ~0.014 pixels per second
    })(),
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

  isMultiSelectDragIncompatible: false,

  // UI panels visibility
  inspectorVisible: false,
  jobQueueVisible: false,
  settingsVisible: false,

  // UI view modes
  showAssets: true,
  showAspects: true,
  showOnlyVisible: false, // Default: show all items in sidebar
  hoveredItem: null,
  selectedItem: null,

  // Tenant credentials
  tenants: [],

  // Data Jobs (workflow jobs)
  dataJobs: [],
  activeJobId: null,

  // UI layout
  treeWidth: 192, // Default 192px (w-48)
  trackHeaderWidth: 192, // Default 192px - width of sticky track headers

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

  removeGroup: (groupId) => {
    set((state) => ({
      // Remove from active job's groups
      dataJobs: state.dataJobs.map(job =>
        job.id === state.activeJobId
          ? { ...job, groups: job.groups.filter(g => g.id !== groupId) }
          : job
      ),
      // Also remove from global groups for backward compatibility
      groups: state.groups.filter(g => g.id !== groupId),
    }));
    // Auto-save to localStorage
    setTimeout(() => get().saveDataJobsToStorage(), 500);
  },

  updateGroup: (groupId, updates) => set((state) => ({
    groups: state.groups.map(g =>
      g.id === groupId ? { ...g, ...updates } : g
    ),
  })),

  toggleGroupExpanded: (groupId) => {
    set((state) => ({
      dataJobs: state.dataJobs.map(job => ({
        ...job,
        groups: job.groups.map(g =>
          g.id === groupId ? { ...g, expanded: !g.expanded } : g
        )
      })),
      // Also update old groups array for backward compatibility during migration
      groups: state.groups.map(g =>
        g.id === groupId ? { ...g, expanded: !g.expanded } : g
      ),
    }));
    // Auto-save to localStorage
    setTimeout(() => get().saveDataJobsToStorage(), 500);
  },

  toggleGroupVisible: (groupId) => {
    set((state) => {
      const newVisibleState = !state.dataJobs
        .flatMap(job => job.groups)
        .find(g => g.id === groupId)?.visible;

      return {
        dataJobs: state.dataJobs.map(job => ({
          ...job,
          groups: job.groups.map(g => {
            if (g.id === groupId) {
              // Explicit toggle on group - cascade DOWN to all children
              return {
                ...g,
                visible: newVisibleState,
                visibilityMode: 'explicit',
                aspects: g.aspects.map(a => ({
                  ...a,
                  visible: newVisibleState,
                  visibilityMode: 'explicit',
                  tracks: a.tracks.map(t => ({
                    ...t,
                    visible: newVisibleState,
                    visibilityMode: 'explicit'
                  }))
                }))
              };
            }
            return g;
          })
        })),
        // Also update old groups array for backward compatibility
        groups: state.groups.map(g => {
          if (g.id === groupId) {
            return {
              ...g,
              visible: newVisibleState,
              visibilityMode: 'explicit',
              aspects: g.aspects.map(a => ({
                ...a,
                visible: newVisibleState,
                visibilityMode: 'explicit',
                tracks: a.tracks.map(t => ({
                  ...t,
                  visible: newVisibleState,
                  visibilityMode: 'explicit'
                }))
              }))
            };
          }
          return g;
        }),
      };
    });
    // Auto-save to localStorage
    setTimeout(() => get().saveDataJobsToStorage(), 500);
  },

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
    dataJobs: state.dataJobs.map(job => ({
      ...job,
      groups: job.groups.map(g => ({
        ...g,
        aspects: g.aspects.map(a =>
          a.id === aspectId ? { ...a, expanded: !a.expanded } : a
        ),
      }))
    })),
    // Also update old groups array for backward compatibility
    groups: state.groups.map(g => ({
      ...g,
      aspects: g.aspects.map(a =>
        a.id === aspectId ? { ...a, expanded: !a.expanded } : a
      ),
    })),
  })),

  toggleAspectVisible: (aspectId) => {
    set((state) => {
      let newVisibleState = false;
      let parentGroupId = '';

      // Find current visibility state and parent group
      for (const job of state.dataJobs) {
        for (const group of job.groups) {
          const aspect = group.aspects.find(a => a.id === aspectId);
          if (aspect) {
            newVisibleState = !aspect.visible;
            parentGroupId = group.id;
            break;
          }
        }
      }

      return {
        dataJobs: state.dataJobs.map(job => ({
          ...job,
          groups: job.groups.map(g => {
            // Update aspects
            const updatedGroup = {
              ...g,
              aspects: g.aspects.map(a => {
                if (a.id === aspectId) {
                  // Explicit toggle on aspect - cascade DOWN to tracks
                  return {
                    ...a,
                    visible: newVisibleState,
                    visibilityMode: 'explicit',
                    tracks: a.tracks.map(t => ({
                      ...t,
                      visible: newVisibleState,
                      visibilityMode: 'explicit'
                    }))
                  };
                }
                return a;
              })
            };

            // If showing this aspect, cascade UP (implicit) to parent group
            if (g.id === parentGroupId && newVisibleState) {
              return {
                ...updatedGroup,
                visible: true,
                visibilityMode: 'implicit'
              };
            }

            return updatedGroup;
          })
        })),
        // Also update old groups array for backward compatibility
        groups: state.groups.map(g => {
          const updatedGroup = {
            ...g,
            aspects: g.aspects.map(a => {
              if (a.id === aspectId) {
                return {
                  ...a,
                  visible: newVisibleState,
                  visibilityMode: 'explicit',
                  tracks: a.tracks.map(t => ({
                    ...t,
                    visible: newVisibleState,
                    visibilityMode: 'explicit'
                  }))
                };
              }
              return a;
            })
          };

          if (g.id === parentGroupId && newVisibleState) {
            return {
              ...updatedGroup,
              visible: true,
              visibilityMode: 'implicit'
            };
          }

          return updatedGroup;
        }),
      };
    });
    // Auto-save to localStorage
    setTimeout(() => get().saveDataJobsToStorage(), 500);
  },

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

  toggleTrackVisible: (trackId) => {
    set((state) => {
      let newVisibleState = false;
      let parentAspectId = '';
      let parentGroupId = '';

      // Find current visibility state and parents
      for (const job of state.dataJobs) {
        for (const group of job.groups) {
          for (const aspect of group.aspects) {
            const track = aspect.tracks.find(t => t.id === trackId);
            if (track) {
              newVisibleState = !track.visible;
              parentAspectId = aspect.id;
              parentGroupId = group.id;
              break;
            }
          }
        }
      }

      return {
        dataJobs: state.dataJobs.map(job => ({
          ...job,
          groups: job.groups.map(g => ({
            ...g,
            // If showing this track, cascade UP (implicit) to parent group
            visible: (g.id === parentGroupId && newVisibleState) ? true : g.visible,
            visibilityMode: (g.id === parentGroupId && newVisibleState) ? 'implicit' : g.visibilityMode,
            aspects: g.aspects.map(a => ({
              ...a,
              // If showing this track, cascade UP (implicit) to parent aspect
              visible: (a.id === parentAspectId && newVisibleState) ? true : a.visible,
              visibilityMode: (a.id === parentAspectId && newVisibleState) ? 'implicit' : a.visibilityMode,
              tracks: a.tracks.map(t =>
                t.id === trackId ? { ...t, visible: newVisibleState, visibilityMode: 'explicit' } : t
              ),
            })),
          }))
        })),
        // Also update old groups array for backward compatibility
        groups: state.groups.map(g => ({
          ...g,
          visible: (g.id === parentGroupId && newVisibleState) ? true : g.visible,
          visibilityMode: (g.id === parentGroupId && newVisibleState) ? 'implicit' : g.visibilityMode,
          aspects: g.aspects.map(a => ({
            ...a,
            visible: (a.id === parentAspectId && newVisibleState) ? true : a.visible,
            visibilityMode: (a.id === parentAspectId && newVisibleState) ? 'implicit' : a.visibilityMode,
            tracks: a.tracks.map(t =>
              t.id === trackId ? { ...t, visible: newVisibleState, visibilityMode: 'explicit' } : t
            ),
          })),
        })),
      };
    });
    // Auto-save to localStorage
    setTimeout(() => get().saveDataJobsToStorage(), 500);
  },

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
      // Update active job's groups
      dataJobs: state.dataJobs.map(job =>
        job.id === state.activeJobId
          ? {
              ...job,
              groups: job.groups.map(group => ({
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
            }
          : job
      ),
      // Also update global groups for backward compatibility
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
    // Update active job's groups
    dataJobs: state.dataJobs.map(job =>
      job.id === state.activeJobId
        ? {
            ...job,
            groups: job.groups.map(group => ({
              ...group,
              aspects: group.aspects.map(aspect => ({
                ...aspect,
                tracks: aspect.tracks.map(track => ({
                  ...track,
                  clips: track.clips.filter(c => c.id !== clipId),
                })),
              })),
            })),
          }
        : job
    ),
    // Also update global groups for backward compatibility
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
    // Update active job's groups
    dataJobs: state.dataJobs.map(job =>
      job.id === state.activeJobId
        ? {
            ...job,
            groups: job.groups.map(group => ({
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
          }
        : job
    ),
    // Also update global groups for backward compatibility
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
    // Get active job's groups
    const activeJob = state.dataJobs.find(job => job.id === state.activeJobId);
    const groups = activeJob?.groups || state.groups; // Fallback to global groups for backward compatibility

    // Find the clip to move
    let clipToMove: Clip | undefined;
    let sourceTrackId: string | undefined;
    let sourceTrack: Track | undefined;

    for (const group of groups) {
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
    for (const group of groups) {
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
        // Update active job's groups
        dataJobs: state.dataJobs.map(job =>
          job.id === state.activeJobId
            ? {
                ...job,
                groups: job.groups.map(group => ({
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
              }
            : job
        ),
        // Also update global groups for backward compatibility
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
      // Update active job's groups
      dataJobs: state.dataJobs.map(job =>
        job.id === state.activeJobId
          ? {
              ...job,
              groups: job.groups.map(group => ({
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
            }
          : job
      ),
      // Also update global groups for backward compatibility
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
        // Update active job's groups
        dataJobs: state.dataJobs.map(job =>
          job.id === state.activeJobId
            ? {
                ...job,
                groups: job.groups.map(group => ({
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
              }
            : job
        ),
        // Also update global groups for backward compatibility
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
    // Get active job's groups
    const activeJob = state.dataJobs.find(job => job.id === state.activeJobId);
    const groups = activeJob?.groups || state.groups; // Fallback to global groups for backward compatibility

    // Find both clips and get all clips in between
    const allClips: Array<{ clip: Clip; globalIndex: number }> = [];
    let globalIndex = 0;

    // Collect all clips with their global indices (in display order)
    groups.forEach(group => {
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
      // Update active job's groups
      dataJobs: state.dataJobs.map(job =>
        job.id === state.activeJobId
          ? {
              ...job,
              groups: job.groups.map(group => ({
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
            }
          : job
      ),
      // Also update global groups for backward compatibility
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
      // Update active job's groups
      dataJobs: state.dataJobs.map(job =>
        job.id === state.activeJobId
          ? {
              ...job,
              groups: job.groups.map(group => ({
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
            }
          : job
      ),
      // Also update global groups for backward compatibility
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
    // Get active job's groups
    const activeJob = state.dataJobs.find(job => job.id === state.activeJobId);
    const groups = activeJob?.groups || state.groups; // Fallback to global groups for backward compatibility

    const allClipIds = groups.flatMap(g =>
      g.aspects.flatMap(a =>
        a.tracks.flatMap(t => t.clips.map(c => c.id))
      )
    );
    return {
      selection: { ...state.selection, clipIds: new Set(allClipIds) },
      // Update active job's groups
      dataJobs: state.dataJobs.map(job =>
        job.id === state.activeJobId
          ? {
              ...job,
              groups: job.groups.map(group => ({
                ...group,
                aspects: group.aspects.map(aspect => ({
                  ...aspect,
                  tracks: aspect.tracks.map(track => ({
                    ...track,
                    clips: track.clips.map(clip => ({ ...clip, selected: true })),
                  })),
                })),
              })),
            }
          : job
      ),
      // Also update global groups for backward compatibility
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
    // Update active job's groups
    dataJobs: state.dataJobs.map(job =>
      job.id === state.activeJobId
        ? {
            ...job,
            groups: job.groups.map(group => ({
              ...group,
              aspects: group.aspects.map(aspect => ({
                ...aspect,
                tracks: aspect.tracks.map(track => ({
                  ...track,
                  clips: track.clips.map(clip => ({ ...clip, selected: false })),
                })),
              })),
            })),
          }
        : job
    ),
    // Also update global groups for backward compatibility
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
    // Get active job's groups
    const activeJob = state.dataJobs.find(job => job.id === state.activeJobId);
    const groups = activeJob?.groups || state.groups; // Fallback to global groups for backward compatibility

    let targetTrack: Track | undefined;
    for (const group of groups) {
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
      // Update active job's groups
      dataJobs: state.dataJobs.map(job =>
        job.id === state.activeJobId
          ? {
              ...job,
              groups: job.groups.map(group => ({
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
            }
          : job
      ),
      // Also update global groups for backward compatibility
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
    // Allow zoom to go very low for narrow windows/large durations, cap at 200 for zoom in
    // Minimum of 0.001 allows extreme zoom out (1000 seconds per pixel)
    const clampedZoom = Math.max(0.001, Math.min(200, zoom));

    // When zoom changes, recalculate scrollX to keep the viewport aligned
    // Formula: scrollX = viewportStart × zoom
    const newScrollX = state.timeline.viewportStart * clampedZoom;

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
    // Ensure minimum 1 second duration
    const validDuration = Math.max(1, duration);

    // Calculate zoom to fit the entire duration in the visible screen
    // This matches what Navigator does when viewport = full duration
    // Get timeline container width (approximation - actual width calculated in browser)
    const timelineContainer = typeof document !== 'undefined'
      ? document.querySelector('.hide-scrollbar') as HTMLElement
      : null;

    // Use dynamic track header width from state
    const trackHeaderWidth = get().trackHeaderWidth;
    const containerWidth = timelineContainer?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth - trackHeaderWidth : 1200);
    const availableWidth = Math.max(100, containerWidth - trackHeaderWidth); // Safety: ensure positive width

    // Calculate zoom: pixels per second needed to fit entire duration in screen
    let newZoom = availableWidth / validDuration;

    // Clamp to reasonable range (allow very low zoom for narrow windows)
    newZoom = Math.max(0.001, Math.min(200, newZoom));

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

  setMultiSelectDragIncompatible: (incompatible) => set(() => ({ isMultiSelectDragIncompatible: incompatible })),

  // Progress handling
  handleProgress: (clipId, progress, state) => {
    get().updateClip(clipId, { progress, state });
  },

  // Utility methods
  getClip: (clipId) => {
    const state = get();
    // Read from active job's groups
    const activeJob = state.dataJobs.find(job => job.id === state.activeJobId);
    const groups = activeJob?.groups || state.groups; // Fallback to global groups for backward compatibility

    for (const group of groups) {
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
    // Read from active job's groups
    const activeJob = state.dataJobs.find(job => job.id === state.activeJobId);
    const groups = activeJob?.groups || state.groups; // Fallback to global groups for backward compatibility

    for (const group of groups) {
      for (const aspect of group.aspects) {
        const track = aspect.tracks.find(t => t.id === trackId);
        if (track) return track;
      }
    }
    return undefined;
  },

  getAspect: (aspectId) => {
    const state = get();
    // Read from active job's groups
    const activeJob = state.dataJobs.find(job => job.id === state.activeJobId);
    const groups = activeJob?.groups || state.groups; // Fallback to global groups for backward compatibility

    for (const group of groups) {
      const aspect = group.aspects.find(a => a.id === aspectId);
      if (aspect) return aspect;
    }
    return undefined;
  },

  getGroup: (groupId) => {
    const state = get();
    // Read from active job's groups
    const activeJob = state.dataJobs.find(job => job.id === state.activeJobId);
    const groups = activeJob?.groups || state.groups; // Fallback to global groups for backward compatibility

    return groups.find(g => g.id === groupId);
  },

  getSelectedClips: () => {
    const state = get();
    // Read from active job's groups
    const activeJob = state.dataJobs.find(job => job.id === state.activeJobId);
    const groups = activeJob?.groups || state.groups; // Fallback to global groups for backward compatibility

    const clips: Clip[] = [];
    groups.forEach(group => {
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
    // Read from active job's groups
    const activeJob = state.dataJobs.find(job => job.id === state.activeJobId);
    const groups = activeJob?.groups || state.groups; // Fallback to global groups for backward compatibility

    const tracks: Track[] = [];
    // Only return tracks that are actually visible in the timeline
    // This matches the rendering logic in Timeline.tsx
    groups
      .filter(group => group.visible) // Only visible groups
      .sort((a, b) => a.index - b.index)
      .forEach(group => {
        group.aspects
          .filter(aspect => aspect.visible) // Only visible aspects
          .sort((a, b) => a.index - b.index)
          .forEach(aspect => {
            aspect.tracks
              .filter(track => track.visible) // Only visible tracks
              .sort((a, b) => a.index - b.index)
              .forEach(track => {
                tracks.push(track);
              });
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

  toggleSettings: () => set((state) => ({
    settingsVisible: !state.settingsVisible,
  })),

  toggleShowAssets: () => set((state) => ({
    showAssets: !state.showAssets,
  })),

  toggleShowAspects: () => set((state) => ({
    showAspects: !state.showAspects,
  })),

  toggleShowOnlyVisible: () => set((state) => ({
    showOnlyVisible: !state.showOnlyVisible,
  })),

  setHoveredItem: (item) => set({ hoveredItem: item }),
  setSelectedItem: (item) => set({ selectedItem: item }),

  // Tenant credential methods
  addTenant: (tenant) => {
    const newTenant: TenantCredential = {
      ...tenant,
      id: `tenant_${generateId()}`,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      tenants: [...state.tenants, newTenant],
    }));

    // Save to localStorage
    get().saveTenantsToStorage();
  },

  updateTenant: (tenantId, updates) => {
    set((state) => ({
      tenants: state.tenants.map(t =>
        t.id === tenantId ? { ...t, ...updates, lastUsed: new Date().toISOString() } : t
      ),
    }));

    // Save to localStorage
    get().saveTenantsToStorage();
  },

  deleteTenant: (tenantId) => {
    set((state) => ({
      tenants: state.tenants.filter(t => t.id !== tenantId),
    }));

    // Save to localStorage
    get().saveTenantsToStorage();
  },

  setDefaultTenant: (tenantId) => {
    set((state) => ({
      tenants: state.tenants.map(t => ({
        ...t,
        isDefault: t.id === tenantId,
      })),
    }));

    // Save to localStorage
    get().saveTenantsToStorage();
  },

  testTenantConnection: async (tenantId) => {
    const tenant = get().tenants.find(t => t.id === tenantId);
    if (!tenant) {
      return { success: false, message: 'Tenant not found' };
    }

    try {
      // Call backend proxy endpoint instead of direct MindSphere API
      const backendUrl = 'http://localhost:3000/api/auth/test';

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: tenant.tenantId,
          clientId: tenant.clientId,
          clientSecret: tenant.clientSecret,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update last used timestamp
        get().updateTenant(tenantId, { lastUsed: new Date().toISOString() });
        return { success: true, message: data.message || 'Connection successful' };
      } else {
        return {
          success: false,
          message: data.message || 'Authentication failed'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Connection error: ${errorMessage}. Make sure backend server is running on port 3000.`
      };
    }
  },

  loadAssetsFromCredential: async (tenantId, assetTypeId) => {
    const tenant = get().tenants.find(t => t.id === tenantId);
    if (!tenant) {
      return { success: false, message: 'Tenant not found' };
    }

    try {
      const backendUrl = 'http://localhost:3000/api/assets/load';

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.tenantId,
          clientId: tenant.clientId,
          clientSecret: tenant.clientSecret,
          assetTypeId: assetTypeId || 'spx.SPX_Generic_Industrial_Machine'
        }),
      });

      const data = await response.json();

      if (data.success && data.groups) {
        // Replace existing groups with loaded groups
        set({ groups: data.groups });

        // Clear selection since old clips are gone
        get().clearSelection();

        return {
          success: true,
          message: `Loaded ${data.totalAssets} assets successfully`,
          totalAssets: data.totalAssets
        };
      } else {
        return {
          success: false,
          message: data.message || 'Failed to load assets'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },

  loadTenantsFromStorage: () => {
    try {
      const stored = localStorage.getItem('flow-studio-tenants');
      if (stored) {
        const tenants = JSON.parse(stored) as TenantCredential[];
        set({ tenants });
      }
    } catch (error) {
      console.error('Failed to load tenants from localStorage:', error);
    }
  },

  saveTenantsToStorage: () => {
    try {
      const tenants = get().tenants;
      localStorage.setItem('flow-studio-tenants', JSON.stringify(tenants));
    } catch (error) {
      console.error('Failed to save tenants to localStorage:', error);
    }
  },

  // Data Job methods
  addDataJob: (name) => {
    const jobId = `job_${generateId()}`;
    const job: DataJob = {
      id: jobId,
      name: name || `Untitled Job`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expanded: true,
      groups: []
    };

    set((state) => ({
      dataJobs: [...state.dataJobs, job],
      activeJobId: jobId // Set new job as active
    }));

    // Auto-save to localStorage
    setTimeout(() => get().saveDataJobsToStorage(), 500);

    return jobId;
  },

  removeDataJob: (jobId) => {
    set((state) => {
      const newJobs = state.dataJobs.filter(j => j.id !== jobId);
      const newActiveId = state.activeJobId === jobId
        ? (newJobs.length > 0 ? newJobs[0].id : null)
        : state.activeJobId;

      return {
        dataJobs: newJobs,
        activeJobId: newActiveId
      };
    });

    // Auto-save to localStorage
    setTimeout(() => get().saveDataJobsToStorage(), 500);
  },

  renameDataJob: (jobId, name) => {
    set((state) => ({
      dataJobs: state.dataJobs.map(job =>
        job.id === jobId
          ? { ...job, name, updatedAt: new Date().toISOString() }
          : job
      )
    }));

    // Auto-save to localStorage
    setTimeout(() => get().saveDataJobsToStorage(), 500);
  },

  setActiveJob: (jobId) => {
    const previousJobId = get().activeJobId;

    set((state) => ({
      activeJobId: jobId,
      // Collapse the previous job and expand the new job
      dataJobs: state.dataJobs.map(job => {
        if (job.id === previousJobId) {
          // Collapse the previously active job
          return { ...job, expanded: false };
        } else if (job.id === jobId) {
          // Expand the newly active job
          return { ...job, expanded: true };
        }
        return job;
      })
    }));

    // Clear selection when switching jobs
    get().clearSelection();
  },

  toggleDataJobExpanded: (jobId) => {
    set((state) => ({
      dataJobs: state.dataJobs.map(job =>
        job.id === jobId
          ? { ...job, expanded: !job.expanded }
          : job
      )
    }));
  },

  collapseAllGroupsInJob: (jobId) => {
    set((state) => ({
      dataJobs: state.dataJobs.map(job =>
        job.id === jobId
          ? {
              ...job,
              groups: job.groups.map(group => ({
                ...group,
                expanded: false,
                aspects: group.aspects.map(aspect => ({
                  ...aspect,
                  expanded: false
                }))
              }))
            }
          : job
      )
    }));
  },

  toggleJobVisibility: (jobId) => {
    set((state) => {
      const job = state.dataJobs.find(j => j.id === jobId);
      if (!job) return state;

      // Determine if we should show or hide based on first group's visibility
      const shouldShow = job.groups.length > 0 ? !job.groups[0].visible : true;

      return {
        dataJobs: state.dataJobs.map(j =>
          j.id === jobId
            ? {
                ...j,
                groups: j.groups.map(group => ({
                  ...group,
                  visible: shouldShow,
                  visibilityMode: 'explicit', // Explicit toggle from job level
                  aspects: group.aspects.map(aspect => ({
                    ...aspect,
                    visible: shouldShow,
                    visibilityMode: 'explicit',
                    tracks: aspect.tracks.map(track => ({
                      ...track,
                      visible: shouldShow,
                      visibilityMode: 'explicit'
                    }))
                  }))
                }))
              }
            : j
        )
      };
    });
  },

  addAssetsToJob: (jobId, groups) => {
    set((state) => ({
      dataJobs: state.dataJobs.map(job =>
        job.id === jobId
          ? { ...job, groups: [...job.groups, ...groups], updatedAt: new Date().toISOString() }
          : job
      )
    }));

    // Auto-save to localStorage
    setTimeout(() => get().saveDataJobsToStorage(), 500);
  },

  saveDataJobsToStorage: () => {
    try {
      const { dataJobs, activeJobId } = get();
      localStorage.setItem('flow-studio-data-jobs', JSON.stringify({ dataJobs, activeJobId }));
    } catch (error) {
      console.error('Failed to save data jobs to localStorage:', error);
    }
  },

  loadDataJobsFromStorage: () => {
    try {
      const stored = localStorage.getItem('flow-studio-data-jobs');
      if (stored) {
        const { dataJobs, activeJobId } = JSON.parse(stored);
        set({ dataJobs, activeJobId });
      }
    } catch (error) {
      console.error('Failed to load data jobs from localStorage:', error);
    }
  },

  // UI layout methods
  setTreeWidth: (width) => set(() => ({
    treeWidth: width,
  })),

  setTrackHeaderWidth: (width) => {
    // Enforce min/max constraints
    const clampedWidth = Math.max(100, Math.min(400, width));
    set(() => ({ trackHeaderWidth: clampedWidth }));
  },
}));