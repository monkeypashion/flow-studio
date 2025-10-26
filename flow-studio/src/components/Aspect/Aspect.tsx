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
  groupId?: string;
  tenantColor?: string;
  tenantId?: string;
}

export const Aspect: React.FC<AspectProps> = ({
  aspect,
  zoom,
  width,
  trackOffset,
  onClipDrop,
  groupId,
  tenantColor,
  tenantId,
}) => {
  const {
    updateAspect,
    toggleAspectExpanded,
    toggleAspectVisible,
    showAssets,
    showAspects,
    selectedItem,
    trackHeaderWidth,
  } = useAppStore();

  // Check if this aspect is selected OR if its parent group is selected
  const isSelected =
    (selectedItem?.type === 'aspect' && selectedItem.id === aspect.id) ||
    (selectedItem?.type === 'group' && groupId && selectedItem.id === groupId);

  return (
    <div className={showAspects ? `border-b ${isSelected ? 'border-cyan-500/30' : 'border-gray-700'}` : ""} data-aspect-id={aspect.id}>
      {/* Aspect header - only show if showAspects is true */}
      {showAspects && (
        <div className="flex items-stretch" style={{ width: '100%' }}>
            {/* Left side - Aspect info and controls */}
            <div
              className={`flex-shrink-0 border-r px-4 py-1.5 sticky left-0 z-20 transition-colors ${
                isSelected ? 'bg-cyan-500/40 border-cyan-400' : 'bg-gray-800 border-gray-700'
              }`}
              style={{ width: `${trackHeaderWidth}px` }}
            >
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

                  {/* Visibility toggle button */}
                  <button
                    onClick={() => toggleAspectVisible(aspect.id)}
                    className="p-0.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                    title={aspect.visible ? 'Hide aspect' : 'Show aspect'}
                  >
                    {aspect.visible ? (
                      <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path
                          fillRule="evenodd"
                          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                          clipRule="evenodd"
                        />
                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                      </svg>
                    )}
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
                  <span className="text-[10px] text-gray-600 bg-gray-900 px-1.5 py-0.5 rounded">
                    {aspect.aspectType}
                  </span>
                </div>
              )}
            </div>

            {/* Right side - Timeline header for aspect */}
            <div className={`flex-1 px-3 py-1.5 transition-colors ${
              isSelected ? 'bg-cyan-500/40' : 'bg-gray-800'
            }`}>
              <div className="text-[10px] text-gray-600 font-medium uppercase tracking-wide">
                {aspect.tracks.length} {aspect.tracks.length === 1 ? 'Property' : 'Properties'}
              </div>
            </div>
        </div>
      )}

      {/* Aspect tracks (properties) - show if aspect is expanded OR if aspects are hidden */}
      {(aspect.expanded || !showAspects) && (
        <div>
            {aspect.tracks.length === 0 ? (
              showAspects && (
                <div className="flex">
                  <div className="flex-shrink-0 bg-gray-900 border-r border-gray-700 px-4 py-3" style={{ width: `${trackHeaderWidth}px` }}>
                    <div className="text-xs text-gray-600 text-center">No properties</div>
                  </div>
                  <div className="flex-1 bg-track-bg py-3 px-3">
                    <div className="text-xs text-gray-600">No properties defined</div>
                  </div>
                </div>
              )
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
                    tenantColor={tenantColor}
                    tenantId={tenantId}
                    groupId={groupId}
                    aspectId={aspect.id}
                  />
                ))
            )}
        </div>
      )}
    </div>
  );
};