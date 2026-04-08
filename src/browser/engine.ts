import { browserSingleton } from "./singleton";
import { executeAction } from "./executor";
import type { JobPayload, JobResult, StepResult } from "../types";

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

/**
 * Runs a full job:
 *  1. Creates a fresh BrowserContext (isolated cookies/storage)
 *  2. Iterates actions sequentially
 *  3. Closes the context regardless of outcome
 *  4. Returns a JobResult with per-step details
 */
export async function runJob(payload: JobPayload): Promise<JobResult> {
  const start = Date.now();
  const timeout = payload.options?.timeout ?? DEFAULT_TIMEOUT;
  const viewport = payload.options?.viewport ?? DEFAULT_VIEWPORT;

  const browser = await browserSingleton.get();
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(timeout);

  const steps: StepResult[] = [];
  let jobSuccess = true;
  let jobError: string | undefined;

  try {
    for (const action of payload.actions) {
      const result = await executeAction(page, action, timeout);
      steps.push(result);

      if (!result.success) {
        jobSuccess = false;
        jobError = `Step "${result.id ?? result.type}" failed: ${result.error}`;
        // Abort remaining steps on first failure
        break;
      }
    }
  } catch (err) {
    jobSuccess = false;
    jobError = (err as Error).message;
  } finally {
    await context.close();
  }

  const result: JobResult = {
    job_id: payload.job_id,
    success: jobSuccess,
    steps,
    duration_ms: Date.now() - start,
  };
  if (jobError) result.error = jobError;
  return result;
}
