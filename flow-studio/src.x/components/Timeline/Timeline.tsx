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
    groups,
    timeline,
    ghostClips,
    selection,
    snapIndicatorPosition,
    inspectorVisible,
    jobQueueVisible,
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
  } = useAppStore();

  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  // Calculate timeline width based on duration and zoom
  const timelineWidth = timeline.duration * timeline.zoom;
  console.log('[Timeline] Rendering with duration:', timeline.duration, 'zoom:', timeline.zoom, 'width:', timelineWidth);

  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScroll(target.scrollLeft, target.scrollTop);
  };

  // Handle mouse wheel zoom (only when Ctrl is held)
  const handleWheel = (e: WheelEvent) => {
    // Only handle zoom when Ctrl key is pressed
    // Otherwise allow normal vertical/horizontal scrolling
    if (!e.ctrlKey) return;

    // Prevent default zoom behavior when Ctrl+Wheel is used
    e.preventDefault();

    const container = scrollContainerRef.current;
    if (!container) return;

    // Determine zoom direction (scroll up = zoom in, scroll down = zoom out)
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(10, Math.min(200, timeline.zoom * zoomFactor));

    // Get mouse position relative to scrollable container
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Calculate time value at mouse cursor BEFORE zoom change
    const timeAtMouse = (mouseX + timeline.scrollX) / timeline.zoom;

    // Calculate new scroll position to keep same time under cursor
    const newScrollX = Math.max(0, timeAtMouse * newZoom - mouseX);

    // Update zoom level
    setZoom(newZoom);

    // Update scroll position immediately (before next render)
    // This prevents visual jump by keeping the time under cursor fixed
    requestAnimationFrame(() => {
      if (container) {
        container.scrollLeft = newScrollX;
      }
    });
  };

  // Handle playhead drag
  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingPlayhead(true);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (rect) {
        const x = Math.max(0, Math.min(e.clientX - rect.left + timeline.scrollX, timelineWidth));
        let time = x / timeline.zoom;

        // Snap to grid if enabled
        if (timeline.gridSnap) {
          time = Math.round(time / timeline.snapInterval) * timeline.snapInterval;
        }

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
    const rect = timelineRef.current?.getBoundingClientRect();
    if (rect && !isDraggingPlayhead) {
      const x = e.clientX - rect.left + timeline.scrollX;
      let time = x / timeline.zoom;

      // Snap to grid if enabled
      if (timeline.gridSnap) {
        time = Math.round(time / timeline.snapInterval) * timeline.snapInterval;
      }

      setPlayhead(time);
    }
  };

  // Format time for display - converts relative seconds to absolute timestamp
  const formatTime = (seconds: number): string => {
    const startDate = new Date(timeline.startTime);
    const absoluteDate = new Date(startDate.getTime() + seconds * 1000);
    return absoluteDate.toISOString();
  };

  // Format time as separate date and time strings for timeline markers
  const formatTimeForMarker = (seconds: number): { date: string; time: string } => {
    const startDate = new Date(timeline.startTime);
    const absoluteDate = new Date(startDate.getTime() + seconds * 1000);
    const isoString = absoluteDate.toISOString();

    // Split ISO string: "2025-10-12T18:07:23.000Z" -> date: "2025-10-12", time: "18:07:23"
    const [datePart, timePart] = isoString.split('T');
    const timeWithoutMs = timePart.split('.')[0]; // Remove milliseconds and Z

    return {
      date: datePart,
      time: timeWithoutMs
    };
  };

  // Generate time ruler markers
  const generateTimeMarkers = () => {
    const markers = [];

    // Calculate smart interval based on duration and zoom
    // More granular intervals for better visibility when panning
    let interval: number;
    const durationInHours = timeline.duration / 3600;

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
    // Increased limit for more granularity
    const maxMarkers = 300;
    const estimatedMarkers = Math.ceil(timeline.duration / interval);
    if (estimatedMarkers > maxMarkers) {
      interval = Math.ceil(timeline.duration / maxMarkers);
    }

    for (let i = 0; i <= timeline.duration; i += interval) {
      const { date, time } = formatTimeForMarker(i);

      markers.push(
        <div
          key={i}
          className="absolute flex flex-col items-center"
          style={{ left: `${i * timeline.zoom}px` }}
        >
          <div className="h-2 w-px bg-gray-600" />
          <div className="flex flex-col items-center mt-1">
            <span className="text-[10px] text-gray-500 leading-tight">{date}</span>
            <span className="text-xs text-gray-400 leading-tight">{time}</span>
          </div>
        </div>
      );
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
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selection.clipIds, removeSelectedClips, copySelection, cut, clearSelection]);

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

  // Handle mouse wheel zoom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Add wheel event listener with passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [timeline.zoom, timeline.scrollX]); // Re-register when zoom/scroll changes

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
            className="flex-1 overflow-auto hide-scrollbar"
            onScroll={handleScroll}
          >
            {/* Time ruler - matches track layout with sticky left spacer */}
            <div className="flex border-b border-gray-700">
              {/* Empty spacer to match track headers - sticky so it stays visible */}
              <div className="w-48 flex-shrink-0 bg-gray-900 sticky left-0 z-20" />

              {/* Actual time ruler that scrolls */}
              <div
                className="h-14 bg-gray-900 relative"
                style={{ width: `${timelineWidth}px` }}
                onClick={handleTimelineClick}
              >
                {generateTimeMarkers()}
              </div>
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
                style={{ left: `${timeline.playheadPosition * timeline.zoom}px` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {/* Playhead handle */}
                <div
                  className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-red-500 cursor-ew-resize pointer-events-auto"
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
              <SnapIndicator position={snapIndicatorPosition} zoom={timeline.zoom} />
            </div>
          </div>

          {/* Navigator bar - aligned with tracks area only, not under sidebar */}
          <div className="flex">
            {/* Spacer to match VisibilityTree width */}
            <div className="w-48 flex-shrink-0" />
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