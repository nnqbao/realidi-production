/**
 * Video is stored as the original file with processing_status=ready.
 * There is no queued/transcode pipeline in this phase.
 */

export type VideoProcessingJob = {
  mediaId: string;
  storageId: string;
};

export async function enqueueVideoProcessing(job: VideoProcessingJob): Promise<void> {
  void job;
  return;
}

export const VIDEO_PROCESSING_AVAILABLE = false;
export const VIDEO_STORED_AS_ORIGINAL = true;
