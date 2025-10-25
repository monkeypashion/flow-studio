import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Clip as ClipType } from '../../types/index';
import { useAppStore } from '../../store/appStore';

interface ClipProps {
  clip: ClipType;
  zoom: number;
  trackIndex: number;
  globalTrackTop?: number; // Absolute pixel position from timeline top
  onDragStart?: (clipId: string, type: 'move' | 'resize-left' | 'resize-right') => void;
  onDragEnd?: () => void;
}

export const Clip: React.FC<ClipProps> = ({
  clip,
  zoom,
  trackIndex,
  onDragStart,
  onDragEnd,
}) => {
  const {
    selectClip,
    updateClip,
    moveClip,
    copyClip,
    moveSelectedClips,
    copySelectedClips,
    getSelectedClips,
    timeline,
    getAllTracks,
    getTrack,
    setGhostClips,
    setSnapIndicator,
  } = useAppStore();

  // Local state
  const [dragType, setDragType] = useState<'move' | 'resize-left' | 'resize-right' | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isIncompatibleTarget, setIsIncompatibleTarget] = useState(false);

  // Refs for drag tracking
  const hasMoved = useRef(false); // Use ref instead of state to avoid effect re-runs
  const dragInfo = useRef({
    startX: 0,
    startY: 0,
    startTimeRange: { start: 0, end: 0 },
    startTrackIndex: 0,
    startTrackPixelTop: 0, // Store the actual pixel position
    startTrackPixelLeft: 0, // Store the actual horizontal position
    currentTrackId: '',
    sourceUnit: undefined as string | undefined,
    sourceDataType: undefined as string | undefined,
    isMultiSelect: false,
    selectedClipsInfo: [] as Array<{ id: string; startTime: number; trackId: string }>,
    originalPositions: [] as Array<{ id: string; start: number; end: number }>,
    isCopyMode: false, // Track copy mode in ref to avoid state race conditions
  });

  // Calculate clip dimensions
  const duration = clip.timeRange.end - clip.timeRange.start;
  const width = duration * zoom;
  const left = clip.timeRange.start * zoom;

  // Helper function to get all snap points from other clips and playhead
  const getSnapPoints = (excludeClipIds: string[] = []) => {
    const snapPoints: number[] = [];
    const allTracks = getAllTracks();

    // Use pixel-based threshold that adapts to zoom level
    // 15 pixels is a comfortable snapping distance regardless of zoom
    const SNAP_THRESHOLD_PIXELS = 15; // pixels
    const SNAP_THRESHOLD = SNAP_THRESHOLD_PIXELS / zoom; // convert to seconds

    // Add playhead position as a snap point
    snapPoints.push(timeline.playheadPosition);

    allTracks.forEach(track => {
      track.clips.forEach(c => {
        // Don't snap to ourselves or other selected clips (when multi-selecting)
        if (!excludeClipIds.includes(c.id)) {
          snapPoints.push(c.timeRange.start);
          snapPoints.push(c.timeRange.end);
        }
      });
    });

    return { snapPoints, threshold: SNAP_THRESHOLD };
  };

  // Helper function to apply snapping to a time value
  const applySnapping = (time: number, excludeClipIds: string[] = []): { snappedTime: number; didSnap: boolean; snapPosition: number | null } => {
    const { snapPoints, threshold } = getSnapPoints(excludeClipIds);

    // Find closest snap point
    let closestPoint: number | null = null;
    let closestDistance = Infinity;

    for (const point of snapPoints) {
      const distance = Math.abs(time - point);
      if (distance < closestDistance && distance <= threshold) {
        closestDistance = distance;
        closestPoint = point;
      }
    }

    if (closestPoint !== null) {
      return { snappedTime: closestPoint, didSnap: true, snapPosition: closestPoint };
    }

    return { snappedTime: time, didSnap: false, snapPosition: null };
  };

  // Helper function to create ghost clips for all selected clips
  const createGhostClipsForSelection = useCallback((targetTrackIndex: number, startTrackIndex: number, deltaTime: number, isIncompatible: boolean) => {
    const selectedClips = getSelectedClips();
    const allTracks = getAllTracks();
    const TRACK_HEADER_WIDTH = 192;

    // Calculate vertical offset: how many tracks to move
    const trackOffset = targetTrackIndex - startTrackIndex;

    return selectedClips.map((selectedClip) => {
      const clipTrack = getTrack(selectedClip.trackId);
      if (!clipTrack) return null;

      // Find track index for this clip's ORIGINAL position
      const clipTrackIndex = allTracks.findIndex(t => t.id === selectedClip.trackId);

      // Calculate new time position (same for all clips - horizontal movement)
      // deltaTime is already snapped (includes both clip-to-clip and grid snapping)
      // so we don't need to snap again here
      let newStart = selectedClip.timeRange.start + deltaTime;
      newStart = Math.max(0, newStart);

      const clipDuration = selectedClip.timeRange.end - selectedClip.timeRange.start;
      const clipWidth = clipDuration * zoom;
      const ghostLeft = newStart * zoom + TRACK_HEADER_WIDTH;

      // Apply the vertical offset to show where clip will be pasted
      // Each ghost moves by the same amount as the dragged clip
      const ghostTrackIndex = Math.min(
        Math.max(0, clipTrackIndex + trackOffset),
        allTracks.length - 1
      );

      const ghostTrackElement = document.querySelector(`[data-track-index="${ghostTrackIndex}"]`) as HTMLElement;
      const timelineContainer = document.querySelector('[data-timeline-container]') as HTMLElement;

      let ghostTop = 0;
      if (ghostTrackElement && timelineContainer) {
        const trackRect = ghostTrackElement.getBoundingClientRect();
        const timelineRect = timelineContainer.getBoundingClientRect();
        // getBoundingClientRect difference already accounts for scroll
        ghostTop = trackRect.top - timelineRect.top + 4;
      }

      return {
        clipId: selectedClip.id,
        left: ghostLeft,
        width: clipWidth,
        top: ghostTop,
        isIncompatible,
      };
    }).filter(Boolean) as Array<{
      clipId: string;
      left: number;
      width: number;
      top: number;
      isIncompatible: boolean;
    }>;
  }, [getSelectedClips, getAllTracks, getTrack, zoom]);

  // Get clip color based on state
  const getClipColor = () => {
    switch (clip.state) {
      case 'idle': return 'bg-clip-idle';
      case 'uploading': return 'bg-clip-uploading';
      case 'processing': return 'bg-clip-processing';
      case 'complete': return 'bg-clip-complete';
      case 'error': return 'bg-clip-error';
      default: return 'bg-gray-600';
    }
  };

  // Handle mouse down on clip or resize handles
  const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'resize-left' | 'resize-right') => {
    e.preventDefault();
    e.stopPropagation();

    // Check if this is a multi-selection scenario BEFORE modifying selection
    const selectedClipsBefore = getSelectedClips();
    const isMultiSelectDrag = selectedClipsBefore.length > 1 && clip.selected;

    // Only update selection if:
    // 1. Shift/Ctrl/Cmd is held (adding to selection), OR
    // 2. This clip is NOT already part of a multi-selection
    if (e.shiftKey || e.ctrlKey || e.metaKey || !isMultiSelectDrag) {
      // Determine selection mode:
      // - Shift: range selection (select all clips between anchor and clicked clip)
      // - Ctrl/Cmd: add to selection (toggle this clip in selection)
      // - Neither: single selection (clear others and select this clip)
      const isRangeSelect = e.shiftKey && !e.ctrlKey && !e.metaKey;
      const isMultiAdd = (e.ctrlKey || e.metaKey) && !e.shiftKey;

      selectClip(clip.id, isMultiAdd, isRangeSelect);
    }

    // Get the source track to store its unit and data type
    const sourceTrack = getTrack(clip.trackId);

    // Re-get selected clips after potential selection update
    const selectedClips = getSelectedClips();
    const isMultiSelect = selectedClips.length > 1;

    // Get the clip element
    const clipElement = e.currentTarget as HTMLElement;

    // Get the current track element (parent of the clip)
    const trackElement = clipElement.closest('[data-track-lane]') as HTMLElement;

    // Get the timeline container
    const timelineContainer = document.querySelector('[data-timeline-container]') as HTMLElement;

    // Fix: Clips are positioned relative to track lanes (after headers)
    // Ghost is positioned relative to timeline container (includes headers)
    // Track headers are 192px wide, so we need to add that offset
    const TRACK_HEADER_WIDTH = 192;
    let initialGhostLeft = left + TRACK_HEADER_WIDTH;
    let initialGhostTop = 0;

    if (trackElement && timelineContainer) {
      // Get all bounding rects
      const trackRect = trackElement.getBoundingClientRect();
      const timelineRect = timelineContainer.getBoundingClientRect();

      // Calculate position relative to timeline container
      // getBoundingClientRect gives viewport coords, so difference gives relative position
      // No need to add scroll - the calculation already accounts for it
      initialGhostTop = trackRect.top - timelineRect.top + 4; // +4 for clip padding

    }

    // Set drag info - store the adjusted position for reuse
    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTimeRange: { ...clip.timeRange },
      startTrackIndex: trackIndex,
      startTrackPixelTop: initialGhostTop,
      startTrackPixelLeft: initialGhostLeft, // This now includes the header adjustment
      currentTrackId: clip.trackId,
      sourceUnit: sourceTrack?.unit,
      sourceDataType: sourceTrack?.dataType,
      isMultiSelect,
      selectedClipsInfo: isMultiSelect ? selectedClips.map(c => ({
        id: c.id,
        startTime: c.timeRange.start,
        trackId: c.trackId,
      })) : [],
      originalPositions: isMultiSelect ? selectedClips.map(c => ({
        id: c.id,
        start: c.timeRange.start,
        end: c.timeRange.end,
      })) : [],
    };

    setDragType(type);
    hasMoved.current = false; // Reset movement flag

    // Don't set copying mode immediately on Ctrl+click - wait for actual drag movement
    if (type === 'move') {
      // We'll determine copying mode after movement threshold is reached
    }

    if (onDragStart) {
      onDragStart(clip.id, type);
    }
  };

  // Handle mouse move during drag
  useEffect(() => {
    if (!dragType) return;

    const DRAG_THRESHOLD = 3; // pixels - minimum movement to consider it a drag
    let rafId: number | null = null;
    let lastEvent: MouseEvent | null = null;

    // Cache DOM elements to avoid repeated queries
    const timelineContainer = document.querySelector('[data-timeline-container]') as HTMLElement;
    const allTracks = getAllTracks();

    const processMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragInfo.current.startX;
      const deltaY = e.clientY - dragInfo.current.startY;
      const deltaTime = deltaX / zoom;

      // Check if we've moved past the threshold
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (!hasMoved.current && distance > DRAG_THRESHOLD) {
        hasMoved.current = true;

        // NOW we can determine if this is a copy operation
        if (dragType === 'move') {
          const shouldCopy = e.ctrlKey || e.metaKey;
          dragInfo.current.isCopyMode = shouldCopy; // Set in ref immediately
          setIsCopying(shouldCopy); // Also set in state for UI updates
          document.body.style.cursor = shouldCopy ? 'copy' : 'move';

          // Show ghost if copying
          if (shouldCopy) {
            if (dragInfo.current.isMultiSelect) {
              // Show ghosts for all selected clips
              const ghosts = createGhostClipsForSelection(dragInfo.current.startTrackIndex, dragInfo.current.startTrackIndex, 0, false);
              setGhostClips(ghosts);
            } else {
              // Single clip ghost
              setGhostClips([{
                clipId: clip.id,
                left: dragInfo.current.startTrackPixelLeft,
                width: width,
                top: dragInfo.current.startTrackPixelTop,
                isIncompatible: false,
              }]);
            }
          }
        }
      }

      // Only process drag operations after movement threshold
      if (!hasMoved.current && distance <= DRAG_THRESHOLD) {
        return; // Don't process until we've moved enough
      }

      if (dragType === 'move') {
        // Calculate target track (use cached allTracks)
        const trackHeight = 80;
        const trackOffset = Math.round(deltaY / trackHeight);
        const targetTrackIndex = Math.min(
          Math.max(0, dragInfo.current.startTrackIndex + trackOffset),
          allTracks.length - 1
        );
        const targetTrack = allTracks[targetTrackIndex];

        // Calculate new time position
        let newStart = dragInfo.current.startTimeRange.start + deltaTime;
        const duration = dragInfo.current.startTimeRange.end - dragInfo.current.startTimeRange.start;
        let newEnd = newStart + duration;

        // Get excluded clip IDs
        // For MOVE: don't snap to selected clips (clips can't snap to themselves)
        // For COPY: don't exclude any clips (ghosts should snap to originals)
        const selectedClips = getSelectedClips();
        const excludeIds = !dragInfo.current.isCopyMode
          ? (dragInfo.current.isMultiSelect ? selectedClips.map(c => c.id) : [clip.id])
          : [];

        // Apply clip-to-clip snapping (check both start and end positions)
        const snapStart = applySnapping(newStart, excludeIds);
        const snapEnd = applySnapping(newEnd, excludeIds);

        // Determine which snap indicator to show
        let snapIndicatorPos: number | null = null;

        // Use whichever snap is closer (start or end)
        if (snapStart.didSnap && snapEnd.didSnap) {
          // Both snapped - use the one with closer distance
          const startDist = Math.abs(newStart - snapStart.snappedTime);
          const endDist = Math.abs(newEnd - snapEnd.snappedTime);
          if (startDist <= endDist) {
            newStart = snapStart.snappedTime;
            newEnd = newStart + duration;
            snapIndicatorPos = snapStart.snapPosition;
          } else {
            newEnd = snapEnd.snappedTime;
            newStart = newEnd - duration;
            snapIndicatorPos = snapEnd.snapPosition;
          }
        } else if (snapStart.didSnap) {
          newStart = snapStart.snappedTime;
          newEnd = newStart + duration;
          snapIndicatorPos = snapStart.snapPosition;
        } else if (snapEnd.didSnap) {
          newEnd = snapEnd.snappedTime;
          newStart = newEnd - duration;
          snapIndicatorPos = snapEnd.snapPosition;
        } else if (timeline.gridSnap) {
          // Fall back to grid snapping if no clip snapping occurred
          const snapInterval = timeline.snapInterval;
          newStart = Math.round(newStart / snapInterval) * snapInterval;
          newEnd = newStart + duration;
        }

        // Update snap indicator
        setSnapIndicator(snapIndicatorPos);

        newStart = Math.max(0, newStart);

        // Calculate snapped deltaTime for ghost positioning
        // This ensures ghosts snap to other clips just like the actual clip would
        const snappedDeltaTime = newStart - dragInfo.current.startTimeRange.start;

        // Update copy state based on current key state during drag (after snapping is calculated)
        if (hasMoved.current) {
          const shouldCopy = e.ctrlKey || e.metaKey;
          if (shouldCopy !== dragInfo.current.isCopyMode) {
            dragInfo.current.isCopyMode = shouldCopy; // Update ref immediately
            setIsCopying(shouldCopy); // Update state for UI
            document.body.style.cursor = shouldCopy ? 'copy' : 'move';

            // Show/hide ghost when toggling copy mode
            if (!shouldCopy) {
              setGhostClips([]);
            } else {
              // Re-show ghost at current position when toggling copy on
              // Use snapped deltaTime for proper positioning
              if (dragInfo.current.isMultiSelect) {
                const ghosts = createGhostClipsForSelection(dragInfo.current.startTrackIndex, dragInfo.current.startTrackIndex, snappedDeltaTime, false);
                setGhostClips(ghosts);
              } else {
                // Find the target track element using data attribute (cached container)
                const targetTrackElement = document.querySelector(`[data-track-index="${targetTrackIndex}"]`) as HTMLElement;

                let targetTop = dragInfo.current.startTrackPixelTop;
                if (targetTrackElement && timelineContainer) {
                  const trackRect = targetTrackElement.getBoundingClientRect();
                  const timelineRect = timelineContainer.getBoundingClientRect();
                  // getBoundingClientRect difference already accounts for scroll
                  targetTop = trackRect.top - timelineRect.top + 4;
                }

                const TRACK_HEADER_WIDTH = 192;
                const newGhostLeft = newStart * zoom + TRACK_HEADER_WIDTH;

                setGhostClips([{
                  clipId: clip.id,
                  left: newGhostLeft,
                  width: width,
                  top: targetTop,
                  isIncompatible: false,
                }]);
              }
            }
          }
        }

        // Check unit and data type compatibility
        const unitCompatible = !dragInfo.current.sourceUnit ||
                              !targetTrack?.unit ||
                              dragInfo.current.sourceUnit === targetTrack.unit;
        const dataTypeCompatible = !dragInfo.current.sourceDataType ||
                                  !targetTrack?.dataType ||
                                  dragInfo.current.sourceDataType === targetTrack.dataType;
        const isCompatible = unitCompatible && dataTypeCompatible;
        setIsIncompatibleTarget(!isCompatible);

        // Update cursor based on compatibility
        if (!isCompatible) {
          document.body.style.cursor = 'not-allowed';
        } else if (dragInfo.current.isCopyMode) {
          document.body.style.cursor = 'copy';
        } else {
          document.body.style.cursor = 'move';
        }

        // Update position (unless copying or incompatible)
        // IMPORTANT: Don't move actual clips when copying - only show ghosts
        // Use ref instead of state to avoid race conditions
        if (!dragInfo.current.isCopyMode && targetTrack && isCompatible) {
          if (dragInfo.current.isMultiSelect) {
            // Move all selected clips together, passing original positions
            moveSelectedClips(
              deltaTime,
              targetTrack.id !== clip.trackId ? targetTrack.id : undefined,
              dragInfo.current.originalPositions
            );
            dragInfo.current.currentTrackId = targetTrack.id;
          } else {
            // Single clip move
            if (targetTrack.id !== dragInfo.current.currentTrackId) {
              // Move to different track
              moveClip(clip.id, targetTrack.id, { start: newStart, end: newEnd });
              dragInfo.current.currentTrackId = targetTrack.id;
            } else {
              // Just update time on same track
              updateClip(clip.id, { timeRange: { start: newStart, end: newEnd } });
            }
          }
          setGhostClips([]);
        } else if (dragInfo.current.isCopyMode) {
          // Update ghost clips during drag using snapped deltaTime
          if (dragInfo.current.isMultiSelect) {
            const ghosts = createGhostClipsForSelection(targetTrackIndex, dragInfo.current.startTrackIndex, snappedDeltaTime, !isCompatible);
            setGhostClips(ghosts);
          } else {
            // Find the target track element using data attribute (cached container)
            const targetTrackElement = document.querySelector(`[data-track-index="${targetTrackIndex}"]`) as HTMLElement;

            let targetTop = dragInfo.current.startTrackPixelTop;
            if (targetTrackElement && timelineContainer) {
              const trackRect = targetTrackElement.getBoundingClientRect();
              const timelineRect = timelineContainer.getBoundingClientRect();
              // getBoundingClientRect difference already accounts for scroll
              targetTop = trackRect.top - timelineRect.top + 4;
            }

            // Ghost shows where the new clip will be placed
            // Need to add header offset since ghost is in timeline container coordinates
            const TRACK_HEADER_WIDTH = 192;
            const newGhostLeft = newStart * zoom + TRACK_HEADER_WIDTH;

            setGhostClips([{
              clipId: clip.id,
              left: newGhostLeft,
              width: width,
              top: targetTop,
              isIncompatible: !isCompatible,
            }]);
          }
        } else {
          setGhostClips([]);
        }
      } else if (dragType === 'resize-left') {
        let newStart = dragInfo.current.startTimeRange.start + deltaTime;

        // Apply clip-to-clip snapping for resize
        const snapResult = applySnapping(newStart, [clip.id]);
        if (snapResult.didSnap) {
          newStart = snapResult.snappedTime;
          setSnapIndicator(snapResult.snapPosition);
        } else {
          // Fall back to grid snapping
          if (timeline.gridSnap) {
            const snapInterval = timeline.snapInterval;
            newStart = Math.round(newStart / snapInterval) * snapInterval;
          }
          setSnapIndicator(null);
        }

        newStart = Math.max(0, Math.min(dragInfo.current.startTimeRange.end - 0.1, newStart));

        updateClip(clip.id, {
          timeRange: { start: newStart, end: clip.timeRange.end }
        });
      } else if (dragType === 'resize-right') {
        let newEnd = dragInfo.current.startTimeRange.end + deltaTime;

        // Apply clip-to-clip snapping for resize
        const snapResult = applySnapping(newEnd, [clip.id]);
        if (snapResult.didSnap) {
          newEnd = snapResult.snappedTime;
          setSnapIndicator(snapResult.snapPosition);
        } else {
          // Fall back to grid snapping
          if (timeline.gridSnap) {
            const snapInterval = timeline.snapInterval;
            newEnd = Math.round(newEnd / snapInterval) * snapInterval;
          }
          setSnapIndicator(null);
        }

        newEnd = Math.max(dragInfo.current.startTimeRange.start + 0.1, newEnd);

        updateClip(clip.id, {
          timeRange: { start: clip.timeRange.start, end: newEnd }
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Store event and schedule RAF for position updates
      // All logic (including snap indicator) now runs throttled via RAF
      lastEvent = e;
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (lastEvent) {
            processMouseMove(lastEvent);
          }
          rafId = null;
        });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Handle copy on drop - use ref to check copy mode
      if (dragType === 'move' && dragInfo.current.isCopyMode) {
        const deltaX = e.clientX - dragInfo.current.startX;
        const deltaY = e.clientY - dragInfo.current.startY;
        const deltaTime = deltaX / zoom;

        const trackHeight = 80;
        const trackOffset = Math.round(deltaY / trackHeight);
        // Use cached allTracks instead of calling getAllTracks() again
        const targetTrackIndex = Math.min(
          Math.max(0, dragInfo.current.startTrackIndex + trackOffset),
          allTracks.length - 1
        );
        const targetTrack = allTracks[targetTrackIndex];

        if (targetTrack) {
          // Check unit and data type compatibility before copying
          const unitCompatible = !dragInfo.current.sourceUnit ||
                                !targetTrack.unit ||
                                dragInfo.current.sourceUnit === targetTrack.unit;
          const dataTypeCompatible = !dragInfo.current.sourceDataType ||
                                    !targetTrack.dataType ||
                                    dragInfo.current.sourceDataType === targetTrack.dataType;
          const isCompatible = unitCompatible && dataTypeCompatible;

          if (isCompatible) {
            if (dragInfo.current.isMultiSelect) {
              // For multi-select, we need to find the earliest clip to match ghost positioning
              const selectedClips = getSelectedClips();
              const sortedClips = [...selectedClips].sort((a, b) => a.timeRange.start - b.timeRange.start);
              const earliestClip = sortedClips[0];

              // Calculate where the earliest clip should be placed
              // Apply clip-to-clip snapping (matching the ghost behavior)
              let earliestNewStart = earliestClip.timeRange.start + deltaTime;
              const earliestDuration = earliestClip.timeRange.end - earliestClip.timeRange.start;
              let earliestNewEnd = earliestNewStart + earliestDuration;

              // For COPY operations, don't exclude any clips
              // (the new clips should be able to snap to the originals)
              const excludeIds: string[] = [];

              // Apply clip-to-clip snapping
              const snapStart = applySnapping(earliestNewStart, excludeIds);
              const snapEnd = applySnapping(earliestNewEnd, excludeIds);

              // Use whichever snap is closer
              if (snapStart.didSnap && snapEnd.didSnap) {
                const startDist = Math.abs(earliestNewStart - snapStart.snappedTime);
                const endDist = Math.abs(earliestNewEnd - snapEnd.snappedTime);
                if (startDist <= endDist) {
                  earliestNewStart = snapStart.snappedTime;
                } else {
                  earliestNewStart = snapEnd.snappedTime - earliestDuration;
                }
              } else if (snapStart.didSnap) {
                earliestNewStart = snapStart.snappedTime;
              } else if (snapEnd.didSnap) {
                earliestNewStart = snapEnd.snappedTime - earliestDuration;
              } else if (timeline.gridSnap) {
                // Fall back to grid snapping
                earliestNewStart = Math.round(earliestNewStart / timeline.snapInterval) * timeline.snapInterval;
              }

              earliestNewStart = Math.max(0, earliestNewStart);

              // Copy all selected clips together
              copySelectedClips(earliestNewStart, targetTrack.id);
            } else {
              // Single clip copy - apply clip-to-clip snapping
              let newStart = dragInfo.current.startTimeRange.start + deltaTime;
              const duration = dragInfo.current.startTimeRange.end - dragInfo.current.startTimeRange.start;
              let newEnd = newStart + duration;

              // For COPY operations, don't exclude any clips
              // (the new clip should be able to snap to the original)
              const excludeIds: string[] = [];

              // Apply clip-to-clip snapping
              const snapStart = applySnapping(newStart, excludeIds);
              const snapEnd = applySnapping(newEnd, excludeIds);

              // Use whichever snap is closer
              if (snapStart.didSnap && snapEnd.didSnap) {
                const startDist = Math.abs(newStart - snapStart.snappedTime);
                const endDist = Math.abs(newEnd - snapEnd.snappedTime);
                if (startDist <= endDist) {
                  newStart = snapStart.snappedTime;
                  newEnd = newStart + duration;
                } else {
                  newEnd = snapEnd.snappedTime;
                  newStart = newEnd - duration;
                }
              } else if (snapStart.didSnap) {
                newStart = snapStart.snappedTime;
                newEnd = newStart + duration;
              } else if (snapEnd.didSnap) {
                newEnd = snapEnd.snappedTime;
                newStart = newEnd - duration;
              } else if (timeline.gridSnap) {
                // Fall back to grid snapping
                newStart = Math.round(newStart / timeline.snapInterval) * timeline.snapInterval;
                newEnd = newStart + duration;
              }

              newStart = Math.max(0, newStart);
              copyClip(clip.id, targetTrack.id, { start: newStart, end: newEnd });
            }
          } else {
            if (!unitCompatible) {
              console.warn(`Cannot copy clip: unit mismatch (${dragInfo.current.sourceUnit} → ${targetTrack.unit})`);
            }
            if (!dataTypeCompatible) {
              console.warn(`Cannot copy clip: data type mismatch (${dragInfo.current.sourceDataType} → ${targetTrack.dataType})`);
            }
          }
        }
      }

      setDragType(null);
      setIsCopying(false);
      setIsIncompatibleTarget(false);
      hasMoved.current = false;
      setGhostClips([]);
      setSnapIndicator(null); // Clear snap indicator
      dragInfo.current.currentTrackId = clip.trackId;
      dragInfo.current.isCopyMode = false; // Reset copy mode ref

      // Reset cursor
      document.body.style.cursor = '';

      if (onDragEnd) {
        onDragEnd();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragType, isCopying, clip.id, clip.timeRange, clip.trackId, zoom, timeline, getAllTracks, getTrack, updateClip, moveClip, copyClip, moveSelectedClips, copySelectedClips, getSelectedClips, setGhostClips, setSnapIndicator, onDragEnd, trackIndex, width, createGhostClipsForSelection]);

  return (
    <motion.div
      data-clip="true"
      className={`
        absolute rounded-md overflow-hidden
        ${dragType === 'move' && isIncompatibleTarget ? 'cursor-not-allowed' : dragType === 'move' && isCopying ? 'cursor-copy' : 'cursor-move'}
        ${getClipColor()}
        ${clip.selected ? 'ring-4 ring-cyan-400 shadow-xl shadow-cyan-400/40' : ''}
        ${dragType === 'move' && !isCopying && !isIncompatibleTarget ? 'opacity-75' : ''}
        ${dragType === 'move' && isCopying && !isIncompatibleTarget ? 'opacity-50 ring-4 ring-green-400 shadow-lg shadow-green-400/50' : ''}
        ${dragType === 'move' && isIncompatibleTarget ? 'opacity-50 ring-4 ring-red-500 shadow-lg shadow-red-500/50' : ''}
        transition-all duration-200
      `}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: '4px',
        bottom: '4px',
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
    >
      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-blue-500 hover:bg-opacity-30 z-10"
        onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
      />

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-blue-500 hover:bg-opacity-30 z-10"
        onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
      />

      {/* Copy indicator */}
      {dragType === 'move' && isCopying && !isIncompatibleTarget && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-20 pointer-events-none">
          <span className="text-white text-xs font-bold">+</span>
        </div>
      )}

      {/* Incompatible indicator */}
      {dragType === 'move' && isIncompatibleTarget && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg z-20 pointer-events-none">
          <span className="text-white text-xs font-bold">✕</span>
        </div>
      )}

      {/* Clip content */}
      <div className="px-3 py-2 h-full flex flex-col justify-between pointer-events-none">
        <div className="flex items-start justify-between">
          <input
            type="text"
            value={clip.name}
            onChange={(e) => {
              e.stopPropagation();
              updateClip(clip.id, { name: e.target.value });
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-xs text-white font-medium bg-transparent outline-none border-b border-transparent hover:border-gray-400 focus:border-blue-500 transition-colors flex-1 min-w-0 pointer-events-auto"
          />
          {clip.state === 'error' && (
            <span className="text-xs text-red-200 ml-2">⚠</span>
          )}
        </div>

        {/* Progress bar */}
        {(clip.state === 'uploading' || clip.state === 'processing') && (
          <div className="relative h-1 bg-black bg-opacity-30 rounded-full overflow-hidden">
            <motion.div
              className="absolute top-0 left-0 h-full bg-white bg-opacity-60"
              initial={{ width: '0%' }}
              animate={{ width: `${clip.progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        )}

        {/* Duration label */}
        <div className="text-xs text-white text-opacity-70">
          {duration.toFixed(1)}s
        </div>
      </div>
    </motion.div>
  );
};