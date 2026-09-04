import { compressImage } from "./compress";
import { validateMediaFile } from "./index";
import {
  finalizeExperienceMediaAction,
  generateExperienceUploadUrlAction,
} from "@/features/experiences/actions";

export async function uploadExperienceFiles(files: File[]): Promise<string[]> {
  const ids: string[] = [];
  for (const file of files) {
    const check = validateMediaFile(file, { allowVideo: true });
    if (!check.ok) throw new Error(check.error);
    const blob = file.type.startsWith("image/") ? await compressImage(file) : file;
    const uploadUrl = await generateExperienceUploadUrlAction();
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": blob.type || file.type },
      body: blob,
    });
    if (!response.ok) throw new Error("UPLOAD_FAILED");
    const payload = (await response.json()) as { storageId?: string };
    if (!payload.storageId) throw new Error("UPLOAD_FAILED");
    const finalized = await finalizeExperienceMediaAction({
      storageId: payload.storageId,
      mimeType: blob.type || file.type,
      byteSize: blob.size,
    });
    ids.push(finalized.storageId);
  }
  return ids;
}
