import React, { useRef } from 'react';
import { useAppStore } from '../../store/appStore';

export const Navigator: React.FC = () => {
  const { timeline, setViewport, setZoom } = useAppStore();

  // Navigator bar dimensions
  const NAVIGATOR_HEIGHT = 60;
  const NAVIGATOR_PADDING = 10;

  const navigatorRef = useRef<HTMLDivElement>(null);

  // Calculate viewport box position and width as percentages
  const viewportStartPercent = (timeline.viewportStart / timeline.duration) * 100;
  const viewportWidthPercent = (timeline.viewportDuration / timeline.duration) * 100;

  // Format time for display (converts seconds to HH:MM:SS or abbreviated format)
  const formatTime = (seconds: number): string => {
    const startDate = new Date(timeline.startTime);
    const absoluteDate = new Date(startDate.getTime() + seconds * 1000);

    // For short durations, show time only
    if (timeline.duration < 86400) { // Less than 24 hours
      return absoluteDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }

    // For longer durations, show date + time
    return absoluteDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // Generate time tick marks
  const generateTimeTicks = () => {
    const ticks = [];
    const numTicks = 10; // Number of tick marks to show

    for (let i = 0; i <= numTicks; i++) {
      const timeSeconds = (timeline.duration / numTicks) * i;
      const positionPercent = (timeSeconds / timeline.duration) * 100;

      ticks.push(
        <div
          key={i}
          className="absolute flex flex-col items-center"
          style={{ left: `${positionPercent}%`, transform: 'translateX(-50%)' }}
        >
          <div className="h-2 w-px bg-gray-600" />
          <span className="text-[9px] text-gray-500 mt-0.5 whitespace-nowrap">
            {formatTime(timeSeconds)}
          </span>
        </div>
      );
    }

    return ticks;
  };

  // Calculate zoom to fit viewport duration in visible screen
  // The viewport duration should fill the available screen width
  const calculateZoomForViewport = (viewportDuration: number): number => {
    // Get the actual timeline scroll container element
    // This is the element with class 'hide-scrollbar' in Timeline.tsx
    const timelineContainer = document.querySelector('.hide-scrollbar') as HTMLElement;

    if (!timelineContainer) {
      // Fallback: use window width minus approximate sidebar width
      const availableWidth = window.innerWidth - 192; // 192px is sidebar width
      return Math.max(0.01, Math.min(200, availableWidth / viewportDuration));
    }

    // Get the actual visible width of the timeline container
    const availableWidth = timelineContainer.clientWidth;

    // Calculate zoom: pixels per second needed to fit viewport in screen
    // zoom = available screen width / viewport duration
    const zoom = availableWidth / viewportDuration;

    console.log('[Navigator] calculateZoomForViewport:', { viewportDuration, availableWidth, zoom });

    // Clamp to reasonable range (allow very low zoom for large durations)
    return Math.max(0.01, Math.min(200, zoom));
  };

  // Handle clicking on navigator bar background to jump to time
  const handleNavigatorClick = (e: React.MouseEvent) => {
    // Only handle clicks on the navigator bar itself, not the viewport box
    if (e.target !== e.currentTarget) return;

    const rect = navigatorRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    const clickTime = clickPercent * timeline.duration;

    // Center the viewport on the clicked time
    const newStart = Math.max(0, Math.min(
      clickTime - timeline.viewportDuration / 2,
      timeline.duration - timeline.viewportDuration
    ));

    setViewport(newStart, timeline.viewportDuration);
    // Note: No zoom change on click, just pan
  };

  // Handle dragging the viewport box (panning)
  const handleViewportMouseDown = (e: React.MouseEvent) => {
    // Don't trigger if clicking on resize handles
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;

    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startViewportStart = timeline.viewportStart;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = navigatorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const deltaX = e.clientX - startX;
      const deltaPercent = deltaX / rect.width;
      const deltaTime = deltaPercent * timeline.duration;

      const newStart = Math.max(0, Math.min(
        startViewportStart + deltaTime,
        timeline.duration - timeline.viewportDuration
      ));

      setViewport(newStart, timeline.viewportDuration);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle dragging left resize handle
  const handleLeftHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startViewportStart = timeline.viewportStart;
    const startViewportDuration = timeline.viewportDuration;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = navigatorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const deltaX = e.clientX - startX;
      const deltaPercent = deltaX / rect.width;
      const deltaTime = deltaPercent * timeline.duration;

      // Moving left handle changes both start position and duration
      const newStart = Math.max(0, Math.min(
        startViewportStart + deltaTime,
        startViewportStart + startViewportDuration - 1 // Minimum 1 second duration
      ));

      const newDuration = startViewportDuration - (newStart - startViewportStart);

      setViewport(newStart, newDuration);
      setZoom(calculateZoomForViewport(newDuration));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle dragging right resize handle
  const handleRightHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startViewportDuration = timeline.viewportDuration;

    console.log('[Navigator] Right handle drag started:', { startViewportDuration });

    const handleMouseMove = (e: MouseEvent) => {
      const rect = navigatorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const deltaX = e.clientX - startX;
      const deltaPercent = deltaX / rect.width;
      const deltaTime = deltaPercent * timeline.duration;

      // Moving right handle only changes duration
      const newDuration = Math.max(1, Math.min(
        startViewportDuration + deltaTime,
        timeline.duration - timeline.viewportStart
      ));

      console.log('[Navigator] Right handle dragging:', {
        deltaX,
        newDuration,
        oldDuration: startViewportDuration,
        calculatingZoom: true
      });

      const newZoom = calculateZoomForViewport(newDuration);

      setViewport(timeline.viewportStart, newDuration);
      setZoom(newZoom);

      console.log('[Navigator] Set zoom to:', newZoom);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="w-full bg-gray-900 border-t border-gray-700"
      style={{ height: `${NAVIGATOR_HEIGHT}px`, padding: `${NAVIGATOR_PADDING}px` }}
    >
      {/* Navigator bar */}
      <div
        ref={navigatorRef}
        className="relative bg-gray-800 rounded cursor-pointer"
        style={{ height: `${NAVIGATOR_HEIGHT - NAVIGATOR_PADDING * 2}px` }}
        onClick={handleNavigatorClick}
      >
        {/* Time tick marks */}
        <div className="absolute inset-0 pointer-events-none">
          {generateTimeTicks()}
        </div>

        {/* Viewport box */}
        <div
          className="absolute top-0 bottom-0 bg-blue-500 bg-opacity-30 border-2 border-blue-400 rounded cursor-move"
          style={{
            left: `${viewportStartPercent}%`,
            width: `${viewportWidthPercent}%`,
          }}
          onMouseDown={handleViewportMouseDown}
        >
          {/* Left resize handle */}
          <div
            className="resize-handle absolute left-0 top-0 bottom-0 w-2 bg-blue-400 cursor-ew-resize hover:bg-blue-300"
            onMouseDown={handleLeftHandleMouseDown}
          />

          {/* Right resize handle */}
          <div
            className="resize-handle absolute right-0 top-0 bottom-0 w-2 bg-blue-400 cursor-ew-resize hover:bg-blue-300"
            onMouseDown={handleRightHandleMouseDown}
          />
        </div>
      </div>
    </div>
  );
};
