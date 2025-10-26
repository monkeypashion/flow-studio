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
    toggleGroupVisible,
    showAssets,
    showAspects,
    selectedItem,
  } = useAppStore();

  // Check if this group is selected
  const isSelected = selectedItem?.type === 'group' && selectedItem.id === group.id;

  return (
    <div className={showAssets ? `border-b-2 ${isSelected ? 'border-cyan-500/40' : 'border-gray-800'}` : ""} data-group-id={group.id}>
      {/* Group header - only show if showAssets is true */}
      {showAssets && (
        <div className={`flex items-stretch border-b ${isSelected ? 'border-cyan-500/30' : 'border-gray-700'}`}>
            {/* Left side - Group info and controls */}
            <div className={`w-48 flex-shrink-0 border-r px-3 py-2 sticky left-0 z-20 transition-colors ${
              isSelected ? 'bg-cyan-500/40 border-cyan-400' : 'bg-gray-800 border-gray-700'
            }`}>
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

                  {/* Visibility toggle button */}
                  <button
                    onClick={() => toggleGroupVisible(group.id)}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                    title={group.visible ? 'Hide asset' : 'Show asset'}
                  >
                    {group.visible ? (
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path
                          fillRule="evenodd"
                          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                          clipRule="evenodd"
                        />
                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                      </svg>
                    )}
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
            <div className={`flex-1 px-3 py-2 transition-colors ${
              isSelected ? 'bg-cyan-500/40' : 'bg-gray-800'
            }`}>
              <div className="text-xs text-gray-500 font-medium">
                {group.aspects.length} {group.aspects.length === 1 ? 'Aspect' : 'Aspects'}
              </div>
            </div>
        </div>
      )}

      {/* Group aspects - show if group is expanded OR if assets are hidden */}
      {(group.expanded || !showAssets) && (
        <div>
            {group.aspects.length === 0 ? (
              showAssets && (
                <div className="flex">
                  <div className="w-48 flex-shrink-0 bg-gray-900 border-r border-gray-700 px-3 py-4">
                    <div className="text-xs text-gray-500 text-center">No aspects</div>
                  </div>
                  <div className="flex-1 bg-track-bg py-4 px-3">
                    <div className="text-xs text-gray-500">No aspects defined</div>
                  </div>
                </div>
              )
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
                      groupId={group.id}
                      tenantColor={group.tenantColor}
                      tenantId={group.tenantId}
                    />
                  );
                })
            )}
        </div>
      )}
    </div>
  );
};