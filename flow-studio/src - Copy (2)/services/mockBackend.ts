import type { Job, ClipState, ProgressEvent } from '../types/index';

type ProgressCallback = (event: ProgressEvent) => void;
type JobCompleteCallback = (job: Job) => void;

class MockBackend {
  private jobs: Map<string, Job> = new Map();
  private progressCallbacks: Set<ProgressCallback> = new Set();
  private jobCompleteCallbacks: Set<JobCompleteCallback> = new Set();
  private activeJobs: Set<string> = new Set();

  // Subscribe to progress events
  onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  // Subscribe to job completion events
  onJobComplete(callback: JobCompleteCallback): () => void {
    this.jobCompleteCallbacks.add(callback);
    return () => this.jobCompleteCallbacks.delete(callback);
  }

  // Emit progress event to all listeners
  private emitProgress(event: ProgressEvent) {
    this.progressCallbacks.forEach(callback => callback(event));
  }

  // Emit job complete event
  private emitJobComplete(job: Job) {
    this.jobCompleteCallbacks.forEach(callback => callback(job));
  }

  // Simulate upload with progress
  async uploadClip(clipId: string, clipName: string): Promise<Job> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: Job = {
      id: jobId,
      type: 'upload',
      clipId,
      clipName,
      progress: 0,
      state: 'running',
      startTime: Date.now(),
    };

    this.jobs.set(jobId, job);
    this.activeJobs.add(jobId);

    // Simulate upload progress
    this.simulateProgress(job, 'uploading', 3000 + Math.random() * 2000);

    return job;
  }

  // Simulate download with progress
  async downloadClip(clipId: string, clipName: string): Promise<Job> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: Job = {
      id: jobId,
      type: 'download',
      clipId,
      clipName,
      progress: 0,
      state: 'running',
      startTime: Date.now(),
    };

    this.jobs.set(jobId, job);
    this.activeJobs.add(jobId);

    // Simulate download progress
    this.simulateProgress(job, 'processing', 2000 + Math.random() * 3000);

    return job;
  }

  // Simulate processing with progress
  async processClip(clipId: string, clipName: string): Promise<Job> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: Job = {
      id: jobId,
      type: 'process',
      clipId,
      clipName,
      progress: 0,
      state: 'running',
      startTime: Date.now(),
    };

    this.jobs.set(jobId, job);
    this.activeJobs.add(jobId);

    // Simulate processing progress
    this.simulateProgress(job, 'processing', 5000 + Math.random() * 5000);

    return job;
  }

  // Simulate progress over time
  private simulateProgress(job: Job, clipState: ClipState, duration: number) {
    const startTime = Date.now();
    const updateInterval = 100; // Update every 100ms
    const shouldFail = Math.random() < 0.1; // 10% chance of failure

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);

      // Update job progress
      job.progress = progress;

      // Simulate random failure
      if (shouldFail && progress > 60 && progress < 90) {
        job.state = 'error';
        job.error = `Failed to ${job.type} clip: Network error`;
        job.endTime = Date.now();

        this.emitProgress({
          jobId: job.id,
          clipId: job.clipId,
          progress: job.progress,
          state: 'error',
          error: job.error,
        });

        this.activeJobs.delete(job.id);
        this.emitJobComplete(job);
        clearInterval(interval);
        return;
      }

      // Emit progress event
      this.emitProgress({
        jobId: job.id,
        clipId: job.clipId,
        progress: progress,
        state: progress === 100 ? 'complete' : clipState,
      });

      // Complete the job
      if (progress >= 100) {
        job.state = 'complete';
        job.progress = 100;
        job.endTime = Date.now();
        this.activeJobs.delete(job.id);
        this.emitJobComplete(job);
        clearInterval(interval);
      }
    }, updateInterval);
  }

  // Cancel a job
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.state !== 'running') {
      return false;
    }

    job.state = 'error';
    job.error = 'Job cancelled by user';
    job.endTime = Date.now();
    this.activeJobs.delete(jobId);
    this.emitJobComplete(job);

    return true;
  }

  // Get all jobs
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  // Get active jobs
  getActiveJobs(): Job[] {
    return Array.from(this.activeJobs).map(id => this.jobs.get(id)!).filter(Boolean);
  }

  // Get job by ID
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  // Clear completed jobs
  clearCompletedJobs() {
    const completedJobs = Array.from(this.jobs.entries())
      .filter(([_, job]) => job.state === 'complete' || job.state === 'error');

    completedJobs.forEach(([id]) => this.jobs.delete(id));
  }

  // Simulate batch operations
  async batchUpload(clips: Array<{ id: string; name: string }>): Promise<Job[]> {
    const jobs = await Promise.all(
      clips.map(clip => this.uploadClip(clip.id, clip.name))
    );
    return jobs;
  }

  // Get statistics
  getStatistics() {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      active: this.activeJobs.size,
      completed: jobs.filter(j => j.state === 'complete').length,
      failed: jobs.filter(j => j.state === 'error').length,
      pending: jobs.filter(j => j.state === 'pending').length,
    };
  }
}

// Export singleton instance
export const mockBackend = new MockBackend();