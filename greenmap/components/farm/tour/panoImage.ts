import { fitWithin } from "./geometry";

/**
 * Prepare a 360° photo for upload, in the browser.
 *
 * Phones and 360 cameras produce 8K photos of 8–20 MB. The viewer never shows
 * more than 4096 px across, so a bigger file only costs the farmer mobile
 * data — on every upload and on every visit. Photos are therefore resized to
 * at most 4096 px wide and saved as JPEG before they leave the phone.
 */

/** Matches MAX_PANO_TEXTURE_WIDTH in panoTexture.ts — more is never displayed. */
export const PANO_UPLOAD_MAX_WIDTH = 4096;
const JPEG_QUALITY = 0.85;

/** A JPEG this small that needs no resize is uploaded untouched (no quality loss). */
const KEEP_ORIGINAL_BELOW_BYTES = 3 * 1024 * 1024;

export interface PreparedPano {
  blob: Blob;
  /** Pixel size of `blob`. */
  width: number;
  height: number;
  /** True when the photo was resized and/or re-encoded. */
  optimized: boolean;
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decodeImage(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => {},
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Decode `file`, shrink it to the display size and encode it as JPEG.
 * Rejects when the browser cannot decode the file.
 */
export async function preparePanoUpload(file: File): Promise<PreparedPano> {
  const decoded = await decodeImage(file);
  try {
    const { width, height } = decoded;
    const target = fitWithin(width, height, PANO_UPLOAD_MAX_WIDTH);
    const original: PreparedPano = { blob: file, width, height, optimized: false };

    if (
      !target.resized &&
      file.type === "image/jpeg" &&
      file.size <= KEEP_ORIGINAL_BELOW_BYTES
    ) {
      return original;
    }

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, 0, 0, target.width, target.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    canvas.width = 0; // release the backing store straight away
    // Re-encoding a photo that was not resized can come out larger. Keep the
    // smaller of the two.
    if (!blob || (!target.resized && blob.size >= file.size)) return original;

    return { blob, width: target.width, height: target.height, optimized: true };
  } finally {
    decoded.release();
  }
}
