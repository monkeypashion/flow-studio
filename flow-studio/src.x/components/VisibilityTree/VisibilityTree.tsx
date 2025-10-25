import React from 'react';
import { useAppStore } from '../../store/appStore';

export const VisibilityTree: React.FC = () => {
  const {
    groups,
    toggleGroupExpanded,
    toggleGroupVisible,
    toggleAspectExpanded,
    toggleAspectVisible,
    toggleTrackVisible,
  } = useAppStore();

  return (
    <div className="w-48 flex-shrink-0 bg-gray-800 border-r border-gray-700 overflow-y-auto">
      {/* Header spacer to align with time ruler */}
      <div className="h-14 border-b border-gray-700 bg-gray-900 flex items-center px-2">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Assets</span>
      </div>

      {/* Tree content */}
      <div className="py-1">
        {groups
          .sort((a, b) => a.index - b.index)
          .map((group) => (
            <div key={group.id}>
              {/* Group/Asset row */}
              <div className="flex items-center px-2 py-1.5 hover:bg-gray-750 transition-colors group">
                {/* Expand/collapse button */}
                <button
                  onClick={() => toggleGroupExpanded(group.id)}
                  className="p-0.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0 mr-1"
                >
                  <svg
                    className={`w-3 h-3 text-gray-500 transition-transform ${
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
                  className="p-0.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0 mr-1.5"
                  title={group.visible ? 'Hide asset' : 'Show asset'}
                >
                  {group.visible ? (
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path
                        fillRule="evenodd"
                        d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
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
                <span
                  className={`text-xs font-semibold flex-1 min-w-0 truncate ${
                    group.visible ? 'text-gray-200' : 'text-gray-600'
                  }`}
                  title={group.name}
                >
                  {group.name}
                </span>
              </div>

              {/* Aspects (only show if group is expanded) */}
              {group.expanded &&
                group.aspects
                  .sort((a, b) => a.index - b.index)
                  .map((aspect) => (
                    <div key={aspect.id}>
                      {/* Aspect row */}
                      <div className="flex items-center px-2 py-1 hover:bg-gray-750 transition-colors group pl-6">
                        {/* Expand/collapse button */}
                        <button
                          onClick={() => toggleAspectExpanded(aspect.id)}
                          className="p-0.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0 mr-1"
                        >
                          <svg
                            className={`w-2.5 h-2.5 text-gray-500 transition-transform ${
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
                          className="p-0.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0 mr-1.5"
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
                        <span
                          className={`text-xs font-medium flex-1 min-w-0 truncate ${
                            aspect.visible ? 'text-gray-300' : 'text-gray-600'
                          }`}
                          title={aspect.name}
                        >
                          {aspect.name}
                        </span>
                      </div>

                      {/* Tracks/Properties (only show if aspect is expanded) */}
                      {aspect.expanded &&
                        aspect.tracks
                          .sort((a, b) => a.index - b.index)
                          .map((track) => (
                            <div
                              key={track.id}
                              className="flex items-center px-2 py-1 hover:bg-gray-750 transition-colors group pl-10"
                            >
                              {/* Visibility toggle button */}
                              <button
                                onClick={() => toggleTrackVisible(track.id)}
                                className="p-0.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0 mr-1.5 ml-3.5"
                                title={track.visible ? 'Hide property' : 'Show property'}
                              >
                                {track.visible ? (
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

                              {/* Track name */}
                              <span
                                className={`text-xs flex-1 min-w-0 truncate ${
                                  track.visible ? 'text-gray-400' : 'text-gray-600'
                                }`}
                                title={track.name}
                              >
                                {track.name}
                              </span>
                            </div>
                          ))}
                    </div>
                  ))}
            </div>
          ))}
      </div>
    </div>
  );
};
