import type { OcrBox, OcrDocument } from '@/services/ocr/types';
import { normalizeOcrResult } from '@/services/ocr/normalize';
import { denormalizeVisionBox, unionBoxes } from '@/services/ocr/visionGeometry';

export type VisionRawBox = { x?: number; y?: number; width?: number; height?: number };

export type VisionRawCandidate = {
  text?: string;
  confidence?: number;
};

export type VisionRawLine = {
  text?: string;
  boundingBox?: VisionRawBox;
  confidence?: number;
  candidates?: VisionRawCandidate[];
  elements?: Array<{
    text?: string;
    boundingBox?: VisionRawBox;
    confidence?: number;
  }>;
};

export type VisionRawResult = {
  text?: string;
  width?: number;
  height?: number;
  coordinateSpace?: 'pixels' | 'normalized';
  blocks?: Array<{
    text?: string;
    boundingBox?: VisionRawBox;
    lines?: VisionRawLine[];
  }>;
  lines?: VisionRawLine[];
};

const mapBox = (
  box: VisionRawBox | undefined,
  imageSize: { width: number; height: number },
  coordinateSpace: 'pixels' | 'normalized'
): OcrBox => {
  if (coordinateSpace === 'normalized') {
    return denormalizeVisionBox(box, imageSize);
  }
  return {
    x: Number(box?.x) || 0,
    y: Number(box?.y) || 0,
    width: Number(box?.width) || 0,
    height: Number(box?.height) || 0,
  };
};

export const mapVisionResult = (raw: VisionRawResult | null): OcrDocument => {
  if (!raw) return normalizeOcrResult({ text: '', blocks: [] });
  const width = Math.max(1, Number(raw.width) || 0);
  const height = Math.max(1, Number(raw.height) || 0);
  const coordinateSpace = raw.coordinateSpace === 'normalized' ? 'normalized' : 'pixels';
  const sourceLines = raw.blocks?.flatMap((block) => block.lines ?? []) ?? raw.lines ?? [];
  const lines = sourceLines
    .map((line) => ({
      text: line.text ?? '',
      boundingBox: mapBox(line.boundingBox, { width, height }, coordinateSpace),
      confidence: line.confidence,
      candidates: line.candidates,
      elements: (line.elements ?? []).map((element) => ({
        text: element.text ?? '',
        boundingBox: mapBox(element.boundingBox, { width, height }, coordinateSpace),
        confidence: element.confidence,
      })),
    }))
    .filter((line) => line.text.trim());

  const blocks =
    raw.blocks?.map((block) => {
      const mappedLines = (block.lines ?? [])
        .map((line) => ({
          text: line.text ?? '',
          boundingBox: mapBox(line.boundingBox, { width, height }, coordinateSpace),
          confidence: line.confidence,
          candidates: line.candidates,
          elements: (line.elements ?? []).map((element) => ({
            text: element.text ?? '',
            boundingBox: mapBox(element.boundingBox, { width, height }, coordinateSpace),
            confidence: element.confidence,
          })),
        }))
        .filter((line) => line.text.trim());
      return {
        text: block.text ?? mappedLines.map((line) => line.text).join('\n'),
        boundingBox: mapBox(block.boundingBox, { width, height }, coordinateSpace),
        lines: mappedLines,
      };
    }) ??
    (lines.length
      ? [
          {
            text: raw.text ?? lines.map((line) => line.text).join('\n'),
            boundingBox: unionBoxes(lines.map((line) => line.boundingBox)),
            lines,
          },
        ]
      : []);

  const document = normalizeOcrResult({
    text: raw.text ?? lines.map((line) => line.text).join('\n'),
    blocks,
  });
  return {
    ...document,
    width: Math.max(document.width, width),
    height: Math.max(document.height, height),
  };
};
