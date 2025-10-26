import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Group } from '../Group/Group';
import { GhostClip } from '../Clip/GhostClip';
import { SelectionOverlay } from '../SelectionOverlay/SelectionOverlay';
import { SnapIndicator } from '../SnapIndicator/SnapIndicator';
import { VisibilityTree } from '../VisibilityTree/VisibilityTree';
import { DateRangePicker } from '../DateRangePicker/DateRangePicker';
import { Navigator } from '../Navigator/Navigator';
import { motion } from 'framer-motion';
import './Timeline.css';

export const Timeline: React.FC = () => {
  const {
    dataJobs,
    activeJobId,
    timeline,
    ghostClips,
    selection,
    snapIndicatorPosition,
    inspectorVisible,
    jobQueueVisible,
    settingsVisible,
    showAssets,
    showAspects,
    treeWidth,
    trackHeaderWidth,
    setScroll,
    setZoom,
    setPlayhead,
    addGroup,
    paste,
    clearSelection,
    removeSelectedClips,
    copySelection,
    cut,
    toggleInspector,
    toggleJobQueue,
    toggleSettings,
    toggleShowAssets,
    toggleShowAspects,
  } = useAppStore();

  // Get groups from active job
  const activeJob = dataJobs.find(job => job.id === activeJobId);
  const groups = activeJob?.groups || [];

  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isDraggingHeaderResize, setIsDraggingHeaderResize] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | null>(null); // Track container width for proper sizing

  // Calculate timeline width
  // Track headers are resizable, independent of tree width
  const calculatedWidth = timeline.duration * timeline.zoom;
  // Ensure timeline always extends at least to fill the visible container
  // This prevents container background showing through when timeline is narrower than viewport
  // containerWidth is already the width AFTER the VisibilityTree, so just subtract track header
  const minWidth = containerWidth !== null
    ? Math.max(calculatedWidth, containerWidth - trackHeaderWidth)
    : calculatedWidth;
  const timelineWidth = minWidth + trackHeaderWidth;


  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScroll(target.scrollLeft, target.scrollTop);
  };

  // Handle playhead drag
  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingPlayhead(true);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (rect) {
        // Calculate x position relative to timeline container
        const x = e.clientX - rect.left;

        // Subtract track header width to get position in track content area
        // This ensures playhead can't go behind the track header
        const xInTrackArea = Math.max(trackHeaderWidth, x);

        // Convert to time (subtract header offset)
        let time = (xInTrackArea - trackHeaderWidth) / timeline.zoom;

        // Snap to grid if enabled
        if (timeline.gridSnap) {
          time = Math.round(time / timeline.snapInterval) * timeline.snapInterval;
        }

        // Clamp to valid time range
        time = Math.max(0, Math.min(time, timeline.duration));

        setPlayhead(time);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle timeline click to move playhead
  const handleTimelineClick = (e: React.MouseEvent) => {
    // Use currentTarget (the time ruler div) instead of timelineRef (tracks container)
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect && !isDraggingPlayhead) {
      // Calculate x position relative to time ruler
      const x = e.clientX - rect.left;

      // Convert to time - no need to subtract header since time ruler starts at time 0
      let time = x / timeline.zoom;

      // Snap to grid if enabled
      if (timeline.gridSnap) {
        time = Math.round(time / timeline.snapInterval) * timeline.snapInterval;
      }

      // Clamp to valid time range
      time = Math.max(0, Math.min(time, timeline.duration));

      setPlayhead(time);
    }
  };

  // Handle track header resize drag
  const handleHeaderResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingHeaderResize(true);

    const startX = e.clientX;
    const startWidth = trackHeaderWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = startWidth + deltaX;

      // setTrackHeaderWidth already enforces min/max constraints (100-400)
      useAppStore.getState().setTrackHeaderWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingHeaderResize(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Format time for display - converts relative seconds to absolute timestamp (local time)
  const formatTime = (relativeSeconds: number): string => {
    const startDate = new Date(timeline.startTime);
    const absoluteDate = new Date(startDate.getTime() + relativeSeconds * 1000);

    // Format as local time in ISO-like format: YYYY-MM-DD HH:MM:SS
    const year = absoluteDate.getFullYear();
    const month = String(absoluteDate.getMonth() + 1).padStart(2, '0');
    const day = String(absoluteDate.getDate()).padStart(2, '0');
    const hours = String(absoluteDate.getHours()).padStart(2, '0');
    const minutes = String(absoluteDate.getMinutes()).padStart(2, '0');
    const seconds = String(absoluteDate.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  // Format time as separate date and time strings for timeline markers (local time)
  const formatTimeForMarker = (relativeSeconds: number): { date: string; time: string } => {
    const startDate = new Date(timeline.startTime);
    const absoluteDate = new Date(startDate.getTime() + relativeSeconds * 1000);

    // Format as local time
    const year = absoluteDate.getFullYear();
    const month = String(absoluteDate.getMonth() + 1).padStart(2, '0');
    const day = String(absoluteDate.getDate()).padStart(2, '0');
    const hours = String(absoluteDate.getHours()).padStart(2, '0');
    const minutes = String(absoluteDate.getMinutes()).padStart(2, '0');
    const seconds = String(absoluteDate.getSeconds()).padStart(2, '0');

    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}:${seconds}`
    };
  };

  // Generate time ruler markers
  const generateTimeMarkers = () => {
    const markers = [];

    // Calculate smart interval based on VIEWPORT duration (not total timeline duration)
    // This ensures markers are appropriate for what's actually visible
    let interval: number;
    const durationInHours = timeline.viewportDuration / 3600;

    if (durationInHours > 48) {
      // More than 2 days: show markers every 2 hours
      interval = 3600 * 2;
    } else if (durationInHours > 24) {
      // 1-2 days: show markers every hour
      interval = 3600;
    } else if (durationInHours > 12) {
      // 12-24 hours: show markers every 30 minutes
      interval = 1800;
    } else if (durationInHours > 6) {
      // 6-12 hours: show markers every 15 minutes
      interval = 900;
    } else if (durationInHours > 3) {
      // 3-6 hours: show markers every 10 minutes
      interval = 600;
    } else if (durationInHours > 1) {
      // 1-3 hours: show markers every 5 minutes
      interval = 300;
    } else {
      // Less than 1 hour: show markers every 2 minutes
      interval = 120;
    }

    // Limit total number of markers to prevent performance issues
    // Use TOTAL duration for marker count (markers span entire timeline, not just viewport)
    const maxMarkers = 300;
    const estimatedMarkers = Math.ceil(timeline.duration / interval);
    if (estimatedMarkers > maxMarkers) {
      interval = Math.ceil(timeline.duration / maxMarkers);
    }

    // Calculate minimum spacing between markers to prevent overlap
    // Approximate width of time marker label: ~80px (date + time on 2 lines)
    const MIN_LABEL_WIDTH = 80;
    const markerSpacingPx = interval * timeline.zoom;

    // Calculate skip factor: show every Nth marker when zoomed out
    let skipFactor = 1;
    if (markerSpacingPx < MIN_LABEL_WIDTH) {
      skipFactor = Math.ceil(MIN_LABEL_WIDTH / markerSpacingPx);
    }

    let markerIndex = 0;
    // Loop through ENTIRE timeline duration (not just viewport)
    // Markers must exist across full range so they're visible when scrolling
    for (let i = 0; i <= timeline.duration; i += interval) {
      // Skip markers to prevent overlap when zoomed out
      if (markerIndex % skipFactor !== 0) {
        markerIndex++;
        continue;
      }

      // i is time in seconds from timeline start
      const { date, time } = formatTimeForMarker(i);

      markers.push(
        <div
          key={i}
          className="absolute flex flex-col items-center"
          style={{ left: `${i * timeline.zoom}px` }}
        >
          <div className="h-2 w-px bg-gray-600" />
          <div className="flex flex-col items-center mt-1">
            <span className="text-[10px] text-gray-500 leading-tight whitespace-nowrap">{date}</span>
            <span className="text-xs text-gray-400 leading-tight whitespace-nowrap">{time}</span>
          </div>
        </div>
      );

      markerIndex++;
    }

    return markers;
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Delete selected clips
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.clipIds.size > 0) {
        e.preventDefault();
        removeSelectedClips();
      }

      // Copy clips
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selection.clipIds.size > 0) {
        e.preventDefault();
        copySelection();
      }

      // Cut clips
      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selection.clipIds.size > 0) {
        e.preventDefault();
        cut();
      }

      // Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        useAppStore.getState().selectAll();
      }

      // Escape to clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
      }

      // Zoom to fit selected clips (Z key - like Propellerhead Reason)
      if (e.key === 'z' && !e.ctrlKey && !e.metaKey && selection.clipIds.size > 0) {
        e.preventDefault();

        // Get all selected clips
        const selectedClips = useAppStore.getState().getSelectedClips();
        if (selectedClips.length === 0) return;

        // Find the time range that encompasses all selected clips
        let minStart = Infinity;
        let maxEnd = -Infinity;

        selectedClips.forEach(clip => {
          minStart = Math.min(minStart, clip.timeRange.start);
          maxEnd = Math.max(maxEnd, clip.timeRange.end);
        });

        // Add 10% padding on each side for better visibility
        const duration = maxEnd - minStart;
        const padding = duration * 0.1;
        const viewportStart = Math.max(0, minStart - padding);
        const viewportDuration = Math.min(timeline.duration - viewportStart, duration + (padding * 2));

        // Calculate and set the zoom FIRST (before setViewport)
        const timelineContainer = document.querySelector('.hide-scrollbar') as HTMLElement;
        // timelineContainer.clientWidth is already after VisibilityTree, just subtract track header
        const availableWidth = (timelineContainer?.clientWidth || 1200) - trackHeaderWidth;
        const newZoom = availableWidth / viewportDuration;
        useAppStore.getState().setZoom(Math.max(0.001, Math.min(200, newZoom)));

        // Now update Navigator viewport
        useAppStore.getState().setViewport(viewportStart, viewportDuration);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selection.clipIds, removeSelectedClips, copySelection, cut, clearSelection, timeline.duration]);

  // Sync DOM scroll position when store scrollX changes (from Navigator)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Only update DOM if it's different from store value
    // This prevents infinite loops (scroll event → setScroll → this effect → scroll event)
    if (Math.abs(container.scrollLeft - timeline.scrollX) > 1) {
      container.scrollLeft = timeline.scrollX;
    }
  }, [timeline.scrollX]);

  // Recalculate zoom when viewport duration or container width changes
  // NOTE: trackHeaderWidth is NOT in dependencies - we read current value but don't re-run when it changes
  // This keeps timeline scale constant when resizing headers (just makes it more scrollable)
  useEffect(() => {
    // Wait for ResizeObserver to set containerWidth before calculating zoom
    if (containerWidth === null) return;

    // Read current trackHeaderWidth from store (avoids stale closure without triggering on changes)
    const currentTrackHeaderWidth = useAppStore.getState().trackHeaderWidth;
    const availableWidth = containerWidth - currentTrackHeaderWidth;
    const newZoom = availableWidth / timeline.viewportDuration;
    // Allow very low zoom for large time ranges (0.0001 = 10000 seconds per pixel = ~2.7 hours/px)
    // Max 200 pixels/second for extreme zoom in
    const clampedZoom = Math.max(0.0001, Math.min(200, newZoom));

    setZoom(clampedZoom);
  }, [timeline.viewportDuration, containerWidth, setZoom]);

  // Track container width and recalculate zoom when it changes
  useEffect(() => {
    const timelineContainer = scrollContainerRef.current;
    if (!timelineContainer) return;

    // Create a ResizeObserver to detect when available width changes (panels opening/closing, window resize)
    const resizeObserver = new ResizeObserver(() => {
      const newContainerWidth = timelineContainer.clientWidth;
      // Update container width state - this will trigger the useEffect that recalculates zoom
      setContainerWidth(newContainerWidth);
    });

    resizeObserver.observe(timelineContainer);

    return () => {
      resizeObserver.disconnect();
    };
  }, []); // No dependencies - observer only needs to track container width changes

  return (
    <div className="flex flex-col h-full bg-timeline-bg">
      {/* Timeline header with controls */}
      <div className="flex items-center justify-between p-2 bg-gray-900 border-b border-gray-700 gap-4">
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-gray-200 flex-shrink-0">Timeline</h2>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <label className="flex items-center text-sm text-gray-400 whitespace-nowrap">
              <input
                type="checkbox"
                checked={timeline.gridSnap}
                onChange={() => useAppStore.getState().toggleGridSnap()}
                className="mr-2"
              />
              Snap to Grid
            </label>
          </div>

          {/* View mode toggles */}
          <div className="flex items-center gap-1 flex-shrink-0 border-l border-gray-700 pl-2">
            <button
              onClick={toggleShowAssets}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                showAssets
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={showAssets ? 'Hide Asset Groups' : 'Show Asset Groups'}
            >
              Assets
            </button>
            <button
              onClick={toggleShowAspects}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                showAspects
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={showAspects ? 'Hide Aspect Groups' : 'Show Aspect Groups'}
            >
              Aspects
            </button>
          </div>

          <div className="text-sm text-gray-400 truncate">
            Playhead: {formatTime(timeline.playheadPosition)}
          </div>

          {/* Panel visibility toggles */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={toggleInspector}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                inspectorVisible
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={inspectorVisible ? 'Hide Inspector' : 'Show Inspector'}
            >
              Inspector
            </button>
            <button
              onClick={toggleJobQueue}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                jobQueueVisible
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={jobQueueVisible ? 'Hide Job Queue' : 'Show Job Queue'}
            >
              Jobs
            </button>
            <button
              onClick={toggleSettings}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                settingsVisible
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={settingsVisible ? 'Hide Settings' : 'Show Settings'}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Date range picker - fixed on right */}
        <div className="flex-shrink-0">
          <DateRangePicker />
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Visibility Tree Sidebar */}
        <VisibilityTree />

        {/* Right side: Scrollable timeline + Navigator */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Scrollable timeline area - scrollbar hidden via CSS */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-auto hide-scrollbar bg-timeline-bg"
            onScroll={handleScroll}
          >
            {/* Time ruler */}
            <div className="sticky top-0 z-40 bg-timeline-bg border-b border-gray-700">
              {/* Actual time ruler that scrolls - full width */}
              <div
                className="h-14 bg-gray-800 cursor-pointer"
                style={{ width: `${timelineWidth}px` }}
                onClick={handleTimelineClick}
                onDoubleClick={handleTimelineClick}
              >
                {generateTimeMarkers()}
              </div>
            </div>

            {/* Sticky track header spacer - SEPARATE, overlays time ruler */}
            <div
              className="bg-gray-900 border-r border-gray-700 h-14"
              style={{
                width: `${trackHeaderWidth}px`,
                position: 'sticky',
                top: 0,
                left: 0,
                marginTop: '-56px', // Pull up to overlay time ruler (h-14 = 56px)
                zIndex: 50
              }}
            >
              {/* Resize handle - draggable vertical bar */}
              <div
                className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-50 transition-colors ${
                  isDraggingHeaderResize ? 'bg-blue-500' : 'hover:bg-blue-400 bg-transparent'
                }`}
                onMouseDown={handleHeaderResizeMouseDown}
                title="Drag to resize track headers"
              />
            </div>

            {/* Tracks container */}
            <div
              ref={timelineRef}
              className="relative"
              style={{ width: `${timelineWidth}px` }}
              data-timeline-container="true"
            >
              {/* Playhead */}
              <motion.div
                className={`absolute top-0 bottom-0 w-0.5 z-20 pointer-events-none ${
                  isDraggingPlayhead ? 'bg-yellow-400' : 'bg-red-500'
                }`}
                style={{ left: `${timeline.playheadPosition * timeline.zoom + trackHeaderWidth}px` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {/* Playhead handle */}
                <div
                  className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-red-500 cursor-ew-resize pointer-events-auto"
                  data-playhead-handle="true"
                  onMouseDown={handlePlayheadMouseDown}
                />
              </motion.div>

              {/* Groups with tracks - filter by visibility */}
              {groups
                .filter(group => group.visible) // Only render visible groups
                .sort((a, b) => a.index - b.index)
                .map((group, index) => {
                  // Calculate track offset for this group based on all previous VISIBLE groups
                  let trackOffset = 0;
                  const visibleGroups = groups.filter(g => g.visible).sort((a, b) => a.index - b.index);
                  for (let i = 0; i < index; i++) {
                    const prevGroup = visibleGroups[i];
                    for (const aspect of prevGroup.aspects) {
                      if (aspect.visible) { // Only count visible aspects
                        trackOffset += aspect.tracks.filter(t => t.visible).length; // Only count visible tracks
                      }
                    }
                  }
                  return (
                    <Group
                      key={group.id}
                      group={group}
                      trackOffset={trackOffset}
                      zoom={timeline.zoom}
                      width={timelineWidth}
                      onClipDrop={(trackId, time) => {
                        // Handle clip drop from clipboard
                        paste(trackId, time);
                      }}
                    />
                  );
                })}

              {/* Ghost clips preview when copying - supports multiple for multi-select */}
              {ghostClips.map((ghost) => (
                <GhostClip
                  key={ghost.clipId}
                  left={ghost.left}
                  width={ghost.width}
                  top={ghost.top}
                  isIncompatible={ghost.isIncompatible}
                />
              ))}

              {/* Selection overlay for rectangular marquee selection */}
              <SelectionOverlay containerRef={timelineRef} />

              {/* Snap indicator - shows vertical line when clips align */}
              <SnapIndicator position={snapIndicatorPosition} zoom={timeline.zoom} trackHeaderWidth={trackHeaderWidth} />
            </div>
          </div>

          {/* Navigator bar - aligned with tracks area only, not under sidebar */}
          <div className="flex">
            {/* Spacer to match track headers width */}
            <div className="flex-shrink-0" style={{ width: `${trackHeaderWidth}px` }} />
            {/* Navigator */}
            <div className="flex-1">
              <Navigator />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};