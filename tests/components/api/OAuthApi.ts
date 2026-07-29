/**
 * KATA Architecture - Layer 3: OAuth API Component
 *
 * API component for the OAuth (GitHub/Google) callback route.
 * Handles the error/rejection paths of the callback — no real provider
 * consent is required for any of these ATCs.
 *
 * Endpoint: GET /auth/callback (web-app root — NOT under /api/v1)
 *
 * Live-verified contract (see .context/PBI/epics/EPIC-BK-1-tenancy-identity/
 * test-specs/BK-3/spec.md for the full probe log):
 * - no `code`                                          -> 307 /login?error=missing_code
 * - `code` present, `bkstate` absent                    -> 307 /login?error=otp_exchange_failed
 * - `bkstate` present, no/mismatched `bk_oauth_state`    -> 403 { code: OAUTH_STATE_MISMATCH }
 * - `bkstate` matches `bk_oauth_state` cookie, stale     -> 307 /login?error=oauth_init_failed
 */

import type { APIResponse } from '@playwright/test';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { faker } from '@faker-js/faker';
import { expect } from '@playwright/test';
import { atc } from '@utils/decorators';

// ============================================
// Types
// ============================================

export interface OAuthCallbackParams {
  code?: string
  bkstate?: string
  /** Raw Cookie header value, e.g. `bk_oauth_state=<uuid>` */
  cookie?: string
}

export interface OAuthErrorBody {
  code: string
}

// ============================================
// OAuth API Component
// ============================================

export class OAuthApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  // ============================================
  // Helpers (Private)
  // ============================================

  /**
   * Raw callback call. Redirects are NOT followed — the assertions need
   * the raw 3xx status and Location header, not the page it points to.
   */
  private async callCallback(params: OAuthCallbackParams): Promise<[APIResponse, OAuthErrorBody]> {
    const url = new URL('/auth/callback', this.config.baseUrl);
    if (params.code) {
      url.searchParams.set('code', params.code);
    }
    if (params.bkstate) {
      url.searchParams.set('bkstate', params.bkstate);
    }

    return this.apiGET<OAuthErrorBody>(url.toString(), {
      maxRedirects: 0,
      headers: params.cookie ? { Cookie: params.cookie } : undefined,
    });
  }

  // ============================================
  // ATCs - Complete Test Cases
  // ============================================

  /**
   * ATC: Callback called with no `code` param - expects graceful redirect error.
   */
  @atc('TC-11')
  async rejectOAuthCallbackWithMissingCode(): Promise<[APIResponse, OAuthErrorBody]> {
    const [response, body] = await this.callCallback({});

    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain('/login?error=missing_code');

    return [response, body];
  }

  /**
   * ATC: `bkstate` present but no matching `bk_oauth_state` cookie - CSRF rejection.
   */
  @atc('TC-10')
  async rejectOAuthCallbackWithMismatchedState(): Promise<[APIResponse, OAuthErrorBody]> {
    const [response, body] = await this.callCallback({
      code: faker.string.alphanumeric(20),
      bkstate: faker.string.uuid(),
    });

    expect(response.status()).toBe(403);
    expect(body.code).toBe('OAUTH_STATE_MISMATCH');

    return [response, body];
  }

  /**
   * ATC: `bkstate` query param matches the `bk_oauth_state` cookie, but the
   * underlying init record is not live (stale/expired/reused) - distinct
   * error from a plain mismatch (different status + code).
   */
  @atc('TC-13')
  async rejectOAuthCallbackWithStaleState(): Promise<[APIResponse, OAuthErrorBody]> {
    const bkstate = faker.string.uuid();
    const [response, body] = await this.callCallback({
      code: faker.string.alphanumeric(20),
      bkstate,
      cookie: `bk_oauth_state=${bkstate}`,
    });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain('/login?error=oauth_init_failed');

    return [response, body];
  }

  /**
   * ATC: `code` present, `bkstate` absent - skips the CSRF check and hits
   * the real Supabase code exchange, which rejects an invalid/replayed code.
   */
  @atc('TC-12')
  async rejectOAuthCallbackWithInvalidCode(): Promise<[APIResponse, OAuthErrorBody]> {
    const [response, body] = await this.callCallback({ code: faker.string.alphanumeric(20) });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain('/login?error=otp_exchange_failed');

    return [response, body];
  }
}
