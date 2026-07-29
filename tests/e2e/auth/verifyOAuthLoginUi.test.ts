/**
 * KATA Architecture - OAuth Login UI E2E Test
 *
 * Verifies the Sign-in screen ships the OAuth buttons enabled and the
 * "ships next sprint" placeholder copy is gone (AC-10).
 *
 * Project: e2e (UI only - no API setup needed)
 */

import { test } from '@TestFixture';

test.describe('BK-3: OAuth Login UI', { tag: ['@critical'] }, () => {
  test('BK-3: should show enabled OAuth buttons with updated copy', async ({ ui }) => {
    await ui.login.verifyOAuthButtonsEnabledWithUpdatedCopy();
  });
});
