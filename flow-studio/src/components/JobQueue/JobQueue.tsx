import React, { useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { mockBackend } from '../../services/mockBackend';
import { motion, AnimatePresence } from 'framer-motion';

export const JobQueue: React.FC = () => {
  const { jobs, addJob, updateJob, removeJob, clearCompletedJobs, handleProgress } = useAppStore();

  useEffect(() => {
    // Subscribe to mock backend events
    const unsubscribeProgress = mockBackend.onProgress((event) => {
      handleProgress(event.clipId, event.progress, event.state);
    });

    const unsubscribeComplete = mockBackend.onJobComplete((job) => {
      updateJob(job.id, job);
    });

    return () => {
      unsubscribeProgress();
      unsubscribeComplete();
    };
  }, [handleProgress, updateJob]);

  const getJobIcon = (type: string) => {
    switch (type) {
      case 'upload':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        );
      case 'download':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        );
      case 'process':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'pending':
        return 'text-gray-400 bg-gray-800';
      case 'running':
        return 'text-blue-400 bg-blue-900';
      case 'complete':
        return 'text-green-400 bg-green-900';
      case 'error':
        return 'text-red-400 bg-red-900';
      default:
        return 'text-gray-400 bg-gray-800';
    }
  };

  const formatDuration = (startTime: number, endTime?: number) => {
    const duration = (endTime || Date.now()) - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const activeJobs = jobs.filter(j => j.state === 'running' || j.state === 'pending');
  const completedJobs = jobs.filter(j => j.state === 'complete' || j.state === 'error');

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-300">Job Queue</h3>
          {completedJobs.length > 0 && (
            <button
              onClick={clearCompletedJobs}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear Completed
            </button>
          )}
        </div>
        <div className="flex space-x-4 text-xs text-gray-500">
          <span>Active: {activeJobs.length}</span>
          <span>Completed: {completedJobs.filter(j => j.state === 'complete').length}</span>
          <span>Failed: {completedJobs.filter(j => j.state === 'error').length}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Active Jobs */}
        {activeJobs.length > 0 && (
          <div className="p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-2">Active</h4>
            <AnimatePresence>
              {activeJobs.map((job) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2"
                >
                  <div className={`p-3 rounded-lg ${getStateColor(job.state).split(' ')[1]} bg-opacity-20 border border-gray-700`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={getStateColor(job.state).split(' ')[0]}>
                          {getJobIcon(job.type)}
                        </span>
                        <span className="text-sm text-gray-300 font-medium">
                          {job.clipName}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDuration(job.startTime)}
                      </span>
                    </div>

                    {job.state === 'running' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{job.type}</span>
                          <span>{Math.round(job.progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 to-green-500"
                            initial={{ width: '0%' }}
                            animate={{ width: `${job.progress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                    )}

                    {job.state === 'pending' && (
                      <div className="text-xs text-gray-500">Waiting...</div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Completed Jobs */}
        {completedJobs.length > 0 && (
          <div className="p-4 border-t border-gray-800">
            <h4 className="text-sm font-medium text-gray-400 mb-2">Completed</h4>
            <AnimatePresence>
              {completedJobs.map((job) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2"
                >
                  <div className={`p-2 rounded ${getStateColor(job.state).split(' ')[1]} bg-opacity-10`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={getStateColor(job.state).split(' ')[0]}>
                          {getJobIcon(job.type)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {job.clipName}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {job.state === 'complete' ? (
                          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatDuration(job.startTime, job.endTime)}
                        </span>
                      </div>
                    </div>
                    {job.error && (
                      <p className="text-xs text-red-400 mt-1">{job.error}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Empty State */}
        {jobs.length === 0 && (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm text-gray-500">No jobs in queue</p>
            <p className="text-xs text-gray-600 mt-1">
              Double-click timeline to create clips
            </p>
          </div>
        )}
      </div>
    </div>
  );
};