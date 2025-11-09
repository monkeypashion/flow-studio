import React, { useRef } from 'react';
import type { Clip as ClipType, SyncMode } from '../../types/index';
import { useAppStore } from '../../store/appStore';
import { Clip } from '../Clip/Clip';
import { AnimatePresence } from 'framer-motion';

interface SpecialLaneProps {
  laneType: 'master';
  masterClips: ClipType[]; // Array of clips (0-2: source, destination)
  trackIndex: number; // Global track index for positioning
  zoom: number;
  width: number;
  height?: number;
  syncMode: SyncMode;
}

export const SpecialLane: React.FC<SpecialLaneProps> = ({
  laneType,
  masterClips,
  trackIndex,
  zoom,
  width,
  height = 80,
  syncMode,
}) => {
  const {
    timeline,
    trackHeaderWidth,
    clearSelection,
    activeJobId,
    addMasterClip,
    dataJobs,
  } = useAppStore();

  const laneRef = useRef<HTMLDivElement>(null);

  // Theme configuration for master lane
  const theme = {
    label: syncMode === 'full' ? 'Master (Full Sync)' : 'Master (Incremental)',
    bgColor: 'bg-gray-950/40',
    borderColor: 'border-gray-700',
    headerBg: 'bg-gray-800', // Solid background like regular tracks (was bg-gray-900/50)
    headerBorder: 'border-gray-700', // Match regular track border color
    textColor: 'text-gray-300',
    highlightBg: 'bg-gray-900/60',
  };

  // Handle click on empty lane area
  const handleLaneClick = (e: React.MouseEvent) => {
    // Only handle clicks on the lane background, not on clips
    if (e.target === e.currentTarget) {
      clearSelection();
    }
  };

  // Handle double-click to create master clip
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && activeJobId) {
      const rect = laneRef.current?.getBoundingClientRect();
      if (rect) {
        // Calculate position in timeline
        const x = e.clientX - rect.left;
        let time = x / zoom;

        // Validate calculated time
        if (!isFinite(time) || time < 0) {
          console.error('Invalid time calculated:', time, 'x:', x, 'zoom:', zoom);
          return;
        }

        // Snap to grid if enabled
        if (timeline.gridSnap) {
          time = Math.round(time / timeline.snapInterval) * timeline.snapInterval;
        }

        // Determine what type of clip to create based on what's missing
        let duration: number;
        let isLive = false;
        let clipName: string;
        let createAsSource: boolean;

        if (syncMode === 'incremental') {
          // Incremental mode: create LIVE clip (no end time)
          duration = 3600; // Dummy value, will be ignored
          isLive = true;
          clipName = 'Master';
          createAsSource = true; // Doesn't matter in incremental mode
        } else {
          // Full sync mode: check which clips exist by linkType
          const hasSourceMaster = masterClips.some(c => c.linkType === 'source');
          const hasDestinationMaster = masterClips.some(c => c.linkType === 'destination');

          if (hasSourceMaster && hasDestinationMaster) {
            // Both clips already exist
            return;
          } else if (!hasSourceMaster) {
            // Need to create source master
            createAsSource = true;
            clipName = 'Source Master';

            // Use default duration: 15% of visible timeline duration
            const timelineContainer = document.querySelector('.hide-scrollbar') as HTMLElement;
            const visibleWidth = (timelineContainer?.clientWidth || 1200) - trackHeaderWidth;
            const visibleDuration = visibleWidth / zoom;
            duration = Math.max(60, Math.min(3600, visibleDuration * 0.15)); // 15% of visible, min 1 minute, max 1 hour
          } else {
            // !hasDestinationMaster - need to create destination master
            createAsSource = false;
            clipName = 'Destination Master';

            // Match source master's duration
            const sourceClip = masterClips.find(c => c.linkType === 'source');
            if (sourceClip && sourceClip.timeRange.end !== undefined) {
              duration = sourceClip.timeRange.end - sourceClip.timeRange.start;
            } else {
              // Fallback: use default duration: 15% of visible timeline duration
              const timelineContainer = document.querySelector('.hide-scrollbar') as HTMLElement;
              const visibleWidth = (timelineContainer?.clientWidth || 1200) - trackHeaderWidth;
              const visibleDuration = visibleWidth / zoom;
              duration = Math.max(60, Math.min(3600, visibleDuration * 0.15)); // 15% of visible, min 1 minute, max 1 hour
            }
          }
        }

        // Create master clip
        const clipData = {
          name: clipName,
          timeRange: {
            start: time,
            end: isLive ? undefined : (time + duration),
          },
          state: 'idle' as const,
          progress: 0,
          selected: false,
        };

        addMasterClip(activeJobId, clipData);
      }
    }
  };

  // Get source and destination clips
  const sourceClip = masterClips.length > 0 ? masterClips[0] : null;
  const destinationClip = masterClips.length > 1 ? masterClips[1] : null;

  return (
    <div className={`flex border-b ${theme.borderColor}`}>
      {/* Lane header - sticky */}
      <div
        className={`flex-shrink-0 border-r ${theme.headerBg} ${theme.headerBorder} px-3 py-2 sticky left-0`}
        style={{ height: `${height}px`, width: `${trackHeaderWidth}px`, zIndex: 70 }}
      >
        {/* Label */}
        <div className="flex flex-col items-center justify-center h-full gap-1">
          <span className={`text-sm font-semibold ${theme.textColor} uppercase tracking-wider`}>
            Master
          </span>
          {/* Sync mode badge */}
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            syncMode === 'full'
              ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
              : 'bg-green-900/50 text-green-300 border border-green-700'
          }`}>
            {syncMode === 'full' ? 'Full' : 'Live'}
          </span>
          {/* Clip count indicator */}
          <span className="text-[10px] text-gray-500">
            {masterClips.length}/{syncMode === 'full' ? '2' : '1'} clips
          </span>
        </div>
      </div>

      {/* Lane content area */}
      <div
        ref={laneRef}
        className={`relative flex-1 z-0 ${theme.bgColor}`}
        style={{ height: `${height}px`, width: `${width}px` }}
        onClick={handleLaneClick}
        onDoubleClick={handleDoubleClick}
        data-special-lane="master"
        data-track-index={trackIndex}
      >
        {/* Grid lines */}
        {timeline.gridSnap && (() => {
          const gridLineCount = Math.floor(width / (timeline.snapInterval * zoom));
          const MAX_GRID_LINES = 1000;

          if (gridLineCount > MAX_GRID_LINES) {
            return null;
          }

          return (
            <div className="absolute inset-0 pointer-events-none">
              {Array.from(
                { length: gridLineCount },
                (_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px bg-gray-700 opacity-20"
                    style={{ left: `${i * timeline.snapInterval * zoom}px` }}
                  />
                )
              )}
            </div>
          );
        })()}

        {/* Render all master clips */}
        <AnimatePresence>
          {masterClips.map((clip) => (
            <Clip key={clip.id} clip={clip} zoom={zoom} trackIndex={trackIndex} />
          ))}
        </AnimatePresence>

        {/* Instructions when empty */}
        {masterClips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className={`text-xs ${theme.textColor} opacity-40`}>
              Double-click to create {syncMode === 'full' ? 'source' : 'live'} master clip
            </span>
          </div>
        )}

        {/* Show instruction for second clip in full mode */}
        {syncMode === 'full' && masterClips.length === 1 && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 pointer-events-none">
            <span className="text-[10px] text-blue-300 bg-blue-900/50 px-2 py-1 rounded border border-blue-700">
              Double-click to add destination clip
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
