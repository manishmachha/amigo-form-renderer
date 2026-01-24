import * as i0 from '@angular/core';
import { InjectionToken, Optional, Inject, Injectable, EventEmitter, Output, Input, Component } from '@angular/core';
import * as i4 from '@angular/common';
import { CommonModule } from '@angular/common';
import * as i5 from '@angular/forms';
import { Validators, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { map, tap, catchError, finalize } from 'rxjs/operators';
import { throwError, of } from 'rxjs';
import * as i1 from '@angular/common/http';
import { HTTP_INTERCEPTORS, HttpHeaders, HttpParams } from '@angular/common/http';

function buildFormGroup(fields, initialValue) {
    const group = {};
    for (const f of fields) {
        const t = String(f?.type ?? '');
        if (t === 'card' || t === 'info-card' || t === 'button')
            continue;
        const v = f.validations ?? {};
        const required = f.required === true || f.required === 'true' || v.required === true;
        const validators = [];
        if (required) {
            if (t === 'checkbox')
                validators.push(Validators.requiredTrue);
            else if (t === 'file')
                validators.push(fileRequiredValidator());
            else
                validators.push(Validators.required);
        }
        if (typeof v.minLength === 'number')
            validators.push(Validators.minLength(v.minLength));
        if (typeof v.maxLength === 'number')
            validators.push(Validators.maxLength(v.maxLength));
        if (typeof v.min === 'number')
            validators.push(Validators.min(v.min));
        if (typeof v.max === 'number')
            validators.push(Validators.max(v.max));
        if (v.pattern)
            validators.push(Validators.pattern(v.pattern));
        if (t === 'email')
            validators.push(Validators.email);
        if (t === 'file') {
            const maxFiles = typeof f.maxFiles === 'number' ? f.maxFiles : f.multiple ? undefined : 1;
            const maxSizeMB = typeof f.maxSizeMB === 'number' ? f.maxSizeMB : undefined;
            const accept = normalizeAccept(f.accept);
            if (maxFiles !== undefined)
                validators.push(fileMaxFilesValidator(maxFiles));
            if (maxSizeMB !== undefined)
                validators.push(fileMaxSizeValidator(maxSizeMB));
            if (accept)
                validators.push(fileAcceptValidator(accept));
        }
        const key = f.name ?? f.id;
        const init = initialValue?.[key] ??
            (t === 'checkbox'
                ? false
                : t === 'select' || t === 'radio'
                    ? null
                    : t === 'file'
                        ? null
                        : '');
        group[key] = new FormControl(init, validators);
    }
    return new FormGroup(group);
}
function normalizeAccept(a) {
    if (!a)
        return undefined;
    const s = String(a).trim().toLowerCase();
    return s || undefined;
}
function fileRequiredValidator() {
    return (c) => {
        const v = c.value;
        if (!v)
            return { required: true };
        if (Array.isArray(v))
            return v.length ? null : { required: true };
        return null;
    };
}
function fileMaxFilesValidator(maxFiles) {
    return (c) => {
        const v = c.value;
        if (!v)
            return null;
        const count = Array.isArray(v) ? v.length : 1;
        return count > maxFiles ? { maxFiles: { maxFiles, actual: count } } : null;
    };
}
function fileMaxSizeValidator(maxSizeMB) {
    const maxBytes = maxSizeMB * 1024 * 1024;
    return (c) => {
        const v = c.value;
        if (!v)
            return null;
        const files = Array.isArray(v) ? v : [v];
        const tooLarge = files.find((f) => f?.size > maxBytes);
        return tooLarge ? { maxSizeMB: { maxSizeMB, actualBytes: tooLarge.size } } : null;
    };
}
function fileAcceptValidator(accept) {
    const parts = accept
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    const isOk = (file) => {
        const mime = (file.type || '').toLowerCase();
        const name = (file.name || '').toLowerCase();
        for (const p of parts) {
            if (p.startsWith('.')) {
                if (name.endsWith(p))
                    return true;
            }
            else if (p.endsWith('/*')) {
                const prefix = p.slice(0, -1);
                if (mime.startsWith(prefix))
                    return true;
            }
            else {
                if (mime === p)
                    return true;
            }
        }
        return false;
    };
    return (c) => {
        const v = c.value;
        if (!v)
            return null;
        const files = Array.isArray(v) ? v : [v];
        const bad = files.find((f) => f && !isOk(f));
        return bad ? { accept: { accept, bad: bad.name } } : null;
    };
}

/**
 * Host app will provide this.
 * Example: () => authService.getAuthToken()
 */
const AMIGO_AUTH_TOKEN_PROVIDER = new InjectionToken('AMIGO_AUTH_TOKEN_PROVIDER');

class AmigoTokenInterceptor {
    tokenProvider;
    cfg;
    constructor(tokenProvider, cfg) {
        this.tokenProvider = tokenProvider;
        this.cfg = cfg;
    }
    intercept(req, next) {
        if (req.headers.has('X-Amigo-Skip-Auth')) {
            const cleaned = req.clone({ headers: req.headers.delete('X-Amigo-Skip-Auth') });
            return next.handle(cleaned);
        }
        if (!this.tokenProvider)
            return next.handle(req);
        const token = this.tokenProvider?.();
        if (!token)
            return next.handle(req);
        if (this.cfg?.apiBaseUrl) {
            const base = this.cfg.apiBaseUrl.replace(/\/+$/, '');
            const isAmigoCall = req.url.startsWith(base) || req.url.startsWith('/');
            if (!isAmigoCall)
                return next.handle(req);
        }
        return next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoTokenInterceptor, deps: [{ token: AMIGO_AUTH_TOKEN_PROVIDER, optional: true }, { token: AMIGO_FORM_CONFIG, optional: true }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoTokenInterceptor });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoTokenInterceptor, decorators: [{
            type: Injectable
        }], ctorParameters: () => [{ type: undefined, decorators: [{
                    type: Optional
                }, {
                    type: Inject,
                    args: [AMIGO_AUTH_TOKEN_PROVIDER]
                }] }, { type: undefined, decorators: [{
                    type: Optional
                }, {
                    type: Inject,
                    args: [AMIGO_FORM_CONFIG]
                }] }] });

const AMIGO_FORM_CONFIG = new InjectionToken('AMIGO_FORM_CONFIG');
function provideAmigoForm(config, tokenProvider) {
    const providers = [
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

class AmigoApiExecutionService {
    http;
    cfg;
    constructor(http, cfg) {
        this.http = http;
        this.cfg = cfg;
    }
    execute(endpoint, ctx) {
        const method = (endpoint?.method || 'POST').toUpperCase();
        const baseUrl = this.resolveUrl(endpoint?.url || '');
        const url = this.applyPathParams(baseUrl, ctx.pathParams);
        let headers = new HttpHeaders();
        if (ctx.skipAuth)
            headers = headers.set('X-Amigo-Skip-Auth', '1');
        for (const h of endpoint?.headers || []) {
            if (!h?.key)
                continue;
            const v = this.resolveString(h.value, ctx.formValue);
            if (v !== undefined && v !== null && String(v).length)
                headers = headers.set(h.key, String(v));
        }
        let params = new HttpParams();
        for (const q of endpoint?.queryParams || []) {
            if (!q?.key)
                continue;
            const v = this.resolveString(q.value, ctx.formValue);
            if (v === undefined || v === null || v === '')
                continue;
            params = params.set(q.key, String(v));
        }
        params = this.mergeParamsOverride(params, ctx.queryParams);
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
    resolveUrl(url) {
        const u = (url || '').trim();
        if (!u)
            return u;
        if (/^https?:\/\//i.test(u))
            return u;
        const base = (this.cfg?.submitActionBaseUrl || '').replace(/\/+$/, '');
        if (!base)
            return u.startsWith('/') ? u : '/' + u;
        if (u.startsWith('/'))
            return base + u;
        return base + '/' + u;
    }
    buildMappedBody(mapping, formValue) {
        if (!mapping)
            return formValue;
        if (Array.isArray(mapping)) {
            const out = {};
            for (const kv of mapping) {
                if (!kv?.key)
                    continue;
                out[kv.key] = this.resolveMappingExpr(kv.value, formValue);
            }
            return out;
        }
        if (typeof mapping === 'object') {
            const out = {};
            for (const k of Object.keys(mapping)) {
                out[k] = this.resolveMappingExpr(mapping[k], formValue);
            }
            return out;
        }
        return formValue;
    }
    resolveMappingExpr(expr, formValue) {
        if (expr === null || expr === undefined)
            return expr;
        if (typeof expr !== 'string')
            return expr;
        const s = expr.trim();
        const m = s.match(/^\{\{\s*([^}]+)\s*\}\}$/);
        if (m)
            return this.getByPath(formValue, m[1].trim());
        if (Object.prototype.hasOwnProperty.call(formValue, s))
            return formValue[s];
        return this.resolveString(s, formValue);
    }
    resolveString(template, formValue) {
        const t = String(template ?? '');
        return t.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, path) => {
            const v = this.getByPath(formValue, String(path).trim());
            return v === undefined || v === null ? '' : String(v);
        });
    }
    getByPath(obj, path) {
        const parts = (path || '')
            .split('.')
            .map((p) => p.trim())
            .filter(Boolean);
        let cur = obj;
        for (const p of parts) {
            if (cur == null)
                return undefined;
            cur = cur[p];
        }
        return cur;
    }
    mergeParamsFromObject(params, obj) {
        if (!obj || typeof obj !== 'object')
            return params;
        let p = params;
        for (const [k, v] of Object.entries(obj)) {
            if (v === undefined || v === null)
                continue;
            if (Array.isArray(v)) {
                for (const item of v) {
                    if (item === undefined || item === null)
                        continue;
                    p = p.append(k, this.scalarToString(item));
                }
                continue;
            }
            p = p.set(k, this.scalarToString(v));
        }
        return p;
    }
    scalarToString(v) {
        if (v instanceof Date)
            return v.toISOString();
        if (typeof v === 'object')
            return JSON.stringify(v);
        return String(v);
    }
    hasFile(v) {
        if (!v)
            return false;
        if (typeof File !== 'undefined' && v instanceof File)
            return true;
        if (Array.isArray(v))
            return v.some((x) => this.hasFile(x));
        if (typeof v === 'object')
            return Object.values(v).some((x) => this.hasFile(x));
        return false;
    }
    toFormData(obj) {
        const fd = new FormData();
        this.appendFormData(fd, obj, '');
        return fd;
    }
    appendFormData(fd, value, keyPrefix) {
        if (value === undefined || value === null)
            return;
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
    applyPathParams(url, params) {
        if (!params || !url)
            return url;
        const has = (k) => Object.prototype.hasOwnProperty.call(params, k);
        const enc = (v) => encodeURIComponent(v === undefined || v === null ? '' : String(v));
        let out = url;
        // {id} style
        out = out.replace(/\{([^}]+)\}/g, (m, k) => (has(k) ? enc(params[k]) : m));
        // :id style
        out = out.replace(/:([A-Za-z0-9_]+)/g, (m, k) => (has(k) ? enc(params[k]) : m));
        return out;
    }
    mergeParamsOverride(params, obj) {
        if (!obj || typeof obj !== 'object')
            return params;
        let p = params;
        for (const [k, v] of Object.entries(obj)) {
            if (v === undefined || v === null)
                continue;
            p = p.delete(k);
            if (Array.isArray(v)) {
                for (const item of v) {
                    if (item === undefined || item === null)
                        continue;
                    p = p.append(k, this.scalarToString(item));
                }
                continue;
            }
            p = p.set(k, this.scalarToString(v));
        }
        return p;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoApiExecutionService, deps: [{ token: i1.HttpClient }, { token: AMIGO_FORM_CONFIG, optional: true }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoApiExecutionService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoApiExecutionService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.HttpClient }, { type: undefined, decorators: [{
                    type: Optional
                }, {
                    type: Inject,
                    args: [AMIGO_FORM_CONFIG]
                }] }] });

