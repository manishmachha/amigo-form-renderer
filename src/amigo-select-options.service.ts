import { Inject, Injectable, Optional } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AMIGO_AUTH_TOKEN_PROVIDER, AmigoAuthTokenProvider } from './auth-token.provider';
import { AMIGO_FORM_CONFIG, AmigoFormConfig } from './config';
import { FormFieldOption, FormFieldSchema, SelectOptionsApiConfig } from './models';

@Injectable({ providedIn: 'root' })
export class AmigoSelectOptionsService {
  private cache = new Map<string, FormFieldOption[]>();

  constructor(
    private http: HttpClient,
    @Optional() @Inject(AMIGO_FORM_CONFIG) private cfg: AmigoFormConfig | null,
    @Optional()
    @Inject(AMIGO_AUTH_TOKEN_PROVIDER)
    private tokenProvider: AmigoAuthTokenProvider | null,
  ) {}

  load(field: FormFieldSchema, _formValue?: Record<string, any>): Observable<FormFieldOption[]> {
    const api = field.optionsSource?.api;
    if (!api?.url) return of([]);

    const cacheKey = `${field.id}::${api.method || 'GET'}::${api.url}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return of(cached);

    const url = this.resolveUrl(api.url);
    const method = ((api.method || 'GET') as string).toUpperCase();

    const shouldBearer = api.secured === true && api.authType === 'BEARER';

    let headers = new HttpHeaders();
    if (!shouldBearer) {
      headers = headers.set('X-Amigo-Skip-Auth', '1');
    } else {
      const token = this.resolveToken(api);
      if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.request(method, url, { headers }).pipe(
      map((res: any) => this.mapOptions(res, api)),
      tap((opts) => this.cache.set(cacheKey, opts)),
      catchError((err) => {
        const msg = err?.error?.message || err?.message || 'Failed to load options.';
        return throwError(() => new Error(msg));
      }),
    );
  }

  clear(fieldId?: string): void {
    if (!fieldId) {
      this.cache.clear();
      return;
    }
    for (const k of [...this.cache.keys()]) {
      if (k.startsWith(fieldId + '::')) this.cache.delete(k);
    }
  }

  private resolveUrl(url: string): string {
    const u = (url || '').trim();
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;

    // Use selectOptionsBaseUrl if available, otherwise fall back into apiBaseUrl
    const base = (this.cfg?.selectOptionsBaseUrl || this.cfg?.apiBaseUrl || '').replace(/\/+$/, '');

    if (!base) return u.startsWith('/') ? u : '/' + u;
    if (u.startsWith('/')) return base + u;
    return base + '/' + u;
  }

  private resolveToken(api: SelectOptionsApiConfig): string | null {
    const key = api.tokenKey || 'access_token';
    if (api.tokenFrom === 'SESSION_STORAGE') {
      return sessionStorage.getItem(key);
    }
    if (api.tokenFrom === 'LOCAL_STORAGE' || !api.tokenFrom) {
      return localStorage.getItem(key);
    }
    if (api.tokenFrom === 'CUSTOM_CALLBACK') {
      return this.tokenProvider?.() || null;
    }
    return null;
  }

  private mapOptions(res: any, api: SelectOptionsApiConfig): FormFieldOption[] {
    const rm = api.responseMapping;
    const labelKey = rm?.labelKey || 'label';
    const valueKey = rm?.valueKey || 'value';
    const data = rm?.dataPath ? this.getByPath(res, rm.dataPath) : res;

    const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

    return arr
      .map((item: any) => ({
        label: item?.[labelKey] ?? '',
        value: item?.[valueKey],
      }))
      .filter((o: any) => o.label !== '' && o.value !== undefined);
  }

  private getByPath(obj: any, path: string): any {
    if (!obj || !path) return obj;
    return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  }
}
