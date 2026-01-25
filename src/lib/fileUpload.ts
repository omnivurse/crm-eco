import { supabase } from './supabase';

export interface UploadedFile {
  name: string;
  path: string;
  url: string;
  size: number;
  type: string;
}

export async function uploadTicketAttachments(
  ticketId: string,
  files: File[]
): Promise<UploadedFile[]> {
  const uploadedFiles: UploadedFile[] = [];

  for (const file of files) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('ticket-attachments')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Failed to upload file:', file.name, uploadError);
      throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('ticket-attachments')
      .getPublicUrl(fileName);

    uploadedFiles.push({
      name: file.name,
      path: uploadData.path,
      url: urlData.publicUrl,
      size: file.size,
      type: file.type,
    });
  }

  return uploadedFiles;
}

export async function saveAttachmentReferences(
  ticketId: string,
  uploadedFiles: UploadedFile[],
  uploadedBy: string
): Promise<void> {
  const attachments = uploadedFiles.map((file) => ({
    ticket_id: ticketId,
    filename: file.name,
    storage_path: file.path,
    file_size: file.size,
    mime_type: file.type,
    uploaded_by: uploadedBy,
  }));

  const { error } = await supabase
    .from('ticket_files')
    .insert(attachments);

  if (error) {
    console.error('Failed to save attachment references:', error);
    throw new Error(`Failed to save attachment references: ${error.message}`);
  }
}

export async function deleteAttachment(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from('ticket-attachments')
    .remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
