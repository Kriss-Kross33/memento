export function redirectSystemPath({
  path,
}: { path: string; initial: boolean }) {
  if (
    path.startsWith('file:') ||
    path.startsWith('content:') ||
    /\.(pdf|jpe?g|png|heic|heif|webp)(\?|$)/i.test(path)
  ) {
    return `/?incoming=${encodeURIComponent(path)}`;
  }
  return '/';
}
