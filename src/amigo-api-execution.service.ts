import { Inject, Injectable, Optional } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AMIGO_FORM_CONFIG, AmigoFormConfig } from './config';
import { ApiEndpointConfig, HttpMethod, KeyValuePair } from './models';

export interface AmigoApiExecutionContext {
  formValue: Record<string, any>;
  payloadKey?: string;
  contentType?: 'auto' | 'json' | 'multipart';
  skipAuth?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AmigoApiExecutionService {
  constructor(private http: HttpClient, @Optional() @Inject(AMIGO_FORM_CONFIG) private cfg: AmigoFormConfig | null) {}

  execute(endpoint: ApiEndpointConfig, ctx: AmigoApiExecutionContext): Observable<any> {
    const method = ((endpoint?.method || 'POST') as string).toUpperCase() as HttpMethod;
    const url = this.resolveUrl(endpoint?.url || '');

    let headers = new HttpHeaders();
    if (ctx.skipAuth) headers = headers.set('X-Amigo-Skip-Auth', '1');

    for (const h of endpoint?.headers || []) {
      if (!h?.key) continue;
      const v = this.resolveString(h.value, ctx.formValue);
      if (v !== undefined && v !== null && String(v).length) headers = headers.set(h.key, String(v));
    }

    let params = new HttpParams();
    for (const q of endpoint?.queryParams || []) {
      if (!q?.key) continue;
      const v = this.resolveString(q.value, ctx.formValue);
      if (v === undefined || v === null || v === '') continue;
      params = params.set(q.key, String(v));
    }

    const mapped = this.buildMappedBody(endpoint?.bodyMapping, ctx.formValue);
    const payload = ctx.payloadKey ? { [ctx.payloadKey]: mapped } : mapped;

    if (method === 'GET') {
      const merged = this.mergeParamsFromObject(params, payload);
      return this.http.request(method, url, { headers, params: merged });
    }

    const contentType = ctx.contentType || 'auto';
    const useMultipart = contentType === 'multipart' || (contentType === 'auto' && this.hasFile(payload));

    if (useMultipart) {
      const fd = this.toFormData(payload);
      return this.http.request(method, url, { headers, params, body: fd });
    }

    headers = headers.set('Content-Type', 'application/json');
    return this.http.request(method, url, { headers, params, body: payload });
  }

  private resolveUrl(url: string): string {
    const u = (url || '').trim();
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;
    const base = (this.cfg?.apiBaseUrl || '').replace(/\/+$/, '');
    if (!base) return u.startsWith('/') ? u : '/' + u;
    if (u.startsWith('/')) return base + u;
    return base + '/' + u;
  }

  private buildMappedBody(mapping: any, formValue: Record<string, any>): any {
    if (!mapping) return formValue;

    if (Array.isArray(mapping)) {
      const out: Record<string, any> = {};
      for (const kv of mapping as KeyValuePair[]) {
        if (!kv?.key) continue;
        out[kv.key] = this.resolveMappingExpr(kv.value, formValue);
      }
      return out;
    }

    if (typeof mapping === 'object') {
      const out: Record<string, any> = {};
      for (const k of Object.keys(mapping)) {
        out[k] = this.resolveMappingExpr((mapping as Record<string, any>)[k], formValue);
      }
      return out;
    }

    return formValue;
  }

  private resolveMappingExpr(expr: any, formValue: Record<string, any>): any {
    if (expr === null || expr === undefined) return expr;
    if (typeof expr !== 'string') return expr;

    const s = expr.trim();
    const m = s.match(/^\{\{\s*([^}]+)\s*\}\}$/);
    if (m) return this.getByPath(formValue, m[1].trim());

    if (Object.prototype.hasOwnProperty.call(formValue, s)) return formValue[s];

    return this.resolveString(s, formValue);
  }

  private resolveString(template: string, formValue: Record<string, any>): string {
    const t = String(template ?? '');
    return t.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, path) => {
      const v = this.getByPath(formValue, String(path).trim());
      return v === undefined || v === null ? '' : String(v);
    });
  }

  private getByPath(obj: any, path: string): any {
    const parts = (path || '').split('.').map((p) => p.trim()).filter(Boolean);
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  private mergeParamsFromObject(params: HttpParams, obj: any): HttpParams {
    if (!obj || typeof obj !== 'object') return params;
    let p = params;
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item === undefined || item === null) continue;
          p = p.append(k, this.scalarToString(item));
        }
        continue;
      }
      p = p.set(k, this.scalarToString(v));
    }
    return p;
  }

  private scalarToString(v: any): string {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  private hasFile(v: any): boolean {
    if (!v) return false;
    if (typeof File !== 'undefined' && v instanceof File) return true;
    if (Array.isArray(v)) return v.some((x) => this.hasFile(x));
    if (typeof v === 'object') return Object.values(v).some((x) => this.hasFile(x));
    return false;
  }

  private toFormData(obj: any): FormData {
    const fd = new FormData();
    this.appendFormData(fd, obj, '');
    return fd;
  }

  private appendFormData(fd: FormData, value: any, keyPrefix: string): void {
    if (value === undefined || value === null) return;

    const isFile = typeof File !== 'undefined' && value instanceof File;
    if (isFile) {
      fd.append(keyPrefix, value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        const k = keyPrefix ? `${keyPrefix}[${i}]` : String(i);
        this.appendFormData(fd, v, k);
      });
      return;
    }

    if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => {
        const next = keyPrefix ? `${keyPrefix}.${k}` : k;
        this.appendFormData(fd, v, next);
      });
      return;
    }

    fd.append(keyPrefix, String(value));
  }
}
