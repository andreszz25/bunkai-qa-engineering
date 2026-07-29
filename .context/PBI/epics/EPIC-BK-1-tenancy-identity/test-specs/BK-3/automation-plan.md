# BK-3 — Automation Plan

See `spec.md` for the scenario analysis. This file is the implementation approach.

## ApiBase extension (Layer 2)

Add to `RequestOptions`: `maxRedirects?: number`. Thread it into `apiGET`'s `this.request.get(url, { ..., maxRedirects: options.maxRedirects })`. Support absolute URLs in `apiGET` the same way `apiPOSTForm` already does: `endpoint.startsWith('http') ? endpoint : this.apiEndpoint(endpoint)`. No existing caller passes an absolute URL or sets `maxRedirects` today, so this is purely additive — no behavior change for `AuthApi`.

## New component — `tests/components/api/OAuthApi.ts`

```typescript
export interface OAuthCallbackParams {
  code?: string
  bkstate?: string
  cookie?: string   // raw Cookie header value, e.g. `bk_oauth_state=<uuid>`
  next?: string
}

export interface OAuthErrorBody {
  code: string
}

export class OAuthApi extends ApiBase {
  // Helper — raw callback call, redirects NOT followed (need the Location header)
  private async callCallback(params: OAuthCallbackParams): Promise<[APIResponse, OAuthErrorBody]> {
    const url = new URL('/auth/callback', this.config.baseUrl);
    if (params.code) url.searchParams.set('code', params.code);
    if (params.bkstate) url.searchParams.set('bkstate', params.bkstate);
    if (params.next) url.searchParams.set('next', params.next);
    const [response, body] = await this.apiGET<OAuthErrorBody>(url.toString(), {
      maxRedirects: 0,
      headers: params.cookie ? { Cookie: params.cookie } : undefined,
    });
    return [response, body];
  }

  @atc('TC-11')
  async rejectOAuthCallbackWithMissingCode() {
    const [response] = await this.callCallback({});
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain('/login?error=missing_code');
    return [response];
  }

  @atc('TC-10')
  async rejectOAuthCallbackWithMismatchedState() {
    const bkstate = this.faker.string.uuid();
    const [response, body] = await this.callCallback({ code: this.faker.string.alphanumeric(20), bkstate });
    expect(response.status()).toBe(403);
    expect(body.code).toBe('OAUTH_STATE_MISMATCH');
    return [response, body];
  }

  @atc('TC-13')
  async rejectOAuthCallbackWithStaleState() {
    const bkstate = this.faker.string.uuid();  // cookie == param, but never a live init record
    const [response] = await this.callCallback({
      code: this.faker.string.alphanumeric(20),
      bkstate,
      cookie: `bk_oauth_state=${bkstate}`,
    });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain('/login?error=oauth_init_failed');
    return [response];
  }

  @atc('TC-12')
  async rejectOAuthCallbackWithInvalidCode() {
    const [response] = await this.callCallback({ code: this.faker.string.alphanumeric(20) }); // bkstate absent -> skips CSRF, hits real exchange
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain('/login?error=otp_exchange_failed');
    return [response];
  }
}
```

Register in `ApiFixture.ts` as `readonly oauth: OAuthApi` (same pattern as `auth`).

## `LoginPage.ts` extension (Layer 3, UI)

One new ATC merging TC-27 + TC-28 (same precondition + action → KATA Rule 2):

```typescript
@atc('TC-27')
async verifyOAuthButtonsEnabledWithUpdatedCopy(): Promise<void> {
  await this.goto();
  await expect(this.page.locator('[data-testid="oauth-github"]')).toBeEnabled();
  await expect(this.page.locator('[data-testid="oauth-google"]')).toBeEnabled();
  await expect(this.page.getByText(/ships next sprint/i)).toHaveCount(0);
}
```
(TC-28 is covered by the same ATC — note this mapping when `/test-documentation` transitions TC statuses; it has no independent method.)

## Test files

- `tests/integration/auth/rejectOAuthCallback.test.ts` — `{ api }`, 4 tests (TC-10/11/12/13), each generates its own faker data.
- `tests/e2e/auth/verifyOAuthLoginUi.test.ts` — `{ ui }`, 1 test (TC-27/28).

## Out of scope (this session)

TC-31 (open-redirect guard) — stays Manual per `spec.md`. Do not stub a fake-passing assertion for it.

## Verification checklist (Phase 3 gate)

- [ ] `bun run test tests/integration/auth/rejectOAuthCallback.test.ts tests/e2e/auth/verifyOAuthLoginUi.test.ts`
- [ ] `bun run types:check`
- [ ] `bun run lint:check`
- [ ] `bun run kata:manifest` (regenerate, then `kata:manifest:check`)
- [ ] Every `@atc` ID (TC-10, TC-11, TC-12, TC-13, TC-27) traceable to the BK-3 ATP row