class AmigoFormService {
    http;
    apiExec;
    cfg;
    constructor(http, apiExec, cfg) {
        this.http = http;
        this.apiExec = apiExec;
        this.cfg = cfg;
    }
    getFormSchemaById(id) {
        const pathBuilder = this.cfg.endpoints?.getFormById;
        const url = pathBuilder ? `${this.cfg.apiBaseUrl}${pathBuilder(id)}` : `${this.cfg.apiBaseUrl}/${id}`;
        return this.http.get(url);
    }
    submitByAction(action, payload) {
        const api = action?.submitApi?.api;
        const endpoint = api?.url
            ? api
            : action?.submitApiUrl
                ? {
                    method: (action.method || 'POST').toUpperCase(),
                    url: action.submitApiUrl,
                    headers: [],
                    queryParams: [],
                }
                : null;
        if (!endpoint?.url) {
            return throwError(() => new Error('No submit API configuration found'));
        }
        return this.apiExec.execute(endpoint, {
            formValue: payload,
            payloadKey: action.payloadKey || undefined,
            contentType: action.contentType || 'auto',
        });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoFormService, deps: [{ token: i1.HttpClient }, { token: AmigoApiExecutionService }, { token: AMIGO_FORM_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoFormService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoFormService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.HttpClient }, { type: AmigoApiExecutionService }, { type: undefined, decorators: [{
                    type: Inject,
                    args: [AMIGO_FORM_CONFIG]
                }] }] });

