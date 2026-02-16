const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  heic: 'image/heic',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/** Re-wrap a blob with the correct MIME type based on file extension.
 *  JSZip extracts blobs as application/octet-stream which Supabase storage rejects. */
export function blobWithMime(blob: Blob, filename: string): Blob {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mime = MIME_TYPES[ext];
  if (mime && blob.type !== mime) {
    return new Blob([blob], { type: mime });
  }
  return blob;
}
