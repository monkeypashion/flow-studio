import { useEffect, useRef } from 'react';
import { Timeline } from './components/Timeline/Timeline';
import { Inspector } from './components/Inspector/Inspector';
import { JobQueue } from './components/JobQueue/JobQueue';
import { useAppStore } from './store/appStore';
import { mockBackend } from './services/mockBackend';
import { initializeClipboardListeners } from './utils/clipboard';

function App() {
  const { addJob, updateJob, handleProgress, inspectorVisible, jobQueueVisible } = useAppStore();
  const appRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize clipboard keyboard shortcuts
    const cleanupClipboard = initializeClipboardListeners();

    // Subscribe to mock backend events
    const unsubscribeProgress = mockBackend.onProgress((event) => {
      handleProgress(event.clipId, event.progress, event.state);
    });

    const unsubscribeComplete = mockBackend.onJobComplete((job) => {
      updateJob(job.id, job);

      // Add job to the job queue if it doesn't exist
      const existingJob = useAppStore.getState().jobs.find(j => j.id === job.id);
      if (!existingJob) {
        addJob(job);
      }
    });

    // Demo: Create some initial clips for testing
    const demoClips = () => {
      const store = useAppStore.getState();
      const allTracks = store.getAllTracks();
      const track1 = allTracks[0]; // GoodParts track
      const track2 = allTracks[1]; // BadParts track

      if (track1) {
        // Convert relative seconds to positions within today's timeline
        // Timeline starts at midnight today (00:00:00)
        // These clips will appear at specific times of day
        setTimeout(() => {
          store.addClip(track1.id, {
            name: 'Sample Data 1',
            trackId: track1.id,
            timeRange: { start: 7200, end: 14400 }, // 02:00 - 04:00 (2-4 hours from midnight)
            state: 'uploading',
            progress: 0,
            selected: false,
          });
        }, 500);

        setTimeout(() => {
          store.addClip(track1.id, {
            name: 'Analysis Result',
            trackId: track1.id,
            timeRange: { start: 28800, end: 43200 }, // 08:00 - 12:00 (8-12 hours from midnight)
            state: 'processing',
            progress: 0,
            selected: false,
          });
        }, 1000);
      }

      if (track2) {
        setTimeout(() => {
          store.addClip(track2.id, {
            name: 'Time Series A',
            trackId: track2.id,
            timeRange: { start: 18000, end: 32400 }, // 05:00 - 09:00 (5-9 hours from midnight)
            state: 'complete',
            progress: 100,
            selected: false,
          });
        }, 1500);

        setTimeout(() => {
          store.addClip(track2.id, {
            name: 'Dataset Beta',
            trackId: track2.id,
            timeRange: { start: 50400, end: 64800 }, // 14:00 - 18:00 (14-18 hours from midnight)
            state: 'idle',
            progress: 0,
            selected: false,
          });
        }, 2000);
      }
    };

    // Uncomment to add demo clips on load
    demoClips();

    return () => {
      cleanupClipboard();
      unsubscribeProgress();
      unsubscribeComplete();
    };
  }, [addJob, updateJob, handleProgress]);

  return (
    <div ref={appRef} className="h-screen w-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">
            Flow Studio
          </h1>
          <span className="text-sm text-gray-500">Digital Time-Series Workstation</span>
        </div>

        <div className="flex items-center space-x-4">
          {/* Keyboard Shortcuts Help */}
          <div className="text-xs text-gray-500">
            <span className="font-semibold">Shortcuts:</span>
            <span className="ml-2">Ctrl+C Copy</span>
            <span className="ml-2">Ctrl+V Paste</span>
            <span className="ml-2">Ctrl+X Cut</span>
            <span className="ml-2">Delete Remove</span>
            <span className="ml-2">G Grid Snap</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Timeline Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Timeline />
        </div>

        {/* Right Sidebar */}
        <div className="flex">
          {/* Inspector */}
          {inspectorVisible && <Inspector />}

          {/* Job Queue */}
          {jobQueueVisible && <JobQueue />}
        </div>
      </div>

      {/* Status Bar */}
      <footer className="bg-gray-900 border-t border-gray-700 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-6 text-xs text-gray-500">
          <span>Tracks: {useAppStore.getState().tracks.length}</span>
          <span>Selected: {useAppStore.getState().selection.clipIds.size}</span>
          <span>Jobs: {mockBackend.getActiveJobs().length} active</span>
        </div>

        <div className="text-xs text-gray-500">
          Double-click timeline to create clips • Drag to move • Resize from edges
        </div>
      </footer>
    </div>
  );
}

export default App;