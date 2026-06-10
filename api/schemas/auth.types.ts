/**
 * KATA Framework - Type Facade: Auth Domain
 *
 * Type definitions for authentication endpoints.
 * When openapi-types.ts is available (after `bun run api:sync`),
 * migrate Custom Types to Schema/Endpoint Types using @openapi imports.
 *
 * Consumed by: tests/components/api/AuthApi.ts
 *
 * Migration example:
 *   import type { components, paths } from '@openapi';
 *   export type TokenResponse = components['schemas']['TokenResponse'];
 *   type LoginPath = paths['/api/auth/login']['post'];
 *   export type LoginRequest = LoginPath['requestBody']['content']['application/json'];
 */

// ============================================================================
// Schema Types (from components.schemas)
// ============================================================================

// TODO: Uncomment after running `bun run api:sync` and replace Custom Types below
// import type { components, paths } from '@openapi';
// export type TokenResponse = components['schemas']['TokenResponse'];
// export type UserInfo = components['schemas']['UserInfoModel'];

// ============================================================================
// Endpoint Types - POST /api/auth/login
// ============================================================================

// TODO: Uncomment after running `bun run api:sync`
// type LoginPath = paths['/api/auth/login']['post'];
// export type LoginPayload = LoginPath['requestBody']['content']['application/json'];
// export type LoginSuccessResponse = LoginPath['responses']['200']['content']['application/json'];
// export type LoginErrorResponse = LoginPath['responses']['401']['content']['application/json'];

// ============================================================================
// Endpoint Types - GET /api/auth/me
// ============================================================================

// TODO: Uncomment after running `bun run api:sync`
// type MePath = paths['/api/auth/me']['get'];
// export type MeResponse = MePath['responses']['200']['content']['application/json'];

// ============================================================================
// Custom Types (pre-sync definitions — replace with OpenAPI types when available)
// ============================================================================

/**
 * Login request payload.
 * TODO: Replace with OpenAPI endpoint type after sync.
 */
export interface LoginPayload {
  email: string
  password: string
}

/**
 * Raw BK signin response from POST /api/v1/auth/signin.
 * Returns both a Supabase session (for cookie auth) and a PAT (for Bearer auth).
 */
export interface BkSignInResponse {
  user: { id: string, email: string | null }
  session: {
    access_token: string
    refresh_token: string
    expires_at?: number
    token_type: string
  }
  pat: {
    token: string // bk_pat_* — use as Bearer token
    id: string
    name: string
    scopes: string[]
    expires_at: string | null
  }
}

/**
 * Normalized token response — compatible with api-auth.setup.ts.
 * authenticateSuccessfully() maps BkSignInResponse to this shape.
 * access_token = PAT token (bk_pat_*) for Bearer auth on requireAuth endpoints.
 */
export interface TokenResponse {
  access_token: string // PAT token
  token_type: string
  expires_in: number
  refresh_token?: string
}

/**
 * Error response for failed authentication.
 */
export interface AuthErrorResponse {
  error: {
    code: string
    message: string
    request_id?: string
  }
}

/**
 * User info response from GET /api/v1/me.
 */
export interface UserInfoResponse {
  user: {
    id: string
    email: string | null
    name?: string
    role?: string
  }
  workspaces: Array<{
    id: string
    slug: string
    name: string
    plan: string
    owner_user_id: string
    created_at: string
  }>
  active_workspace_id: string | null
}
