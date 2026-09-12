export type VisionRecognitionLevel = 'fast' | 'accurate';

export type VisionRecognizeOptions = {
  recognitionLevel?: VisionRecognitionLevel;
  recognitionLanguages?: string[];
  usesLanguageCorrection?: boolean;
  minimumTextHeight?: number;
};

export type VisionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisionCandidate = {
  text: string;
  confidence: number;
};

export type VisionElement = {
  text: string;
  boundingBox: VisionBox;
  confidence?: number;
};

export type VisionLine = {
  text: string;
  boundingBox: VisionBox;
  confidence?: number;
  candidates?: VisionCandidate[];
  elements?: VisionElement[];
};

export type VisionBlock = {
  text: string;
  boundingBox: VisionBox;
  lines: VisionLine[];
};

export type VisionOcrResult = {
  text: string;
  width: number;
  height: number;
  coordinateSpace: 'pixels';
  blocks: VisionBlock[];
};
