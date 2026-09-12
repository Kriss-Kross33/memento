import type { OcrBox } from '@/services/ocr/types';

export type NormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Vision bounding boxes are normalized to [0, 1] with origin at the
 * bottom-left. Memento / ML Kit use pixel coordinates with origin at
 * the top-left.
 */
export const denormalizeVisionBox = (
  rect: Partial<NormalizedRect> | null | undefined,
  imageSize: { width: number; height: number }
): OcrBox => {
  const width = Math.max(0, Number(imageSize.width) || 0);
  const height = Math.max(0, Number(imageSize.height) || 0);
  const nx = Number(rect?.x);
  const ny = Number(rect?.y);
  const nw = Number(rect?.width);
  const nh = Number(rect?.height);
  if (![nx, ny, nw, nh, width, height].every((value) => Number.isFinite(value))) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return {
    x: nx * width,
    y: (1 - ny - nh) * height,
    width: nw * width,
    height: nh * height,
  };
};

export const unionBoxes = (boxes: OcrBox[]): OcrBox => {
  const valid = boxes.filter((box) => box.width > 0 || box.height > 0);
  if (valid.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const minX = Math.min(...valid.map((box) => box.x));
  const minY = Math.min(...valid.map((box) => box.y));
  const maxX = Math.max(...valid.map((box) => box.x + box.width));
  const maxY = Math.max(...valid.map((box) => box.y + box.height));
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
};

export const sortVisionObservations = <T extends { boundingBox: NormalizedRect }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    if (a.boundingBox.y !== b.boundingBox.y) return b.boundingBox.y - a.boundingBox.y;
    return a.boundingBox.x - b.boundingBox.x;
  });
