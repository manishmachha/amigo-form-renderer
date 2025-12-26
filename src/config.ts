import { InjectionToken, Provider } from '@angular/core';

export interface AmigoFormConfig {
  apiBaseUrl: string; // e.g. https://your-api.com
  endpoints?: {
    getFormById?: (id: string) => string; // optional custom path builder
  };
}

export const AMIGO_FORM_CONFIG = new InjectionToken<AmigoFormConfig>(
  'AMIGO_FORM_CONFIG'
);

export function provideAmigoForm(config: AmigoFormConfig): Provider[] {
  return [{ provide: AMIGO_FORM_CONFIG, useValue: config }];
}
