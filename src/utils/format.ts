export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0) return `${bytes} B`;
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || 'B'}`;
}

export function formatDate(dateInput: string | number): string {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';

  // Check if year is 1970
  if (d.getFullYear() <= 1970) return 'Arsip Sistem';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getFileCategory(extension: string, isDir: boolean): 'folder' | 'image' | 'video' | 'audio' | 'document' | 'archive' | 'code' | 'other' {
  if (isDir) return 'folder';
  const ext = extension.toLowerCase().replace('.', '');

  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
    return 'image';
  }
  if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv'].includes(ext)) {
    return 'video';
  }
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) {
    return 'audio';
  }
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'txt', 'rtf'].includes(ext)) {
    return 'document';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso'].includes(ext)) {
    return 'archive';
  }
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'sh', 'sql', 'yml', 'yaml', 'xml'].includes(ext)) {
    return 'code';
  }
  return 'other';
}

export function isPdf(extension: string): boolean {
  const ext = extension.toLowerCase().replace('.', '');
  return ext === 'pdf';
}

export function isOfficeFile(extension: string): boolean {
  const ext = extension.toLowerCase().replace('.', '');
  return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'md', 'rtf'].includes(ext);
}

export function isOfficeOrPdf(extension: string): boolean {
  return isPdf(extension) || isOfficeFile(extension);
}
