import { describe, expect, it, vi } from 'vitest';
import {
  resolveScheduledEmailAttachments,
  type ScheduledAttachmentStorage,
} from './scheduled-email-attachments';

function storageReturning(bytes: number[]): ScheduledAttachmentStorage {
  return {
    download: vi.fn(async () => ({
      data: new Blob([new Uint8Array(bytes)]),
      error: null,
    })),
  };
}

describe('resolveScheduledEmailAttachments', () => {
  it('downloads tenant-owned files and builds Resend attachments', async () => {
    const storage = storageReturning([1, 2, 3, 255]);

    await expect(
      resolveScheduledEmailAttachments(
        [
          {
            filename: 'member-guide.pdf',
            content_type: 'application/pdf',
            file_path: 'org-1/messages/member-guide.pdf',
          },
        ],
        'org-1',
        storage
      )
    ).resolves.toEqual([
      {
        filename: 'member-guide.pdf',
        content: 'AQID/w==',
        content_type: 'application/pdf',
      },
    ]);

    expect(storage.download).toHaveBeenCalledWith(
      'email-attachments',
      'org-1/messages/member-guide.pdf'
    );
  });

  it('rejects another tenant path before reading storage', async () => {
    const storage = storageReturning([1]);

    await expect(
      resolveScheduledEmailAttachments(
        [
          {
            file_name: 'private.pdf',
            mime_type: 'application/pdf',
            bucket_path: 'org-2/private.pdf',
          },
        ],
        'org-1',
        storage
      )
    ).rejects.toThrow('does not belong to this organization');

    expect(storage.download).not.toHaveBeenCalled();
  });

  it('fails closed when durable storage metadata is missing', async () => {
    const storage = storageReturning([1]);

    await expect(
      resolveScheduledEmailAttachments(
        [{ filename: 'missing.pdf', content_type: 'application/pdf' }],
        'org-1',
        storage
      )
    ).rejects.toThrow('missing its stored file');

    expect(storage.download).not.toHaveBeenCalled();
  });

  it('returns an empty list for drafts without attachments', async () => {
    const storage = storageReturning([1]);

    await expect(resolveScheduledEmailAttachments([], 'org-1', storage)).resolves.toEqual([]);
    expect(storage.download).not.toHaveBeenCalled();
  });
});
