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
    @Optional() @Inject(AMIGO_FORM_CONFIG) private cfg: AmigoFormConfig | null,
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (req.headers.has('X-Amigo-Skip-Auth')) {
      const cleaned = req.clone({ headers: req.headers.delete('X-Amigo-Skip-Auth') });
      return next.handle(cleaned);
    }

    if (!this.tokenProvider) return next.handle(req);

    const token = this.tokenProvider?.();
    if (!token) return next.handle(req);

    if (this.cfg?.apiBaseUrl || this.cfg?.selectOptionsBaseUrl) {
      const bases = [this.cfg.apiBaseUrl, this.cfg.selectOptionsBaseUrl]
        .filter((b) => !!b)
        .map((b) => b!.replace(/\/+$/, ''));

      const isAmigoCall = req.url.startsWith('/') || bases.some((b) => req.url.startsWith(b));

      if (!isAmigoCall) return next.handle(req);
    }

    return next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
}
