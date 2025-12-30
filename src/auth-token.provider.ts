import { InjectionToken } from '@angular/core';

export type AmigoAuthTokenProvider = () => string | null;

/**
 * Host app will provide this.
 * Example: () => authService.getAuthToken()
 */
export const AMIGO_AUTH_TOKEN_PROVIDER = new InjectionToken<AmigoAuthTokenProvider>(
  'AMIGO_AUTH_TOKEN_PROVIDER'
);
