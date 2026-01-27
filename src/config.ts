import { InjectionToken, Provider } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AmigoTokenInterceptor } from './amigo-token.interceptor';
import { AMIGO_AUTH_TOKEN_PROVIDER, AmigoAuthTokenProvider } from './auth-token.provider';

export interface AmigoFormConfig {
  apiBaseUrl: string;
  submitActionBaseUrl: string;
  selectOptionsBaseUrl?: string;
  endpoints?: {
    getFormById?: (id: string) => string;
  };
}

export const AMIGO_FORM_CONFIG = new InjectionToken<AmigoFormConfig>('AMIGO_FORM_CONFIG');

export function provideAmigoForm(
  config: AmigoFormConfig,
  tokenProvider?: AmigoAuthTokenProvider,
): Provider[] {
  const providers: Provider[] = [
    { provide: AMIGO_FORM_CONFIG, useValue: config },

    // Register interceptor
    { provide: HTTP_INTERCEPTORS, useClass: AmigoTokenInterceptor, multi: true },
  ];

  // Optional token provider
  if (tokenProvider) {
    providers.push({ provide: AMIGO_AUTH_TOKEN_PROVIDER, useValue: tokenProvider });
  }

  return providers;
}
