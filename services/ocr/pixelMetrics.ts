/** Pure pixel metrics. Safe to unit-test without Skia or a device. */

export type PixelMetrics = {
  brightness: number;
  contrast: number;
  sharpness: number;
  glare: number;
  coverage: number;
  skew: number;
  signedSkew: number;
  perspective: number;
};

export type QualityIssue =
  | 'low-res'
  | 'blurry'
  | 'dark'
  | 'low-contrast'
  | 'glare'
  | 'skewed'
  | 'low-coverage';

const lumaAt = (pixels: Uint8Array | Uint8ClampedArray, index: number): number => {
  const i = index * 4;
  return 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
};

const otsuThreshold = (histogram: number[], total: number): number => {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  let sumB = 0;
  let wB = 0;
  let max = 0;
  let threshold = 128;
  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) {
      max = between;
      threshold = i;
    }
  }
  return threshold;
};

export const analyzePixels = (
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): PixelMetrics => {
  const count = width * height;
  if (count <= 0 || pixels.length < count * 4) {
    return {
      brightness: 0,
      contrast: 0,
      sharpness: 0,
      glare: 0,
      coverage: 0,
      skew: 0,
      signedSkew: 0,
      perspective: 0,
    };
  }

  const histogram = new Array<number>(256).fill(0);
  let lumaSum = 0;
  let lumaSq = 0;
  let glareCount = 0;

  for (let i = 0; i < count; i++) {
    const y = Math.round(lumaAt(pixels, i));
    histogram[y] += 1;
    lumaSum += y;
    lumaSq += y * y;
    if (y >= 248) glareCount += 1;
  }

  const brightness = lumaSum / count;
  const contrast = Math.sqrt(Math.max(0, lumaSq / count - brightness * brightness));
  const glare = glareCount / count;
  const threshold = otsuThreshold(histogram, count);

  let lapSum = 0;
  let lapSq = 0;
  let lapCount = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const c = lumaAt(pixels, y * width + x);
      const lap =
        lumaAt(pixels, (y - 1) * width + x) +
        lumaAt(pixels, (y + 1) * width + x) +
        lumaAt(pixels, y * width + x - 1) +
        lumaAt(pixels, y * width + x + 1) -
        4 * c;
      lapSum += lap;
      lapSq += lap * lap;
      lapCount += 1;
    }
  }
  const lapMean = lapCount > 0 ? lapSum / lapCount : 0;
  const sharpness = lapCount > 0 ? Math.sqrt(Math.max(0, lapSq / lapCount - lapMean * lapMean)) : 0;

  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let docCount = 0;
  const rowCentroid: number[] = new Array(height).fill(0);
  const rowWeight: number[] = new Array(height).fill(0);
  const topInk: number[] = [];
  const bottomInk: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const yv = lumaAt(pixels, y * width + x);
      const isDoc = brightness >= 128 ? yv <= threshold : yv >= threshold;
      if (!isDoc) continue;
      docCount += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      rowCentroid[y] += x;
      rowWeight[y] += 1;
      if (y < height * 0.28) topInk.push(x);
      if (y > height * 0.72) bottomInk.push(x);
    }
  }

  const bboxArea = minX <= maxX && minY <= maxY ? (maxX - minX + 1) * (maxY - minY + 1) : 0;
  const coverage = Math.min(1, Math.max(docCount / count, bboxArea / Math.max(count, 1)));

  let skewNum = 0;
  let skewDen = 0;
  let meanY = 0;
  let meanX = 0;
  let used = 0;
  for (let y = 0; y < height; y++) {
    if (rowWeight[y] < 4) continue;
    const cx = rowCentroid[y] / rowWeight[y];
    meanY += y;
    meanX += cx;
    used += 1;
  }
  if (used >= 8) {
    meanY /= used;
    meanX /= used;
    for (let y = 0; y < height; y++) {
      if (rowWeight[y] < 4) continue;
      const cx = rowCentroid[y] / rowWeight[y];
      const dy = y - meanY;
      skewNum += dy * (cx - meanX);
      skewDen += dy * dy;
    }
  }
  const slope = skewDen > 0 ? skewNum / skewDen : 0;
  const signedSkew = Math.atan(slope) * (180 / Math.PI);
  const skew = Math.abs(signedSkew);

  const widthOf = (xs: number[]): number => {
    if (xs.length < 4) return 0;
    return Math.max(...xs) - Math.min(...xs);
  };
  const topW = widthOf(topInk);
  const bottomW = widthOf(bottomInk);
  const maxW = Math.max(topW, bottomW, 1);
  const perspective = Math.min(1, Math.abs(topW - bottomW) / maxW);

  return {
    brightness,
    contrast,
    sharpness,
    glare,
    coverage,
    skew,
    signedSkew,
    perspective,
  };
};

export const issuesFromMetrics = (
  metrics: PixelMetrics | null,
  size: { minSide: number }
): QualityIssue[] => {
  const issues: QualityIssue[] = [];
  if (size.minSide > 0 && size.minSide < 640) issues.push('low-res');
  if (!metrics) return issues;
  if (metrics.sharpness < 14) issues.push('blurry');
  if (metrics.brightness < 72) issues.push('dark');
  if (metrics.contrast < 26) issues.push('low-contrast');
  if (metrics.glare >= 0.08) issues.push('glare');
  if (metrics.skew >= 7 || metrics.perspective >= 0.28) issues.push('skewed');
  if (metrics.coverage > 0 && metrics.coverage < 0.22) issues.push('low-coverage');
  return issues;
};
