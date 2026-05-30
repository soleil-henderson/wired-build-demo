import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { Image as RNImage, Platform } from 'react-native';

/** JPEG quality for re-encoded uploads. */
export const JPEG_QUALITY = 0.85;

export type PreparedImage = {
  uri: string;
  width: number;
  height: number;
};

/**
 * Resize + recompress before upload. Native uses expo-image-manipulator;
 * web uses canvas so blob: URLs from drag-drop and file inputs work.
 */
export async function prepareImageForUpload(input: {
  uri: string;
  width?: number | null;
  height?: number | null;
  maxEdgePx?: number;
}): Promise<PreparedImage> {
  if (Platform.OS === 'web') {
    return prepareImageForUploadWeb(input);
  }

  const maxEdge = input.maxEdgePx ?? 1920;
  const { width: w, height: h } = await resolveImageDimensions(
    input.uri,
    input.width,
    input.height
  );
  const longest = Math.max(w, h);
  const actions =
    longest > maxEdge
      ? w >= h
        ? [{ resize: { width: maxEdge } }]
        : [{ resize: { height: maxEdge } }]
      : [];

  const result = await manipulateAsync(input.uri, actions, {
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}

async function prepareImageForUploadWeb(input: {
  uri: string;
  width?: number | null;
  height?: number | null;
  maxEdgePx?: number;
}): Promise<PreparedImage> {
  const maxEdge = input.maxEdgePx ?? 1920;
  const oriented = await loadOrientedWebImage(input.uri);
  let w = input.width && input.width > 0 ? input.width : oriented.width;
  let h = input.height && input.height > 0 ? input.height : oriented.height;

  const longest = Math.max(w, h);
  if (longest > maxEdge) {
    if (w >= h) {
      h = Math.round((h * maxEdge) / w);
      w = maxEdge;
    } else {
      w = Math.round((w * maxEdge) / h);
      h = maxEdge;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare image for upload');

  ctx.drawImage(oriented, 0, 0, w, h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode image'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });

  return {
    uri: URL.createObjectURL(blob),
    width: w,
    height: h,
  };
}

export async function readUploadBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    if (!res.ok) throw new Error('Could not read image data');
    return new Uint8Array(await res.arrayBuffer());
  }

  try {
    const file = new File(uri);
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    const res = await fetch(uri);
    if (!res.ok) throw new Error('Could not read image data');
    return new Uint8Array(await res.arrayBuffer());
  }
}

async function resolveImageDimensions(
  uri: string,
  width?: number | null,
  height?: number | null
): Promise<{ width: number; height: number }> {
  if (width && height && width > 0 && height > 0) {
    return { width, height };
  }
  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (w, h) => resolve({ width: w, height: h }),
      () => reject(new Error('Could not read image dimensions'))
    );
  });
}

export function imageDimensionsFromFile(
  file: globalThis.File
): Promise<{ width: number; height: number }> {
  const uri = URL.createObjectURL(file);
  return loadWebImageDimensions(uri).finally(() => URL.revokeObjectURL(uri));
}

function loadWebImageDimensions(
  uri: string,
  width?: number | null,
  height?: number | null
): Promise<{ width: number; height: number }> {
  if (width && height) return Promise.resolve({ width, height });
  return loadOrientedWebImage(uri).then((img) => ({
    width: img.width,
    height: img.height,
  }));
}

/** Loads image with EXIF orientation applied (fixes sideways phone photos on web). */
async function loadOrientedWebImage(
  uri: string
): Promise<HTMLImageElement | ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to HTMLImageElement.
    }
  }
  return loadWebImageElement(uri);
}

function loadWebImageElement(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = uri;
  });
}
