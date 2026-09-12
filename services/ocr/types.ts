export type OcrBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrElement = {
  text: string;
  boundingBox: OcrBox;
  confidence?: number;
};

export type OcrLine = {
  text: string;
  boundingBox: OcrBox;
  confidence?: number;
  elements?: OcrElement[];
};

export type OcrBlock = {
  text: string;
  boundingBox: OcrBox;
  lines: OcrLine[];
};

export type OcrDocument = {
  text: string;
  width: number;
  height: number;
  blocks: OcrBlock[];
  lines: OcrLine[];
};

// Compatibility aliases used by older imports.
export type OcrResult = OcrDocument;
