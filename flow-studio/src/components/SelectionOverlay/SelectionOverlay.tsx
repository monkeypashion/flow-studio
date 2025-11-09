import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store/appStore';

interface SelectionOverlayProps {
  containerRef: React.RefObject<HTMLElement>;
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({ containerRef }) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const startPoint = useRef({ x: 0, y: 0 });
  const initialSelection = useRef<Set<string>>(new Set());
  const isSelectingRef = useRef(false); // Track selecting state in ref to avoid closure issues
  const justFinishedSelecting = useRef(false); // Prevent clicks immediately after selection

  const { selectClip, clearSelection, dataJobs, activeJobId, timeline, selection, trackHeaderWidth } = useAppStore();

  // Get groups from active job
  const activeJob = dataJobs.find(job => job.id === activeJobId);
  const groups = activeJob?.groups || [];

  // Helper to get current timeline position for live clips
  const getCurrentTimelinePosition = (): number => {
    const timelineStartMs = new Date(timeline.startTime).getTime();
    const nowMs = Date.now();
    const currentPositionInSeconds = (nowMs - timelineStartMs) / 1000;
    return currentPositionInSeconds;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Only start selection on left click with no modifiers (except shift for multi-select)
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey) return;

      // Don't start selection if clicking on a clip, control, playhead, or track header
      const target = e.target as HTMLElement;
      if (
        target.closest('[data-clip]') ||
        target.closest('[data-playhead-handle]') ||
        target.closest('button') ||
        target.closest('input') ||
        !target.closest('[data-timeline-container]')
      ) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      startPoint.current = { x, y };
      setSelectionBox({ x, y, width: 0, height: 0 });
      isSelectingRef.current = true;
      setIsSelecting(true);

      // Store initial selection if shift is held (for additive selection)
      if (e.shiftKey) {
        initialSelection.current = new Set(selection.clipIds);
      } else {
        initialSelection.current = new Set();
        clearSelection();
      }

      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isSelectingRef.current) return;

      const rect = container.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const x = Math.min(currentX, startPoint.current.x);
      const y = Math.min(currentY, startPoint.current.y);
      const width = Math.abs(currentX - startPoint.current.x);
      const height = Math.abs(currentY - startPoint.current.y);

      setSelectionBox({ x, y, width, height });

      // Find clips within selection box
      // Note: selection box is in timeline container coordinates
      const selectionRect = {
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
      };

      // Collect all clips that should be selected
      const clipsToSelect = new Set<string>(initialSelection.current);

      // IMPORTANT: Clips are positioned relative to track lanes (AFTER track headers)
      // But selection box is relative to timeline container (INCLUDES headers)
      // So we need to add header offset to clip positions
      const timelineContainer = document.querySelector('[data-timeline-container]') as HTMLElement;

      // Calculate track positions and check which clips intersect with selection
      // IMPORTANT: Only iterate through VISIBLE groups/aspects/tracks (matches Timeline rendering)

      // First, check master lane for all master clips (source/destination on single track)
      let trackIndex = 0;
      if (activeJob && activeJob.masterLane.clips.length > 0) {
        const trackElement = document.querySelector(`[data-special-lane="master"]`) as HTMLElement;

        activeJob.masterLane.clips.forEach(clip => {
          let clipTop = 0;
          let clipBottom = 0;

          if (trackElement && timelineContainer) {
            const trackRect = trackElement.getBoundingClientRect();
            const timelineRect = timelineContainer.getBoundingClientRect();
            clipTop = trackRect.top - timelineRect.top;
            clipBottom = clipTop + 80; // Default special lane height
          }

          const clipLeft = clip.timeRange.start * timeline.zoom + trackHeaderWidth;
          // Handle live clips (end is undefined)
          const clipEndTime = clip.timeRange.end !== undefined ? clip.timeRange.end : getCurrentTimelinePosition();
          const clipRight = clipEndTime * timeline.zoom + trackHeaderWidth;

          const intersects =
            clipLeft < selectionRect.right &&
            clipRight > selectionRect.left &&
            clipTop < selectionRect.bottom &&
            clipBottom > selectionRect.top;

          if (intersects) {
            clipsToSelect.add(clip.id);
          }
        });

        trackIndex++;
      }

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
                  track.clips.forEach(clip => {
                    // Get actual track position from DOM (handles scrolling and layout correctly)
                    const trackElement = document.querySelector(`[data-track-index="${trackIndex}"]`) as HTMLElement;

                    let clipTop = 0;
                    let clipBottom = 0;

                    if (trackElement && timelineContainer) {
                      const trackRect = trackElement.getBoundingClientRect();
                      const timelineRect = timelineContainer.getBoundingClientRect();
                      // Position relative to timeline container
                      clipTop = trackRect.top - timelineRect.top;
                      clipBottom = clipTop + track.height;
                    }

                    // Clip positions in timeline container coordinates
                    // Add header width to convert from track-relative to container-relative
                    const clipLeft = clip.timeRange.start * timeline.zoom + trackHeaderWidth;
                    // Handle live clips (end is undefined)
                    const clipEndTime = clip.timeRange.end !== undefined ? clip.timeRange.end : getCurrentTimelinePosition();
                    const clipRight = clipEndTime * timeline.zoom + trackHeaderWidth;

                    // Check if clip intersects with selection box (any overlap)
                    const intersects =
                      clipLeft < selectionRect.right &&
                      clipRight > selectionRect.left &&
                      clipTop < selectionRect.bottom &&
                      clipBottom > selectionRect.top;

                    if (intersects) {
                      clipsToSelect.add(clip.id);
                    }
                  });

                  trackIndex++;
                });
            });
        });

      // Update selection to match the calculated set
      // First, clear current selection
      clearSelection();
      // Then select all clips that should be selected
      clipsToSelect.forEach(clipId => {
        selectClip(clipId, true);
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
        setIsSelecting(false);
        setSelectionBox({ x: 0, y: 0, width: 0, height: 0 });

        // Set flag to block clicks for a short time
        justFinishedSelecting.current = true;
        setTimeout(() => {
          justFinishedSelecting.current = false;
        }, 100);
      }
    };

    // Capture click events to prevent track clicks after selection
    const handleClick = (e: MouseEvent) => {
      if (justFinishedSelecting.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    // Add event listeners
    // Use capture phase for click to intercept before it reaches Track
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('click', handleClick, true);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('click', handleClick, true);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [clearSelection, selectClip, dataJobs, activeJobId, timeline, selection, containerRef, groups, trackHeaderWidth]);

  if (!isSelecting || selectionBox.width === 0 || selectionBox.height === 0) {
    return null;
  }

  return (
    <motion.div
      className="absolute pointer-events-none z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        left: selectionBox.x,
        top: selectionBox.y,
        width: selectionBox.width,
        height: selectionBox.height,
        border: '2px solid rgba(59, 130, 246, 0.5)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
      }}
    />
  );
};