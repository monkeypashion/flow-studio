import React from 'react';
import type { Aspect as AspectType } from '../../types/index';
import { useAppStore } from '../../store/appStore';
import { Track } from '../Track/Track';

interface AspectProps {
  aspect: AspectType;
  zoom: number;
  width: number;
  trackOffset: number; // Global track offset for this aspect
  onClipDrop?: (trackId: string, time: number) => void;
}

export const Aspect: React.FC<AspectProps> = ({
  aspect,
  zoom,
  width,
  trackOffset,
  onClipDrop,
}) => {
  const {
    updateAspect,
    toggleAspectExpanded,
  } = useAppStore();

  return (
    <div className="border-b border-gray-750">
      {/* Aspect header */}
      <div className="bg-gray-825">
        <div className="flex items-center" style={{ width: '100%' }}>
          {/* Left side - Aspect info and controls */}
          <div className="w-48 flex-shrink-0 bg-gray-775 border-r border-gray-700 px-4 py-1.5 sticky left-0 z-20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                {/* Expand/Collapse button */}
                <button
                  onClick={() => toggleAspectExpanded(aspect.id)}
                  className="p-0.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                >
                  <svg
                    className={`w-3 h-3 text-gray-500 transition-transform ${
                      aspect.expanded ? 'rotate-90' : ''
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {/* Aspect name */}
                <input
                  type="text"
                  value={aspect.name}
                  onChange={(e) => updateAspect(aspect.id, { name: e.target.value })}
                  className="bg-transparent text-xs font-medium text-gray-300 outline-none border-b border-transparent hover:border-gray-600 focus:border-blue-500 transition-colors flex-1 min-w-0 truncate"
                  title={aspect.name}
                />
              </div>

            </div>

            {/* Aspect type badge */}
            {aspect.aspectType && (
              <div className="mt-0.5">
                <span className="text-[10px] text-gray-600 bg-gray-850 px-1.5 py-0.5 rounded">
                  {aspect.aspectType}
                </span>
              </div>
            )}
          </div>

          {/* Right side - Timeline header for aspect */}
          <div className="flex-1 px-3 py-1.5 bg-gray-825">
            <div className="text-[10px] text-gray-600 font-medium uppercase tracking-wide">
              {aspect.tracks.length} {aspect.tracks.length === 1 ? 'Property' : 'Properties'}
            </div>
          </div>
        </div>
      </div>

      {/* Aspect tracks (properties) */}
      {aspect.expanded && (
        <div>
            {aspect.tracks.length === 0 ? (
              <div className="flex">
                <div className="w-48 flex-shrink-0 bg-gray-850 border-r border-gray-700 px-4 py-3">
                  <div className="text-xs text-gray-600 text-center">No properties</div>
                </div>
                <div className="flex-1 bg-track-bg py-3 px-3">
                  <div className="text-xs text-gray-600">No properties defined</div>
                </div>
              </div>
            ) : (
              aspect.tracks
                .filter(track => track.visible) // Only render visible tracks
                .sort((a, b) => a.index - b.index)
                .map((track, index) => (
                  <Track
                    key={track.id}
                    track={track}
                    trackIndex={trackOffset + index} // Pass the global track index (only counting visible tracks)
                    zoom={zoom}
                    width={width}
                    onClipDrop={onClipDrop}
                  />
                ))
            )}
        </div>
      )}
    </div>
  );
};