/**
 * Video processing is intentionally not implemented in MVP.
 * Upload accepts video MIME types and stores the original file.
 * Transcoding / poster generation should plug in here later.
 */

export type VideoProcessingJob = {
  mediaId: string;
  storagePath: string;
};

export async function enqueueVideoProcessing(job: VideoProcessingJob): Promise<void> {
  void job;
  return;
}

export const VIDEO_PROCESSING_AVAILABLE = false;
