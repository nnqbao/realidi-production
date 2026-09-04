export const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"] as const;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type MediaBucket = "avatars" | "experience-media" | "place-media";

export function validateMediaFile(
  file: { type: string; size: number },
  options: { allowVideo?: boolean; maxBytes?: number } = {},
): { ok: true } | { ok: false; error: string } {
  const allowVideo = options.allowVideo ?? false;
  const allowed = allowVideo ? [...IMAGE_MIME, ...VIDEO_MIME] : [...IMAGE_MIME];
  if (!allowed.includes(file.type as (typeof allowed)[number])) {
    return { ok: false, error: "unsupported_type" };
  }
  const max =
    options.maxBytes ??
    (VIDEO_MIME.includes(file.type as (typeof VIDEO_MIME)[number]) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES);
  if (file.size > max) {
    return { ok: false, error: "file_too_large" };
  }
  return { ok: true };
}

export function publicStorageUrl(_bucket: MediaBucket, path: string): string {
  return path;
}

export function mediaSrc(path: string | null | undefined, bucket: MediaBucket = "place-media"): string | null {
  if (!path) return null;
  return publicStorageUrl(bucket, path);
}

/** Prefer smaller Unsplash derivatives for list cards. */
export function optimizedImageSrc(src: string | null | undefined, width = 800): string | null {
  if (!src) return null;
  try {
    const url = new URL(src);
    if (url.hostname === "images.unsplash.com") {
      url.searchParams.set("auto", "format");
      url.searchParams.set("fit", "crop");
      url.searchParams.set("w", String(width));
      url.searchParams.set("q", "75");
      return url.toString();
    }
  } catch {
    return src;
  }
  return src;
}
