import { describe, expect, it } from 'vitest';
import { buildCrmCreateDataFromFormData } from './create-form-data';

describe('buildCrmCreateDataFromFormData', () => {
  it('preserves controlled create-form values with their CRM types', () => {
    const formData = new FormData();
    formData.set('first_name', 'Ada');
    formData.set('annual_premium', '125.50');
    formData.set('is_smoker', 'false');
    formData.set('tags', JSON.stringify(['Priority', 'Renewal']));
    formData.set('assigned_to', '11111111-1111-4111-8111-111111111111');

    expect(
      buildCrmCreateDataFromFormData(formData, {
        first_name: 'text',
        annual_premium: 'currency',
        is_smoker: 'boolean',
        tags: 'multiselect',
        assigned_to: 'user',
      }),
    ).toEqual({
      first_name: 'Ada',
      annual_premium: '125.50',
      is_smoker: false,
      tags: ['Priority', 'Renewal'],
      assigned_to: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('drops transport fields, blanks, files, and malformed multiselect payloads', () => {
    const formData = new FormData();
    formData.set('$ACTION_ID_example', 'encrypted');
    formData.set('_action', 'create');
    formData.set('_force', '1');
    formData.set('empty', '   ');
    formData.set('tags', '{"not":"an array"}');
    formData.set('attachment', new Blob(['test']), 'test.txt');

    expect(
      buildCrmCreateDataFromFormData(formData, {
        empty: 'text',
        tags: 'multiselect',
      }),
    ).toEqual({});
  });
});
