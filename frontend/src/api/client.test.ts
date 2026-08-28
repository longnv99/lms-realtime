import { describe, expect, it } from 'vitest';
import { unwrapEnvelope } from './client';

describe('unwrapEnvelope', () => {
  it('returns data from successful envelopes', () => {
    expect(unwrapEnvelope({ success: true, data: { ok: true }, error: null, meta: null })).toEqual({
      ok: true,
    });
  });

  it('throws API error messages from failed envelopes', () => {
    expect(() =>
      unwrapEnvelope({
        success: false,
        data: null,
        error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Sai email/password' },
        meta: null,
      }),
    ).toThrow('Sai email/password');
  });
});
