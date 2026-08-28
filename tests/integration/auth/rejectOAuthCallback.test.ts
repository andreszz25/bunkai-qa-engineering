/**
 * KATA Architecture - OAuth Callback Rejection Integration Tests
 *
 * Tests for the GET /auth/callback error/rejection paths (GitHub/Google OAuth).
 * None of these ATCs require real provider consent.
 *
 * Project: integration (no auth token needed - these are pre-auth paths)
 */

import { expect, test } from '@TestFixture';

test.describe('BK-3: OAuth Callback Rejection Paths', { tag: ['@critical'] }, () => {
  test('BK-3: should redirect to missing_code error when no code param is sent', async ({ api }) => {
    const [response] = await api.oauth.rejectOAuthCallbackWithMissingCode();

    expect(response.status()).toBe(307);
  });

  test('BK-3: should reject with 403 OAUTH_STATE_MISMATCH when bkstate does not match the cookie', async ({ api }) => {
    const [response, body] = await api.oauth.rejectOAuthCallbackWithMismatchedState();

    expect(response.status()).toBe(403);
    expect(body.code).toBe('OAUTH_STATE_MISMATCH');
  });

  test('BK-3: should redirect to oauth_init_failed when bkstate matches but the init record is not live', async ({ api }) => {
    const [response] = await api.oauth.rejectOAuthCallbackWithStaleState();

    expect(response.status()).toBe(307);
  });

  test('BK-3: should redirect to otp_exchange_failed when an invalid or replayed code is exchanged', async ({ api }) => {
    const [response] = await api.oauth.rejectOAuthCallbackWithInvalidCode();

    expect(response.status()).toBe(307);
  });
});
