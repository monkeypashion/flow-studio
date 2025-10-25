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
}

export const Track: React.FC<TrackProps> = ({
  track,
  trackIndex,
  zoom,
  width,
  onClipDrop,
}) => {
  const {
    addClip,
    updateTrack,
    selectTrackClips,
    clearSelection,
    timeline,
  } = useAppStore();

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
        const x = e.clientX - rect.left + timeline.scrollX;
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
        const x = e.clientX - rect.left + timeline.scrollX;
        let time = x / zoom;

        // Snap to grid if enabled
        if (timeline.gridSnap) {
          time = Math.round(time / timeline.snapInterval) * timeline.snapInterval;
        }

        // Create new clip at click position
        addClip(track.id, {
          name: `Clip ${track.clips.length + 1}`,
          trackId: track.id,
          timeRange: {
            start: time,
            end: time + 5, // Default 5-second clip
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
        const x = e.clientX - rect.left + timeline.scrollX;
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
    <div className="flex border-b border-gray-700">
      {/* Track header - sticky so it stays visible during horizontal scroll */}
      <div className="w-48 flex-shrink-0 bg-gray-800 border-r border-gray-700 px-3 py-2 flex flex-col gap-2 sticky left-0 z-20">
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
          <div className="flex items-center gap-1 flex-wrap min-w-0">
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
            {/* Mute button */}
            <button
              onClick={() => updateTrack(track.id, { muted: !track.muted })}
              className={`p-1 rounded hover:bg-gray-700 transition-colors ${
                track.muted ? 'text-red-400' : 'text-gray-400'
              }`}
              title={track.muted ? 'Unmute' : 'Mute'}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                {track.muted ? (
                  <path
                    fillRule="evenodd"
                    d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                ) : (
                  <path
                    fillRule="evenodd"
                    d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                    clipRule="evenodd"
                  />
                )}
              </svg>
            </button>

            {/* Lock button */}
            <button
              onClick={() => updateTrack(track.id, { locked: !track.locked })}
              className={`p-1 rounded hover:bg-gray-700 transition-colors ${
                track.locked ? 'text-yellow-400' : 'text-gray-400'
              }`}
              title={track.locked ? 'Unlock' : 'Lock'}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                {track.locked ? (
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                ) : (
                  <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                )}
              </svg>
            </button>

          </div>
        </div>
      </div>

      {/* Track content area with clips */}
      <div
        ref={trackRef}
        className="relative flex-1 bg-track-bg z-0"
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