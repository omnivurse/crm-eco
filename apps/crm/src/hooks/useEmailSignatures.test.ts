import { describe, expect, it } from 'vitest';
import { pickSignatureForCompose } from '@/app/crm/inbox/_components/inbox-reply';

describe('useEmailSignatures selection', () => {
  it('omits signatures that are off for new compose', () => {
    const picked = pickSignatureForCompose(
      [
        {
          id: 'old',
          name: 'Old',
          content_html: '<p>Old</p>',
          is_default: true,
          include_in_new: false,
          include_in_replies: true,
        },
      ],
      'new',
    );
    expect(picked).toBeNull();
  });
});
