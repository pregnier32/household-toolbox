export const ATTACHMENT_MAX_FILE_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/tiff',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const ATTACHMENT_ACCEPT = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.heic',
  '.heif',
  '.bmp',
  '.tif',
  '.tiff',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  ...ATTACHMENT_ALLOWED_MIME_TYPES,
].join(',');

export type AttachmentItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
  url?: string | null;
  createdAt?: string | null;
};

export function formatAttachmentBytes(bytes: number): string {
  const safe = Math.max(0, bytes);
  if (safe < 1024) return `${safe} B`;
  if (safe < 1024 * 1024) return `${(safe / 1024).toFixed(safe < 10 * 1024 ? 1 : 0)} KB`;
  if (safe < 1024 * 1024 * 1024) {
    return `${(safe / (1024 * 1024)).toFixed(safe < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }
  return `${(safe / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function isImageAttachment(type: string): boolean {
  return type.startsWith('image/');
}

export function isPdfAttachment(type: string, name?: string | null): boolean {
  return type === 'application/pdf' || (name || '').toLowerCase().endsWith('.pdf');
}

export function canPreviewAttachment(type: string, name?: string | null): boolean {
  return isImageAttachment(type) || isPdfAttachment(type, name);
}

export function createPendingAttachment(file: File): AttachmentItem {
  return {
    id: `pending-${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    size: file.size,
    type: file.type,
    file,
    url: URL.createObjectURL(file),
  };
}

export function isAllowedAttachmentType(type: string, name: string): boolean {
  if (ATTACHMENT_ALLOWED_MIME_TYPES.includes(type as (typeof ATTACHMENT_ALLOWED_MIME_TYPES)[number])) {
    return true;
  }
  const ext = name.includes('.') ? `.${name.split('.').pop()?.toLowerCase()}` : '';
  return ATTACHMENT_ACCEPT.split(',').includes(ext);
}

export function filterIncomingAttachments(
  incoming: File[],
  options: {
    existingCount: number;
    maxFiles?: number;
    pendingBytes?: number;
    usedBytes?: number;
    limitBytes?: number;
  }
): { accepted: File[]; errors: string[] } {
  const errors: string[] = [];
  const accepted: File[] = [];
  const maxFiles = options.maxFiles ?? Number.POSITIVE_INFINITY;
  let remainingSlots = Math.max(0, maxFiles - options.existingCount);
  let runningBytes = (options.usedBytes ?? 0) + (options.pendingBytes ?? 0);

  if (remainingSlots === 0) {
    errors.push(maxFiles === 1 ? 'Only one file can be attached here.' : `You can attach up to ${maxFiles} files.`);
    return { accepted, errors };
  }

  for (const file of incoming) {
    if (remainingSlots <= 0) {
      errors.push(maxFiles === 1 ? 'Only one file can be attached here.' : `You can attach up to ${maxFiles} files.`);
      break;
    }
    if (file.size > ATTACHMENT_MAX_FILE_BYTES) {
      errors.push(`${file.name} is larger than 10 MB.`);
      continue;
    }
    if (!isAllowedAttachmentType(file.type, file.name)) {
      errors.push(`${file.name} is not an allowed file type.`);
      continue;
    }
    if (options.limitBytes != null && runningBytes + file.size > options.limitBytes) {
      errors.push(`${file.name} would exceed your storage limit.`);
      continue;
    }
    accepted.push(file);
    remainingSlots -= 1;
    runningBytes += file.size;
  }

  return { accepted, errors };
}
