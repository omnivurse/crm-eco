import { describe, expect, it } from 'vitest';
import { buildRecordTagsPatch } from './record-tags-patch';

describe('buildRecordTagsPatch', () => {
  it('sends only tags so stale record fields cannot overwrite newer values', () => {
    const patch = buildRecordTagsPatch(['VIP', 'Renewal']);

    expect(patch).toEqual({
      data: {
        tags: ['VIP', 'Renewal'],
      },
    });
    expect(patch.data).not.toHaveProperty('city');
  });

  it('copies the tag array before handing it to the offline queue', () => {
    const tags = ['VIP'];
    const patch = buildRecordTagsPatch(tags);

    tags.push('Changed later');

    expect(patch.data.tags).toEqual(['VIP']);
  });
});
