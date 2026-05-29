import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

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
  const ctx = ImageManipulator.manipulate(input.uri);

  const w = input.width ?? 0;
  const h = input.height ?? 0;
  const longest = Math.max(w, h);
  if (longest > maxEdge) {
    if (w >= h) {
      ctx.resize({ width: maxEdge });
    } else {
      ctx.resize({ height: maxEdge });
    }
  }

  const img = await ctx.renderAsync();
  const result = await img.saveAsync({
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
  const dims = await loadWebImageDimensions(input.uri, input.width, input.height);
  let { width: w, height: h } = dims;

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

  const img = await loadWebImageElement(input.uri);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare image for upload');

  ctx.drawImage(img, 0, 0, w, h);

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

export async function readUploadBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    if (!res.ok) throw new Error('Could not read image data');
    return res.arrayBuffer();
  }
  const file = new File(uri);
  return file.arrayBuffer();
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
  return loadWebImageElement(uri).then((img) => ({
    width: img.naturalWidth,
    height: img.naturalHeight,
  }));
}

function loadWebImageElement(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = uri;
  });
}
