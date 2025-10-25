export type ClipState = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

export type DataType = 'Boolean' | 'Int' | 'Long' | 'Double' | 'String' | 'Big_string' | 'Timestamp';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface TimeRange {
  start: number;  // in seconds
  end: number;    // in seconds
}

export interface Clip {
  id: string;
  trackId: string;
  name: string;
  timeRange: TimeRange;
  state: ClipState;
  progress: number; // 0-100
  selected: boolean;
  color?: string;
  unit?: string; // Unit of measure for this clip's data
  dataType?: DataType; // Data type of this clip
  metadata?: Record<string, any>;
  // TODO: Hybrid approach - these maintain absolute time identity when timeline date range changes
  // For future refactor: move to absolute-only storage (see REFACTOR_REMINDER.md)
  absoluteStartTime?: string; // ISO 8601 timestamp - absolute time identity
  absoluteEndTime?: string;   // ISO 8601 timestamp - absolute time identity
}

export interface Group {
  id: string;
  name: string;
  assetId?: string; // IoT asset identifier
  expanded: boolean;
  visible: boolean; // Show/hide in timeline
  index: number;
  aspects: Aspect[];
}

export interface Aspect {
  id: string;
  groupId: string; // Reference to parent group/asset
  name: string;
  aspectType?: string; // Type of aspect (temperature, pressure, vibration, etc.)
  expanded: boolean;
  visible: boolean; // Show/hide in timeline
  index: number; // Index within the group
  tracks: Track[];
}

export interface Track {
  id: string;
  aspectId: string; // Reference to parent aspect
  name: string;
  property?: string; // Property name (min, max, avg, current, etc.)
  unit?: string; // Unit of measure (°C, N, kg, %, etc.)
  dataType?: DataType; // Data type (Boolean, Int, Long, Double, String, Big_string, Timestamp)
  index: number; // Index within the aspect
  muted: boolean;
  locked: boolean;
  visible: boolean; // Show/hide in timeline
  height: number;
  clips: Clip[];
}

export interface Job {
  id: string;
  type: 'upload' | 'download' | 'process';
  clipId: string;
  clipName: string;
  progress: number;
  state: 'pending' | 'running' | 'complete' | 'error';
  startTime: number;
  endTime?: number;
  error?: string;
}

export interface Selection {
  clipIds: Set<string>;
  trackId?: string;
  timeRange?: TimeRange;
  lastSelectedClipId?: string; // Anchor point for shift-click range selection
}

export interface ClipboardData {
  clips: Clip[];
  sourceTrackId: string;
}

export interface TimelineState {
  zoom: number;        // pixels per second
  scrollX: number;
  scrollY: number;
  duration: number;    // total timeline duration in seconds (from date picker)
  playheadPosition: number;
  gridSnap: boolean;
  snapInterval: number; // in seconds
  startTime: string;   // ISO 8601 timestamp - absolute time at position 0

  // Navigator viewport fields
  viewportStart: number;    // Start of visible viewport in seconds (offset from startTime)
  viewportDuration: number; // Duration of visible viewport in seconds
}

export interface DragState {
  isDragging: boolean;
  dragType: 'move' | 'resize-left' | 'resize-right' | null;
  startPosition: Position;
  startTimeRange: TimeRange;
  currentPosition: Position;
  targetTrackId?: string;
}

export interface ProgressEvent {
  jobId: string;
  clipId: string;
  progress: number;
  state: ClipState;
  error?: string;
}