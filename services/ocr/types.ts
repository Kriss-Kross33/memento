export type OcrBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrElement = {
  text: string;
  boundingBox: OcrBox;
};

export type OcrLine = {
  text: string;
  boundingBox: OcrBox;
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
