import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { motion, AnimatePresence } from 'framer-motion';

export const Inspector: React.FC = () => {
  // Subscribe to the actual state that changes, not just functions
  const dataJobs = useAppStore(state => state.dataJobs);
  const activeJobId = useAppStore(state => state.activeJobId);
  const selection = useAppStore(state => state.selection);
  const timeline = useAppStore(state => state.timeline);
  const updateClip = useAppStore(state => state.updateClip);
  const removeClip = useAppStore(state => state.removeClip);
  const getSelectedClips = useAppStore(state => state.getSelectedClips);

  // Call getSelectedClips() during render to get fresh data
  const selectedClips = getSelectedClips();

  // State for refreshing live clip display
  const [, setRefreshTrigger] = useState(0);

  // Get first clip and check if it's live (before early return)
  const clip = selectedClips.length > 0 ? selectedClips[0] : null;
  const isLiveClip = clip ? (clip.timeRange.end === undefined || clip.timeRange.end === null) : false;

  // Auto-refresh Inspector display for live clips
  // MUST be called before early return to follow Rules of Hooks
  useEffect(() => {
    if (!isLiveClip) return;

    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [isLiveClip]);

  // Early return AFTER all hooks
  if (selectedClips.length === 0 || !clip) {
    return (
      <div className="w-80 bg-gray-900 border-l border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-gray-300 mb-4">Inspector</h3>
        <p className="text-sm text-gray-500">No clips selected</p>
      </div>
    );
  }

  // Get current timeline position for live clips
  const getCurrentTimelinePosition = (): number => {
    const timelineStartMs = new Date(timeline.startTime).getTime();
    const nowMs = Date.now();
    const currentPositionInSeconds = (nowMs - timelineStartMs) / 1000;
    return currentPositionInSeconds;
  };

  // Convert relative seconds to absolute ISO timestamp
  const formatTime = (seconds: number | undefined): string => {
    // Check for undefined, null, or NaN
    if (seconds === undefined || seconds === null || isNaN(seconds)) {
      return 'LIVE (Current Time)';
    }

    try {
      const startDate = new Date(timeline.startTime);
      const absoluteDate = new Date(startDate.getTime() + seconds * 1000);

      // Check if the resulting date is valid
      if (isNaN(absoluteDate.getTime())) {
        return 'LIVE (Current Time)';
      }

      return absoluteDate.toISOString();
    } catch (error) {
      // Fallback for any errors
      return 'LIVE (Current Time)';
    }
  };

  // Format duration as human-readable (hours:minutes:seconds)
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'idle':
        return 'text-gray-400';
      case 'uploading':
        return 'text-blue-400';
      case 'processing':
        return 'text-green-400';
      case 'complete':
        return 'text-green-500';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-300">Inspector</h3>
        {isLiveClip && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-600 rounded animate-pulse">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            <span className="text-xs font-bold text-white">LIVE</span>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={clip.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {/* Clip Name */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Name
            </label>
            <input
              type="text"
              value={clip.name}
              onChange={(e) => updateClip(clip.id, { name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Color
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={clip.color || '#14b8a6'}
                onChange={(e) => updateClip(clip.id, { color: e.target.value })}
                className="w-12 h-10 bg-gray-800 border border-gray-700 rounded cursor-pointer"
              />
              <div className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm font-mono">
                {clip.color || 'Default (State-based)'}
              </div>
              {clip.color && (
                <button
                  onClick={() => updateClip(clip.id, { color: undefined })}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors text-sm"
                  title="Reset to default"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Status
            </label>
            <div className="flex items-center space-x-2">
              <span className={`font-medium ${getStateColor(clip.state)}`}>
                {clip.state.charAt(0).toUpperCase() + clip.state.slice(1)}
              </span>
              {clip.state === 'uploading' || clip.state === 'processing' ? (
                <span className="text-sm text-gray-500">
                  ({Math.round(clip.progress)}%)
                </span>
              ) : null}
            </div>

            {/* Progress Bar */}
            {(clip.state === 'uploading' || clip.state === 'processing') && (
              <div className="mt-2 w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-green-500"
                  initial={{ width: '0%' }}
                  animate={{ width: `${clip.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
          </div>

          {/* Time Range - showing absolute ISO timestamps */}
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Start Time
              </label>
              <p className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 font-mono text-xs break-all">
                {formatTime(clip.timeRange.start)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                End Time
              </label>
              <p className={`w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded font-mono text-xs break-all ${
                isLiveClip ? 'text-green-400 font-bold' : 'text-gray-200'
              }`}>
                {formatTime(clip.timeRange.end)}
              </p>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Duration
            </label>
            <p className={`${isLiveClip ? 'text-green-400 font-bold' : 'text-gray-200'}`}>
              {isLiveClip
                ? `LIVE - ${formatDuration(getCurrentTimelinePosition() - clip.timeRange.start)}`
                : formatDuration(clip.timeRange.end! - clip.timeRange.start)
              }
            </p>
          </div>

          {/* Live Mode Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Live Mode
            </label>
            <button
              onClick={() => {
                if (isLiveClip) {
                  // Freeze at current time
                  const currentPos = getCurrentTimelinePosition();
                  updateClip(clip.id, {
                    timeRange: { start: clip.timeRange.start, end: currentPos }
                  });
                } else {
                  // Make live (clear end date)
                  updateClip(clip.id, {
                    timeRange: { start: clip.timeRange.start, end: undefined }
                  });
                }
              }}
              className={`w-full px-4 py-2 rounded transition-all flex items-center justify-center gap-2 ${
                isLiveClip
                  ? 'bg-green-600 hover:bg-green-700 text-white animate-pulse'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {isLiveClip && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
              <span className="font-medium">
                {isLiveClip ? 'Freeze at Current Time' : 'Make Live'}
              </span>
            </button>
          </div>

          {/* Linked Clip Info */}
          {clip.linkedToClipId && (
            <div className="p-3 bg-blue-900 bg-opacity-20 border border-blue-700 rounded">
              <div className="flex items-center space-x-2 mb-1">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <p className="text-sm font-medium text-blue-400">Linked Clip</p>
              </div>
              <p className="text-xs text-blue-300">
                Duration synced to master clip
              </p>
              <p className="text-xs text-gray-400 mt-1 font-mono break-all">
                Master: {clip.linkedToClipId}
              </p>
            </div>
          )}

          {/* Master Clip Info */}
          {(() => {
            // Check if this is a master clip (has clips linked to it)
            const linkedClips: string[] = [];
            dataJobs.find(job => job.id === activeJobId)?.groups.forEach(group => {
              group.aspects.forEach(aspect => {
                aspect.tracks.forEach(track => {
                  track.clips.forEach(c => {
                    if (c.linkedToClipId === clip.id) {
                      linkedClips.push(c.id);
                    }
                  });
                });
              });
            });

            if (linkedClips.length > 0) {
              return (
                <div className="p-3 bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded">
                  <div className="flex items-center space-x-2 mb-1">
                    <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <p className="text-sm font-medium text-yellow-400">Master Clip</p>
                  </div>
                  <p className="text-xs text-yellow-300">
                    {linkedClips.length} clip{linkedClips.length > 1 ? 's' : ''} linked to this master
                  </p>
                </div>
              );
            }
            return null;
          })()}

          {/* Track */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Track ID
            </label>
            <p className="text-gray-200 font-mono text-sm">{clip.trackId}</p>
          </div>

          {/* Clip ID */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Clip ID
            </label>
            <p className="text-gray-200 font-mono text-xs break-all">{clip.id}</p>
          </div>

          {/* Multiple Selection Info */}
          {selectedClips.length > 1 && (
            <div className="mt-4 p-3 bg-blue-900 bg-opacity-20 border border-blue-700 rounded">
              <p className="text-sm text-blue-400">
                {selectedClips.length} clips selected
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-gray-700 space-y-2">
            <button
              onClick={() => {
                selectedClips.forEach((c) => removeClip(c.id));
              }}
              className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              Delete {selectedClips.length > 1 ? 'Selected Clips' : 'Clip'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};