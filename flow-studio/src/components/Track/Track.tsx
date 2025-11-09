import React, { useRef } from 'react';
import type { Track as TrackType } from '../../types/index';
import { useAppStore } from '../../store/appStore';
import { Clip } from '../Clip/Clip';
import { AnimatePresence } from 'framer-motion';

interface TrackProps {
  track: TrackType;
  trackIndex: number; // Global track index
  zoom: number;
  width: number;
  onClipDrop?: (trackId: string, time: number) => void;
  tenantColor?: string;
  tenantId?: string;
  groupId?: string;
  aspectId?: string;
}

export const Track: React.FC<TrackProps> = ({
  track,
  trackIndex,
  zoom,
  width,
  onClipDrop,
  tenantColor,
  tenantId,
  groupId,
  aspectId,
}) => {
  const {
    addClip,
    updateTrack,
    toggleTrackVisible,
    selectTrackClips,
    clearSelection,
    timeline,
    trackHeaderWidth,
    showAssets,
    hoveredItem,
    selectedItem,
    dataJobs,
    activeJobId,
    hoveredClipId,
    getClip,
  } = useAppStore();

  // Check if this track should be highlighted
  // Hover highlighting: only for tracks
  // Selection highlighting: for groups, aspects, and tracks
  const isHighlighted =
    (hoveredItem?.type === 'track' && hoveredItem.id === track.id) ||
    (selectedItem?.type === 'track' && selectedItem.id === track.id) ||
    (selectedItem?.type === 'aspect' && aspectId && selectedItem.id === aspectId) ||
    (selectedItem?.type === 'group' && groupId && selectedItem.id === groupId);

  // Check if this track is part of a source-destination connection with the hovered clip
  const isLinkedToHoveredClip = React.useMemo(() => {
    if (!hoveredClipId) return false;

    const hoveredClip = getClip(hoveredClipId);
    if (!hoveredClip) return false;

    // Check if any clip in THIS track is linked to the hovered clip
    return track.clips.some(clip => {
      // Case 1: This track contains the hovered clip itself
      if (clip.id === hoveredClipId && (clip.linkType === 'source' || clip.linkType === 'destination')) {
        return true;
      }

      // Case 2: Hovered clip is destination, this track contains its source
      if (hoveredClip.linkType === 'destination' && hoveredClip.sourceClipId === clip.id) {
        return true;
      }

      // Case 3: This track contains a destination, and hovered clip is its source
      if (clip.linkType === 'destination' && clip.sourceClipId === hoveredClipId) {
        return true;
      }

      return false;
    });
  }, [hoveredClipId, track.clips, getClip]);

  const trackRef = useRef<HTMLDivElement>(null);

  // Handle click on empty track area
  const handleTrackClick = (e: React.MouseEvent) => {
    // Only handle clicks on the track background, not on clips
    if (e.target === e.currentTarget) {
      // Clear selection when clicking empty track area
      clearSelection();

      // Get click position in time
      const rect = trackRef.current?.getBoundingClientRect();
      if (rect) {
        // rect.left already accounts for scroll position
        const x = e.clientX - rect.left;
        const time = x / zoom;

        // Could add new clip at click position if desired
        // For now, just clear selection
      }
    }
  };

  // Handle double-click to create new clip
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !track.locked) {
      const rect = trackRef.current?.getBoundingClientRect();
      if (rect) {
        // Calculate position in timeline
        // rect.left already accounts for scroll (it changes as we scroll)
        // so we don't need to add timeline.scrollX
        const x = e.clientX - rect.left;
        let time = x / zoom;

        // Snap to grid if enabled
        if (timeline.gridSnap) {
          time = Math.round(time / timeline.snapInterval) * timeline.snapInterval;
        }

        const activeJob = dataJobs.find(job => job.id === activeJobId);
        // First clip in master lane is the master clip
        const masterClip = activeJob?.masterLane?.clips?.[0];

        // Check if we're in incremental/live mode
        const isIncrementalMode = activeJob?.syncMode === 'incremental';

        let clipStart: number;
        let clipEnd: number | undefined;

        if (isIncrementalMode && masterClip) {
          // In live mode: create a live clip with the same start time as master
          clipStart = masterClip.timeRange.start;
          clipEnd = undefined; // Live clip has no end time
        } else {
          // In full mode or no master: use clicked position and calculate duration
          clipStart = time;

          let duration: number;
          if (masterClip && masterClip.timeRange.end !== undefined) {
            // Use Master's duration as the default
            duration = masterClip.timeRange.end - masterClip.timeRange.start;
          } else {
            // Fallback: Calculate dynamic clip duration based on what's VISIBLE on screen
            const timelineContainer = document.querySelector('.hide-scrollbar') as HTMLElement;
            const visibleWidth = (timelineContainer?.clientWidth || 1200) - trackHeaderWidth;
            const visibleDuration = visibleWidth / zoom;

            // Make clip 3% of visible duration, with min 5 seconds and max 3600 seconds (1 hour)
            duration = Math.max(5, Math.min(3600, visibleDuration * 0.03));
          }

          clipEnd = clipStart + duration;
        }

        // Create new clip
        addClip(track.id, {
          name: `Clip ${track.clips.length + 1}`,
          trackId: track.id,
          timeRange: {
            start: clipStart,
            end: clipEnd,
          },
          state: 'uploading',
          progress: 0,
          selected: false,
        });
      }
    }
  };

  // Handle drag over for clip dropping
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!track.locked && onClipDrop) {
      const rect = trackRef.current?.getBoundingClientRect();
      if (rect) {
        // rect.left already accounts for scroll position
        const x = e.clientX - rect.left;
        let time = x / zoom;

        // Snap to grid if enabled
        if (timeline.gridSnap) {
          time = Math.round(time / timeline.snapInterval) * timeline.snapInterval;
        }

        onClipDrop(track.id, time);
      }
    }
  };

  return (
    <div className={`flex border-b ${isHighlighted ? 'border-cyan-500/30' : 'border-gray-700'}`} data-track-id={track.id}>
      {/* Track header - sticky so it stays visible during horizontal scroll */}
      <div
        className={`flex-shrink-0 border-r px-3 py-2 flex flex-col gap-2 sticky left-0 transition-colors ${
          isLinkedToHoveredClip
            ? 'bg-yellow-500/20 border-yellow-400 ring-2 ring-yellow-400 ring-inset'
            : isHighlighted
            ? 'bg-cyan-500/40 border-cyan-400'
            : 'bg-gray-800 border-gray-700'
        }`}
        style={{ height: `${track.height}px`, width: `${trackHeaderWidth}px`, zIndex: 70 }}
      >
        {/* Top row: Track name */}
        <div className="flex items-center min-w-0">
          <input
            type="text"
            value={track.name}
            onChange={(e) => updateTrack(track.id, { name: e.target.value })}
            className="bg-transparent text-sm text-gray-200 outline-none border-b border-transparent hover:border-gray-600 focus:border-blue-500 transition-colors flex-1 min-w-0 truncate"
            disabled={track.locked}
            title={track.name}
          />
        </div>

        {/* Bottom row: Badges and buttons */}
        <div className="flex items-center justify-between gap-2">
          {/* Left side: Badges */}
          <div className="flex items-center gap-1 min-w-0 overflow-hidden">
            {/* Tenant badge - only show when assets are hidden */}
            {!showAssets && tenantId && (
              <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 px-1.5 py-0.5 rounded">
                {tenantColor && (
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tenantColor }}
                  />
                )}
                <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap truncate" title={`Tenant: ${tenantId}`}>
                  {tenantId}
                </span>
              </div>
            )}
            {track.dataType && (
              <span className="text-[10px] font-medium text-green-300 bg-gray-900 border border-gray-700 px-1 py-0.5 rounded whitespace-nowrap" title="Data Type">
                {track.dataType}
              </span>
            )}
            {track.unit && (
              <span className="text-[10px] font-medium text-blue-300 bg-gray-900 border border-gray-700 px-1.5 py-0.5 rounded-full whitespace-nowrap" title="Unit">
                {track.unit}
              </span>
            )}
          </div>

          {/* Right side: Control buttons */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Visibility toggle button */}
            <button
              onClick={() => toggleTrackVisible(track.id)}
              className="p-1 rounded hover:bg-gray-700 transition-colors"
              title={track.visible ? 'Hide property' : 'Show property'}
            >
              {track.visible ? (
                <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path
                    fillRule="evenodd"
                    d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                    clipRule="evenodd"
                  />
                  <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                </svg>
              )}
            </button>

          </div>
        </div>
      </div>

      {/* Track content area with clips */}
      <div
        ref={trackRef}
        className={`relative flex-1 z-0 transition-colors ${isHighlighted ? 'bg-cyan-500/40' : 'bg-track-bg'}`}
        style={{ height: `${track.height}px`, width: `${width}px` }}
        onClick={handleTrackClick}
        onDoubleClick={handleDoubleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-track-lane="true"
        data-track-index={trackIndex}
      >
        {/* Grid lines */}
        {timeline.gridSnap && (() => {
          // Calculate number of grid lines
          const gridLineCount = Math.floor(width / (timeline.snapInterval * zoom));

          // Skip grid lines if there would be too many (performance optimization)
          // This happens when zoom is very small (viewing large time ranges)
          const MAX_GRID_LINES = 1000;
          if (gridLineCount > MAX_GRID_LINES) {
            return null; // Don't render grid lines for extreme zoom-out levels
          }

          return (
            <div className="absolute inset-0 pointer-events-none">
              {Array.from(
                { length: gridLineCount },
                (_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px bg-gray-700 opacity-30"
                    style={{ left: `${i * timeline.snapInterval * zoom}px` }}
                  />
                )
              )}
            </div>
          );
        })()}

        {/* Clips */}
        <AnimatePresence>
          {track.clips.map((clip) => (
            <Clip key={clip.id} clip={clip} zoom={zoom} trackIndex={trackIndex} />
          ))}
        </AnimatePresence>

        {/* Drop zone indicator when dragging */}
        {track.locked && (
          <div className="absolute inset-0 bg-red-900 bg-opacity-10 pointer-events-none flex items-center justify-center">
            <span className="text-red-400 text-sm">Track Locked</span>
          </div>
        )}
      </div>
    </div>
  );
};