import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Clip as ClipType } from '../../types/index';
import { useAppStore } from '../../store/appStore';

interface ClipProps {
  clip: ClipType;
  zoom: number;
  trackIndex: number;
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
    timeline,
    setDragState,
    tracks,
  } = useAppStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [currentTrackId, setCurrentTrackId] = useState(clip.trackId);
  const clipRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0, timeStart: 0, timeEnd: 0, trackIndex: 0 });

  // Calculate clip dimensions
  const duration = clip.timeRange.end - clip.timeRange.start;
  const width = duration * zoom;
  const left = clip.timeRange.start * zoom;

  // Get clip color based on state
  const getClipColor = () => {
    switch (clip.state) {
      case 'idle':
        return 'bg-clip-idle';
      case 'uploading':
        return 'bg-clip-uploading';
      case 'processing':
        return 'bg-clip-processing';
      case 'complete':
        return 'bg-clip-complete';
      case 'error':
        return 'bg-clip-error';
      default:
        return 'bg-gray-600';
    }
  };

  // Define mouse move handler using useRef to avoid stale closures
  const handleMouseMoveRef = useRef<(e: MouseEvent) => void>();
  const handleMouseUpRef = useRef<(e: MouseEvent) => void>();

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;
      const deltaTime = deltaX / zoom;

      if (isResizing) {
        console.log('Resizing:', { isResizing, deltaX, deltaTime });
      }

      if (isDragging) {
        // Calculate which track we're hovering over
        const trackHeight = 80; // Height of each track
        const trackOffset = Math.round(deltaY / trackHeight);
        const targetTrackIndex = Math.min(
          Math.max(0, dragStartPos.current.trackIndex + trackOffset),
          tracks.length - 1
        );
        const targetTrack = tracks[targetTrackIndex];

        // Calculate new time position
        let newStart = dragStartPos.current.timeStart + deltaTime;
        if (timeline.gridSnap) {
          const snapInterval = timeline.snapInterval;
          const snappedDelta = Math.round(deltaTime / snapInterval) * snapInterval;
          newStart = Math.max(0, dragStartPos.current.timeStart + snappedDelta);
        } else {
          newStart = Math.max(0, newStart);
        }
        const newEnd = newStart + (dragStartPos.current.timeEnd - dragStartPos.current.timeStart);

        // In copy mode, just show preview position without actually moving
        // In move mode, update the clip position
        if (!isCopying) {
          // Move mode: only call moveClip when changing tracks
          if (targetTrack && targetTrack.id !== currentTrackId) {
            moveClip(clip.id, targetTrack.id, { start: newStart, end: newEnd });
            setCurrentTrackId(targetTrack.id); // Update current track
          } else {
            // Same track, just update position
            updateClip(clip.id, {
              timeRange: { start: newStart, end: newEnd },
            });
          }
        }
        // Store the target position for copy on mouse up
        setDragState({
          currentPosition: { x: e.clientX, y: e.clientY },
          targetTrackId: targetTrack?.id,
        });
      } else if (isResizing === 'left') {
        // Resize from left
        let newStart: number;
        if (timeline.gridSnap) {
          const snapInterval = timeline.snapInterval;
          const snappedDelta = Math.round(deltaTime / snapInterval) * snapInterval;
          newStart = dragStartPos.current.timeStart + snappedDelta;
        } else {
          newStart = dragStartPos.current.timeStart + deltaTime;
        }

        // Constrain to valid range
        newStart = Math.max(0, Math.min(dragStartPos.current.timeEnd - 0.1, newStart));
        console.log('Updating left resize:', { oldStart: clip.timeRange.start, newStart, deltaTime });

        updateClip(clip.id, {
          timeRange: { start: newStart, end: clip.timeRange.end },
        });
      } else if (isResizing === 'right') {
        // Resize from right
        let newEnd: number;
        if (timeline.gridSnap) {
          const snapInterval = timeline.snapInterval;
          const snappedDelta = Math.round(deltaTime / snapInterval) * snapInterval;
          newEnd = dragStartPos.current.timeEnd + snappedDelta;
        } else {
          newEnd = dragStartPos.current.timeEnd + deltaTime;
        }

        // Constrain to valid range
        newEnd = Math.max(dragStartPos.current.timeStart + 0.1, newEnd);
        console.log('Updating right resize:', { oldEnd: clip.timeRange.end, newEnd, deltaTime });

        updateClip(clip.id, {
          timeRange: { start: clip.timeRange.start, end: newEnd },
        });
      }

      setDragState({
        currentPosition: { x: e.clientX, y: e.clientY },
      });
    },
    [clip.id, currentTrackId, isDragging, isCopying, isResizing, timeline, zoom, updateClip, moveClip, copyClip, setDragState, tracks, setCurrentTrackId]
  );

  const handleMouseUp = useCallback((e: MouseEvent) => {
    // If we were copying, create the copy at the final position
    if (isDragging && isCopying) {
      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;
      const deltaTime = deltaX / zoom;

      // Calculate target track
      const trackHeight = 80;
      const trackOffset = Math.round(deltaY / trackHeight);
      const targetTrackIndex = Math.min(
        Math.max(0, dragStartPos.current.trackIndex + trackOffset),
        tracks.length - 1
      );
      const targetTrack = tracks[targetTrackIndex];

      // Calculate new time position
      let newStart = dragStartPos.current.timeStart + deltaTime;
      if (timeline.gridSnap) {
        const snapInterval = timeline.snapInterval;
        const snappedDelta = Math.round(deltaTime / snapInterval) * snapInterval;
        newStart = Math.max(0, dragStartPos.current.timeStart + snappedDelta);
      } else {
        newStart = Math.max(0, newStart);
      }
      const newEnd = newStart + (dragStartPos.current.timeEnd - dragStartPos.current.timeStart);

      // Create the copy at the final position
      if (targetTrack) {
        copyClip(clip.id, targetTrack.id, { start: newStart, end: newEnd });
      }
    }

    setIsDragging(false);
    setIsResizing(null);
    setIsCopying(false);
    setCurrentTrackId(clip.trackId); // Reset to actual track after drag

    setDragState({
      isDragging: false,
      dragType: null,
    });

    if (onDragEnd) {
      onDragEnd();
    }

    // Remove global mouse event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging, isCopying, clip.id, dragStartPos, zoom, timeline, tracks, copyClip, handleMouseMove, setDragState, onDragEnd]);

  // Update currentTrackId when clip.trackId changes (from props)
  useEffect(() => {
    setCurrentTrackId(clip.trackId);
  }, [clip.trackId]);

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <motion.div
      ref={clipRef}
      className={`
        absolute rounded-md overflow-hidden
        ${isCopying ? 'cursor-copy' : 'cursor-move'}
        ${getClipColor()}
        ${clip.selected ? 'ring-2 ring-blue-400 ring-opacity-75' : ''}
        ${isDragging && !isCopying || isResizing ? 'opacity-75' : ''}
        ${isDragging && isCopying ? 'opacity-50 ring-2 ring-green-400' : ''}
        transition-colors duration-200
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
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-transparent hover:bg-blue-500 hover:bg-opacity-30 z-10"
        onMouseDown={(e) => {
          console.log('Left resize handle clicked');
          handleMouseDown(e, 'resize-left');
        }}
      />

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-transparent hover:bg-blue-500 hover:bg-opacity-30 z-10"
        onMouseDown={(e) => {
          console.log('Right resize handle clicked');
          handleMouseDown(e, 'resize-right');
        }}
      />

      {/* Clip content */}
      <div className="px-3 py-2 h-full flex flex-col justify-between pointer-events-none">
        <div className="flex items-start justify-between">
          <span className="text-xs text-white font-medium truncate">
            {clip.name}
          </span>
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