import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
    trackHeaderWidth,
    getAllTracks,
    getTrack,
    setGhostClips,
    setSnapIndicator,
    isMultiSelectDragIncompatible,
    setMultiSelectDragIncompatible,
    linkClipTo,
    dataJobs,
    activeJobId,
    setClipAsSource,
    setClipAsDestination,
    setClipAsNone,
    setDestinationSourceClip,
    hoveredClipId,
    setHoveredClipId,
    getClip,
    showSource,
  } = useAppStore();

  // Local state
  const [dragType, setDragType] = useState<'move' | 'resize-left' | 'resize-right' | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isIncompatibleTarget, setIsIncompatibleTarget] = useState(false);
  const [isShowingCrossTrackGhost, setIsShowingCrossTrackGhost] = useState(false);
  const [showLinkDropdown, setShowLinkDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Refs
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);

  // Refs for drag tracking
  const hasMoved = useRef(false); // Use ref instead of state to avoid effect re-runs
  const dragInfo = useRef({
    startX: 0,
    startY: 0,
    startTimeRange: { start: 0, end: 0 },
    startTrackIndex: 0,
    startTrackPixelTop: 0, // Store the actual pixel position
    startTrackPixelLeft: 0, // Store the actual horizontal position
    sourceTrackId: '', // Original track where drag started (never changes during drag)
    currentTrackId: '', // Current target track during drag
    sourceUnit: undefined as string | undefined,
    sourceDataType: undefined as string | undefined,
    isMultiSelect: false,
    selectedClipsInfo: [] as Array<{ id: string; startTime: number; trackId: string }>,
    originalPositions: [] as Array<{ id: string; start: number; end: number }>,
    isCopyMode: false, // Track copy mode in ref to avoid state race conditions
  });

  // State to track current time for live clips
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Check if this is a live clip (no end date)
  const isLiveClip = clip.timeRange.end === undefined || clip.timeRange.end === null;

  // Calculate current position on timeline for live clips
  const getCurrentTimelinePosition = useCallback(() => {
    const timelineStartMs = new Date(timeline.startTime).getTime();
    const nowMs = Date.now();
    const currentPositionInSeconds = (nowMs - timelineStartMs) / 1000;
    return currentPositionInSeconds;
  }, [timeline.startTime]);

  // Calculate time-based progress for live destination clips
  const calculateLiveClipProgress = useCallback(() => {
    // Only for live destination clips with lastSyncedTime
    if (!isLiveClip || clip.linkType !== 'destination' || !clip.lastSyncedTime || !clip.absoluteStartTime) {
      return clip.progress; // Use stored progress for non-live clips
    }

    try {
      const startMs = new Date(clip.absoluteStartTime).getTime();
      const syncedMs = new Date(clip.lastSyncedTime).getTime();
      const nowMs = Date.now();

      // Progress = (synced_time - start_time) / (now - start_time)
      const syncedDuration = syncedMs - startMs;
      const totalDuration = nowMs - startMs;

      if (totalDuration <= 0) return 0;

      const progress = Math.max(0, Math.min(100, (syncedDuration / totalDuration) * 100));
      return Math.round(progress);
    } catch (e) {
      return clip.progress; // Fallback to stored progress on error
    }
  }, [isLiveClip, clip.linkType, clip.lastSyncedTime, clip.absoluteStartTime, clip.progress, currentTime]);

  // Get display progress (time-based for live clips, stored for others)
  const displayProgress = calculateLiveClipProgress();

  // Update live clips every second
  useEffect(() => {
    if (!isLiveClip) return;

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [isLiveClip]);

  // Calculate clip dimensions
  const endTime = isLiveClip ? getCurrentTimelinePosition() : clip.timeRange.end!;
  const duration = endTime - clip.timeRange.start;
  const width = duration * zoom;
  const left = clip.timeRange.start * zoom;

  // Check if this clip should be highlighted as connected to the hovered clip
  const isLinkedToHoveredClip = React.useMemo(() => {
    if (!hoveredClipId) return false;

    const hoveredClip = getClip(hoveredClipId);
    if (!hoveredClip) return false;

    // Case 1: The hovered clip is a destination, and this clip is its source
    if (hoveredClip.linkType === 'destination' && hoveredClip.sourceClipId === clip.id) {
      return true;
    }

    // Case 2: This clip is a destination, and the hovered clip is its source
    if (clip.linkType === 'destination' && clip.sourceClipId === hoveredClipId) {
      return true;
    }

    return false;
  }, [hoveredClipId, clip.id, clip.linkType, clip.sourceClipId, getClip]);

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

    // Add master clips as snap points
    const activeJob = dataJobs.find(job => job.id === activeJobId);
    if (activeJob && activeJob.masterLane) {
      activeJob.masterLane.clips.forEach(masterClip => {
        if (!excludeClipIds.includes(masterClip.id)) {
          snapPoints.push(masterClip.timeRange.start);
          // Only add end point if not a live clip
          if (masterClip.timeRange.end !== undefined) {
            snapPoints.push(masterClip.timeRange.end);
          }
        }
      });
    }

    // Add regular track clips as snap points
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

    // Calculate vertical offset: how many tracks to move
    const trackOffset = targetTrackIndex - startTrackIndex;

    return selectedClips.map((selectedClip) => {
      const clipTrack = getTrack(selectedClip.trackId);
      if (!clipTrack) return null;

      // Find track index for this clip's ORIGINAL position in the allTracks array
      const clipTrackIndex = allTracks.findIndex(t => t.id === selectedClip.trackId);

      // Calculate new time position (same for all clips - horizontal movement)
      // deltaTime is already snapped (includes both clip-to-clip and grid snapping)
      // so we don't need to snap again here
      let newStart = selectedClip.timeRange.start + deltaTime;
      newStart = Math.max(0, newStart);

      const clipDuration = selectedClip.timeRange.end - selectedClip.timeRange.start;
      const clipWidth = clipDuration * zoom;
      const ghostLeft = newStart * zoom + trackHeaderWidth;

      // Apply the vertical offset to show where clip will be pasted
      // Each ghost moves by the same amount as the dragged clip
      let ghostTrackIndex = Math.min(
        Math.max(0, clipTrackIndex + trackOffset),
        allTracks.length - 1
      );

      // IMPORTANT: allTracks only contains regular tracks (not master lane)
      // But DOM track indices include master lane when visible
      // So we need to offset the DOM query by the number of special lanes
      let domTrackIndex = ghostTrackIndex;
      const activeJob = dataJobs.find(job => job.id === activeJobId);
      if (activeJob?.masterLane && showSource) {
        domTrackIndex += 1; // Add 1 for master lane
      }

      const ghostTrackElement = document.querySelector(`[data-track-index="${domTrackIndex}"]`) as HTMLElement;
      const timelineContainer = document.querySelector('[data-timeline-container]') as HTMLElement;

      let ghostTop = 0;
      if (ghostTrackElement && timelineContainer) {
        const trackRect = ghostTrackElement.getBoundingClientRect();
        const timelineRect = timelineContainer.getBoundingClientRect();
        // getBoundingClientRect difference already accounts for scroll
        ghostTop = trackRect.top - timelineRect.top + 4;
      } else {
        // Fallback: if we can't find the track element, return null to filter it out
        console.warn(`Ghost track element not found for domTrackIndex: ${domTrackIndex}, ghostTrackIndex: ${ghostTrackIndex}`);
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
  }, [getSelectedClips, getAllTracks, getTrack, zoom, trackHeaderWidth, dataJobs, activeJobId, showSource]);

  // Get clip color based on state and custom color
  const getClipColor = () => {
    // If clip has a custom color, use it
    if (clip.color) {
      return '';  // Return empty string to use inline style instead
    }

    // Otherwise use state-based colors
    switch (clip.state) {
      case 'idle': return 'bg-teal-600';  // Teal for new/idle clips - distinct but thematic
      case 'uploading': return 'bg-purple-600';
      case 'processing': return 'bg-indigo-600';
      case 'complete': return 'bg-emerald-600';  // Emerald green for completed
      case 'error': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  // Check if this clip is linked to a selected master
  const linkedHighlight = (() => {
    const selectedClips = getSelectedClips();

    // Case: This clip is linked to a selected master - highlight as linked
    if (clip.linkedToClipId) {
      const masterIsSelected = selectedClips.some(c => c.id === clip.linkedToClipId);
      if (masterIsSelected) {
        return 'linked-highlighted';
      }
    }

    return null;
  })();

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

    // In incremental/live mode, only allow resize-left (changing start time)
    // Horizontal movement is not allowed in live jobs
    const activeJob = dataJobs.find(job => job.id === activeJobId);
    const isIncrementalMode = activeJob?.syncMode === 'incremental';

    if (isIncrementalMode && type === 'move') {
      // Don't allow horizontal dragging in live mode, but selection is already done above
      return;
    }

    // Prevent move operations on linked clips (position controlled by master)
    // Allow copy operations (creates new independent clip)
    // Note: Selection has already been updated above, so linked clips can still be selected
    if (type === 'move' && clip.linkedToClipId && !e.ctrlKey && !e.metaKey) {
      return; // Locked in position - can't move, only copy
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
    // Track headers are dynamic width, so we need to add that offset
    let initialGhostLeft = left + trackHeaderWidth;
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
      sourceTrackId: clip.trackId, // Original track (never changes during drag)
      currentTrackId: clip.trackId, // Current target track (updates during drag)
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
        // Instead of calculating by height offset, find the actual track element under the mouse
        // This handles asset/aspect headers which have different heights and aren't valid drop targets
        const mouseY = e.clientY;
        let targetTrackElement: HTMLElement | null = null;
        let targetTrackIndex = dragInfo.current.startTrackIndex;
        let isSpecialLane = false;

        // Check for special lanes first (Source/Destination)
        const specialLanes = document.querySelectorAll('[data-special-lane]');
        for (let i = 0; i < specialLanes.length; i++) {
          const lane = specialLanes[i] as HTMLElement;
          const rect = lane.getBoundingClientRect();
          if (mouseY >= rect.top && mouseY <= rect.bottom) {
            targetTrackElement = lane;
            targetTrackIndex = parseInt(lane.getAttribute('data-track-index') || '0', 10);
            isSpecialLane = true;
            break;
          }
        }

        // If not on special lane, check regular tracks
        if (!isSpecialLane) {
          const trackLanes = document.querySelectorAll('[data-track-lane="true"]');
          for (let i = 0; i < trackLanes.length; i++) {
            const lane = trackLanes[i] as HTMLElement;
            const rect = lane.getBoundingClientRect();
            if (mouseY >= rect.top && mouseY <= rect.bottom) {
              targetTrackElement = lane;
              targetTrackIndex = parseInt(lane.getAttribute('data-track-index') || '0', 10);
              break;
            }
          }
        }

        // Adjust index to account for special lanes
        // targetTrackIndex is global (includes special lanes), but allTracks only has regular tracks
        let adjustedIndex = targetTrackIndex;
        if (!isSpecialLane && targetTrackElement) {
          // Subtract 1 if master lane is visible (regardless of whether it has clips)
          if (showSource) {
            adjustedIndex--;
          }
        }

        const targetTrack = !isSpecialLane && targetTrackElement ? allTracks[adjustedIndex] : null;
        const isMasterClip = clip.trackId === 'master';

        // Master clips can only be dragged on their special lane
        if (isMasterClip && !isSpecialLane) {
          targetTrackElement = null; // Treat as invalid target
        }

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

        // Check if mouse is over a non-track area (asset/aspect header)
        // Allow special lanes for master clips
        if (!targetTrack && !(isSpecialLane && isMasterClip)) {
          setIsIncompatibleTarget(true);
          document.body.style.cursor = 'not-allowed';

          // If multi-select, set the global incompatibility flag so all selected clips show feedback
          if (dragInfo.current.isMultiSelect) {
            setMultiSelectDragIncompatible(true);
          }

          // Show ghost at cursor position to keep it fixed to mouse
          const newGhostLeft = newStart * zoom + trackHeaderWidth;

          setGhostClips([{
            clipId: clip.id,
            left: newGhostLeft,
            width: width,
            top: mouseY - (timelineContainer?.getBoundingClientRect().top || 0),
            isIncompatible: true,
          }]);
          return; // Don't process further
        } else {
          // Over a valid track, clear incompatible state from asset/aspect header
          // The compatibility will be re-evaluated based on unit/data type and cross-track checks below
          if (isIncompatibleTarget) {
            setIsIncompatibleTarget(false);
          }
          // For multi-select, the incompatibility flag will be set again below if it's a cross-track move
          // For same-track moves, we want to clear it here
          if (dragInfo.current.isMultiSelect) {
            setMultiSelectDragIncompatible(false);
          }
        }

        // ============================================================
        // MASTER CLIP LOGIC (Source/Destination lanes)
        // ============================================================
        // Handle master clips on special lanes completely separately
        if (isSpecialLane && isMasterClip) {
          // Master clips on special lanes are always compatible (moving on same lane)
          setIsIncompatibleTarget(false);

          // Copy mode is NOT allowed for master clips (only one master allowed per lane)
          // Ignore Ctrl/Cmd keys
          document.body.style.cursor = 'move';

          // Check if this is a multi-select drag with multiple master clips
          if (dragInfo.current.isMultiSelect) {
            // Get all selected clips (should be multiple master clips)
            const selectedClips = getSelectedClips();
            const masterClipsInSelection = selectedClips.filter(c => c.trackId === 'master');

            // Create ghosts for all selected master clips
            const targetTrackElement = document.querySelector(`[data-special-lane="master"]`) as HTMLElement;
            let targetTop = dragInfo.current.startTrackPixelTop;
            if (targetTrackElement && timelineContainer) {
              const trackRect = targetTrackElement.getBoundingClientRect();
              const timelineRect = timelineContainer.getBoundingClientRect();
              targetTop = trackRect.top - timelineRect.top + 4;
            }

            const ghosts = masterClipsInSelection.map(selectedClip => {
              const clipDuration = (selectedClip.timeRange.end || getCurrentTimelinePosition()) - selectedClip.timeRange.start;
              const clipWidth = clipDuration * zoom;
              const newClipStart = selectedClip.timeRange.start + snappedDeltaTime;
              const newGhostLeft = newClipStart * zoom + trackHeaderWidth;

              return {
                clipId: selectedClip.id,
                left: newGhostLeft,
                width: clipWidth,
                top: targetTop,
                isIncompatible: false,
              };
            });

            setGhostClips(ghosts);
          } else {
            // Single clip drag - original logic
            const targetTrackElement = document.querySelector(`[data-special-lane="master"]`) as HTMLElement;
            let targetTop = dragInfo.current.startTrackPixelTop;
            if (targetTrackElement && timelineContainer) {
              const trackRect = targetTrackElement.getBoundingClientRect();
              const timelineRect = timelineContainer.getBoundingClientRect();
              targetTop = trackRect.top - timelineRect.top + 4;
            }

            const newGhostLeft = newStart * zoom + trackHeaderWidth;
            setGhostClips([{
              clipId: clip.id,
              left: newGhostLeft,
              width: width,
              top: targetTop,
              isIncompatible: false,
            }]);
          }

          // Early return - don't run regular track logic for master clips
          return;
        }

        // ============================================================
        // REGULAR TRACK LOGIC
        // ============================================================
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

                const newGhostLeft = newStart * zoom + trackHeaderWidth;

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

        // Regular track logic
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

        // Update position during drag
        // IMPORTANT: For cross-track moves, show ghost instead of actually moving
        // This prevents component unmount/remount which would break the drag
        if (!dragInfo.current.isCopyMode && targetTrack && isCompatible) {
          const isCrossTrackMove = targetTrack.id !== dragInfo.current.sourceTrackId;

          // Prevent multi-select from moving across tracks (too complex with different units/data types)
          if (isCrossTrackMove && dragInfo.current.isMultiSelect) {
            setIsIncompatibleTarget(true);
            setMultiSelectDragIncompatible(true);
            document.body.style.cursor = 'not-allowed';
            setGhostClips([]);
            return;
          } else if (dragInfo.current.isMultiSelect) {
            // Multi-select horizontal move is allowed, clear the incompatible flag
            setMultiSelectDragIncompatible(false);
          }

          if (isCrossTrackMove) {
            // Single clip moving to different track - show ghost, don't actually move yet
            dragInfo.current.currentTrackId = targetTrack.id;
            setIsShowingCrossTrackGhost(true);

            // Show ghost at target position
            const targetTrackElement = document.querySelector(`[data-track-index="${targetTrackIndex}"]`) as HTMLElement;
            let targetTop = dragInfo.current.startTrackPixelTop;
            if (targetTrackElement && timelineContainer) {
              const trackRect = targetTrackElement.getBoundingClientRect();
              const timelineRect = timelineContainer.getBoundingClientRect();
              targetTop = trackRect.top - timelineRect.top + 4;
            }

            const newGhostLeft = newStart * zoom + trackHeaderWidth;

            setGhostClips([{
              clipId: clip.id,
              left: newGhostLeft,
              width: width,
              top: targetTop,
              isIncompatible: false,
            }]);
          } else {
            // On source track - show ghost (consistent with cross-track moves)
            dragInfo.current.currentTrackId = targetTrack.id;
            setIsShowingCrossTrackGhost(false);

            // Show ghost(s) at new time position on same track(s)
            if (dragInfo.current.isMultiSelect) {
              // Show ghosts for all selected clips
              const ghosts = createGhostClipsForSelection(dragInfo.current.startTrackIndex, dragInfo.current.startTrackIndex, snappedDeltaTime, false);
              setGhostClips(ghosts);
            } else {
              // Show single ghost
              const newGhostLeft = newStart * zoom + trackHeaderWidth;

              setGhostClips([{
                clipId: clip.id,
                left: newGhostLeft,
                width: width,
                top: dragInfo.current.startTrackPixelTop,
                isIncompatible: false,
              }]);
            }
          }
        } else if (dragInfo.current.isCopyMode) {
          // If over non-track area, show incompatible
          if (!targetTrack) {
            setIsIncompatibleTarget(true);
            document.body.style.cursor = 'not-allowed';

            // If multi-select, set the global incompatibility flag so all selected clips show feedback
            if (dragInfo.current.isMultiSelect) {
              setMultiSelectDragIncompatible(true);
            }

            // Show ghost at cursor position
            const newGhostLeft = newStart * zoom + trackHeaderWidth;

            setGhostClips([{
              clipId: clip.id,
              left: newGhostLeft,
              width: width,
              top: mouseY - (timelineContainer?.getBoundingClientRect().top || 0),
              isIncompatible: true,
            }]);
            return;
          }

          const isCrossTrackCopy = targetTrackIndex !== dragInfo.current.startTrackIndex;

          // Prevent multi-select from copying across tracks
          if (isCrossTrackCopy && dragInfo.current.isMultiSelect) {
            setIsIncompatibleTarget(true);
            setMultiSelectDragIncompatible(true);
            document.body.style.cursor = 'not-allowed';
            setGhostClips([]);
            return;
          } else if (dragInfo.current.isMultiSelect) {
            // Multi-select horizontal copy is allowed, clear the incompatible flag
            setMultiSelectDragIncompatible(false);
          }

          // Update ghost clips during drag using snapped deltaTime
          if (dragInfo.current.isMultiSelect) {
            const ghosts = createGhostClipsForSelection(targetTrackIndex, dragInfo.current.startTrackIndex, snappedDeltaTime, !isCompatible);
            setGhostClips(ghosts);
          } else {
            let targetTop = dragInfo.current.startTrackPixelTop;
            if (targetTrackElement && timelineContainer) {
              const trackRect = targetTrackElement.getBoundingClientRect();
              const timelineRect = timelineContainer.getBoundingClientRect();
              // getBoundingClientRect difference already accounts for scroll
              targetTop = trackRect.top - timelineRect.top + 4;
            }

            // Ghost shows where the new clip will be placed
            // Need to add header offset since ghost is in timeline container coordinates
            const newGhostLeft = newStart * zoom + trackHeaderWidth;

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

        // Constrain start time: must be >= 0
        // For non-live clips: also must be < end
        // For live clips: no upper bound (end is undefined)
        if (dragInfo.current.startTimeRange.end !== undefined) {
          newStart = Math.max(0, Math.min(dragInfo.current.startTimeRange.end - 0.1, newStart));
        } else {
          newStart = Math.max(0, newStart);
        }

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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Cancel the drag and revert to original position
        setDragType(null);
        setIsCopying(false);
        setIsIncompatibleTarget(false);
        setIsShowingCrossTrackGhost(false);
        hasMoved.current = false;
        setGhostClips([]);
        setSnapIndicator(null);
        setMultiSelectDragIncompatible(false);

        // Reset cursor
        document.body.style.cursor = '';

        // Clips are already at their original positions (we never moved them during drag)
        // So no need to explicitly revert

        if (onDragEnd) {
          onDragEnd();
        }

        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Only process move if user actually dragged (prevents accidental updates on selection clicks)
      if (dragType === 'move' && !hasMoved.current) {
        // Just a click to select - don't update clip position
        setDragType(null);
        setIsCopying(false);
        setIsIncompatibleTarget(false);
        setIsShowingCrossTrackGhost(false);
        setGhostClips([]);
        setSnapIndicator(null);
        setMultiSelectDragIncompatible(false);
        hasMoved.current = false;
        dragInfo.current.isCopyMode = false;
        document.body.style.cursor = '';
        if (onDragEnd) {
          onDragEnd();
        }
        return;
      }

      // Handle move on drop - perform actual move now (not during drag)
      if (dragType === 'move' && !dragInfo.current.isCopyMode) {
        const deltaX = e.clientX - dragInfo.current.startX;
        const deltaTime = deltaX / zoom;

        // Use DOM-based track detection (same as during drag)
        // This handles asset/aspect headers which have different heights
        const mouseY = e.clientY;
        let targetTrackIndex = dragInfo.current.startTrackIndex;
        let targetTrack = null;
        let isSpecialLane = false;
        let specialLaneType: 'source' | 'destination' | null = null;

        // Check for special lanes first (Source/Destination)
        const specialLanes = document.querySelectorAll('[data-special-lane]');
        for (let i = 0; i < specialLanes.length; i++) {
          const lane = specialLanes[i] as HTMLElement;
          const rect = lane.getBoundingClientRect();
          if (mouseY >= rect.top && mouseY <= rect.bottom) {
            isSpecialLane = true;
            specialLaneType = lane.getAttribute('data-special-lane') as 'source' | 'destination';
            targetTrackIndex = parseInt(lane.getAttribute('data-track-index') || '0', 10);
            break;
          }
        }

        // If not on special lane, check regular tracks
        if (!isSpecialLane) {
          const trackLanes = document.querySelectorAll('[data-track-lane="true"]');
          for (let i = 0; i < trackLanes.length; i++) {
            const lane = trackLanes[i] as HTMLElement;
            const rect = lane.getBoundingClientRect();
            if (mouseY >= rect.top && mouseY <= rect.bottom) {
              targetTrackIndex = parseInt(lane.getAttribute('data-track-index') || '0', 10);

              // Adjust index to account for special lanes
              let adjustedIndex = targetTrackIndex;
              // Subtract 1 if master lane is visible (regardless of whether it has clips)
              if (showSource) {
                adjustedIndex--;
              }

              targetTrack = allTracks[adjustedIndex];
              break;
            }
          }
        }

        // Check if this is a master clip
        const isMasterClip = clip.trackId === 'master';

        // If not over any track/lane, don't perform the move
        if (!isSpecialLane && !targetTrack) {
          setDragType(null);
          setIsCopying(false);
          setIsIncompatibleTarget(false);
          setIsShowingCrossTrackGhost(false);
          setGhostClips([]);
          setSnapIndicator(null);
          setMultiSelectDragIncompatible(false);
          document.body.style.cursor = '';
          if (onDragEnd) {
            onDragEnd();
          }
          return;
        }

        // Master clips can only move within their own lane
        if (isMasterClip && !isSpecialLane) {
          setDragType(null);
          setIsCopying(false);
          setIsIncompatibleTarget(false);
          setIsShowingCrossTrackGhost(false);
          setGhostClips([]);
          setSnapIndicator(null);
          setMultiSelectDragIncompatible(false);
          document.body.style.cursor = '';
          if (onDragEnd) {
            onDragEnd();
          }
          return;
        }

        // Handle master clip movement on special lane
        if (isSpecialLane && isMasterClip) {
          // Calculate final position with snapping
          let newStart = dragInfo.current.startTimeRange.start + deltaTime;
          const duration = dragInfo.current.startTimeRange.end - dragInfo.current.startTimeRange.start;
          let newEnd = newStart + duration;

          // Apply snapping (exclude all selected clips if multi-select)
          const excludeIds = dragInfo.current.isMultiSelect ? getSelectedClips().map(c => c.id) : [clip.id];
          const snapStart = applySnapping(newStart, excludeIds);
          const snapEnd = applySnapping(newEnd, excludeIds);

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
            newStart = Math.round(newStart / timeline.snapInterval) * timeline.snapInterval;
            newEnd = newStart + duration;
          }

          newStart = Math.max(0, newStart);

          // Calculate the actual deltaTime that will be applied
          const actualDeltaTime = newStart - dragInfo.current.startTimeRange.start;

          // Update master clip position
          updateClip(clip.id, { timeRange: { start: newStart, end: newEnd } });

          // If multi-select, move all other selected master clips by the same delta
          if (dragInfo.current.isMultiSelect) {
            const selectedClips = getSelectedClips();
            selectedClips.forEach(selectedClip => {
              if (selectedClip.id !== clip.id && selectedClip.trackId === 'master') {
                const clipDuration = (selectedClip.timeRange.end || getCurrentTimelinePosition()) - selectedClip.timeRange.start;
                const newClipStart = Math.max(0, selectedClip.timeRange.start + actualDeltaTime);
                const newClipEnd = selectedClip.timeRange.end !== undefined
                  ? newClipStart + clipDuration
                  : undefined; // Keep live clips live

                updateClip(selectedClip.id, {
                  timeRange: { start: newClipStart, end: newClipEnd }
                });
              }
            });
          }
        } else if (targetTrack) {
          const isCrossTrackMove = targetTrack.id !== dragInfo.current.sourceTrackId;

          // Don't allow multi-select cross-track moves
          if (isCrossTrackMove && dragInfo.current.isMultiSelect) {
            return;
          }
          // Calculate final position with snapping
          let newStart = dragInfo.current.startTimeRange.start + deltaTime;
          const duration = dragInfo.current.startTimeRange.end - dragInfo.current.startTimeRange.start;
          let newEnd = newStart + duration;

          // Apply snapping
          const excludeIds = dragInfo.current.isMultiSelect ? getSelectedClips().map(c => c.id) : [clip.id];
          const snapStart = applySnapping(newStart, excludeIds);
          const snapEnd = applySnapping(newEnd, excludeIds);

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
            newStart = Math.round(newStart / timeline.snapInterval) * timeline.snapInterval;
            newEnd = newStart + duration;
          }

          newStart = Math.max(0, newStart);

          // Check compatibility
          const unitCompatible = !dragInfo.current.sourceUnit ||
                                !targetTrack.unit ||
                                dragInfo.current.sourceUnit === targetTrack.unit;
          const dataTypeCompatible = !dragInfo.current.sourceDataType ||
                                    !targetTrack.dataType ||
                                    dragInfo.current.sourceDataType === targetTrack.dataType;
          const isCompatible = unitCompatible && dataTypeCompatible;

          if (isCompatible) {
            if (isCrossTrackMove) {
              // Cross-track move
              moveClip(clip.id, targetTrack.id, { start: newStart, end: newEnd });
            } else if (dragInfo.current.isMultiSelect) {
              // Multi-select horizontal move (all clips on their own tracks)
              moveSelectedClips(deltaTime, undefined, dragInfo.current.originalPositions);
            } else {
              // Single clip horizontal move (same track)
              updateClip(clip.id, { timeRange: { start: newStart, end: newEnd } });
            }
          }
        }
      }

      // Handle copy on drop - use ref to check copy mode
      if (dragType === 'move' && dragInfo.current.isCopyMode) {
        const deltaX = e.clientX - dragInfo.current.startX;
        const deltaTime = deltaX / zoom;

        // Use DOM-based track detection (same as during drag)
        // This handles asset/aspect headers which have different heights
        const mouseY = e.clientY;
        let targetTrackIndex = dragInfo.current.startTrackIndex;
        let targetTrack = null;

        const trackLanes = document.querySelectorAll('[data-track-lane="true"]');
        for (let i = 0; i < trackLanes.length; i++) {
          const lane = trackLanes[i] as HTMLElement;
          const rect = lane.getBoundingClientRect();
          if (mouseY >= rect.top && mouseY <= rect.bottom) {
            targetTrackIndex = parseInt(lane.getAttribute('data-track-index') || '0', 10);

            // Adjust index to account for special lanes
            let adjustedIndex = targetTrackIndex;
            // Subtract 1 if master lane is visible (regardless of whether it has clips)
            if (showSource) {
              adjustedIndex--;
            }

            targetTrack = allTracks[adjustedIndex];
            break;
          }
        }

        // If not over any track (e.g., over asset/aspect header), don't perform the copy
        if (!targetTrack) {
          setDragType(null);
          setIsCopying(false);
          setIsIncompatibleTarget(false);
          setIsShowingCrossTrackGhost(false);
          setGhostClips([]);
          setSnapIndicator(null);
          setMultiSelectDragIncompatible(false);
          document.body.style.cursor = '';
          if (onDragEnd) {
            onDragEnd();
          }
          return;
        }

        if (targetTrack) {
          const isCrossTrackCopy = targetTrackIndex !== dragInfo.current.startTrackIndex;

          // Don't allow multi-select cross-track copies
          if (isCrossTrackCopy && dragInfo.current.isMultiSelect) {
            return;
          }
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
      setIsShowingCrossTrackGhost(false);
      hasMoved.current = false;
      setGhostClips([]);
      setSnapIndicator(null); // Clear snap indicator
      setMultiSelectDragIncompatible(false); // Clear multi-select incompatible flag
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
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  // NOTE: Many dependencies are intentionally EXCLUDED to prevent effect re-runs during drag:
  // - clip.timeRange, clip.trackId, trackIndex, width: captured at drag start, change during drag
  // - timeline: object reference may change on store updates, but values are read live in handlers
  // - Store functions (getAllTracks, getTrack, etc.): should be stable but may get new refs on store updates
  // - createGhostClipsForSelection: recreated when its deps change
  // The effect only sets up event listeners - handlers use closures to access current values
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragType, isCopying]);

  // Get all clips from active job for linking dropdown
  const getAvailableClips = () => {
    const activeJob = dataJobs.find(job => job.id === activeJobId);
    if (!activeJob) return [];

    // Get current clip's data type for filtering
    const currentTrack = getTrack(clip.trackId);
    const currentDataType = currentTrack?.dataType;

    // First, check if there's already a master in this job
    let existingMaster: { clip: Clip; group: any; aspect: any; track: any } | null = null;

    activeJob.groups.forEach(group => {
      group.aspects.forEach(aspect => {
        aspect.tracks.forEach(track => {
          track.clips.forEach(c => {
            // Find a clip that has other clips linked to it (master)
            const hasLinkedClips = activeJob.groups.some(g =>
              g.aspects.some(a =>
                a.tracks.some(t =>
                  t.clips.some(linkedClip => linkedClip.linkedToClipId === c.id)
                )
              )
            );
            if (hasLinkedClips && c.id !== clip.id) {
              existingMaster = { clip: c, group, aspect, track };
            }
          });
        });
      });
    });

    const clips: Array<{
      clipId: string;
      clipName: string;
      assetName: string;
      aspectName: string;
      trackName: string;
    }> = [];

    // If a master already exists in this job, only show that master (if data types match)
    if (existingMaster) {
      const masterDataType = existingMaster.track.dataType;

      // Only show the master if data types match
      if (masterDataType === currentDataType) {
        clips.push({
          clipId: existingMaster.clip.id,
          clipName: existingMaster.clip.name,
          assetName: existingMaster.group.name || existingMaster.group.assetId || 'Unknown',
          aspectName: existingMaster.aspect.name,
          trackName: existingMaster.track.name
        });
      }
      // If data types don't match, return empty array (no compatible master)
      return clips;
    }

    // No master exists yet - show all clips with matching data type that aren't already linked
    activeJob.groups.forEach(group => {
      group.aspects.forEach(aspect => {
        aspect.tracks.forEach(track => {
          track.clips.forEach(c => {
            // Exclude current clip and any linked clips (can't be masters)
            // Only include clips with matching data type
            if (c.id !== clip.id && !c.linkedToClipId && track.dataType === currentDataType) {
              clips.push({
                clipId: c.id,
                clipName: c.name,
                assetName: group.name || group.assetId || 'Unknown',
                aspectName: aspect.name,
                trackName: track.name
              });
            }
          });
        });
      });
    });

    return clips;
  };

  const availableClips = getAvailableClips();

  // Check if there's a master in the job with incompatible data type
  const getIncompatibleMasterInfo = () => {
    const activeJob = dataJobs.find(job => job.id === activeJobId);
    if (!activeJob) return null;

    const currentTrack = getTrack(clip.trackId);
    const currentDataType = currentTrack?.dataType;

    // Find existing master
    let existingMaster: { clip: Clip; track: any } | null = null;
    activeJob.groups.forEach(group => {
      group.aspects.forEach(aspect => {
        aspect.tracks.forEach(track => {
          track.clips.forEach(c => {
            const hasLinkedClips = activeJob.groups.some(g =>
              g.aspects.some(a =>
                a.tracks.some(t =>
                  t.clips.some(linkedClip => linkedClip.linkedToClipId === c.id)
                )
              )
            );
            if (hasLinkedClips && c.id !== clip.id) {
              existingMaster = { clip: c, track };
            }
          });
        });
      });
    });

    if (existingMaster && existingMaster.track.dataType !== currentDataType) {
      return {
        masterName: existingMaster.clip.name,
        masterDataType: existingMaster.track.dataType,
        currentDataType
      };
    }

    return null;
  };

  const incompatibleMaster = getIncompatibleMasterInfo();

  // Check if this clip is a master (has other clips linked to it)
  const isMaster = (() => {
    const activeJob = dataJobs.find(job => job.id === activeJobId);
    if (!activeJob) return false;

    let found = false;
    activeJob.groups.forEach(group => {
      group.aspects.forEach(aspect => {
        aspect.tracks.forEach(track => {
          track.clips.forEach(c => {
            if (c.linkedToClipId === clip.id) {
              found = true;
            }
          });
        });
      });
    });
    return found;
  })();

  // Update dropdown position when shown
  const updateDropdownPosition = () => {
    if (dropdownButtonRef.current) {
      const buttonRect = dropdownButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: buttonRect.bottom + 4, // 4px gap below button
        left: buttonRect.right - 256, // 256px = w-64 (align right edge of dropdown with right edge of button)
      });
    }
  };

  // Update position when dropdown is shown
  useEffect(() => {
    if (showLinkDropdown) {
      updateDropdownPosition();
    }
  }, [showLinkDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showLinkDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside both the button and the dropdown
      if (
        dropdownButtonRef.current &&
        !dropdownButtonRef.current.contains(e.target as Node)
      ) {
        // Since dropdown is portaled, we need to check if click is inside dropdown manually
        const target = e.target as HTMLElement;
        const isInsideDropdown = target.closest('[data-link-dropdown]');
        if (!isInsideDropdown) {
          setShowLinkDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLinkDropdown]);

  return (
    <motion.div
      data-clip="true"
      className={`
        absolute rounded-md overflow-hidden
        ${
          dragType === 'move' && isIncompatibleTarget
            ? 'cursor-not-allowed'
            : dragType === 'move' && isCopying
            ? 'cursor-copy'
            : clip.linkedToClipId || (dataJobs.find(j => j.id === activeJobId)?.syncMode === 'incremental')
            ? 'cursor-default'
            : 'cursor-move'
        }
        ${getClipColor()}
        ${clip.linkType === 'source' ? 'ring-2 ring-teal-400 shadow-lg shadow-teal-400/30' : ''}
        ${clip.linkType === 'destination' ? 'ring-2 ring-purple-400 shadow-lg shadow-purple-400/30' : ''}
        ${clip.selected && !isMultiSelectDragIncompatible ? 'ring-4 ring-cyan-400 shadow-xl shadow-cyan-400/40' : ''}
        ${linkedHighlight === 'linked-highlighted' ? 'ring-4 ring-orange-400 shadow-xl shadow-orange-400/50' : ''}
        ${isLinkedToHoveredClip ? 'ring-4 ring-yellow-400 shadow-xl shadow-yellow-400/60 scale-105' : ''}
        ${dragType === 'move' && !isCopying && !isIncompatibleTarget && !isMultiSelectDragIncompatible ? 'opacity-20' : ''}
        ${dragType === 'move' && isCopying && !isIncompatibleTarget ? 'opacity-50 ring-4 ring-green-400 shadow-lg shadow-green-400/50' : ''}
        ${(dragType === 'move' && isIncompatibleTarget) || (clip.selected && isMultiSelectDragIncompatible) ? 'opacity-50 ring-4 ring-red-500 shadow-lg shadow-red-500/50' : ''}
        transition-all duration-200
      `}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        top: '4px',
        bottom: '4px',
        ...(clip.color ? { backgroundColor: clip.color } : {}),
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setHoveredClipId(clip.id)}
      onMouseLeave={() => setHoveredClipId(null)}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
    >
      {/* Resize handles - only show for non-linked clips and not for Destination Master (duration controlled by Source Master) */}
      {(() => {
        // Check if this is a destination master clip (in master lane with linkType 'destination')
        const isDestinationMaster = clip.trackId === 'master' && clip.linkType === 'destination';

        // Show resize handles only if not linked and not destination master
        return !clip.linkedToClipId && !isDestinationMaster;
      })() && (
        <>
          {/* Left resize handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-blue-500 hover:bg-opacity-30 z-10"
            onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
          />

          {/* Right resize handle - disabled for live clips */}
          {!isLiveClip && (
            <div
              className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-blue-500 hover:bg-opacity-30 z-10"
              onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
            />
          )}

          {/* Live clip indicator at right edge */}
          {isLiveClip && (
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-green-500 animate-pulse z-10" title="Live - extends to current time" />
          )}
        </>
      )}

      {/* Copy indicator */}
      {dragType === 'move' && isCopying && !isIncompatibleTarget && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-20 pointer-events-none">
          <span className="text-white text-xs font-bold">+</span>
        </div>
      )}

      {/* Incompatible indicator */}
      {((dragType === 'move' && isIncompatibleTarget) || (clip.selected && isMultiSelectDragIncompatible)) && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg z-20 pointer-events-none">
          <span className="text-white text-xs font-bold">✕</span>
        </div>
      )}

      {/* Master clip indicator badge (top-right) */}
      {isMaster && (
        <div className="absolute top-1 right-1 w-5 h-5 bg-yellow-600 rounded flex items-center justify-center shadow-md z-20 pointer-events-none" title="Master clip (has linked clips)">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
      )}

      {/* Link indicator badge (top-right) */}
      {clip.linkedToClipId && (
        <div className="absolute top-1 right-1 w-5 h-5 bg-blue-600 rounded flex items-center justify-center shadow-md z-20 pointer-events-none" title="Linked clip">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
      )}

      {/* Source/Destination Buttons (top-right corner) - only for regular track clips, not master clips */}
      {clip.trackId !== 'master' && (
        <div
          className="absolute top-1 right-1 z-30 pointer-events-auto group flex gap-1"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Source button */}
          <button
            className={`w-6 h-6 rounded flex items-center justify-center transition-all shadow-md ${
              clip.linkType === 'source'
                ? 'bg-teal-600 opacity-100'
                : 'bg-gray-700 bg-opacity-70 opacity-0 group-hover:opacity-100 hover:bg-teal-700'
            }`}
            title="Set as Source Clip"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setClipAsSource(clip.id);
            }}
          >
            <span className={`text-xs font-bold ${clip.linkType === 'source' ? 'text-white' : 'text-gray-300'}`}>S</span>
          </button>

          {/* Destination button */}
          <button
            className={`w-6 h-6 rounded flex items-center justify-center transition-all shadow-md ${
              clip.linkType === 'destination'
                ? 'bg-purple-600 opacity-100'
                : 'bg-gray-700 bg-opacity-70 opacity-0 group-hover:opacity-100 hover:bg-purple-700'
            }`}
            title="Set as Destination Clip"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setClipAsDestination(clip.id);
            }}
          >
            <span className={`text-xs font-bold ${clip.linkType === 'destination' ? 'text-white' : 'text-gray-300'}`}>D</span>
          </button>

          {/* Clear/None button - only show when a type is set */}
          {clip.linkType && (
            <button
              className="w-6 h-6 rounded flex items-center justify-center transition-all shadow-md bg-gray-600 opacity-100 hover:bg-red-700"
              title="Clear clip type (set to None)"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setClipAsNone(clip.id);
              }}
            >
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Source Clip Dropdown (for destination clips on regular tracks only, not master clips) */}
      {clip.linkType === 'destination' && clip.trackId !== 'master' && (() => {
        // Get linked source clip details for display
        let linkedSourceInfo: { assetName: string; aspectName: string; property: string } | null = null;

        if (clip.sourceClipId) {
          const activeJob = dataJobs.find(job => job.id === activeJobId);
          if (activeJob) {
            // Find the linked source clip
            activeJob.groups.forEach(group => {
              group.aspects.forEach(aspect => {
                aspect.tracks.forEach(track => {
                  const sourceClip = track.clips.find(c => c.id === clip.sourceClipId);
                  if (sourceClip) {
                    linkedSourceInfo = {
                      assetName: group.name || group.assetId || 'Unknown',
                      aspectName: aspect.name,
                      property: track.property || track.name
                    };
                  }
                });
              });
            });
          }
        }

        // Build display text - show Asset / Property for brevity
        const displayText = linkedSourceInfo
          ? `${linkedSourceInfo.assetName} / ${linkedSourceInfo.property}`
          : 'Src';

        const tooltipText = linkedSourceInfo
          ? `Linked to: ${linkedSourceInfo.assetName} / ${linkedSourceInfo.aspectName} / ${linkedSourceInfo.property}\nClick to change`
          : 'Link to source clip';

        return (
          <div
            className="absolute top-8 left-1 z-30 pointer-events-auto group"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={dropdownButtonRef}
              className={`px-2 py-1 text-xxs rounded flex items-center gap-1 transition-all shadow-md max-w-[150px] ${
                clip.sourceClipId
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-700 bg-opacity-70 text-gray-300 hover:bg-opacity-100'
              }`}
              title={tooltipText}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowLinkDropdown(!showLinkDropdown);

                // Calculate dropdown position
                if (dropdownButtonRef.current) {
                  const rect = dropdownButtonRef.current.getBoundingClientRect();
                  setDropdownPosition({
                    top: rect.bottom + 4,
                    left: rect.left
                  });
                }
              }}
            >
              {linkedSourceInfo ? (
                <>
                  <span className="truncate">{displayText}</span>
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              ) : (
                <>
                  <span>Src</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>

          {/* Render dropdown using portal */}
          {showLinkDropdown && createPortal(
            <div
              data-link-dropdown="true"
              className="fixed w-64 max-h-80 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-[9999]"
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
              }}
            >
              {/* Unlink option */}
              <button
                className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-700 transition-colors ${
                  !clip.sourceClipId ? 'bg-gray-700 font-semibold' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setDestinationSourceClip(clip.id, null);
                  setShowLinkDropdown(false);
                }}
              >
                <div className="text-gray-300">None (no source)</div>
              </button>

              <div className="border-t border-gray-700"></div>

              {/* Source Clips */}
              {(() => {
                const activeJob = dataJobs.find(job => job.id === activeJobId);
                if (!activeJob) {
                  return (
                    <div className="px-3 py-4 text-xs text-center text-gray-500">
                      No active job
                    </div>
                  );
                }

                const currentTrack = getTrack(clip.trackId);
                const currentDataType = currentTrack?.dataType;

                // Collect all source clips
                const sourceClips: Array<{
                  clipId: string;
                  clipName: string;
                  assetName: string;
                  aspectName: string;
                  trackName: string;
                  tenantId?: string;
                  tenantColor?: string;
                }> = [];

                activeJob.groups.forEach(group => {
                  group.aspects.forEach(aspect => {
                    aspect.tracks.forEach(track => {
                      track.clips.forEach(c => {
                        // Only include clips marked as source with matching data type
                        if (c.linkType === 'source' && c.id !== clip.id) {
                          if (!currentDataType || !track.dataType || track.dataType === currentDataType) {
                            sourceClips.push({
                              clipId: c.id,
                              clipName: c.name,
                              assetName: group.name || group.assetId || 'Unknown',
                              aspectName: aspect.name,
                              trackName: track.name,
                              tenantId: group.tenantId,
                              tenantColor: group.tenantColor
                            });
                          }
                        }
                      });
                    });
                  });
                });

                if (sourceClips.length === 0) {
                  return (
                    <div className="px-3 py-4 text-xs text-center text-gray-500">
                      No source clips available
                    </div>
                  );
                }

                return sourceClips.map((sourceClip) => (
                  <button
                    key={sourceClip.clipId}
                    className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-700 transition-colors ${
                      clip.sourceClipId === sourceClip.clipId ? 'bg-teal-900 font-semibold' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDestinationSourceClip(clip.id, sourceClip.clipId);
                      setShowLinkDropdown(false);
                    }}
                  >
                    <div className="text-teal-300 font-medium truncate">{sourceClip.clipName}</div>
                    <div className="text-gray-500 text-xxs truncate">{sourceClip.assetName}</div>
                    <div className="text-gray-500 text-xxs truncate">{sourceClip.aspectName} / {sourceClip.trackName}</div>
                    {/* Tenant info with color badge */}
                    {sourceClip.tenantId && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {sourceClip.tenantColor && (
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: sourceClip.tenantColor }}
                          />
                        )}
                        <span className="text-gray-600 text-xxs truncate">
                          Tenant: {sourceClip.tenantId}
                        </span>
                      </div>
                    )}
                  </button>
                ));
              })()}
            </div>,
            document.body
          )}
        </div>
        );
      })()}

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

        {/* Progress bar - only show on destination clips (not source) */}
        {(clip.state === 'uploading' || clip.state === 'processing' || clip.state === 'complete') && clip.linkType === 'destination' && (
          <div className="relative h-1 bg-black bg-opacity-30 rounded-full overflow-hidden">
            <motion.div
              className="absolute top-0 left-0 h-full bg-white bg-opacity-60"
              initial={{ width: '0%' }}
              animate={{ width: `${displayProgress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        )}

        {/* Duration label */}
        <div className={`text-xs ${isLiveClip ? 'text-green-300 font-bold' : 'text-white text-opacity-70'}`}>
          {isLiveClip ? 'LIVE' : `${duration.toFixed(1)}s`}
        </div>
      </div>
    </motion.div>
  );
};