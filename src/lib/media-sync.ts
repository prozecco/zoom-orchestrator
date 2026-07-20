/**
 * Media Attachments & Emoji Reactions Helper
 */

export interface MediaAttachmentInput {
  message_id: string;
  telegram_id: number;
  file_name: string;
  file_type: 'image' | 'video' | 'document' | 'audio';
  file_size: number;
  storage_path: string;
  zoom_file_id?: string;
}

export interface EmojiReactionInput {
  message_id: string;
  telegram_id: number;
  emoji_code: string;
}

export const SUPPORTED_EMOJIS = ['👍', '❤️', '🔥', '👏', '🎉', '😮', '🙏'];

/**
 * Validates file type and size limits (max 50MB for videos/documents, 10MB for images).
 */
export function validateMediaUpload(fileType: string, fileSize: number): { valid: boolean; error?: string } {
  const maxSizeBytes = fileType === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;

  if (fileSize > maxSizeBytes) {
    const limitMB = maxSizeBytes / (1024 * 1024);
    return {
      valid: false,
      error: `ขนาดไฟล์เกินกำหนดสูงสุด (${limitMB}MB)`,
    };
  }

  return { valid: true };
}
