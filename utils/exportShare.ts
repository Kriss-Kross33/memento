import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import { Receipt } from '@/models/types';
import { formatMoney } from '@/utils/currency';
import { buildReceiptsCsv, buildExportFilename } from '@/utils/csv';

const htmlEscape = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const buildReceiptsHtml = (receipts: Receipt[], title = 'Memento export'): string => {
  const rows = receipts
    .map(
      (receipt) => `
        <tr>
          <td>${htmlEscape(receipt.date)}</td>
          <td>${htmlEscape(receipt.merchant || 'Unfiled')}</td>
          <td>${htmlEscape(receipt.category)}</td>
          <td>${htmlEscape(formatMoney(receipt.amount, receipt.currency))}</td>
          <td>${htmlEscape(receipt.receiptNumber ?? '')}</td>
          <td>${htmlEscape(receipt.notes ?? '')}</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${htmlEscape(title)}</title>
    <style>
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #18181b; padding: 24px; }
      h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px; }
      p { color: #71717a; font-size: 12px; margin: 0 0 20px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { text-align: left; border-bottom: 1px solid #e4e4e7; padding: 8px 6px; color: #71717a; }
      td { border-bottom: 1px solid #f4f4f5; padding: 8px 6px; vertical-align: top; }
    </style>
  </head>
  <body>
    <h1>${htmlEscape(title)}</h1>
    <p>${receipts.length} receipt${receipts.length === 1 ? '' : 's'} · generated on this device</p>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Merchant</th>
          <th>Category</th>
          <th>Total</th>
          <th>Receipt no.</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;
};

export const shareCsv = async (receipts: Receipt[], filename = buildExportFilename()): Promise<void> => {
  const csv = buildReceiptsCsv(receipts);
  if (Platform.OS === 'web') {
    const { Blob: BlobCtor, URL: UrlObj, document: doc } = globalThis as unknown as {
      Blob?: new (parts: string[], options?: { type: string }) => unknown;
      URL?: { createObjectURL(obj: unknown): string; revokeObjectURL(url: string): void };
      document?: { createElement(tag: 'a'): { href: string; download: string; click(): void } };
    };
    if (BlobCtor && UrlObj && doc) {
      const url = UrlObj.createObjectURL(new BlobCtor([csv], { type: 'text/csv' }));
      const anchor = doc.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      UrlObj.revokeObjectURL(url);
    }
    return;
  }
  await Share.share({ title: filename, message: csv });
};

export const sharePdf = async (receipts: Receipt[], title = 'Memento export'): Promise<void> => {
  const html = buildReceiptsHtml(receipts, title);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const file = await Print.printToFileAsync({ html });
  await Share.share({ url: file.uri, title });
};