class AmigoSelectOptionsService {
    http;
    cfg;
    tokenProvider;
    cache = new Map();
    constructor(http, cfg, tokenProvider) {
        this.http = http;
        this.cfg = cfg;
        this.tokenProvider = tokenProvider;
    }
    load(field, _formValue) {
        const api = field.optionsSource?.api;
        if (!api?.url)
            return of([]);
        const cacheKey = `${field.id}::${api.method || 'GET'}::${api.url}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return of(cached);
        const url = this.resolveUrl(api.url);
        const method = (api.method || 'GET').toUpperCase();
        const shouldBearer = api.secured === true && api.authType === 'BEARER';
        let headers = new HttpHeaders();
        if (!shouldBearer) {
            headers = headers.set('X-Amigo-Skip-Auth', '1');
        }
        else {
            const token = this.resolveToken(api);
            if (token)
                headers = headers.set('Authorization', `Bearer ${token}`);
        }
        return this.http.request(method, url, { headers }).pipe(map((res) => this.mapOptions(res, api)), tap((opts) => this.cache.set(cacheKey, opts)), catchError((err) => {
            const msg = err?.error?.message || err?.message || 'Failed to load options.';
            return throwError(() => new Error(msg));
        }));
    }
    clear(fieldId) {
        if (!fieldId) {
            this.cache.clear();
            return;
        }
        for (const k of [...this.cache.keys()]) {
            if (k.startsWith(fieldId + '::'))
                this.cache.delete(k);
        }
    }
    resolveUrl(url) {
        const u = (url || '').trim();
        if (!u)
            return u;
        if (/^https?:\/\//i.test(u))
            return u;
        const base = (this.cfg?.apiBaseUrl || '').replace(/\/+$/, '');
        if (!base)
            return u.startsWith('/') ? u : '/' + u;
        if (u.startsWith('/'))
            return base + u;
        return base + '/' + u;
    }
    resolveToken(api) {
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
    mapOptions(res, api) {
        const rm = api.responseMapping;
        const labelKey = rm?.labelKey || 'label';
        const valueKey = rm?.valueKey || 'value';
        const data = rm?.dataPath ? this.getByPath(res, rm.dataPath) : res;
        const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        return arr
            .map((item) => ({
            label: item?.[labelKey] ?? '',
            value: item?.[valueKey],
        }))
            .filter((o) => o.label !== '' && o.value !== undefined);
    }
    getByPath(obj, path) {
        if (!obj || !path)
            return obj;
        return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoSelectOptionsService, deps: [{ token: i1.HttpClient }, { token: AMIGO_FORM_CONFIG, optional: true }, { token: AMIGO_AUTH_TOKEN_PROVIDER, optional: true }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoSelectOptionsService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoSelectOptionsService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.HttpClient }, { type: undefined, decorators: [{
                    type: Optional
                }, {
                    type: Inject,
                    args: [AMIGO_FORM_CONFIG]
                }] }, { type: undefined, decorators: [{
                    type: Optional
                }, {
                    type: Inject,
                    args: [AMIGO_AUTH_TOKEN_PROVIDER]
                }] }] });

class AmigoFormComponent {
    formService;
    cdr;
    zone;
    apiExec;
    selectOptions;
    formId;
    schema;
    initialValue;
    submitPathParams;
    submitQueryParams;
    submitted = new EventEmitter();
    submitFailed = new EventEmitter();
    cancelled = new EventEmitter();
    isLoading = false;
    loadError = null;
    isSubmitting = false;
    submitError = null;
    resolvedSchema = null;
    form = null;
    activeStepIndex = 0;
    submitLoading = false;
    submitFeedback;
    isSubmitHovered = false;
    isCancelHovered = false;
    selectState = {};
    buttonLoading = {};
    buttonFeedback = {};
    visibilitySub;
    visibilityState = {};
    visibilityUpdating = false;
    constructor(formService, cdr, zone, apiExec, selectOptions) {
        this.formService = formService;
        this.cdr = cdr;
        this.zone = zone;
        this.apiExec = apiExec;
        this.selectOptions = selectOptions;
    }
    ngOnChanges(changes) {
        if (changes['schema'] || changes['formId']) {
            this.init();
        }
        if (changes['initialValue'] && this.resolvedSchema) {
            this.form = buildFormGroup(this.resolvedSchema.fields, this.initialValue);
        }
    }
    init() {
        this.loadError = null;
        if (this.schema) {
            this.applySchema(this.schema);
            return;
        }
        if (!this.formId) {
            this.resolvedSchema = null;
            this.form = null;
            this.loadError = 'No schema or formId provided.';
            this.cdr.detectChanges();
            return;
        }
        this.isLoading = true;
        this.cdr.detectChanges(); //  ensure UI shows loading immediately
        this.formService.getFormSchemaById(this.formId).subscribe({
            next: (res) => {
                this.zone.run(() => {
                    this.applySchema(res?.form_data ?? res);
                    this.isLoading = false;
                    this.cdr.detectChanges(); //  render immediately
                });
            },
            error: (e) => {
                this.zone.run(() => {
                    this.isLoading = false;
                    this.loadError = e?.message ?? 'Failed to load form schema';
                    this.cdr.detectChanges();
                });
            },
        });
    }
    preloadApiSelectOptions() {
        const fields = this.resolvedSchema?.fields ?? [];
        const formValue = this.normalizeFormValue();
        for (const f of fields) {
            if (f.type !== 'select')
                continue;
            if (f.optionsSource?.mode !== 'API')
                continue;
            this.selectState[f.id] = { loading: true, options: [] };
            this.selectOptions.load(f, formValue).subscribe({
                next: (opts) => {
                    this.selectState[f.id] = { loading: false, options: opts };
                    this.cdr.detectChanges();
                },
                error: () => {
                    this.selectState[f.id] = {
                        loading: false,
                        error: 'Failed to load options.',
                        options: [],
                    };
                    this.cdr.detectChanges();
                },
            });
        }
    }
    applySchema(raw) {
        const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const formType = (s?.formType ?? 'single');
        const fields = (s?.fields ?? []).map((f) => {
            if (f?.type === 'file')
                return { ...f, accept: normalizeAccept(f.accept) };
            return f;
        });
        this.resolvedSchema = {
            ...s,
            formType,
            layout: s?.layout ?? { rows: 1, columns: 1 },
            fields,
            steps: s?.steps ?? [],
            sections: s?.sections ?? [],
            spacing: s?.spacing ?? {},
            style: s?.style ?? {},
            actions: s?.actions ?? {},
        };
        this.activeStepIndex = 0;
        this.form = buildFormGroup(this.resolvedSchema.fields, this.initialValue);
        this.patchInitialValue();
        this.setupVisibility();
        this.preloadApiSelectOptions();
    }
    isCard(field) {
        const t = field?.type;
        return t === 'card' || t === 'info-card';
    }
    cardIcon(field) {
        return field?.card?.icon || '';
    }
    cardTitle(field) {
        return field?.card?.title || field?.label || 'Info';
    }
    cardBody(field) {
        return field?.card?.body || '';
    }
    cardStyle(field) {
        const cs = field?.card?.style ?? {};
        const borderWidth = cs.borderWidth ?? 1;
        const borderRadius = cs.borderRadius ?? 12;
        const borderColor = cs.borderColor ?? '#BBF7D0';
        const backgroundColor = cs.backgroundColor ?? '#F0FDF4';
        const textColor = cs.textColor ?? '#166534';
        return {
            borderStyle: 'solid',
            borderWidth: `${borderWidth}px`,
            borderColor,
            borderRadius: `${borderRadius}px`,
            backgroundColor,
            color: textColor,
            padding: '12px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
        };
    }
    cardIconStyle(field) {
        const cs = field?.card?.style ?? {};
        const textColor = cs.textColor ?? '#166534';
        return {
            color: cs.iconColor ?? textColor,
            fontSize: '18px',
            lineHeight: '1',
            marginTop: '2px',
        };
    }
    controlKey(field) {
        return field?.name ?? field?.id;
    }
    ctrl(field) {
        return this.form?.get(this.controlKey(field)) ?? null;
    }
    showError(field) {
        const c = this.ctrl(field);
        return !!(c && c.invalid && (c.touched || c.dirty));
    }
    onFileChange(evt, field) {
        const input = evt.target;
        const files = input?.files ? Array.from(input.files) : [];
        const key = this.controlKey(field);
        const c = this.form?.get(key);
        if (!c)
            return;
        let normalized = field.multiple ? files : files.slice(0, 1);
        if (typeof field.maxFiles === 'number' && field.maxFiles > 0) {
            normalized = normalized.slice(0, field.maxFiles);
        }
        c.setValue(field.multiple ? normalized : (normalized[0] ?? null));
        c.markAsTouched();
        c.updateValueAndValidity();
    }
    fileNames(field) {
        const v = this.ctrl(field)?.value;
        if (!v)
            return [];
        if (Array.isArray(v))
            return v.map((f) => f?.name).filter(Boolean);
        if (v instanceof File)
            return [v.name];
        if (typeof FileList !== 'undefined' && v instanceof FileList) {
            return Array.from(v)
                .map((f) => f?.name)
                .filter(Boolean);
        }
        return [];
    }
    clearFiles(field, inputEl) {
        const c = this.ctrl(field);
        if (!c)
            return;
        c.setValue(null);
        c.markAsTouched();
        c.updateValueAndValidity();
        if (inputEl)
            inputEl.value = '';
    }
    trackByFieldId = (_, field) => field?.id ?? field?.name ?? _;
    get orderedSteps() {
        const s = this.resolvedSchema;
        return [...(s?.steps ?? [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
    }
    get totalSteps() {
        return this.orderedSteps.length;
    }
    get isMultiStep() {
        return this.resolvedSchema?.formType === 'multi' && this.totalSteps > 0;
    }
    get visibleFields() {
        const s = this.resolvedSchema;
        if (!s)
            return [];
        if (s.formType === 'multi' && this.totalSteps > 0) {
            const step = this.orderedSteps[this.activeStepIndex];
            const ids = new Set(step?.fieldIds ?? []);
            if (!ids.size)
                return [];
            return (s.fields ?? [])
                .filter((f) => ids.has(f.id))
                .filter((f) => this.isFieldVisible(f));
        }
        return (s.fields ?? []).filter((f) => this.isFieldVisible(f));
    }
    get orderedSections() {
        const s = this.resolvedSchema;
        if (!s || s.formType !== 'single-sectional')
            return [];
        return [...(s.sections ?? [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
    }
    get isSectional() {
        return this.resolvedSchema?.formType === 'single-sectional' && this.orderedSections.length > 0;
    }
    fieldsForSection(sectionId) {
        const s = this.resolvedSchema;
        if (!s)
            return [];
        const section = (s.sections ?? []).find((x) => x.id === sectionId);
        const ids = new Set(section?.fieldIds ?? []);
        return (s.fields ?? [])
            .filter((f) => ids.has(f.id))
            .filter((f) => this.isFieldVisible(f));
    }
    setActiveStep(i) {
        this.activeStepIndex = i;
    }
    onCancel() {
        this.cancelled.emit();
    }
    prevStep() {
        this.activeStepIndex = Math.max(0, this.activeStepIndex - 1);
    }
    nextStep() {
        const s = this.resolvedSchema;
        if (!s || s.formType !== 'multi')
            return;
        const current = this.visibleFields;
        this.touchFields(current);
        if (this.hasErrors(current))
            return;
        this.activeStepIndex = Math.min(this.totalSteps - 1, this.activeStepIndex + 1);
    }
    submit() {
        if (!this.resolvedSchema || !this.form)
            return;
        this.submitError = null;
        this.submitFeedback = undefined;
        const action = this.resolvedSchema?.actions ?? {};
        const submitCfg = this.resolveSubmitApi();
        const triggerValidation = submitCfg ? submitCfg.triggerValidation !== false : true;
        if (triggerValidation) {
            this.form.markAllAsTouched();
            if (this.form.invalid)
                return;
        }
        const rawPayload = this.form.value;
        const payload = this.normalizePayload(rawPayload);
        if (!submitCfg?.api?.url) {
            this.submitted.emit(payload);
            return;
        }
        this.isSubmitting = true;
        this.apiExec
            .execute(submitCfg.api, {
            formValue: payload,
            pathParams: this.submitPathParams,
            queryParams: this.submitQueryParams,
            payloadKey: action.payloadKey,
            contentType: action.contentType,
        })
            .pipe(finalize(() => (this.isSubmitting = false)))
            .subscribe({
            next: (res) => {
                this.submitFeedback = {
                    type: 'success',
                    message: submitCfg.successMessage || 'Submitted successfully.',
                };
                this.submitted.emit({
                    payload,
                    response: res,
                    action: this.resolvedSchema?.actions,
                });
            },
            error: (err) => {
                this.submitFeedback = {
                    type: 'error',
                    message: submitCfg.errorMessage ||
                        err?.error?.message ||
                        err?.message ||
                        'Failed to submit. Please try again.',
                };
                this.submitError = this.submitFeedback.message;
                this.submitFailed.emit(err);
            },
        });
    }
    touchFields(fields) {
        if (!this.form)
            return;
        for (const f of fields) {
            if (this.isNonInput(f))
                continue;
            if (!this.isFieldVisible(f))
                continue;
            const c = this.form.get(this.controlKey(f));
            if (!c || c.disabled)
                continue;
            c.markAsTouched();
            c.updateValueAndValidity({ emitEvent: false });
        }
    }
    hasErrors(fields) {
        if (!this.form)
            return true;
        return fields
            .filter((f) => !this.isNonInput(f))
            .filter((f) => this.isFieldVisible(f))
            .some((f) => {
            const c = this.form.get(this.controlKey(f));
            return !!(c && c.enabled && c.invalid);
        });
    }
    getFormStyle() {
        const sp = this.resolvedSchema?.spacing ?? {};
        const st = this.resolvedSchema?.style ?? {};
        return {
            marginTop: px(sp.marginTop),
            marginRight: px(sp.marginRight),
            marginBottom: px(sp.marginBottom),
            marginLeft: px(sp.marginLeft),
            paddingTop: px(sp.paddingTop),
            paddingRight: px(sp.paddingRight),
            paddingBottom: px(sp.paddingBottom),
            paddingLeft: px(sp.paddingLeft),
            backgroundColor: st.backgroundColor ?? null,
            color: st.textColor ?? null,
            borderStyle: st.borderWidth ? 'solid' : null,
            borderWidth: st.borderWidth ? px(st.borderWidth) : null,
            borderColor: st.borderColor ?? null,
            borderRadius: st.borderRadius ? px(st.borderRadius) : null,
        };
    }
    get submitButtonStyle() {
        const st = this.resolvedSchema?.style ?? {};
        const baseBg = st.buttonBackgroundColor ?? '#111827';
        const baseText = st.buttonTextColor ?? '#ffffff';
        const hoverBg = st.buttonHoverBackgroundColor ?? baseBg;
        const hoverText = st.buttonHoverTextColor ?? baseText;
        return {
            backgroundColor: this.isSubmitHovered ? hoverBg : baseBg,
            color: this.isSubmitHovered ? hoverText : baseText,
            borderRadius: st.borderRadius ? `${st.borderRadius}px` : '10px',
        };
    }
    get cancelButtonStyle() {
        const st = this.resolvedSchema?.style ?? {};
        const baseBg = '#FFFFFF';
        const baseText = st.buttonBackgroundColor ?? '#111827';
        const baseBorder = st.buttonBackgroundColor ?? '#111827';
        const hoverBg = st.buttonHoverBackgroundColor ?? baseBg;
        const hoverText = st.buttonHoverTextColor ?? baseText;
        const hoverBorder = st.buttonHoverBackgroundColor ?? baseBorder;
        const isHover = this.isCancelHovered;
        return {
            backgroundColor: isHover ? hoverBg : baseBg,
            color: isHover ? hoverText : baseText,
            border: `1px solid ${isHover ? hoverBorder : baseBorder}`,
            borderRadius: st.borderRadius ? `${st.borderRadius}px` : '10px',
        };
    }
    isBootstrapIcon(icon) {
        const v = (icon || '').trim();
        return v.startsWith('bi ') || v.startsWith('bi-') || v.includes(' bi-');
    }
    get showCancelButton() {
        const a = this.resolvedSchema?.actions ?? {};
        return a.showCancel !== false;
    }
    normalizePayload(payload) {
        const normalized = {};
        for (const field of this.resolvedSchema?.fields ?? []) {
            const key = this.controlKey(field);
            const value = payload[key];
            if (field.type === 'number') {
                normalized[key] = value === '' || value === undefined ? null : Number(value);
            }
            else {
                normalized[key] = value;
            }
        }
        return normalized;
    }
    patchInitialValue() {
        if (!this.form || !this.resolvedSchema || !this.initialValue)
            return;
        const patch = {};
        const inputFields = (this.resolvedSchema.fields ?? []).filter((f) => !this.isCard(f));
        for (const field of inputFields) {
            const key = this.controlKey(field);
            const incoming = this.initialValue[key] ??
                (field?.name ? this.initialValue[field.name] : undefined) ??
                (field?.id ? this.initialValue[field.id] : undefined);
            if (incoming === undefined)
                continue;
            if (field.type === 'file') {
                continue;
            }
            if (field.type === 'number') {
                patch[key] = incoming === '' || incoming === null ? null : Number(incoming);
                continue;
            }
            if (field.type === 'checkbox') {
                patch[key] = incoming === true || incoming === 'true' || incoming === 1 || incoming === '1';
                continue;
            }
            if (field.type === 'date' && incoming) {
                patch[key] = String(incoming).slice(0, 10);
                continue;
            }
            patch[key] = incoming;
        }
        this.form.patchValue(patch, { emitEvent: false });
        this.form.markAsPristine();
        this.form.markAsUntouched();
    }
    isButton(field) {
        return (field?.type ?? '') === 'button';
    }
    isNonInput(field) {
        const t = field?.type;
        return t === 'card' || t === 'info-card' || t === 'button';
    }
    normalizeFormValue() {
        if (!this.form)
            return {};
        const raw = this.form.value;
        const normalized = {};
        for (const field of this.resolvedSchema?.fields ?? []) {
            if (this.isNonInput(field))
                continue;
            const key = this.controlKey(field);
            const value = raw[key];
            normalized[key] =
                field.type === 'number'
                    ? value === '' || value === undefined
                        ? null
                        : Number(value)
                    : value;
        }
        return normalized;
    }
    setupVisibility() {
        this.visibilitySub?.unsubscribe();
        if (!this.form || !this.resolvedSchema)
            return;
        this.recomputeVisibility();
        this.visibilitySub = this.form.valueChanges.subscribe(() => {
            if (this.visibilityUpdating)
                return;
            this.recomputeVisibility();
        });
    }
    isFieldVisible(field) {
        const rules = field?.visibility?.rules;
        if (!rules || !rules.length)
            return true;
        const key = field?.id || field?.name;
        return this.visibilityState[key] !== false;
    }
    recomputeVisibility() {
        if (!this.form || !this.resolvedSchema)
            return;
        const raw = this.form.getRawValue ? this.form.getRawValue() : this.form.value;
        this.visibilityUpdating = true;
        try {
            for (const f of this.resolvedSchema.fields) {
                const visible = this.evaluateVisibility(f, raw);
                const stateKey = f.id || f.name;
                this.visibilityState[stateKey] = visible;
                if (this.isNonInput(f))
                    continue;
                const c = this.form.get(this.controlKey(f));
                if (!c)
                    continue;
                if (!visible && c.enabled)
                    c.disable({ emitEvent: false });
                if (visible && c.disabled)
                    c.enable({ emitEvent: false });
            }
        }
        finally {
            this.visibilityUpdating = false;
        }
    }
    evaluateVisibility(field, raw) {
        const vis = field?.visibility;
        const rules = vis?.rules ?? [];
        if (!rules.length)
            return true;
        const mode = String(vis?.mode || 'ALL').toUpperCase();
        const results = rules.map((r) => this.evaluateVisibilityRule(r, raw));
        return mode === 'ANY' ? results.some(Boolean) : results.every(Boolean);
    }
    evaluateVisibilityRule(rule, raw) {
        const depKey = this.resolveDependsOnKey(rule?.dependsOn);
        const v = raw?.[depKey];
        const op = String(rule?.operator || 'EQUALS').toUpperCase();
        const cmp = rule?.value;
        switch (op) {
            case 'CHECKED':
                return v === true;
            case 'UNCHECKED':
                return v !== true;
            case 'HAS_VALUE':
                return !this.isEmptyValue(v);
            case 'NOT_HAS_VALUE':
                return this.isEmptyValue(v);
            case 'IN':
                return Array.isArray(cmp) ? cmp.includes(v) : false;
            case 'NOT_IN':
                return Array.isArray(cmp) ? !cmp.includes(v) : true;
            case 'NOT_EQUALS':
                return Array.isArray(v) ? !v.includes(cmp) : v !== cmp;
            case 'EQUALS':
            default:
                return Array.isArray(v) ? v.includes(cmp) : v === cmp;
        }
    }
    resolveDependsOnKey(dep) {
        const d = String(dep || '');
        if (!d)
            return d;
        if (this.form?.get(d))
            return d;
        const fields = (this.resolvedSchema?.fields ?? []);
        const byId = fields.find((f) => f.id === d);
        if (byId)
            return this.controlKey(byId);
        const byName = fields.find((f) => f.name === d);
        if (byName)
            return this.controlKey(byName);
        return d;
    }
    isEmptyValue(v) {
        if (v === null || v === undefined)
            return true;
        if (typeof v === 'string' && v.trim() === '')
            return true;
        if (Array.isArray(v) && v.length === 0)
            return true;
        return false;
    }
    onSchemaButtonClick(field) {
        const btn = field?.button;
        const endpoint = btn?.api;
        if (!btn || (btn.actionType === 'API_CALL' && !endpoint))
            return;
        const triggerValidation = btn.triggerValidation !== false;
        if (triggerValidation) {
            const scope = this.isMultiStep ? this.visibleFields : (this.resolvedSchema?.fields ?? []);
            this.touchFields(scope.filter((f) => !this.isNonInput(f)));
            if (this.hasErrors(scope.filter((f) => !this.isNonInput(f))))
                return;
        }
        const formValue = this.normalizeFormValue();
        this.buttonLoading[field.id] = true;
        delete this.buttonFeedback[field.id];
        this.apiExec
            .execute(endpoint, { formValue })
            .pipe(finalize(() => (this.buttonLoading[field.id] = false)))
            .subscribe({
            next: () => {
                this.buttonFeedback[field.id] = {
                    type: 'success',
                    message: btn.successMessage || 'Action completed successfully.',
                };
            },
            error: (err) => {
                this.buttonFeedback[field.id] = {
                    type: 'error',
                    message: btn.errorMessage || err?.error?.message || err?.message || 'Action failed.',
                };
            },
        });
    }
    resolveSubmitApi() {
        const a = this.resolvedSchema?.actions;
        if (a?.submitApi?.api?.url) {
            return {
                triggerValidation: a.submitApi.triggerValidation !== false,
                successMessage: a.submitApi.successMessage,
                errorMessage: a.submitApi.errorMessage,
                api: a.submitApi.api,
            };
        }
        if (a?.submitApiUrl) {
            return {
                triggerValidation: true,
                api: {
                    method: (a.method || 'POST'),
                    url: a.submitApiUrl,
                    headers: [],
                    queryParams: [],
                },
            };
        }
        return null;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoFormComponent, deps: [{ token: AmigoFormService }, { token: i0.ChangeDetectorRef }, { token: i0.NgZone }, { token: AmigoApiExecutionService }, { token: AmigoSelectOptionsService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "21.0.6", type: AmigoFormComponent, isStandalone: true, selector: "amigo-form", inputs: { formId: "formId", schema: "schema", initialValue: "initialValue", submitPathParams: "submitPathParams", submitQueryParams: "submitQueryParams" }, outputs: { submitted: "submitted", submitFailed: "submitFailed", cancelled: "cancelled" }, usesOnChanges: true, ngImport: i0, template: "<div class=\"w-full h-full flex flex-col mb-6 overflow-auto\">\n\n    \n    <div *ngIf=\"isLoading\" class=\"flex items-center justify-center p-6 text-sm text-gray-600\">\n        Loading form\u2026\n    </div>\n\n    \n    <div *ngIf=\"loadError\" class=\"p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\">\n        {{ loadError }}\n    </div>\n\n    \n    <div *ngIf=\"!isLoading && !loadError && (!resolvedSchema?.fields || resolvedSchema.fields.length === 0)\"\n        class=\"flex justify-center items-center h-100 border border-dotted border-gray-300 rounded-xl bg-white\">\n        <h2 class=\"text-sm text-gray-600\">No fields found for this form schema.</h2>\n    </div>\n\n    <form *ngIf=\"!isLoading && !loadError && resolvedSchema?.fields?.length && form\" [formGroup]=\"form\" class=\"text-sm\"\n        [ngStyle]=\"getFormStyle()\" [ngClass]=\"resolvedSchema?.style?.formClass || ''\" (ngSubmit)=\"submit()\">\n        <h2 class=\"text-2xl my-2\">{{ resolvedSchema.name }}</h2>\n\n        <p *ngIf=\"resolvedSchema.description\" class=\"text-[13px] text-gray-500 mb-4\">\n            {{ resolvedSchema.description }}\n        </p>\n\n        \n        <div *ngIf=\"isMultiStep\" class=\"w-full mb-6 flex flex-col items-center my-3\">\n\n            \n            <div class=\"w-full h-1 bg-gray-200 rounded-full relative mb-6\">\n                <div class=\"h-1 rounded-full transition-all duration-300\" [ngStyle]=\"{\n                width: ((activeStepIndex + 1) / totalSteps) * 100 + '%',\n                backgroundColor: submitButtonStyle['backgroundColor']\n              }\">\n                </div>\n            </div>\n\n            \n            <div class=\"flex items-center justify-center gap-10\">\n                <div *ngFor=\"let step of orderedSteps; let i = index\" class=\"flex flex-col items-center cursor-pointer\"\n                    (click)=\"setActiveStep(i)\">\n\n                    <div class=\"w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all duration-300\"\n                        [ngStyle]=\"\n                  i === activeStepIndex\n                    ? {\n                        backgroundColor: submitButtonStyle['backgroundColor'],\n                        borderColor: submitButtonStyle['backgroundColor'],\n                        color: submitButtonStyle['color']\n                      }\n                    : {\n                        backgroundColor: '#FFFFFF',\n                        borderColor: '#9CA3AF',\n                        color: '#374151'\n                      }\n                \">\n\n                        \n                        <ng-container *ngIf=\"!step.icon\">\n                            {{ i + 1 }}\n                        </ng-container>\n\n                        \n                        <ng-container *ngIf=\"step.icon\">\n                            <i [class]=\"step.icon\" class=\"text-lg\" [ngStyle]=\"\n                      i === activeStepIndex\n                        ? { color: submitButtonStyle['color'] }\n                        : { color: '#6B7280' }\n                    \">\n                            </i>\n                        </ng-container>\n\n                    </div>\n\n                    <div class=\"mt-2 text-xs text-gray-600 font-medium\">\n                        {{ step.label }}\n                    </div>\n                </div>\n            </div>\n\n            <div *ngIf=\"visibleFields.length === 0\" class=\"text-xs text-gray-500 my-5\">\n                No fields assigned to this step yet.\n            </div>\n        </div>\n\n\n        \n        <div *ngIf=\"isSectional; else normalOrMulti\">\n            <div *ngFor=\"let sec of orderedSections\" class=\"mb-6\">\n                <div class=\"flex items-center justify-between mb-2 border-b border-gray-200 pb-2\">\n                    <h3 class=\"text-[11px] font-semibold uppercase text-blue-700\">{{ sec.label }}</h3>\n                    <span class=\"text-[11px] text-gray-500\">{{ fieldsForSection(sec.id).length }} fields</span>\n                </div>\n\n                <div class=\"grid\" [ngStyle]=\"{\n            'grid-template-columns': 'repeat(' + (resolvedSchema.layout?.columns || 1) + ', minmax(0, 1fr))',\n            'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\n            'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px'\n          }\">\n                    <div *ngFor=\"let field of fieldsForSection(sec.id); trackBy: trackByFieldId\"\n                        [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\n                        [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\">\n                        <ng-container *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"></ng-container>\n                    </div>\n                </div>\n\n                <div *ngIf=\"fieldsForSection(sec.id).length === 0\" class=\"text-xs text-gray-500 mt-2\">\n                    No fields in this section yet.\n                </div>\n            </div>\n        </div>\n\n        \n        <ng-template #normalOrMulti>\n            <div class=\"grid\" [ngStyle]=\"{\n          'grid-template-columns': 'repeat(' + (resolvedSchema.layout?.columns || 1) + ', minmax(0, 1fr))',\n          'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\n          'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px'\n        }\">\n                <div *ngFor=\"let field of visibleFields; trackBy: trackByFieldId\"\n                    [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\n                    [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\">\n                    <ng-container *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"></ng-container>\n                </div>\n            </div>\n        </ng-template>\n\n        \n        <div *ngIf=\"isMultiStep\" class=\"mt-4 flex items-center justify-between text-xs\">\n            <button type=\"button\" class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\n                (click)=\"prevStep()\" [disabled]=\"activeStepIndex === 0\">\n                \u2190 Previous step\n            </button>\n\n            <button type=\"button\" class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\n                (click)=\"nextStep()\" [disabled]=\"activeStepIndex === totalSteps - 1\">\n                Next step \u2192\n            </button>\n        </div>\n\n        <div *ngIf=\"submitFeedback\" class=\"mt-3 p-3 rounded border text-sm\"\n            [ngClass]=\"submitFeedback.type === 'success'\n              ? 'border-green-200 bg-green-50 text-green-700'\n              : 'border-red-200 bg-red-50 text-red-700'\">\n            {{ submitFeedback.message }}\n        </div>\n\n        \n        <div *ngIf=\"submitError\" class=\"mt-3 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\">\n            {{ submitError }}\n        </div>\n\n        \n        <div class=\"mt-4 flex items-center gap-2\">\n            <button type=\"submit\" (mouseenter)=\"isSubmitHovered = true\" (mouseleave)=\"isSubmitHovered = false\"\n                [ngStyle]=\"submitButtonStyle\" [disabled]=\"isSubmitting\"\n                [ngClass]=\"resolvedSchema.style?.buttonClass || 'px-4 py-2 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed'\">\n                {{ isSubmitting ? 'Submitting...' : (resolvedSchema.actions?.submitLabel || 'Submit') }}\n            </button>\n\n            <button *ngIf=\"showCancelButton\" type=\"button\" (click)=\"onCancel()\" (mouseenter)=\"isCancelHovered = true\"\n                (mouseleave)=\"isCancelHovered = false\" [disabled]=\"isSubmitting\" [ngStyle]=\"cancelButtonStyle\"\n                [ngClass]=\"resolvedSchema.style?.buttonClass || 'px-4 py-2 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed'\">\n                {{ resolvedSchema.actions?.cancelLabel || 'Cancel' }}\n            </button>\n        </div>\n\n\n        \n        <ng-template #fieldRenderer let-field>\n            \n            <ng-container *ngIf=\"isCard(field); else notCard\">\n                <div [ngStyle]=\"cardStyle(field)\" class=\"w-full flex items-start gap-3\">\n                    \n                    <div class=\"shrink-0 mt-0.5 text-lg leading-none\" [ngStyle]=\"cardIconStyle(field)\">\n                        <i *ngIf=\"isBootstrapIcon(cardIcon(field))\" [class]=\"cardIcon(field)\"></i>\n                        <span *ngIf=\"!isBootstrapIcon(cardIcon(field))\">{{ cardIcon(field) }}</span>\n                    </div>\n\n                    \n                    <div class=\"min-w-0\">\n                        <div class=\"text-sm font-semibold leading-tight\">\n                            {{ cardTitle(field) }}\n                        </div>\n\n                        <div *ngIf=\"cardBody(field)\" class=\"mt-1 text-xs opacity-90\">\n                            {{ cardBody(field) }}\n                        </div>\n                    </div>\n                </div>\n            </ng-container>\n\n            <ng-template #notCard>\n\n                \n                <ng-container *ngIf=\"isButton(field); else inputField\">\n                    <div class=\"w-full\">\n                        <button type=\"button\" (click)=\"onSchemaButtonClick(field)\" [disabled]=\"buttonLoading[field.id]\"\n                            class=\"w-full transition disabled:opacity-60 disabled:cursor-not-allowed\" [ngClass]=\"[\n                        (resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'),\n                        (field.button?.styleVariant || 'primary') === 'primary'\n                          ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'\n                          : (field.button?.styleVariant || 'primary') === 'danger'\n                            ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'\n                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'\n                      ]\">\n                            <span class=\"inline-flex items-center justify-center gap-2\">\n                                <span>{{ field.button?.label || field.label }}</span>\n                                <span *ngIf=\"buttonLoading[field.id]\" class=\"text-xs opacity-80\">\u2026</span>\n                            </span>\n                        </button>\n                \n                        <div *ngIf=\"buttonFeedback[field.id]\" class=\"mt-2 text-xs rounded-lg px-3 py-2 border\" [ngClass]=\"buttonFeedback[field.id].type === 'success'\n                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'\n                        : 'bg-rose-50 border-rose-200 text-rose-800'\">\n                            {{ buttonFeedback[field.id].message }}\n                        </div>\n                    </div>\n                </ng-container>\n\n\n                \n                <ng-template #inputField>\n                    <label [ngClass]=\"resolvedSchema?.style?.labelClass || 'block text-sm font-medium mb-1'\">\n                        {{ field.label }}\n                        <span\n                            *ngIf=\"field.required === true || field.required === 'true' || field.validations?.required\"\n                            class=\"text-red-500\">*</span>\n                    </label>\n\n                    <ng-container [ngSwitch]=\"field.type\">\n\n                        \n                        <ng-container *ngSwitchCase=\"'text'\">\n                            <input type=\"text\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                                    Minimum {{ field.validations?.minLength }} characters required.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\n                                </div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'password'\">\n                            <input type=\"password\" [placeholder]=\"field.placeholder\"\n                                [formControlName]=\"controlKey(field)\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                                    Minimum {{ field.validations?.minLength }} characters required.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\n                                </div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'number'\">\n                            <input type=\"number\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['min']\">Value should be \u2265 {{ field.validations?.min\n                                    }}.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['max']\">Value should be \u2264 {{ field.validations?.max\n                                    }}.</div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'email'\">\n                            <input type=\"email\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['email']\">Please enter a valid email address.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                                    Minimum {{ field.validations?.minLength }} characters required.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\n                                </div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'textarea'\">\n                            <textarea [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\" rows=\"4\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\"></textarea>\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                                    Minimum {{ field.validations?.minLength }} characters required.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\n                                </div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'select'\">\n                            <select [formControlName]=\"controlKey(field)\" [disabled]=\"selectState[field.id]?.loading\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\">\n                                <option value=\"\">Select an option</option>\n                        \n                                <ng-container *ngFor=\"let opt of (field.optionsSource?.mode === 'API'\n                              ? (selectState[field.id]?.options || [])\n                              : (field.options || []))\">\n                                    <option [value]=\"opt.value\">{{ opt.label }}</option>\n                                </ng-container>\n                            </select>\n                        \n                            <div *ngIf=\"field.optionsSource?.mode === 'API' && selectState[field.id]?.loading\"\n                                class=\"mt-1 text-[11px] text-slate-500\">\n                                Loading options\u2026\n                            </div>\n                        \n                            <div *ngIf=\"field.optionsSource?.mode === 'API' && selectState[field.id]?.error\"\n                                class=\"mt-1 text-[11px] text-rose-600\">\n                                {{ selectState[field.id]?.error }}\n                            </div>\n                        \n                            <div *ngIf=\"field.optionsSource?.mode === 'API'\n                                      && !selectState[field.id]?.loading\n                                      && !selectState[field.id]?.error\n                                      && (selectState[field.id]?.options?.length || 0) === 0\" class=\"mt-1 text-[11px] text-slate-500\">\n                                No options available.\n                            </div>\n                        \n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">Please select an option.</div>\n                            </div>\n                        </ng-container>\n\n\n                        \n                        <ng-container *ngSwitchCase=\"'checkbox'\">\n                            <div class=\"flex items-center gap-2\">\n                                <input type=\"checkbox\" [formControlName]=\"controlKey(field)\" />\n                                <span class=\"text-xs text-gray-700\">Check</span>\n                            </div>\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['requiredTrue']\">Please check this box.</div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'radio'\">\n                            <div\n                                [ngClass]=\"field.optionDirection === 'horizontal' ? 'flex flex-row gap-4 items-center' : 'flex flex-col gap-1'\">\n                                <label *ngFor=\"let opt of field.options || []\"\n                                    class=\"inline-flex items-center gap-2 text-xs text-gray-700\">\n                                    <input type=\"radio\" [value]=\"opt.value\" [formControlName]=\"controlKey(field)\" />\n                                    <span>{{ opt.label }}</span>\n                                </label>\n                            </div>\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">Please choose an option.</div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'date'\">\n                            <input type=\"date\" [formControlName]=\"controlKey(field)\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['min']\">Date should be on or after {{\n                                    field.validations?.min\n                                    }}.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['max']\">Date should be on or before {{\n                                    field.validations?.max\n                                    }}.</div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'file'\">\n                            <div class=\"flex flex-col gap-2\">\n                                <div class=\"flex items-center gap-2\">\n                                    <input #fileInput type=\"file\" [attr.accept]=\"field.accept || null\"\n                                        [attr.multiple]=\"field.multiple ? '' : null\"\n                                        (change)=\"onFileChange($event, field)\" (blur)=\"ctrl(field)?.markAsTouched()\"\n                                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                                    <button *ngIf=\"fileNames(field).length\" type=\"button\"\n                                        class=\"px-2 py-1 text-[11px] border border-gray-300 rounded hover:bg-gray-100\"\n                                        (click)=\"clearFiles(field, fileInput)\">\n                                        Clear\n                                    </button>\n                                </div>\n\n                                <div class=\"text-[11px] text-gray-500\">\n                                    <span *ngIf=\"field.accept\">Allowed: {{ field.accept }}</span>\n                                    <span *ngIf=\"field.maxSizeMB\"> \u2022 Max {{ field.maxSizeMB }}MB per file</span>\n                                    <span *ngIf=\"field.maxFiles\"> \u2022 Max {{ field.maxFiles }} file(s)</span>\n                                </div>\n\n                                <div *ngIf=\"fileNames(field).length\" class=\"text-[11px] text-gray-600\">\n                                    Selected: {{ fileNames(field).join(', ') }}\n                                </div>\n                            </div>\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxFiles']\">\n                                    You can upload up to {{ ctrl(field)?.errors?.['maxFiles']?.max }} file(s).\n                                </div>\n\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxSizeMB']\">\n                                    {{ ctrl(field)?.errors?.['maxSizeMB']?.file }} is too large. Max\n                                    {{ ctrl(field)?.errors?.['maxSizeMB']?.max }}MB.\n                                </div>\n\n                                <div *ngIf=\"ctrl(field)?.errors?.['accept']\">\n                                    {{ ctrl(field)?.errors?.['accept']?.file }} is not an allowed file type.\n                                </div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchDefault>\n                            <input type=\"text\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n                        </ng-container>\n\n                    </ng-container>\n                </ng-template>\n            </ng-template>\n        </ng-template>\n    </form>\n</div>", styles: [".amigo-loading{padding:12px;opacity:.85}.amigo-error{padding:12px;border:1px solid #ef4444;border-radius:8px;color:#ef4444}.amigo-form-root{width:100%;box-sizing:border-box}.amigo-header{margin-bottom:12px}.amigo-title{font-size:18px;font-weight:700}.amigo-desc{margin-top:4px;opacity:.8}.amigo-grid{width:100%}.amigo-field{display:block}.amigo-label{display:block;font-size:13px;margin-bottom:6px;font-weight:600}.amigo-required{color:#ef4444;margin-left:4px}.amigo-input{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:14px}.amigo-hint{margin-top:6px;font-size:12px;opacity:.75}.amigo-field-error{margin-top:6px;font-size:12px;color:#ef4444}.amigo-checkbox{display:flex;align-items:center;gap:8px}.amigo-radio{display:flex;flex-direction:column;gap:6px}.amigo-radio-item{display:inline-flex;align-items:center;gap:8px}.amigo-section{margin-bottom:18px}.amigo-section-title{font-weight:700;margin-bottom:10px}.amigo-actions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.amigo-btn{padding:8px 12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer}.amigo-primary{border-color:#111827;background:#111827;color:#fff}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i4.NgClass, selector: "[ngClass]", inputs: ["class", "ngClass"] }, { kind: "directive", type: i4.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i4.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i4.NgTemplateOutlet, selector: "[ngTemplateOutlet]", inputs: ["ngTemplateOutletContext", "ngTemplateOutlet", "ngTemplateOutletInjector"] }, { kind: "directive", type: i4.NgStyle, selector: "[ngStyle]", inputs: ["ngStyle"] }, { kind: "directive", type: i4.NgSwitch, selector: "[ngSwitch]", inputs: ["ngSwitch"] }, { kind: "directive", type: i4.NgSwitchCase, selector: "[ngSwitchCase]", inputs: ["ngSwitchCase"] }, { kind: "directive", type: i4.NgSwitchDefault, selector: "[ngSwitchDefault]" }, { kind: "ngmodule", type: ReactiveFormsModule }, { kind: "directive", type: i5.ɵNgNoValidate, selector: "form:not([ngNoForm]):not([ngNativeValidate])" }, { kind: "directive", type: i5.NgSelectOption, selector: "option", inputs: ["ngValue", "value"] }, { kind: "directive", type: i5.ɵNgSelectMultipleOption, selector: "option", inputs: ["ngValue", "value"] }, { kind: "directive", type: i5.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i5.NumberValueAccessor, selector: "input[type=number][formControlName],input[type=number][formControl],input[type=number][ngModel]" }, { kind: "directive", type: i5.CheckboxControlValueAccessor, selector: "input[type=checkbox][formControlName],input[type=checkbox][formControl],input[type=checkbox][ngModel]" }, { kind: "directive", type: i5.SelectControlValueAccessor, selector: "select:not([multiple])[formControlName],select:not([multiple])[formControl],select:not([multiple])[ngModel]", inputs: ["compareWith"] }, { kind: "directive", type: i5.RadioControlValueAccessor, selector: "input[type=radio][formControlName],input[type=radio][formControl],input[type=radio][ngModel]", inputs: ["name", "formControlName", "value"] }, { kind: "directive", type: i5.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i5.NgControlStatusGroup, selector: "[formGroupName],[formArrayName],[ngModelGroup],[formGroup],[formArray],form:not([ngNoForm]),[ngForm]" }, { kind: "directive", type: i5.FormGroupDirective, selector: "[formGroup]", inputs: ["formGroup"], outputs: ["ngSubmit"], exportAs: ["ngForm"] }, { kind: "directive", type: i5.FormControlName, selector: "[formControlName]", inputs: ["formControlName", "disabled", "ngModel"], outputs: ["ngModelChange"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoFormComponent, decorators: [{
            type: Component,
            args: [{ selector: 'amigo-form', standalone: true, imports: [CommonModule, ReactiveFormsModule], template: "<div class=\"w-full h-full flex flex-col mb-6 overflow-auto\">\n\n    \n    <div *ngIf=\"isLoading\" class=\"flex items-center justify-center p-6 text-sm text-gray-600\">\n        Loading form\u2026\n    </div>\n\n    \n    <div *ngIf=\"loadError\" class=\"p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\">\n        {{ loadError }}\n    </div>\n\n    \n    <div *ngIf=\"!isLoading && !loadError && (!resolvedSchema?.fields || resolvedSchema.fields.length === 0)\"\n        class=\"flex justify-center items-center h-100 border border-dotted border-gray-300 rounded-xl bg-white\">\n        <h2 class=\"text-sm text-gray-600\">No fields found for this form schema.</h2>\n    </div>\n\n    <form *ngIf=\"!isLoading && !loadError && resolvedSchema?.fields?.length && form\" [formGroup]=\"form\" class=\"text-sm\"\n        [ngStyle]=\"getFormStyle()\" [ngClass]=\"resolvedSchema?.style?.formClass || ''\" (ngSubmit)=\"submit()\">\n        <h2 class=\"text-2xl my-2\">{{ resolvedSchema.name }}</h2>\n\n        <p *ngIf=\"resolvedSchema.description\" class=\"text-[13px] text-gray-500 mb-4\">\n            {{ resolvedSchema.description }}\n        </p>\n\n        \n        <div *ngIf=\"isMultiStep\" class=\"w-full mb-6 flex flex-col items-center my-3\">\n\n            \n            <div class=\"w-full h-1 bg-gray-200 rounded-full relative mb-6\">\n                <div class=\"h-1 rounded-full transition-all duration-300\" [ngStyle]=\"{\n                width: ((activeStepIndex + 1) / totalSteps) * 100 + '%',\n                backgroundColor: submitButtonStyle['backgroundColor']\n              }\">\n                </div>\n            </div>\n\n            \n            <div class=\"flex items-center justify-center gap-10\">\n                <div *ngFor=\"let step of orderedSteps; let i = index\" class=\"flex flex-col items-center cursor-pointer\"\n                    (click)=\"setActiveStep(i)\">\n\n                    <div class=\"w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all duration-300\"\n                        [ngStyle]=\"\n                  i === activeStepIndex\n                    ? {\n                        backgroundColor: submitButtonStyle['backgroundColor'],\n                        borderColor: submitButtonStyle['backgroundColor'],\n                        color: submitButtonStyle['color']\n                      }\n                    : {\n                        backgroundColor: '#FFFFFF',\n                        borderColor: '#9CA3AF',\n                        color: '#374151'\n                      }\n                \">\n\n                        \n                        <ng-container *ngIf=\"!step.icon\">\n                            {{ i + 1 }}\n                        </ng-container>\n\n                        \n                        <ng-container *ngIf=\"step.icon\">\n                            <i [class]=\"step.icon\" class=\"text-lg\" [ngStyle]=\"\n                      i === activeStepIndex\n                        ? { color: submitButtonStyle['color'] }\n                        : { color: '#6B7280' }\n                    \">\n                            </i>\n                        </ng-container>\n\n                    </div>\n\n                    <div class=\"mt-2 text-xs text-gray-600 font-medium\">\n                        {{ step.label }}\n                    </div>\n                </div>\n            </div>\n\n            <div *ngIf=\"visibleFields.length === 0\" class=\"text-xs text-gray-500 my-5\">\n                No fields assigned to this step yet.\n            </div>\n        </div>\n\n\n        \n        <div *ngIf=\"isSectional; else normalOrMulti\">\n            <div *ngFor=\"let sec of orderedSections\" class=\"mb-6\">\n                <div class=\"flex items-center justify-between mb-2 border-b border-gray-200 pb-2\">\n                    <h3 class=\"text-[11px] font-semibold uppercase text-blue-700\">{{ sec.label }}</h3>\n                    <span class=\"text-[11px] text-gray-500\">{{ fieldsForSection(sec.id).length }} fields</span>\n                </div>\n\n                <div class=\"grid\" [ngStyle]=\"{\n            'grid-template-columns': 'repeat(' + (resolvedSchema.layout?.columns || 1) + ', minmax(0, 1fr))',\n            'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\n            'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px'\n          }\">\n                    <div *ngFor=\"let field of fieldsForSection(sec.id); trackBy: trackByFieldId\"\n                        [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\n                        [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\">\n                        <ng-container *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"></ng-container>\n                    </div>\n                </div>\n\n                <div *ngIf=\"fieldsForSection(sec.id).length === 0\" class=\"text-xs text-gray-500 mt-2\">\n                    No fields in this section yet.\n                </div>\n            </div>\n        </div>\n\n        \n        <ng-template #normalOrMulti>\n            <div class=\"grid\" [ngStyle]=\"{\n          'grid-template-columns': 'repeat(' + (resolvedSchema.layout?.columns || 1) + ', minmax(0, 1fr))',\n          'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\n          'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px'\n        }\">\n                <div *ngFor=\"let field of visibleFields; trackBy: trackByFieldId\"\n                    [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\n                    [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\">\n                    <ng-container *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"></ng-container>\n                </div>\n            </div>\n        </ng-template>\n\n        \n        <div *ngIf=\"isMultiStep\" class=\"mt-4 flex items-center justify-between text-xs\">\n            <button type=\"button\" class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\n                (click)=\"prevStep()\" [disabled]=\"activeStepIndex === 0\">\n                \u2190 Previous step\n            </button>\n\n            <button type=\"button\" class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\n                (click)=\"nextStep()\" [disabled]=\"activeStepIndex === totalSteps - 1\">\n                Next step \u2192\n            </button>\n        </div>\n\n        <div *ngIf=\"submitFeedback\" class=\"mt-3 p-3 rounded border text-sm\"\n            [ngClass]=\"submitFeedback.type === 'success'\n              ? 'border-green-200 bg-green-50 text-green-700'\n              : 'border-red-200 bg-red-50 text-red-700'\">\n            {{ submitFeedback.message }}\n        </div>\n\n        \n        <div *ngIf=\"submitError\" class=\"mt-3 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\">\n            {{ submitError }}\n        </div>\n\n        \n        <div class=\"mt-4 flex items-center gap-2\">\n            <button type=\"submit\" (mouseenter)=\"isSubmitHovered = true\" (mouseleave)=\"isSubmitHovered = false\"\n                [ngStyle]=\"submitButtonStyle\" [disabled]=\"isSubmitting\"\n                [ngClass]=\"resolvedSchema.style?.buttonClass || 'px-4 py-2 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed'\">\n                {{ isSubmitting ? 'Submitting...' : (resolvedSchema.actions?.submitLabel || 'Submit') }}\n            </button>\n\n            <button *ngIf=\"showCancelButton\" type=\"button\" (click)=\"onCancel()\" (mouseenter)=\"isCancelHovered = true\"\n                (mouseleave)=\"isCancelHovered = false\" [disabled]=\"isSubmitting\" [ngStyle]=\"cancelButtonStyle\"\n                [ngClass]=\"resolvedSchema.style?.buttonClass || 'px-4 py-2 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed'\">\n                {{ resolvedSchema.actions?.cancelLabel || 'Cancel' }}\n            </button>\n        </div>\n\n\n        \n        <ng-template #fieldRenderer let-field>\n            \n            <ng-container *ngIf=\"isCard(field); else notCard\">\n                <div [ngStyle]=\"cardStyle(field)\" class=\"w-full flex items-start gap-3\">\n                    \n                    <div class=\"shrink-0 mt-0.5 text-lg leading-none\" [ngStyle]=\"cardIconStyle(field)\">\n                        <i *ngIf=\"isBootstrapIcon(cardIcon(field))\" [class]=\"cardIcon(field)\"></i>\n                        <span *ngIf=\"!isBootstrapIcon(cardIcon(field))\">{{ cardIcon(field) }}</span>\n                    </div>\n\n                    \n                    <div class=\"min-w-0\">\n                        <div class=\"text-sm font-semibold leading-tight\">\n                            {{ cardTitle(field) }}\n                        </div>\n\n                        <div *ngIf=\"cardBody(field)\" class=\"mt-1 text-xs opacity-90\">\n                            {{ cardBody(field) }}\n                        </div>\n                    </div>\n                </div>\n            </ng-container>\n\n            <ng-template #notCard>\n\n                \n                <ng-container *ngIf=\"isButton(field); else inputField\">\n                    <div class=\"w-full\">\n                        <button type=\"button\" (click)=\"onSchemaButtonClick(field)\" [disabled]=\"buttonLoading[field.id]\"\n                            class=\"w-full transition disabled:opacity-60 disabled:cursor-not-allowed\" [ngClass]=\"[\n                        (resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'),\n                        (field.button?.styleVariant || 'primary') === 'primary'\n                          ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'\n                          : (field.button?.styleVariant || 'primary') === 'danger'\n                            ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'\n                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'\n                      ]\">\n                            <span class=\"inline-flex items-center justify-center gap-2\">\n                                <span>{{ field.button?.label || field.label }}</span>\n                                <span *ngIf=\"buttonLoading[field.id]\" class=\"text-xs opacity-80\">\u2026</span>\n                            </span>\n                        </button>\n                \n                        <div *ngIf=\"buttonFeedback[field.id]\" class=\"mt-2 text-xs rounded-lg px-3 py-2 border\" [ngClass]=\"buttonFeedback[field.id].type === 'success'\n                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'\n                        : 'bg-rose-50 border-rose-200 text-rose-800'\">\n                            {{ buttonFeedback[field.id].message }}\n                        </div>\n                    </div>\n                </ng-container>\n\n\n                \n                <ng-template #inputField>\n                    <label [ngClass]=\"resolvedSchema?.style?.labelClass || 'block text-sm font-medium mb-1'\">\n                        {{ field.label }}\n                        <span\n                            *ngIf=\"field.required === true || field.required === 'true' || field.validations?.required\"\n                            class=\"text-red-500\">*</span>\n                    </label>\n\n                    <ng-container [ngSwitch]=\"field.type\">\n\n                        \n                        <ng-container *ngSwitchCase=\"'text'\">\n                            <input type=\"text\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                                    Minimum {{ field.validations?.minLength }} characters required.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\n                                </div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'password'\">\n                            <input type=\"password\" [placeholder]=\"field.placeholder\"\n                                [formControlName]=\"controlKey(field)\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                                    Minimum {{ field.validations?.minLength }} characters required.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\n                                </div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'number'\">\n                            <input type=\"number\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['min']\">Value should be \u2265 {{ field.validations?.min\n                                    }}.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['max']\">Value should be \u2264 {{ field.validations?.max\n                                    }}.</div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'email'\">\n                            <input type=\"email\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['email']\">Please enter a valid email address.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                                    Minimum {{ field.validations?.minLength }} characters required.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\n                                </div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'textarea'\">\n                            <textarea [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\" rows=\"4\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\"></textarea>\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                                    Minimum {{ field.validations?.minLength }} characters required.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\n                                </div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\n                                </div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'select'\">\n                            <select [formControlName]=\"controlKey(field)\" [disabled]=\"selectState[field.id]?.loading\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\">\n                                <option value=\"\">Select an option</option>\n                        \n                                <ng-container *ngFor=\"let opt of (field.optionsSource?.mode === 'API'\n                              ? (selectState[field.id]?.options || [])\n                              : (field.options || []))\">\n                                    <option [value]=\"opt.value\">{{ opt.label }}</option>\n                                </ng-container>\n                            </select>\n                        \n                            <div *ngIf=\"field.optionsSource?.mode === 'API' && selectState[field.id]?.loading\"\n                                class=\"mt-1 text-[11px] text-slate-500\">\n                                Loading options\u2026\n                            </div>\n                        \n                            <div *ngIf=\"field.optionsSource?.mode === 'API' && selectState[field.id]?.error\"\n                                class=\"mt-1 text-[11px] text-rose-600\">\n                                {{ selectState[field.id]?.error }}\n                            </div>\n                        \n                            <div *ngIf=\"field.optionsSource?.mode === 'API'\n                                      && !selectState[field.id]?.loading\n                                      && !selectState[field.id]?.error\n                                      && (selectState[field.id]?.options?.length || 0) === 0\" class=\"mt-1 text-[11px] text-slate-500\">\n                                No options available.\n                            </div>\n                        \n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">Please select an option.</div>\n                            </div>\n                        </ng-container>\n\n\n                        \n                        <ng-container *ngSwitchCase=\"'checkbox'\">\n                            <div class=\"flex items-center gap-2\">\n                                <input type=\"checkbox\" [formControlName]=\"controlKey(field)\" />\n                                <span class=\"text-xs text-gray-700\">Check</span>\n                            </div>\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['requiredTrue']\">Please check this box.</div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'radio'\">\n                            <div\n                                [ngClass]=\"field.optionDirection === 'horizontal' ? 'flex flex-row gap-4 items-center' : 'flex flex-col gap-1'\">\n                                <label *ngFor=\"let opt of field.options || []\"\n                                    class=\"inline-flex items-center gap-2 text-xs text-gray-700\">\n                                    <input type=\"radio\" [value]=\"opt.value\" [formControlName]=\"controlKey(field)\" />\n                                    <span>{{ opt.label }}</span>\n                                </label>\n                            </div>\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">Please choose an option.</div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'date'\">\n                            <input type=\"date\" [formControlName]=\"controlKey(field)\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['min']\">Date should be on or after {{\n                                    field.validations?.min\n                                    }}.</div>\n                                <div *ngIf=\"ctrl(field)?.errors?.['max']\">Date should be on or before {{\n                                    field.validations?.max\n                                    }}.</div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchCase=\"'file'\">\n                            <div class=\"flex flex-col gap-2\">\n                                <div class=\"flex items-center gap-2\">\n                                    <input #fileInput type=\"file\" [attr.accept]=\"field.accept || null\"\n                                        [attr.multiple]=\"field.multiple ? '' : null\"\n                                        (change)=\"onFileChange($event, field)\" (blur)=\"ctrl(field)?.markAsTouched()\"\n                                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                                    <button *ngIf=\"fileNames(field).length\" type=\"button\"\n                                        class=\"px-2 py-1 text-[11px] border border-gray-300 rounded hover:bg-gray-100\"\n                                        (click)=\"clearFiles(field, fileInput)\">\n                                        Clear\n                                    </button>\n                                </div>\n\n                                <div class=\"text-[11px] text-gray-500\">\n                                    <span *ngIf=\"field.accept\">Allowed: {{ field.accept }}</span>\n                                    <span *ngIf=\"field.maxSizeMB\"> \u2022 Max {{ field.maxSizeMB }}MB per file</span>\n                                    <span *ngIf=\"field.maxFiles\"> \u2022 Max {{ field.maxFiles }} file(s)</span>\n                                </div>\n\n                                <div *ngIf=\"fileNames(field).length\" class=\"text-[11px] text-gray-600\">\n                                    Selected: {{ fileNames(field).join(', ') }}\n                                </div>\n                            </div>\n\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxFiles']\">\n                                    You can upload up to {{ ctrl(field)?.errors?.['maxFiles']?.max }} file(s).\n                                </div>\n\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxSizeMB']\">\n                                    {{ ctrl(field)?.errors?.['maxSizeMB']?.file }} is too large. Max\n                                    {{ ctrl(field)?.errors?.['maxSizeMB']?.max }}MB.\n                                </div>\n\n                                <div *ngIf=\"ctrl(field)?.errors?.['accept']\">\n                                    {{ ctrl(field)?.errors?.['accept']?.file }} is not an allowed file type.\n                                </div>\n                            </div>\n                        </ng-container>\n\n                        \n                        <ng-container *ngSwitchDefault>\n                            <input type=\"text\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n                        </ng-container>\n\n                    </ng-container>\n                </ng-template>\n            </ng-template>\n        </ng-template>\n    </form>\n</div>", styles: [".amigo-loading{padding:12px;opacity:.85}.amigo-error{padding:12px;border:1px solid #ef4444;border-radius:8px;color:#ef4444}.amigo-form-root{width:100%;box-sizing:border-box}.amigo-header{margin-bottom:12px}.amigo-title{font-size:18px;font-weight:700}.amigo-desc{margin-top:4px;opacity:.8}.amigo-grid{width:100%}.amigo-field{display:block}.amigo-label{display:block;font-size:13px;margin-bottom:6px;font-weight:600}.amigo-required{color:#ef4444;margin-left:4px}.amigo-input{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:14px}.amigo-hint{margin-top:6px;font-size:12px;opacity:.75}.amigo-field-error{margin-top:6px;font-size:12px;color:#ef4444}.amigo-checkbox{display:flex;align-items:center;gap:8px}.amigo-radio{display:flex;flex-direction:column;gap:6px}.amigo-radio-item{display:inline-flex;align-items:center;gap:8px}.amigo-section{margin-bottom:18px}.amigo-section-title{font-weight:700;margin-bottom:10px}.amigo-actions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.amigo-btn{padding:8px 12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer}.amigo-primary{border-color:#111827;background:#111827;color:#fff}\n"] }]
        }], ctorParameters: () => [{ type: AmigoFormService }, { type: i0.ChangeDetectorRef }, { type: i0.NgZone }, { type: AmigoApiExecutionService }, { type: AmigoSelectOptionsService }], propDecorators: { formId: [{
                type: Input
            }], schema: [{
                type: Input
            }], initialValue: [{
                type: Input
            }], submitPathParams: [{
                type: Input
            }], submitQueryParams: [{
                type: Input
            }], submitted: [{
                type: Output
            }], submitFailed: [{
                type: Output
            }], cancelled: [{
                type: Output
            }] } });
function px(v) {
    if (v === undefined || v === null)
        return null;
    const n = Number(v);
    return Number.isFinite(n) ? `${n}px` : null;
}

/**
 * Generated bundle index. Do not edit.
 */

export { AMIGO_AUTH_TOKEN_PROVIDER, AMIGO_FORM_CONFIG, AmigoFormComponent, AmigoFormService, AmigoTokenInterceptor, buildFormGroup, normalizeAccept, provideAmigoForm };
//# sourceMappingURL=amigo-amigo-form-renderer.mjs.map
