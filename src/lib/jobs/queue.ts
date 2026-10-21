/**
 * Background Job Queue Abstraction
 *
 * Provides a lightweight job queue for asynchronous task processing
 * such as portal feed syncing, email/SMS dispatch, and webhooks.
 */

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface Job<T = Record<string, unknown>> {
  id: string;
  queue: string;
  type: string;
  payload: T;
  status: JobStatus;
  progress: number;
  attempts: number;
  maxAttempts: number;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type JobHandler<T = Record<string, unknown>> = (
  job: Job<T>,
) => Promise<unknown>;

class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private handlers: Map<string, JobHandler<any>> = new Map();

  /**
   * Enqueue a new job
   */
  enqueue<T = Record<string, unknown>>(input: {
    queue: string;
    type: string;
    payload: T;
    maxAttempts?: number;
  }): Job<T> {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const job: Job<T> = {
      id,
      queue: input.queue,
      type: input.type,
      payload: input.payload,
      status: "pending",
      progress: 0,
      attempts: 0,
      maxAttempts: input.maxAttempts || 3,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(id, job as Job);
    return job;
  }

  /**
   * Register a job handler for a specific job type
   */
  registerHandler<T = Record<string, unknown>>(
    type: string,
    handler: JobHandler<T>,
  ) {
    this.handlers.set(type, handler as JobHandler);
  }

  /**
   * Get job by ID
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /**
   * List jobs for a specific queue or all jobs
   */
  listJobs(queue?: string): Job[] {
    const all = Array.from(this.jobs.values());
    if (!queue) return all;
    return all.filter((j) => j.queue === queue);
  }

  /**
   * Process a specific job by ID
   */
  async processJob(id: string): Promise<Job> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Job ${id} not found`);

    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = "failed";
      job.error = `No handler registered for job type "${job.type}"`;
      job.updatedAt = new Date().toISOString();
      return job;
    }

    job.status = "processing";
    job.attempts += 1;
    job.progress = 25;
    job.updatedAt = new Date().toISOString();

    try {
      const result = await handler(job);
      job.status = "completed";
      job.progress = 100;
      job.result = result;
      job.updatedAt = new Date().toISOString();
    } catch (err) {
      job.error = err instanceof Error ? err.message : String(err);
      if (job.attempts < job.maxAttempts) {
        job.status = "pending";
        job.progress = 0;
      } else {
        job.status = "failed";
      }
      job.updatedAt = new Date().toISOString();
    }

    return job;
  }

  /**
   * Process all pending jobs in a queue
   */
  async processQueue(queue?: string): Promise<Job[]> {
    const pending = this.listJobs(queue).filter((j) => j.status === "pending");
    const results: Job[] = [];
    for (const job of pending) {
      results.push(await this.processJob(job.id));
    }
    return results;
  }
}

// Global Singleton
export const globalJobQueue = new JobQueue();
