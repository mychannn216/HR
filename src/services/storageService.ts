import { supabase } from './supabaseClient';

export type StorageFolder = 'cccd-front' | 'cccd-back' | 'qr-code' | 'documents';

export interface UploadResult {
  publicUrl: string;
  path: string;
}

/**
 * Upload file lên Supabase Storage bucket 'employee-docs'
 * @param file Đối tượng File cần tải lên
 * @param folder Thư mục phân loại (cccd-front, cccd-back, qr-code, ...)
 * @returns Đường dẫn public URL của file vừa upload
 */
export async function uploadEmployeeFile(
  file: File,
  folder: StorageFolder = 'documents'
): Promise<string> {
  if (!file) {
    throw new Error('Vui lòng chọn file hợp lệ để tải lên.');
  }

  // Chuẩn hóa tên file để tránh lỗi ký tự đặc biệt hoặc tiếng Việt có dấu
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const sanitizedFileName = file.name
    .replace(/[^a-zA-Z0-9.]/g, '_')
    .toLowerCase();
  const filePath = `${folder}/${timestamp}_${randomSuffix}_${sanitizedFileName}`;

  const { data, error } = await supabase.storage
    .from('employee-docs')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/png',
    });

  if (error) {
    console.error('Supabase Storage upload error:', error);
    throw new Error(`Upload file thất bại: ${error.message}`);
  }

  // Lấy Public URL của file
  const { data: publicUrlData } = supabase.storage
    .from('employee-docs')
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

/**
 * Xóa file khỏi Supabase Storage theo public URL hoặc đường dẫn file
 */
export async function deleteEmployeeFile(urlOrPath: string): Promise<void> {
  if (!urlOrPath) return;

  try {
    let filePath = urlOrPath;
    if (urlOrPath.includes('/employee-docs/')) {
      filePath = urlOrPath.split('/employee-docs/')[1];
    }

    const { error } = await supabase.storage
      .from('employee-docs')
      .remove([filePath]);

    if (error) {
      console.warn('Lỗi khi xóa file storage:', error.message);
    }
  } catch (err) {
    console.warn('Không thể xóa file storage:', err);
  }
}
