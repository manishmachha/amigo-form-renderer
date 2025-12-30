import { Inject, Injectable, Optional } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AMIGO_AUTH_TOKEN_PROVIDER, AmigoAuthTokenProvider } from './auth-token.provider';
import { AMIGO_FORM_CONFIG, AmigoFormConfig } from './config';

@Injectable()
export class AmigoTokenInterceptor implements HttpInterceptor {
  constructor(
    @Optional()
    @Inject(AMIGO_AUTH_TOKEN_PROVIDER)
    private tokenProvider: AmigoAuthTokenProvider | null,
    @Optional() @Inject(AMIGO_FORM_CONFIG) private cfg: AmigoFormConfig | null
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // If no token provider was registered, just pass through
    if (!this.tokenProvider) return next.handle(req);

    const token = this.tokenProvider?.();
    if (!token) return next.handle(req);

    // (Optional) Only attach token for amigo endpoints
    // Helps avoid sending token to 3rd-party URLs.
    if (this.cfg?.apiBaseUrl) {
      const base = this.cfg.apiBaseUrl.replace(/\/+$/, '');
      const isAmigoCall = req.url.startsWith(base) || req.url.startsWith('/');
      if (!isAmigoCall) return next.handle(req);
    }

    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });

    return next.handle(authReq);
  }
}
