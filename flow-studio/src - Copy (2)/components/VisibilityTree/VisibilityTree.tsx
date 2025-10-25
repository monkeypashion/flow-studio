import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { AssetPickerModal } from '../AssetPickerModal';

export const VisibilityTree: React.FC = () => {
  const {
    dataJobs,
    activeJobId,
    addDataJob,
    removeDataJob,
    renameDataJob,
    setActiveJob,
    toggleDataJobExpanded,
    toggleGroupExpanded,
    toggleGroupVisible,
    removeGroup,
    toggleAspectExpanded,
    toggleAspectVisible,
    toggleTrackVisible,
    treeWidth,
    setTreeWidth,
  } = useAppStore();

  const [isResizing, setIsResizing] = useState(false);
  const [assetPickerJobId, setAssetPickerJobId] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingJobName, setEditingJobName] = useState('');

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = treeWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(150, Math.min(400, startWidth + deltaX)); // Min 150px, max 400px
      setTreeWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleCreateJob = () => {
    const jobId = addDataJob('Untitled Job');
    setEditingJobId(jobId);
    setEditingJobName('Untitled Job');
  };

  const handleStartRename = (jobId: string, currentName: string) => {
    setEditingJobId(jobId);
    setEditingJobName(currentName);
  };

  const handleSaveRename = () => {
    if (editingJobId && editingJobName.trim()) {
      renameDataJob(editingJobId, editingJobName.trim());
    }
    setEditingJobId(null);
    setEditingJobName('');
  };

  const handleCancelRename = () => {
    setEditingJobId(null);
    setEditingJobName('');
  };

  const handleDeleteJob = (jobId: string) => {
    if (confirm('Delete this job? All assets and clips will be removed.')) {
      removeDataJob(jobId);
    }
  };

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    if (confirm(`Remove asset "${groupName}" from this job?`)) {
      removeGroup(groupId);
    }
  };

  return (
    <div
      className="flex-shrink-0 bg-gray-800 border-r border-gray-700 overflow-y-auto relative"
      style={{ width: `${treeWidth}px` }}
    >
      {/* Header */}
      <div className="h-14 border-b border-gray-700 bg-gray-900 flex items-center justify-between px-2">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Jobs</span>
        <button
          onClick={handleCreateJob}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
          title="Create new job"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Tree content */}
      <div className="py-1">
        {dataJobs.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No jobs yet. Click + to create one.
          </div>
        )}

        {dataJobs.map((job) => (
          <div key={job.id}>
            {/* Job row */}
            <div
              className={`flex items-center px-2 py-1.5 hover:bg-gray-750 transition-colors group ${
                activeJobId === job.id ? 'bg-gray-750' : ''
              }`}
            >
              {/* Expand/collapse button */}
              <button
                onClick={() => toggleDataJobExpanded(job.id)}
                className="p-0.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0 mr-1"
              >
                <svg
                  className={`w-3 h-3 text-gray-500 transition-transform ${
                    job.expanded ? 'rotate-90' : ''
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

              {/* Job name */}
              {editingJobId === job.id ? (
                <input
                  type="text"
                  value={editingJobName}
                  onChange={(e) => setEditingJobName(e.target.value)}
                  onBlur={handleSaveRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    if (e.key === 'Escape') handleCancelRename();
                  }}
                  className="flex-1 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              ) : (
                <>
                  <button
                    onClick={() => setActiveJob(job.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <span
                      className={`text-xs font-semibold truncate block ${
                        activeJobId === job.id ? 'text-blue-400' : 'text-gray-200'
                      }`}
                      title={job.name}
                    >
                      {job.name}
                    </span>
                  </button>

                  {/* Job actions (show on hover) */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setAssetPickerJobId(job.id)}
                      className="p-0.5 hover:bg-gray-700 rounded transition-colors"
                      title="Add assets to job"
                    >
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleStartRename(job.id, job.name)}
                      className="p-0.5 hover:bg-gray-700 rounded transition-colors"
                      title="Rename job"
                    >
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="p-0.5 hover:bg-gray-700 rounded transition-colors"
                      title="Delete job"
                    >
                      <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Groups (Assets) under job */}
            {job.expanded &&
              job.groups
                .sort((a, b) => a.index - b.index)
                .map((group) => (
                  <div key={group.id} className="ml-2">
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
                        title={group.visible ? (group.visibilityMode === 'implicit' ? 'Hide asset (implicit)' : 'Hide asset') : 'Show asset'}
                      >
                        {group.visible ? (
                          <svg
                            className={`w-3.5 h-3.5 ${group.visibilityMode === 'implicit' ? 'text-gray-500 opacity-60' : 'text-gray-400'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
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

                      {/* Tenant color indicator */}
                      {group.tenantColor && (
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0 mr-1.5"
                          style={{ backgroundColor: group.tenantColor }}
                          title={`Tenant: ${group.tenantId || 'Unknown'}`}
                        />
                      )}

                      {/* Group name */}
                      <span
                        className={`text-xs font-semibold flex-1 min-w-0 truncate ${
                          group.visible ? 'text-gray-200' : 'text-gray-600'
                        }`}
                        title={group.name}
                      >
                        {group.name}
                      </span>

                      {/* Delete button (show on hover) */}
                      <button
                        onClick={() => handleDeleteGroup(group.id, group.name)}
                        className="p-0.5 hover:bg-gray-700 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove asset from job"
                      >
                        <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
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
                                title={aspect.visible ? (aspect.visibilityMode === 'implicit' ? 'Hide aspect (implicit)' : 'Hide aspect') : 'Show aspect'}
                              >
                                {aspect.visible ? (
                                  <svg
                                    className={`w-3 h-3 ${aspect.visibilityMode === 'implicit' ? 'text-gray-500 opacity-60' : 'text-gray-400'}`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
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
                                      title={track.visible ? (track.visibilityMode === 'implicit' ? 'Hide property (implicit)' : 'Hide property') : 'Show property'}
                                    >
                                      {track.visible ? (
                                        <svg
                                          className={`w-3 h-3 ${track.visibilityMode === 'implicit' ? 'text-gray-500 opacity-60' : 'text-gray-400'}`}
                                          fill="currentColor"
                                          viewBox="0 0 20 20"
                                        >
                                          <path d="M10 12a2 0 100-4 2 2 0 000 4z" />
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
        ))}
      </div>

      {/* Resize handle */}
      <div
        className={`absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors ${
          isResizing ? 'bg-blue-500' : 'bg-transparent'
        }`}
        onMouseDown={handleMouseDown}
      />

      {/* Asset Picker Modal */}
      {assetPickerJobId && (
        <AssetPickerModal
          jobId={assetPickerJobId}
          onClose={() => setAssetPickerJobId(null)}
        />
      )}
    </div>
  );
};
