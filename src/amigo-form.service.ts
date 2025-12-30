import { Inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AMIGO_FORM_CONFIG, AmigoFormConfig } from './config';
import { FormActionSchema, FormSchema } from './models';
import { Observable, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AmigoFormService {
  constructor(private http: HttpClient, @Inject(AMIGO_FORM_CONFIG) private cfg: AmigoFormConfig) {}

  getFormSchemaById(id: string): Observable<FormSchema> {
    const pathBuilder = this.cfg.endpoints?.getFormById;
    const url = pathBuilder
      ? `${this.cfg.apiBaseUrl}${pathBuilder(id)}`
      : `${this.cfg.apiBaseUrl}/${id}`;

    return this.http.get<any>(url);
  }

  /**
   * Calls submit API based on FormActionSchema.
   * - Auto uses FormData if any file exists in payload (or contentType='multipart')
   * - GET uses query params
   */
  submitByAction(
    action: FormActionSchema,
    payload: Record<string, any>,
    schema?: FormSchema
  ): Observable<any> {
    const method = (action?.method ?? 'POST').toUpperCase() as
      | 'GET'
      | 'POST'
      | 'PUT'
      | 'PATCH'
      | 'DELETE';

    const submitApiUrl = (action?.submitApiUrl || '').trim();
    if (!submitApiUrl) {
      return throwError(() => new Error('No submitApiUrl provided in schema.actions'));
    }

    const url = this.resolveUrl(submitApiUrl);

    // optionally wrap payload
    const finalPayload =
      action.payloadKey && action.payloadKey.trim()
        ? { [action.payloadKey.trim()]: payload }
        : payload;

    // Decide multipart
    const mode = action.contentType ?? 'auto';
    const hasFiles = this.payloadHasFiles(finalPayload);
    const useMultipart = mode === 'multipart' || (mode === 'auto' && hasFiles);

    if (method === 'GET') {
      const params = this.toHttpParams(finalPayload);
      return this.http.request(method, url, { params });
    }

    if (useMultipart) {
      const formData = this.toFormData(finalPayload);
      return this.http.request(method, url, { body: formData });
    }

    // default JSON
    return this.http.request(method, url, { body: finalPayload });
  }

  private resolveUrl(submitApiUrl: string): string {
    // absolute URL
    if (/^https?:\/\//i.test(submitApiUrl)) return submitApiUrl;

    // relative URL => prefix apiBaseUrl
    const base = (this.cfg.apiBaseUrl || '').replace(/\/+$/, '');
    const path = submitApiUrl.startsWith('/') ? submitApiUrl : `/${submitApiUrl}`;
    return `${base}${path}`;
  }

  private payloadHasFiles(obj: any): boolean {
    if (!obj) return false;

    const isFile = (v: any) => typeof File !== 'undefined' && v instanceof File;

    const isFileList = (v: any) => typeof FileList !== 'undefined' && v instanceof FileList;

    if (isFile(obj) || isFileList(obj)) return true;

    if (Array.isArray(obj)) return obj.some((x) => this.payloadHasFiles(x));

    if (typeof obj === 'object') {
      return Object.values(obj).some((v) => this.payloadHasFiles(v));
    }

    return false;
  }

  private toFormData(payload: any): FormData {
    const fd = new FormData();

    const appendValue = (key: string, value: any) => {
      if (value === undefined || value === null) return;

      // File
      if (typeof File !== 'undefined' && value instanceof File) {
        fd.append(key, value, value.name);
        return;
      }

      // FileList
      if (typeof FileList !== 'undefined' && value instanceof FileList) {
        Array.from(value).forEach((f) => fd.append(key, f, f.name));
        return;
      }

      // Array
      if (Array.isArray(value)) {
        // if it's array of Files => append multiple under same key
        value.forEach((v) => appendValue(key, v));
        return;
      }

      // Object => stringify
      if (typeof value === 'object') {
        fd.append(key, JSON.stringify(value));
        return;
      }

      // primitives
      fd.append(key, String(value));
    };

    Object.entries(payload || {}).forEach(([k, v]) => appendValue(k, v));
    return fd;
  }

  private toHttpParams(payload: any): HttpParams {
    let params = new HttpParams();

    const add = (key: string, value: any) => {
      if (value === undefined || value === null) return;

      if (Array.isArray(value)) {
        value.forEach((v) => add(key, v));
        return;
      }

      if (typeof value === 'object') {
        // objects in GET -> stringify
        params = params.append(key, JSON.stringify(value));
        return;
      }

      params = params.append(key, String(value));
    };

    Object.entries(payload || {}).forEach(([k, v]) => add(k, v));
    return params;
  }
}
