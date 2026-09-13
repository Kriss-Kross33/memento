import { isPdfInput, type ReceiptInput } from '@/services/ingest/types';

const IMAGE_EXT = /\.(jpe?g|png|heic|heif|webp)$/i;
const PDF_EXT = /\.pdf$/i;

const stripQuery = (value: string): string => value.split('?')[0] ?? value;

/** Turn a share / open-in URL into a ReceiptInput, or null if it is not a file. */
export const receiptInputFromIncomingUrl = (url: string): ReceiptInput | null => {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const decoded = (() => {
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  })();
  const path = stripQuery(decoded);
  const isFile =
    decoded.startsWith('file:') ||
    decoded.startsWith('content:') ||
    decoded.startsWith('memento://') ||
    IMAGE_EXT.test(path) ||
    PDF_EXT.test(path);
  if (!isFile && !decoded.includes('/')) return null;

  let uri = decoded;
  if (decoded.startsWith('memento://')) {
    try {
      const parsed = new URL(decoded);
      uri = parsed.searchParams.get('uri') || parsed.searchParams.get('url') || decoded;
    } catch {
      uri = decoded;
    }
  }

  const fileName = stripQuery(uri).split('/').pop();
  const kind = isPdfInput({ kind: 'share', uri, fileName }) ? 'pdf' : 'share';
  if (kind !== 'pdf' && !IMAGE_EXT.test(stripQuery(uri)) && !uri.startsWith('content:') && !uri.startsWith('file:')) {
    return null;
  }
  return { kind, uri, fileName };
};
