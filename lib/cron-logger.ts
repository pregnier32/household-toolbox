import { supabaseServer } from './supabaseServer';

export type CronJobStatus = 'success' | 'error' | 'warning';

export interface CronJobLogData {
  job_name: string;
  status: CronJobStatus;
  message?: string;
  error_details?: string;
  execution_data?: Record<string, any>;
}

/**
 * Logs a cron job execution to the database
 * @param logData - The log data to record
 * @returns The created log record or null if logging fails
 */
export async function logCronJobExecution(
  logData: CronJobLogData
): Promise<{ id: string } | null> {
  try {
    const startTime = new Date();
    
    // Calculate duration if we have a start time from execution_data
    let duration_ms: number | undefined;
    if (logData.execution_data?.started_at) {
      const startedAt = new Date(logData.execution_data.started_at);
      duration_ms = startTime.getTime() - startedAt.getTime();
    }

    const { data, error } = await supabaseServer
      .from('cron_job_logs')
      .insert({
        job_name: logData.job_name,
        status: logData.status,
        started_at: logData.execution_data?.started_at || startTime.toISOString(),
        completed_at: startTime.toISOString(),
        duration_ms,
        message: logData.message,
        error_details: logData.error_details,
        execution_data: logData.execution_data || {},
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to log cron job execution:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error logging cron job execution:', error);
    return null;
  }
}

/**
 * Helper to wrap a cron job function with automatic logging
 * @param jobName - Name of the cron job
 * @param jobFunction - The async function to execute
 * @returns The result of the job function
 */
export async function executeWithLogging<T>(
  jobName: string,
  jobFunction: () => Promise<T>
): Promise<T> {
  const startedAt = new Date().toISOString();
  let status: CronJobStatus = 'success';
  let message: string | undefined;
  let errorDetails: string | undefined;
  let executionData: Record<string, any> = { started_at: startedAt };

  try {
    const result = await jobFunction();
    
    // If result is a NextResponse-like object, check if it's an error
    if (result && typeof result === 'object' && 'status' in result && 'json' in result && typeof (result as any).json === 'function') {
      const response = result as { status: number; json: () => Promise<any> };
      if (response.status >= 400) {
        status = 'error';
        const errorData = await response.json();
        message = errorData.error || 'Job failed';
        errorDetails = JSON.stringify(errorData);
      } else {
        const successData = await response.json();
        message = successData.message || 'Job completed successfully';
        executionData = { ...executionData, ...successData };
      }
    } else {
      message = 'Job completed successfully';
      executionData = { ...executionData, result };
    }

    await logCronJobExecution({
      job_name: jobName,
      status,
      message,
      error_details: errorDetails,
      execution_data: executionData,
    });

    return result;
  } catch (error) {
    status = 'error';
    message = 'Job execution failed';
    errorDetails = error instanceof Error 
      ? error.message 
      : JSON.stringify(error);
    
    await logCronJobExecution({
      job_name: jobName,
      status,
      message,
      error_details: errorDetails,
      execution_data: executionData,
    });

    throw error;
  }
}

