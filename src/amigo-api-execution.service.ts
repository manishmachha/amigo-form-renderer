import { Inject, Injectable, Optional } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';

import { AMIGO_FORM_CONFIG, AmigoFormConfig } from './config';
import { AMIGO_AUTH_TOKEN_PROVIDER, AmigoAuthTokenProvider } from './auth-token.provider';
import { AMIGO_SKIP_AUTH } from './amigo-token.interceptor';
import { ApiEndpointConfig, KeyValuePair } from './models';

export type TokenFrom = 'LOCAL_STORAGE' | 'SESSION_STORAGE' | 'CUSTOM_CALLBACK';
export type AuthType = 'NONE' | 'BEARER';

export interface BearerAuthConfig {
  secured?: boolean;
  authType?: AuthType;
  tokenFrom?: TokenFrom;
  tokenKey?: string; // e.g. access_token
}

export interface ExecuteOptions {
  /** values from the reactive form (normalized) */
  formValue?: Record<string, any>;
  /** true => do NOT let interceptor attach global token */
  skipGlobalAuth?: boolean;
  /** optional per-request bearer auth (mainly for select API) */
  bearerAuth?: BearerAuthConfig;
}

@Injectable({ providedIn: 'root' })
export class AmigoApiExecutionService {
  constructor(
    private http: HttpClient,
    @Optional() @Inject(AMIGO_FORM_CONFIG) private cfg: AmigoFormConfig | null,
    @Optional()
    @Inject(AMIGO_AUTH_TOKEN_PROVIDER)
    private tokenProvider: AmigoAuthTokenProvider | null
  ) {}

  execute(endpoint: ApiEndpointConfig, opts: ExecuteOptions = {}): Observable<any> {
    if (!endpoint?.url) return throwError(() => new Error('API endpoint url is required'));

    const method = (endpoint.method || 'GET').toUpperCase() as any;
    const url = this.resolveUrl(endpoint.url);

    const params = this.toHttpParams(endpoint.queryParams, opts.formValue);
    const headersObj = this.toHeaderRecord(endpoint.headers, opts.formValue);

    // select-options requirement: attach Authorization only when explicitly configured
    const authHeader = this.buildBearerHeader(opts.bearerAuth);
    const headers = new HttpHeaders({
      ...headersObj,
      ...(authHeader ? authHeader : {}),
    });

    const context = opts.skipGlobalAuth ? new HttpContext().set(AMIGO_SKIP_AUTH, true) : undefined;

    // Body only for non-GET
    const body =
      method === 'GET' ? undefined : this.buildBody(endpoint.bodyMapping, opts.formValue);

    // Auto multipart if files exist (same logic as submit)
    const useMultipart = method !== 'GET' && this.payloadHasFiles(body);
    const finalBody = useMultipart ? this.toFormData(body) : body;

    return this.http.request(method, url, {
      body: finalBody,
      headers,
      params,
      context,
    });
  }

  // ---------- helpers ----------
  private resolveUrl(u: string): string {
    if (/^https?:\/\//i.test(u)) return u;
    const base = (this.cfg?.apiBaseUrl || '').replace(/\/+$/, '');
    const path = u.startsWith('/') ? u : `/${u}`;
    return base ? `${base}${path}` : path;
  }

  private buildBearerHeader(auth?: BearerAuthConfig): Record<string, string> | null {
    if (!auth?.secured) return null;
    if (auth.authType !== 'BEARER') return null;

    const tokenKey = auth.tokenKey || 'access_token';
    const token =
      auth.tokenFrom === 'SESSION_STORAGE'
        ? sessionStorage.getItem(tokenKey)
        : auth.tokenFrom === 'CUSTOM_CALLBACK'
        ? this.tokenProvider?.() ?? null
        : localStorage.getItem(tokenKey);

    return token ? { Authorization: `Bearer ${token}` } : null;
  }

  private toHeaderRecord(pairs?: KeyValuePair[], formValue?: any): Record<string, string> {
    const out: Record<string, string> = {};
    for (const p of pairs || []) {
      const k = (p?.key || '').trim();
      if (!k) continue;
      out[k] = this.interpolate(String(p.value ?? ''), formValue);
    }
    return out;
  }

  private toHttpParams(pairs?: KeyValuePair[], formValue?: any): HttpParams {
    let params = new HttpParams();
    for (const p of pairs || []) {
      const k = (p?.key || '').trim();
      if (!k) continue;
      const v = this.interpolate(String(p.value ?? ''), formValue);
      params = params.set(k, v);
    }
    return params;
  }

  private buildBody(mapping?: Record<string, string>, formValue?: any): any {
    if (!mapping || !Object.keys(mapping).length) return formValue ?? {};
    const body: Record<string, any> = {};
    for (const [k, expr] of Object.entries(mapping)) {
      body[k] = this.resolveExpr(expr, formValue);
    }
    return body;
  }

  private resolveExpr(expr: string, ctx: any): any {
    if (expr == null) return null;
    const s = String(expr);
    const exact = s.match(/^{{\s*([^}]+)\s*}}$/);
    if (exact) return this.getByPath(ctx, exact[1].trim());
    if (s.includes('{{')) return this.interpolate(s, ctx);

    // convenience: "employee.id" becomes a lookup if it exists
    const v = this.getByPath(ctx, s);
    return v === undefined ? s : v;
  }

  private interpolate(tpl: string, ctx: any): string {
    return tpl.replace(/{{\s*([^}]+)\s*}}/g, (_, path) => {
      const v = this.getByPath(ctx, String(path).trim());
      return v == null ? '' : String(v);
    });
  }

  private getByPath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  }

  private payloadHasFiles(obj: any): boolean {
    if (!obj) return false;
    const isFile = (v: any) => typeof File !== 'undefined' && v instanceof File;
    const isFileList = (v: any) => typeof FileList !== 'undefined' && v instanceof FileList;
    if (isFile(obj) || isFileList(obj)) return true;
    if (Array.isArray(obj)) return obj.some((x) => this.payloadHasFiles(x));
    if (typeof obj === 'object') return Object.values(obj).some((v) => this.payloadHasFiles(v));
    return false;
  }

  private toFormData(payload: any): FormData {
    const fd = new FormData();

    const append = (key: string, value: any) => {
      if (value === undefined || value === null) return;
      if (typeof File !== 'undefined' && value instanceof File) {
        fd.append(key, value, value.name);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((v, i) => append(`${key}[${i}]`, v));
        return;
      }
      if (typeof value === 'object') {
        Object.entries(value).forEach(([k, v]) => append(`${key}.${k}`, v));
        return;
      }
      fd.append(key, String(value));
    };

    Object.entries(payload || {}).forEach(([k, v]) => append(k, v));
    return fd;
  }
}
