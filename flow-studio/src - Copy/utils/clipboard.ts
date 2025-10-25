import { useAppStore } from '../store/appStore';

export const initializeClipboardListeners = () => {
  const handleKeyDown = (e: KeyboardEvent) => {
    const store = useAppStore.getState();

    // Copy: Ctrl+C or Cmd+C
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey) {
      e.preventDefault();
      store.copySelection();
      console.log('Copied selection to clipboard');
    }

    // Cut: Ctrl+X or Cmd+X
    if ((e.ctrlKey || e.metaKey) && e.key === 'x' && !e.shiftKey) {
      e.preventDefault();
      store.cut();
      console.log('Cut selection to clipboard');
    }

    // Paste: Ctrl+V or Cmd+V
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey) {
      e.preventDefault();

      // Get current playhead position for paste location
      const timeline = store.timeline;
      const time = timeline.playheadPosition;

      // Paste to first track by default, or to selected track if available
      const firstTrack = store.tracks[0];
      if (firstTrack) {
        store.paste(firstTrack.id, time);
        console.log('Pasted clipboard content');
      }
    }

    // Select All: Ctrl+A or Cmd+A
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.shiftKey) {
      e.preventDefault();
      store.selectAll();
      console.log('Selected all clips');
    }

    // Delete: Delete key
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const selectedClips = store.getSelectedClips();
      if (selectedClips.length > 0) {
        e.preventDefault();
        selectedClips.forEach(clip => store.removeClip(clip.id));
        console.log('Deleted selected clips');
      }
    }

    // Escape: Clear selection
    if (e.key === 'Escape') {
      e.preventDefault();
      store.clearSelection();
      console.log('Cleared selection');
    }

    // Duplicate: Ctrl+D or Cmd+D
    if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !e.shiftKey) {
      e.preventDefault();
      const selectedClips = store.getSelectedClips();
      const newClipIds: string[] = [];

      selectedClips.forEach(clip => {
        const newId = store.duplicateClip(clip.id);
        if (newId) newClipIds.push(newId);
      });

      // Select the newly duplicated clips
      if (newClipIds.length > 0) {
        store.clearSelection();
        newClipIds.forEach((id, index) => {
          store.selectClip(id, index > 0);
        });
        console.log('Duplicated selected clips');
      }
    }

    // Zoom In: Ctrl++ or Cmd++
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
      e.preventDefault();
      const currentZoom = store.timeline.zoom;
      store.setZoom(currentZoom * 1.2);
      console.log('Zoomed in');
    }

    // Zoom Out: Ctrl+- or Cmd+-
    if ((e.ctrlKey || e.metaKey) && e.key === '-') {
      e.preventDefault();
      const currentZoom = store.timeline.zoom;
      store.setZoom(currentZoom / 1.2);
      console.log('Zoomed out');
    }

    // Toggle Grid Snap: G key
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      store.toggleGridSnap();
      console.log('Toggled grid snap');
    }
  };

  // Add event listener
  window.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
};