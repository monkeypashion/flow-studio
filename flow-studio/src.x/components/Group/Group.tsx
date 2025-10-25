import React from 'react';
import type { Group as GroupType } from '../../types/index';
import { useAppStore } from '../../store/appStore';
import { Aspect } from '../Aspect/Aspect';

interface GroupProps {
  group: GroupType;
  zoom: number;
  width: number;
  trackOffset: number; // Global track offset for this group
  onClipDrop?: (trackId: string, time: number) => void;
}

export const Group: React.FC<GroupProps> = ({
  group,
  zoom,
  width,
  trackOffset,
  onClipDrop,
}) => {
  const {
    updateGroup,
    toggleGroupExpanded,
  } = useAppStore();

  console.log('[Group] Rendering:', group.name, 'width:', width, 'aspects:', group.aspects.length);

  return (
    <div className="border-b-2 border-gray-800">
      {/* Group header */}
      <div className="bg-gray-850 border-b border-gray-700">
        <div className="flex items-center">
          {/* Left side - Group info and controls */}
          <div className="w-48 flex-shrink-0 bg-gray-800 border-r border-gray-700 px-3 py-2 sticky left-0 z-20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {/* Expand/Collapse button */}
                <button
                  onClick={() => toggleGroupExpanded(group.id)}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                >
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      group.expanded ? 'rotate-90' : ''
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

                {/* Group name */}
                <input
                  type="text"
                  value={group.name}
                  onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                  className="bg-transparent text-sm font-semibold text-gray-200 outline-none border-b border-transparent hover:border-gray-600 focus:border-blue-500 transition-colors"
                />
              </div>

            </div>

            {/* Asset ID badge */}
            {group.assetId && (
              <div className="mt-1">
                <span
                  className="text-[10px] text-gray-500 bg-gray-900 px-2 py-0.5 rounded block truncate max-w-full"
                  title={group.assetId}
                >
                  {group.assetId}
                </span>
              </div>
            )}
          </div>

          {/* Right side - Timeline header for group */}
          <div className="flex-1 px-3 py-2 bg-gray-850">
            <div className="text-xs text-gray-500 font-medium">
              {group.aspects.length} {group.aspects.length === 1 ? 'Aspect' : 'Aspects'}
            </div>
          </div>
        </div>
      </div>

      {/* Group aspects */}
      {group.expanded && (
        <div>
            {group.aspects.length === 0 ? (
              <div className="flex">
                <div className="w-48 flex-shrink-0 bg-gray-850 border-r border-gray-700 px-3 py-4">
                  <div className="text-xs text-gray-500 text-center">No aspects</div>
                </div>
                <div className="flex-1 bg-track-bg py-4 px-3">
                  <div className="text-xs text-gray-500">No aspects defined</div>
                </div>
              </div>
            ) : (
              group.aspects
                .filter(aspect => aspect.visible) // Only render visible aspects
                .sort((a, b) => a.index - b.index)
                .map((aspect, index) => {
                  // Calculate track offset for this aspect based on all previous VISIBLE aspects
                  let aspectTrackOffset = trackOffset;
                  const visibleAspects = group.aspects.filter(a => a.visible).sort((a, b) => a.index - b.index);
                  for (let i = 0; i < index; i++) {
                    // Only count visible tracks from visible aspects
                    aspectTrackOffset += visibleAspects[i].tracks.filter(t => t.visible).length;
                  }
                  return (
                    <Aspect
                      key={aspect.id}
                      aspect={aspect}
                      zoom={zoom}
                      width={width}
                      trackOffset={aspectTrackOffset}
                      onClipDrop={onClipDrop}
                    />
                  );
                })
            )}
        </div>
      )}
    </div>
  );
};