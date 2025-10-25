import React from 'react';
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

  if (selectedClips.length === 0) {
    return (
      <div className="w-80 bg-gray-900 border-l border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-gray-300 mb-4">Inspector</h3>
        <p className="text-sm text-gray-500">No clips selected</p>
      </div>
    );
  }

  const clip = selectedClips[0]; // Show details of first selected clip

  // Convert relative seconds to absolute ISO timestamp
  const formatTime = (seconds: number): string => {
    const startDate = new Date(timeline.startTime);
    const absoluteDate = new Date(startDate.getTime() + seconds * 1000);
    return absoluteDate.toISOString();
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
      <h3 className="text-lg font-semibold text-gray-300 mb-4">Inspector</h3>

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
              <p className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 font-mono text-xs break-all">
                {formatTime(clip.timeRange.end)}
              </p>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Duration
            </label>
            <p className="text-gray-200">
              {formatDuration(clip.timeRange.end - clip.timeRange.start)}
            </p>
          </div>

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