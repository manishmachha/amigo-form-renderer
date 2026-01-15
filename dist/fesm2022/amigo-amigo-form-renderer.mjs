import * as i0 from '@angular/core';
import { InjectionToken, Optional, Inject, Injectable, EventEmitter, Output, Input, Component } from '@angular/core';
import * as i4 from '@angular/common';
import { CommonModule } from '@angular/common';
import * as i5 from '@angular/forms';
import { Validators, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { map, catchError, shareReplay, finalize } from 'rxjs/operators';
import * as i1 from '@angular/common/http';
import { HttpContextToken, HTTP_INTERCEPTORS, HttpParams, HttpHeaders, HttpContext } from '@angular/common/http';
import { throwError, of } from 'rxjs';

function buildFormGroup(fields, initialValue) {
    const group = {};
    const isNonInput = (t) => t === 'card' || t === 'info-card' || t === 'button';
    for (const f of fields) {
        const t = (f?.type ?? '').toString();
        if (isNonInput(t))
            continue;
        // Info cards are purely visual blocks and must NOT create form controls.
        if (f.type === 'card' || f.type === 'info-card')
            continue;
        const v = f.validations ?? {};
        // robust required parsing (boolean OR "true"/"false" strings)
        const required = f.required === true || f.required === 'true' || v.required === true;
        const validators = [];
        // required mapping
        if (required) {
            if (f.type === 'checkbox')
                validators.push(Validators.requiredTrue);
            else if (f.type === 'file')
                validators.push(fileRequiredValidator());
            else
                validators.push(Validators.required);
        }
        // string length rules
        if (typeof v.minLength === 'number')
            validators.push(Validators.minLength(v.minLength));
        if (typeof v.maxLength === 'number')
            validators.push(Validators.maxLength(v.maxLength));
        // numeric/date min/max (note: Angular Validators.min/max are numeric; if you want date min/max, handle separately)
        if (typeof v.min === 'number')
            validators.push(Validators.min(v.min));
        if (typeof v.max === 'number')
            validators.push(Validators.max(v.max));
        // pattern
        if (v.pattern)
            validators.push(Validators.pattern(v.pattern));
        //  email validator like template-driven
        if (f.type === 'email')
            validators.push(Validators.email);
        //  file-specific validators
        if (f.type === 'file') {
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
            (f.type === 'checkbox'
                ? false
                : f.type === 'select' || f.type === 'radio'
                    ? null
                    : f.type === 'file'
                        ? null
                        : '');
        group[key] = new FormControl(init, validators);
    }
    return new FormGroup(group);
}
// -----------------------
// File helpers + validators
// -----------------------
function normalizeAccept(a) {
    if (!a)
        return undefined;
    const s = String(a).trim().toLowerCase();
    if (!s)
        return undefined;
    // handle common composer shorthand like "pdf"
    if (s === 'pdf')
        return '.pdf,application/pdf';
    // if already looks valid
    if (s.startsWith('.') || s.includes('/') || s.includes(','))
        return a;
    // fallback: treat as extension
    return `.${s}`;
}
function normalizeFiles(value) {
    if (!value)
        return [];
    if (Array.isArray(value))
        return value.filter(Boolean);
    if (typeof FileList !== 'undefined' && value instanceof FileList) {
        return Array.from(value);
    }
    if (typeof File !== 'undefined' && value instanceof File) {
        return [value];
    }
    return [];
}
function fileRequiredValidator() {
    return (control) => {
        const files = normalizeFiles(control.value);
        return files.length ? null : { required: true };
    };
}
function fileMaxFilesValidator(maxFiles) {
    return (control) => {
        const files = normalizeFiles(control.value);
        return files.length > maxFiles
            ? { maxFiles: { max: maxFiles, actual: files.length } }
            : null;
    };
}
function fileMaxSizeValidator(maxSizeMB) {
    const maxBytes = maxSizeMB * 1024 * 1024;
    return (control) => {
        const files = normalizeFiles(control.value);
        const tooBig = files.find((f) => (f?.size ?? 0) > maxBytes);
        return tooBig
            ? {
                maxSizeMB: {
                    max: maxSizeMB,
                    file: tooBig?.name,
                    actualBytes: tooBig?.size,
                },
            }
            : null;
    };
}
/**
 * Accept parser supports:
 * - extensions: .pdf
 * - exact mime: application/pdf
 * - wildcards: image/*
 */
function fileAcceptValidator(accept) {
    const tokens = (accept || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    return (control) => {
        const files = normalizeFiles(control.value);
        if (!files.length || !tokens.length)
            return null;
        const bad = files.find((f) => !isAcceptedFile(f, tokens));
        return bad ? { accept: { accept, file: bad.name, type: bad.type } } : null;
    };
}
function isAcceptedFile(file, tokens) {
    const name = (file?.name || '').toLowerCase();
    const type = (file?.type || '').toLowerCase();
    return tokens.some((t) => {
        const tok = t.toLowerCase();
        if (!tok)
            return true;
        // extension
        if (tok.startsWith('.'))
            return name.endsWith(tok);
        // wildcard mime, e.g. image/*
        if (tok.endsWith('/*')) {
            const prefix = tok.slice(0, tok.length - 1); // keep trailing '/'
            return type.startsWith(prefix);
        }
        // exact mime
        if (tok.includes('/')) {
            if (type)
                return type === tok;
            // fallback when browser doesn't provide MIME type
            if (tok === 'application/pdf')
                return name.endsWith('.pdf');
            return false;
        }
        return false;
    });
}

/**
 * Host app will provide this.
 * Example: () => authService.getAuthToken()
 */
const AMIGO_AUTH_TOKEN_PROVIDER = new InjectionToken('AMIGO_AUTH_TOKEN_PROVIDER');

const AMIGO_SKIP_AUTH = new HttpContextToken(() => false);
class AmigoTokenInterceptor {
    tokenProvider;
    cfg;
    constructor(tokenProvider, cfg) {
        this.tokenProvider = tokenProvider;
        this.cfg = cfg;
    }
    intercept(req, next) {
        // If no token provider was registered, just pass through
        if (!this.tokenProvider)
            return next.handle(req);
        const token = this.tokenProvider?.();
        if (!token)
            return next.handle(req);
        if (req.context.get(AMIGO_SKIP_AUTH))
            return next.handle(req);
        // (Optional) Only attach token for amigo endpoints
        // Helps avoid sending token to 3rd-party URLs.
        if (this.cfg?.apiBaseUrl) {
            const base = this.cfg.apiBaseUrl.replace(/\/+$/, '');
            const isAmigoCall = req.url.startsWith(base) || req.url.startsWith('/');
            if (!isAmigoCall)
                return next.handle(req);
        }
        const authReq = req.clone({
            setHeaders: { Authorization: `Bearer ${token}` },
        });
        return next.handle(authReq);
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

class AmigoFormService {
    http;
    cfg;
    constructor(http, cfg) {
        this.http = http;
        this.cfg = cfg;
    }
    getFormSchemaById(id) {
        const pathBuilder = this.cfg.endpoints?.getFormById;
        const url = pathBuilder
            ? `${this.cfg.apiBaseUrl}${pathBuilder(id)}`
            : `${this.cfg.apiBaseUrl}/${id}`;
        return this.http.get(url);
    }
    /**
     * Calls submit API based on FormActionSchema.
     * - Auto uses FormData if any file exists in payload (or contentType='multipart')
     * - GET uses query params
     */
    submitByAction(action, payload, schema) {
        const method = (action?.method ?? 'POST').toUpperCase();
        const submitApiUrl = (action?.submitApiUrl || '').trim();
        if (!submitApiUrl) {
            return throwError(() => new Error('No submitApiUrl provided in schema.actions'));
        }
        const url = this.resolveUrl(submitApiUrl);
        // optionally wrap payload
        const finalPayload = action.payloadKey && action.payloadKey.trim()
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
    resolveUrl(submitApiUrl) {
        // absolute URL
        if (/^https?:\/\//i.test(submitApiUrl))
            return submitApiUrl;
        // relative URL => prefix apiBaseUrl
        const base = (this.cfg.apiBaseUrl || '').replace(/\/+$/, '');
        const path = submitApiUrl.startsWith('/') ? submitApiUrl : `/${submitApiUrl}`;
        return `${base}${path}`;
    }
    payloadHasFiles(obj) {
        if (!obj)
            return false;
        const isFile = (v) => typeof File !== 'undefined' && v instanceof File;
        const isFileList = (v) => typeof FileList !== 'undefined' && v instanceof FileList;
        if (isFile(obj) || isFileList(obj))
            return true;
        if (Array.isArray(obj))
            return obj.some((x) => this.payloadHasFiles(x));
        if (typeof obj === 'object') {
            return Object.values(obj).some((v) => this.payloadHasFiles(v));
        }
        return false;
    }
    toFormData(payload) {
        const fd = new FormData();
        const appendValue = (key, value) => {
            if (value === undefined || value === null)
                return;
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
    toHttpParams(payload) {
        let params = new HttpParams();
        const add = (key, value) => {
            if (value === undefined || value === null)
                return;
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoFormService, deps: [{ token: i1.HttpClient }, { token: AMIGO_FORM_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoFormService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoFormService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.HttpClient }, { type: undefined, decorators: [{
                    type: Inject,
                    args: [AMIGO_FORM_CONFIG]
                }] }] });

class AmigoApiExecutionService {
    http;
    cfg;
    tokenProvider;
    constructor(http, cfg, tokenProvider) {
        this.http = http;
        this.cfg = cfg;
        this.tokenProvider = tokenProvider;
    }
    execute(endpoint, opts = {}) {
        if (!endpoint?.url)
            return throwError(() => new Error('API endpoint url is required'));
        const method = (endpoint.method || 'GET').toUpperCase();
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
        const body = method === 'GET' ? undefined : this.buildBody(endpoint.bodyMapping, opts.formValue);
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
    resolveUrl(u) {
        if (/^https?:\/\//i.test(u))
            return u;
        const base = (this.cfg?.apiBaseUrl || '').replace(/\/+$/, '');
        const path = u.startsWith('/') ? u : `/${u}`;
        return base ? `${base}${path}` : path;
    }
    buildBearerHeader(auth) {
        if (!auth?.secured)
            return null;
        if (auth.authType !== 'BEARER')
            return null;
        const tokenKey = auth.tokenKey || 'access_token';
        const token = auth.tokenFrom === 'SESSION_STORAGE'
            ? sessionStorage.getItem(tokenKey)
            : auth.tokenFrom === 'CUSTOM_CALLBACK'
                ? this.tokenProvider?.() ?? null
                : localStorage.getItem(tokenKey);
        return token ? { Authorization: `Bearer ${token}` } : null;
    }
    toHeaderRecord(pairs, formValue) {
        const out = {};
        for (const p of pairs || []) {
            const k = (p?.key || '').trim();
            if (!k)
                continue;
            out[k] = this.interpolate(String(p.value ?? ''), formValue);
        }
        return out;
    }
    toHttpParams(pairs, formValue) {
        let params = new HttpParams();
        for (const p of pairs || []) {
            const k = (p?.key || '').trim();
            if (!k)
                continue;
            const v = this.interpolate(String(p.value ?? ''), formValue);
            params = params.set(k, v);
        }
        return params;
    }
    buildBody(mapping, formValue) {
        if (!mapping || !Object.keys(mapping).length)
            return formValue ?? {};
        const body = {};
        for (const [k, expr] of Object.entries(mapping)) {
            body[k] = this.resolveExpr(expr, formValue);
        }
        return body;
    }
    resolveExpr(expr, ctx) {
        if (expr == null)
            return null;
        const s = String(expr);
        const exact = s.match(/^{{\s*([^}]+)\s*}}$/);
        if (exact)
            return this.getByPath(ctx, exact[1].trim());
        if (s.includes('{{'))
            return this.interpolate(s, ctx);
        // convenience: "employee.id" becomes a lookup if it exists
        const v = this.getByPath(ctx, s);
        return v === undefined ? s : v;
    }
    interpolate(tpl, ctx) {
        return tpl.replace(/{{\s*([^}]+)\s*}}/g, (_, path) => {
            const v = this.getByPath(ctx, String(path).trim());
            return v == null ? '' : String(v);
        });
    }
    getByPath(obj, path) {
        if (!obj || !path)
            return undefined;
        return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    }
    payloadHasFiles(obj) {
        if (!obj)
            return false;
        const isFile = (v) => typeof File !== 'undefined' && v instanceof File;
        const isFileList = (v) => typeof FileList !== 'undefined' && v instanceof FileList;
        if (isFile(obj) || isFileList(obj))
            return true;
        if (Array.isArray(obj))
            return obj.some((x) => this.payloadHasFiles(x));
        if (typeof obj === 'object')
            return Object.values(obj).some((v) => this.payloadHasFiles(v));
        return false;
    }
    toFormData(payload) {
        const fd = new FormData();
        const append = (key, value) => {
            if (value === undefined || value === null)
                return;
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoApiExecutionService, deps: [{ token: i1.HttpClient }, { token: AMIGO_FORM_CONFIG, optional: true }, { token: AMIGO_AUTH_TOKEN_PROVIDER, optional: true }], target: i0.ɵɵFactoryTarget.Injectable });
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
                }] }, { type: undefined, decorators: [{
                    type: Optional
                }, {
                    type: Inject,
                    args: [AMIGO_AUTH_TOKEN_PROVIDER]
                }] }] });

class AmigoSelectOptionsService {
    api;
    cache = new Map();
    constructor(api) {
        this.api = api;
    }
    load(field, formValue) {
        const src = field.optionsSource;
        if (!src || src.mode !== "API" || !src.api) {
            return of(field.options ?? []);
        }
        const a = src.api;
        const key = `${field.id}::${a.method}::${a.url}::${a.responseMapping.dataPath || ""}::${a.responseMapping.labelKey}::${a.responseMapping.valueKey}`;
        const cached = this.cache.get(key);
        if (cached)
            return cached;
        const req = {
            method: a.method,
            url: a.url,
            headers: [], // keep open for future extensions
            queryParams: [], // keep open for future extensions
        };
        const obs = this.api
            .execute(req, {
            formValue,
            skipGlobalAuth: true, // IMPORTANT: don't attach token unless explicitly configured below
            bearerAuth: {
                secured: !!a.secured,
                authType: a.authType || "NONE",
                tokenFrom: a.tokenFrom || "LOCAL_STORAGE",
                tokenKey: a.tokenKey || "access_token",
            },
        })
            .pipe(map((res) => this.mapResponseToOptions(res, a.responseMapping)), catchError(() => of([])), shareReplay(1));
        this.cache.set(key, obs);
        return obs;
    }
    mapResponseToOptions(res, m) {
        const list = m.dataPath ? this.getByPath(res, m.dataPath) : res;
        if (!Array.isArray(list))
            return [];
        return list.map((item) => ({
            label: String(this.getByPath(item, m.labelKey) ?? ""),
            value: this.getByPath(item, m.valueKey),
        }));
    }
    getByPath(obj, path) {
        if (!obj || !path)
            return undefined;
        return path
            .split(".")
            .reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoSelectOptionsService, deps: [{ token: AmigoApiExecutionService }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoSelectOptionsService, providedIn: "root" });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoSelectOptionsService, decorators: [{
            type: Injectable,
            args: [{ providedIn: "root" }]
        }], ctorParameters: () => [{ type: AmigoApiExecutionService }] });

class AmigoFormComponent {
    formService;
    cdr;
    zone;
    apiExec;
    selectOptions;
    formId;
    schema;
    initialValue;
    /**
     * Emits:
     * - if NO submitApiUrl => raw form value (backward compatible)
     * - if submitApiUrl exists => { payload, response, action }
     */
    submitted = new EventEmitter();
    /** Emits error object when API submit fails */
    submitFailed = new EventEmitter();
    cancelled = new EventEmitter();
    isLoading = false;
    loadError = null;
    isSubmitting = false;
    submitError = null;
    resolvedSchema = null;
    form = null;
    activeStepIndex = 0;
    isSubmitHovered = false;
    isCancelHovered = false;
    selectState = {};
    buttonLoading = {};
    buttonFeedback = {};
    constructor(formService, cdr, zone, apiExec, selectOptions) {
        this.formService = formService;
        this.cdr = cdr;
        this.zone = zone;
        this.apiExec = apiExec;
        this.selectOptions = selectOptions;
    }
    ngOnChanges(changes) {
        if (changes["schema"] || changes["formId"]) {
            this.init();
        }
        if (changes["initialValue"] && this.resolvedSchema) {
            // If you want to patch when initialValue changes:
            this.form = buildFormGroup(this.resolvedSchema.fields, this.initialValue);
        }
    }
    init() {
        this.loadError = null;
        // If schema is provided directly
        if (this.schema) {
            this.applySchema(this.schema);
            return;
        }
        // If neither schema nor formId
        if (!this.formId) {
            this.resolvedSchema = null;
            this.form = null;
            this.loadError = "No schema or formId provided.";
            this.cdr.detectChanges();
            return;
        }
        // Start loading
        this.isLoading = true;
        this.cdr.detectChanges(); //  ensure UI shows loading immediately
        this.formService.getFormSchemaById(this.formId).subscribe({
            next: (res) => {
                //  force inside Angular CD context to update UI
                this.zone.run(() => {
                    this.applySchema(res?.form_data ?? res);
                    this.isLoading = false;
                    this.cdr.detectChanges(); //  render immediately
                });
            },
            error: (e) => {
                this.zone.run(() => {
                    this.isLoading = false;
                    this.loadError = e?.message ?? "Failed to load form schema";
                    this.cdr.detectChanges();
                });
            },
        });
    }
    preloadApiSelectOptions() {
        const fields = this.resolvedSchema?.fields ?? [];
        const formValue = this.normalizeFormValue();
        for (const f of fields) {
            if (f.type !== "select")
                continue;
            if (f.optionsSource?.mode !== "API")
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
                        error: "Failed to load options.",
                        options: [],
                    };
                    this.cdr.detectChanges();
                },
            });
        }
    }
    applySchema(raw) {
        const s = typeof raw === "string" ? JSON.parse(raw) : raw;
        const formType = (s?.formType ?? "single");
        const fields = (s?.fields ?? []).map((f) => {
            if (f?.type === "file")
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
        this.preloadApiSelectOptions();
        this.patchInitialValue();
    }
    // ---------- info cards ----------
    isCard(field) {
        const t = field?.type;
        return t === "card" || t === "info-card";
    }
    cardIcon(field) {
        return field?.card?.icon || "";
    }
    cardTitle(field) {
        return field?.card?.title || field?.label || "Info";
    }
    cardBody(field) {
        return field?.card?.body || "";
    }
    cardStyle(field) {
        const cs = field?.card?.style ?? {};
        const borderWidth = cs.borderWidth ?? 1;
        const borderRadius = cs.borderRadius ?? 12;
        const borderColor = cs.borderColor ?? "#BBF7D0";
        const backgroundColor = cs.backgroundColor ?? "#F0FDF4";
        const textColor = cs.textColor ?? "#166534";
        return {
            borderStyle: "solid",
            borderWidth: `${borderWidth}px`,
            borderColor,
            borderRadius: `${borderRadius}px`,
            backgroundColor,
            color: textColor,
            padding: "12px",
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
        };
    }
    cardIconStyle(field) {
        const cs = field?.card?.style ?? {};
        const textColor = cs.textColor ?? "#166534";
        return {
            color: cs.iconColor ?? textColor,
            fontSize: "18px",
            lineHeight: "1",
            marginTop: "2px",
        };
    }
    // ---------- keys & controls ----------
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
    // ---------- file inputs ----------
    onFileChange(evt, field) {
        const input = evt.target;
        const files = input?.files ? Array.from(input.files) : [];
        const key = this.controlKey(field);
        const c = this.form?.get(key);
        if (!c)
            return;
        let normalized = field.multiple ? files : files.slice(0, 1);
        if (typeof field.maxFiles === "number" && field.maxFiles > 0) {
            normalized = normalized.slice(0, field.maxFiles);
        }
        c.setValue(field.multiple ? normalized : normalized[0] ?? null);
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
        if (typeof FileList !== "undefined" && v instanceof FileList) {
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
            inputEl.value = "";
    }
    // ---------- visibility helpers ----------
    trackByFieldId = (_, field) => field?.id ?? field?.name ?? _;
    get orderedSteps() {
        const s = this.resolvedSchema;
        return [...(s?.steps ?? [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
    }
    get totalSteps() {
        return this.orderedSteps.length;
    }
    get isMultiStep() {
        return this.resolvedSchema?.formType === "multi" && this.totalSteps > 0;
    }
    get visibleFields() {
        const s = this.resolvedSchema;
        if (!s)
            return [];
        if (s.formType === "multi" && this.totalSteps > 0) {
            const step = this.orderedSteps[this.activeStepIndex];
            const ids = new Set(step?.fieldIds ?? []);
            if (!ids.size)
                return [];
            return (s.fields ?? []).filter((f) => ids.has(f.id));
        }
        return s.fields ?? [];
    }
    get orderedSections() {
        const s = this.resolvedSchema;
        if (!s || s.formType !== "single-sectional")
            return [];
        return [...(s.sections ?? [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
    }
    get isSectional() {
        return (this.resolvedSchema?.formType === "single-sectional" &&
            this.orderedSections.length > 0);
    }
    fieldsForSection(sectionId) {
        const s = this.resolvedSchema;
        if (!s)
            return [];
        const section = (s.sections ?? []).find((x) => x.id === sectionId);
        const ids = new Set(section?.fieldIds ?? []);
        return (s.fields ?? []).filter((f) => ids.has(f.id));
    }
    setActiveStep(i) {
        this.activeStepIndex = i;
    }
    // ---------- actions ----------
    onCancel() {
        this.cancelled.emit();
    }
    prevStep() {
        this.activeStepIndex = Math.max(0, this.activeStepIndex - 1);
    }
    nextStep() {
        const s = this.resolvedSchema;
        if (!s || s.formType !== "multi")
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
        this.form.markAllAsTouched();
        if (this.form.invalid) {
            const invalid = Object.entries(this.form.controls)
                .filter(([_, c]) => c.invalid)
                .map(([k, c]) => ({ key: k, errors: c.errors }));
            console.table(invalid);
            return;
        }
        if (this.form.invalid)
            return;
        const rawPayload = this.form.value;
        const payload = this.normalizePayload(rawPayload);
        const action = this.resolvedSchema?.actions;
        // If no API config, keep old behavior
        const hasApi = !!(action?.submitApiUrl && (action?.method || "POST"));
        if (!hasApi) {
            this.submitted.emit(payload);
            return;
        }
        this.isSubmitting = true;
        this.formService
            .submitByAction(action, payload, this.resolvedSchema)
            .pipe(finalize(() => (this.isSubmitting = false)))
            .subscribe({
            next: (res) => {
                this.submitted.emit({
                    payload,
                    response: res,
                    action,
                });
            },
            error: (err) => {
                this.submitError =
                    err?.error?.message ??
                        err?.message ??
                        "Failed to submit. Please try again.";
                this.submitFailed.emit(err);
            },
        });
    }
    touchFields(fields) {
        if (!this.form)
            return;
        for (const f of fields) {
            if (this.isCard(f))
                continue;
            const c = this.form.get(this.controlKey(f));
            c?.markAsTouched();
            c?.updateValueAndValidity();
        }
    }
    hasErrors(fields) {
        if (!this.form)
            return true;
        return fields
            .filter((f) => !this.isCard(f))
            .some((f) => this.form.get(this.controlKey(f))?.invalid);
    }
    // ---------- styling helpers ----------
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
            borderStyle: st.borderWidth ? "solid" : null,
            borderWidth: st.borderWidth ? px(st.borderWidth) : null,
            borderColor: st.borderColor ?? null,
            borderRadius: st.borderRadius ? px(st.borderRadius) : null,
        };
    }
    get submitButtonStyle() {
        const st = this.resolvedSchema?.style ?? {};
        const baseBg = st.buttonBackgroundColor ?? "#111827";
        const baseText = st.buttonTextColor ?? "#ffffff";
        const hoverBg = st.buttonHoverBackgroundColor ?? baseBg;
        const hoverText = st.buttonHoverTextColor ?? baseText;
        return {
            backgroundColor: this.isSubmitHovered ? hoverBg : baseBg,
            color: this.isSubmitHovered ? hoverText : baseText,
            borderRadius: st.borderRadius ? `${st.borderRadius}px` : "10px",
        };
    }
    get cancelButtonStyle() {
        const st = this.resolvedSchema?.style ?? {};
        const baseBg = "#FFFFFF";
        const baseText = st.buttonBackgroundColor ?? "#111827";
        const baseBorder = st.buttonBackgroundColor ?? "#111827";
        const hoverBg = st.buttonHoverBackgroundColor ?? baseBg;
        const hoverText = st.buttonHoverTextColor ?? baseText;
        const hoverBorder = st.buttonHoverBackgroundColor ?? baseBorder;
        const isHover = this.isCancelHovered;
        return {
            backgroundColor: isHover ? hoverBg : baseBg,
            color: isHover ? hoverText : baseText,
            border: `1px solid ${isHover ? hoverBorder : baseBorder}`,
            borderRadius: st.borderRadius ? `${st.borderRadius}px` : "10px",
        };
    }
    isBootstrapIcon(icon) {
        const v = (icon || "").trim();
        return v.startsWith("bi ") || v.startsWith("bi-") || v.includes(" bi-");
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
            //  ONLY for number fields
            if (field.type === "number") {
                normalized[key] =
                    value === "" || value === undefined ? null : Number(value);
            }
            else {
                //  Do NOT touch text / other fields
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
            // allow matching by name or id (in case parent sends either)
            const incoming = this.initialValue[key] ??
                (field?.name ? this.initialValue[field.name] : undefined) ??
                (field?.id ? this.initialValue[field.id] : undefined);
            if (incoming === undefined)
                continue;
            // File inputs: cannot set the actual <input type=file> UI value.
            // Best practice: ignore or store separately to display "existing files".
            if (field.type === "file") {
                // If you still want the FormControl to hold metadata, you can:
                // patch[key] = incoming; // e.g., [{name,url}]
                continue;
            }
            // Normalize common types
            if (field.type === "number") {
                patch[key] =
                    incoming === "" || incoming === null ? null : Number(incoming);
                continue;
            }
            if (field.type === "checkbox") {
                patch[key] =
                    incoming === true ||
                        incoming === "true" ||
                        incoming === 1 ||
                        incoming === "1";
                continue;
            }
            // date expects yyyy-mm-dd for <input type="date">
            if (field.type === "date" && incoming) {
                patch[key] = String(incoming).slice(0, 10);
                continue;
            }
            patch[key] = incoming;
        }
        // only patch existing controls
        this.form.patchValue(patch, { emitEvent: false });
        // optional: keep form “clean” after prefill
        this.form.markAsPristine();
        this.form.markAsUntouched();
    }
    isButton(field) {
        return (field?.type ?? "") === "button";
    }
    isNonInput(field) {
        const t = field?.type;
        return t === "card" || t === "info-card" || t === "button";
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
                field.type === "number"
                    ? value === "" || value === undefined
                        ? null
                        : Number(value)
                    : value;
        }
        return normalized;
    }
    onSchemaButtonClick(field) {
        const btn = field?.button;
        const endpoint = btn?.api;
        if (!btn || (btn.actionType === "API_CALL" && !endpoint))
            return;
        // default true
        const triggerValidation = btn.triggerValidation !== false;
        if (triggerValidation) {
            const scope = this.isMultiStep
                ? this.visibleFields
                : this.resolvedSchema?.fields ?? [];
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
                    type: "success",
                    message: btn.successMessage || "Action completed successfully.",
                };
            },
            error: (err) => {
                this.buttonFeedback[field.id] = {
                    type: "error",
                    message: btn.errorMessage ||
                        err?.error?.message ||
                        err?.message ||
                        "Action failed.",
                };
            },
        });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoFormComponent, deps: [{ token: AmigoFormService }, { token: i0.ChangeDetectorRef }, { token: i0.NgZone }, { token: AmigoApiExecutionService }, { token: AmigoSelectOptionsService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "21.0.6", type: AmigoFormComponent, isStandalone: true, selector: "amigo-form", inputs: { formId: "formId", schema: "schema", initialValue: "initialValue" }, outputs: { submitted: "submitted", submitFailed: "submitFailed", cancelled: "cancelled" }, usesOnChanges: true, ngImport: i0, template: "<div class=\"w-full h-full flex flex-col mb-6 overflow-auto\">\r\n\r\n    <!-- Loading -->\r\n    <div *ngIf=\"isLoading\" class=\"flex items-center justify-center p-6 text-sm text-gray-600\">\r\n        Loading form\u2026\r\n    </div>\r\n\r\n    <!-- Error -->\r\n    <div *ngIf=\"loadError\" class=\"p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\">\r\n        {{ loadError }}\r\n    </div>\r\n\r\n    <!-- Empty -->\r\n    <div *ngIf=\"!isLoading && !loadError && (!resolvedSchema?.fields || resolvedSchema.fields.length === 0)\"\r\n        class=\"flex justify-center items-center h-100 border border-dotted border-gray-300 rounded-xl bg-white\">\r\n        <h2 class=\"text-sm text-gray-600\">No fields found for this form schema.</h2>\r\n    </div>\r\n\r\n    <form *ngIf=\"!isLoading && !loadError && resolvedSchema?.fields?.length && form\" [formGroup]=\"form\" class=\"text-sm\"\r\n        [ngStyle]=\"getFormStyle()\" [ngClass]=\"resolvedSchema?.style?.formClass || ''\" (ngSubmit)=\"submit()\">\r\n        <h2 class=\"text-2xl my-2\">{{ resolvedSchema.name }}</h2>\r\n\r\n        <p *ngIf=\"resolvedSchema.description\" class=\"text-[13px] text-gray-500 mb-4\">\r\n            {{ resolvedSchema.description }}\r\n        </p>\r\n\r\n        <!-- MULTI STEP PROGRESS -->\r\n        <div *ngIf=\"isMultiStep\" class=\"w-full mb-6 flex flex-col items-center my-3\">\r\n\r\n            <!-- progress bar -->\r\n            <div class=\"w-full h-1 bg-gray-200 rounded-full relative mb-6\">\r\n                <div class=\"h-1 rounded-full transition-all duration-300\" [ngStyle]=\"{\r\n                width: ((activeStepIndex + 1) / totalSteps) * 100 + '%',\r\n                backgroundColor: submitButtonStyle['backgroundColor']\r\n              }\">\r\n                </div>\r\n            </div>\r\n\r\n            <!-- step circles -->\r\n            <div class=\"flex items-center justify-center gap-10\">\r\n                <div *ngFor=\"let step of orderedSteps; let i = index\" class=\"flex flex-col items-center cursor-pointer\"\r\n                    (click)=\"setActiveStep(i)\">\r\n\r\n                    <div class=\"w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all duration-300\"\r\n                        [ngStyle]=\"\r\n                  i === activeStepIndex\r\n                    ? {\r\n                        backgroundColor: submitButtonStyle['backgroundColor'],\r\n                        borderColor: submitButtonStyle['backgroundColor'],\r\n                        color: submitButtonStyle['color']\r\n                      }\r\n                    : {\r\n                        backgroundColor: '#FFFFFF',\r\n                        borderColor: '#9CA3AF',\r\n                        color: '#374151'\r\n                      }\r\n                \">\r\n\r\n                        <!-- if no icon -->\r\n                        <ng-container *ngIf=\"!step.icon\">\r\n                            {{ i + 1 }}\r\n                        </ng-container>\r\n\r\n                        <!-- if icon -->\r\n                        <ng-container *ngIf=\"step.icon\">\r\n                            <i [class]=\"step.icon\" class=\"text-lg\" [ngStyle]=\"\r\n                      i === activeStepIndex\r\n                        ? { color: submitButtonStyle['color'] }\r\n                        : { color: '#6B7280' }\r\n                    \">\r\n                            </i>\r\n                        </ng-container>\r\n\r\n                    </div>\r\n\r\n                    <div class=\"mt-2 text-xs text-gray-600 font-medium\">\r\n                        {{ step.label }}\r\n                    </div>\r\n                </div>\r\n            </div>\r\n\r\n            <div *ngIf=\"visibleFields.length === 0\" class=\"text-xs text-gray-500 my-5\">\r\n                No fields assigned to this step yet.\r\n            </div>\r\n        </div>\r\n\r\n\r\n        <!-- SINGLE-SECTIONAL MODE -->\r\n        <div *ngIf=\"isSectional; else normalOrMulti\">\r\n            <div *ngFor=\"let sec of orderedSections\" class=\"mb-6\">\r\n                <div class=\"flex items-center justify-between mb-2 border-b border-gray-200 pb-2\">\r\n                    <h3 class=\"text-[11px] font-semibold uppercase text-blue-700\">{{ sec.label }}</h3>\r\n                    <span class=\"text-[11px] text-gray-500\">{{ fieldsForSection(sec.id).length }} fields</span>\r\n                </div>\r\n\r\n                <div class=\"grid\" [ngStyle]=\"{\r\n            'grid-template-columns': 'repeat(' + (resolvedSchema.layout?.columns || 1) + ', minmax(0, 1fr))',\r\n            'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\r\n            'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px'\r\n          }\">\r\n                    <div *ngFor=\"let field of fieldsForSection(sec.id); trackBy: trackByFieldId\"\r\n                        [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\r\n                        [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\">\r\n                        <ng-container *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"></ng-container>\r\n                    </div>\r\n                </div>\r\n\r\n                <div *ngIf=\"fieldsForSection(sec.id).length === 0\" class=\"text-xs text-gray-500 mt-2\">\r\n                    No fields in this section yet.\r\n                </div>\r\n            </div>\r\n        </div>\r\n\r\n        <!-- NORMAL (single) + MULTI -->\r\n        <ng-template #normalOrMulti>\r\n            <div class=\"grid\" [ngStyle]=\"{\r\n          'grid-template-columns': 'repeat(' + (resolvedSchema.layout?.columns || 1) + ', minmax(0, 1fr))',\r\n          'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\r\n          'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px'\r\n        }\">\r\n                <div *ngFor=\"let field of visibleFields; trackBy: trackByFieldId\"\r\n                    [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\r\n                    [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\">\r\n                    <ng-container *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"></ng-container>\r\n                </div>\r\n            </div>\r\n        </ng-template>\r\n\r\n        <!-- Multi-step nav -->\r\n        <div *ngIf=\"isMultiStep\" class=\"mt-4 flex items-center justify-between text-xs\">\r\n            <button type=\"button\" class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\r\n                (click)=\"prevStep()\" [disabled]=\"activeStepIndex === 0\">\r\n                \u2190 Previous step\r\n            </button>\r\n\r\n            <button type=\"button\" class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\r\n                (click)=\"nextStep()\" [disabled]=\"activeStepIndex === totalSteps - 1\">\r\n                Next step \u2192\r\n            </button>\r\n        </div>\r\n\r\n        <!-- Submit error (API) -->\r\n        <div *ngIf=\"submitError\" class=\"mt-3 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\">\r\n            {{ submitError }}\r\n        </div>\r\n\r\n        <!-- Actions -->\r\n        <div class=\"mt-4 flex items-center gap-2\">\r\n            <button type=\"submit\" (mouseenter)=\"isSubmitHovered = true\" (mouseleave)=\"isSubmitHovered = false\"\r\n                [ngStyle]=\"submitButtonStyle\" [disabled]=\"isSubmitting\"\r\n                [ngClass]=\"resolvedSchema.style?.buttonClass || 'px-4 py-2 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed'\">\r\n                {{ isSubmitting ? 'Submitting...' : (resolvedSchema.actions?.submitLabel || 'Submit') }}\r\n            </button>\r\n\r\n            <button *ngIf=\"showCancelButton\" type=\"button\" (click)=\"onCancel()\" (mouseenter)=\"isCancelHovered = true\"\r\n                (mouseleave)=\"isCancelHovered = false\" [disabled]=\"isSubmitting\" [ngStyle]=\"cancelButtonStyle\"\r\n                [ngClass]=\"resolvedSchema.style?.buttonClass || 'px-4 py-2 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed'\">\r\n                {{ resolvedSchema.actions?.cancelLabel || 'Cancel' }}\r\n            </button>\r\n        </div>\r\n\r\n\r\n        <!-- Field renderer template -->\r\n        <ng-template #fieldRenderer let-field>\r\n            <!-- INFO CARD (non-input block) -->\r\n            <ng-container *ngIf=\"isCard(field); else notCard\">\r\n                <div [ngStyle]=\"cardStyle(field)\" class=\"w-full flex items-start gap-3\">\r\n                    <!-- Icon -->\r\n                    <div class=\"shrink-0 mt-0.5 text-lg leading-none\" [ngStyle]=\"cardIconStyle(field)\">\r\n                        <i *ngIf=\"isBootstrapIcon(cardIcon(field))\" [class]=\"cardIcon(field)\"></i>\r\n                        <span *ngIf=\"!isBootstrapIcon(cardIcon(field))\">{{ cardIcon(field) }}</span>\r\n                    </div>\r\n\r\n                    <!-- Content -->\r\n                    <div class=\"min-w-0\">\r\n                        <div class=\"text-sm font-semibold leading-tight\">\r\n                            {{ cardTitle(field) }}\r\n                        </div>\r\n\r\n                        <div *ngIf=\"cardBody(field)\" class=\"mt-1 text-xs opacity-90\">\r\n                            {{ cardBody(field) }}\r\n                        </div>\r\n                    </div>\r\n                </div>\r\n            </ng-container>\r\n\r\n            <ng-template #notCard>\r\n\r\n                <!-- BUTTON (non-input block) -->\r\n                <ng-container *ngIf=\"isButton(field); else inputField\">\r\n                    <div class=\"w-full\">\r\n                        <button type=\"button\" (click)=\"onSchemaButtonClick(field)\" [disabled]=\"buttonLoading[field.id]\"\r\n                            class=\"px-4 py-2 rounded-lg text-sm font-semibold border transition\" [ngClass]=\"[\r\n                                  (field.button?.styleVariant || 'primary') === 'primary' ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' :\r\n                                  (field.button?.styleVariant || 'primary') === 'danger' ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' :\r\n                                  'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'\r\n                                ]\">\r\n                            {{ field.button?.label || field.label }}\r\n                            <span *ngIf=\"buttonLoading[field.id]\" class=\"ml-2 text-xs opacity-80\">\u2026</span>\r\n                        </button>\r\n\r\n                        <div *ngIf=\"buttonFeedback[field.id]\" class=\"mt-2 text-xs rounded-lg px-3 py-2 border\"\r\n                            [ngClass]=\"buttonFeedback[field.id].type === 'success'\r\n                               ? 'bg-emerald-50 border-emerald-200 text-emerald-800'\r\n                               : 'bg-rose-50 border-rose-200 text-rose-800'\">\r\n                            {{ buttonFeedback[field.id].message }}\r\n                        </div>\r\n                    </div>\r\n                </ng-container>\r\n\r\n\r\n                <!-- INPUT FIELD -->\r\n                <ng-template #inputField>\r\n                    <label [ngClass]=\"resolvedSchema?.style?.labelClass || 'block text-sm font-medium mb-1'\">\r\n                        {{ field.label }}\r\n                        <span\r\n                            *ngIf=\"field.required === true || field.required === 'true' || field.validations?.required\"\r\n                            class=\"text-red-500\">*</span>\r\n                    </label>\r\n\r\n                    <ng-container [ngSwitch]=\"field.type\">\r\n\r\n                        <!-- TEXT -->\r\n                        <ng-container *ngSwitchCase=\"'text'\">\r\n                            <input type=\"text\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                                    Minimum {{ field.validations?.minLength }} characters required.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\r\n                                </div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- PASSWORD -->\r\n                        <ng-container *ngSwitchCase=\"'password'\">\r\n                            <input type=\"password\" [placeholder]=\"field.placeholder\"\r\n                                [formControlName]=\"controlKey(field)\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                                    Minimum {{ field.validations?.minLength }} characters required.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\r\n                                </div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- NUMBER -->\r\n                        <ng-container *ngSwitchCase=\"'number'\">\r\n                            <input type=\"number\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['min']\">Value should be \u2265 {{ field.validations?.min\r\n                                    }}.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['max']\">Value should be \u2264 {{ field.validations?.max\r\n                                    }}.</div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- EMAIL -->\r\n                        <ng-container *ngSwitchCase=\"'email'\">\r\n                            <input type=\"email\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['email']\">Please enter a valid email address.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                                    Minimum {{ field.validations?.minLength }} characters required.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\r\n                                </div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- TEXTAREA -->\r\n                        <ng-container *ngSwitchCase=\"'textarea'\">\r\n                            <textarea [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\" rows=\"4\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\"></textarea>\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                                    Minimum {{ field.validations?.minLength }} characters required.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\r\n                                </div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- SELECT -->\r\n                        <ng-container *ngSwitchCase=\"'select'\">\r\n                            <select [formControlName]=\"controlKey(field)\" [disabled]=\"selectState[field.id]?.loading\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\">\r\n                                <option value=\"\">Select an option</option>\r\n                        \r\n                                <ng-container *ngFor=\"let opt of (field.optionsSource?.mode === 'API'\r\n                              ? (selectState[field.id]?.options || [])\r\n                              : (field.options || []))\">\r\n                                    <option [value]=\"opt.value\">{{ opt.label }}</option>\r\n                                </ng-container>\r\n                            </select>\r\n                        \r\n                            <div *ngIf=\"field.optionsSource?.mode === 'API' && selectState[field.id]?.loading\"\r\n                                class=\"mt-1 text-[11px] text-slate-500\">\r\n                                Loading options\u2026\r\n                            </div>\r\n                        \r\n                            <div *ngIf=\"field.optionsSource?.mode === 'API' && selectState[field.id]?.error\"\r\n                                class=\"mt-1 text-[11px] text-rose-600\">\r\n                                {{ selectState[field.id]?.error }}\r\n                            </div>\r\n                        \r\n                            <div *ngIf=\"field.optionsSource?.mode === 'API'\r\n                                      && !selectState[field.id]?.loading\r\n                                      && !selectState[field.id]?.error\r\n                                      && (selectState[field.id]?.options?.length || 0) === 0\" class=\"mt-1 text-[11px] text-slate-500\">\r\n                                No options available.\r\n                            </div>\r\n                        \r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">Please select an option.</div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n\r\n                        <!-- CHECKBOX -->\r\n                        <ng-container *ngSwitchCase=\"'checkbox'\">\r\n                            <div class=\"flex items-center gap-2\">\r\n                                <input type=\"checkbox\" [formControlName]=\"controlKey(field)\" />\r\n                                <span class=\"text-xs text-gray-700\">Check</span>\r\n                            </div>\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['requiredTrue']\">Please check this box.</div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- RADIO -->\r\n                        <ng-container *ngSwitchCase=\"'radio'\">\r\n                            <div\r\n                                [ngClass]=\"field.optionDirection === 'horizontal' ? 'flex flex-row gap-4 items-center' : 'flex flex-col gap-1'\">\r\n                                <label *ngFor=\"let opt of field.options || []\"\r\n                                    class=\"inline-flex items-center gap-2 text-xs text-gray-700\">\r\n                                    <input type=\"radio\" [value]=\"opt.value\" [formControlName]=\"controlKey(field)\" />\r\n                                    <span>{{ opt.label }}</span>\r\n                                </label>\r\n                            </div>\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">Please choose an option.</div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- DATE -->\r\n                        <ng-container *ngSwitchCase=\"'date'\">\r\n                            <input type=\"date\" [formControlName]=\"controlKey(field)\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['min']\">Date should be on or after {{\r\n                                    field.validations?.min\r\n                                    }}.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['max']\">Date should be on or before {{\r\n                                    field.validations?.max\r\n                                    }}.</div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- FILE -->\r\n                        <ng-container *ngSwitchCase=\"'file'\">\r\n                            <div class=\"flex flex-col gap-2\">\r\n                                <div class=\"flex items-center gap-2\">\r\n                                    <input #fileInput type=\"file\" [attr.accept]=\"field.accept || null\"\r\n                                        [attr.multiple]=\"field.multiple ? '' : null\"\r\n                                        (change)=\"onFileChange($event, field)\" (blur)=\"ctrl(field)?.markAsTouched()\"\r\n                                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\r\n\r\n                                    <button *ngIf=\"fileNames(field).length\" type=\"button\"\r\n                                        class=\"px-2 py-1 text-[11px] border border-gray-300 rounded hover:bg-gray-100\"\r\n                                        (click)=\"clearFiles(field, fileInput)\">\r\n                                        Clear\r\n                                    </button>\r\n                                </div>\r\n\r\n                                <div class=\"text-[11px] text-gray-500\">\r\n                                    <span *ngIf=\"field.accept\">Allowed: {{ field.accept }}</span>\r\n                                    <span *ngIf=\"field.maxSizeMB\"> \u2022 Max {{ field.maxSizeMB }}MB per file</span>\r\n                                    <span *ngIf=\"field.maxFiles\"> \u2022 Max {{ field.maxFiles }} file(s)</span>\r\n                                </div>\r\n\r\n                                <div *ngIf=\"fileNames(field).length\" class=\"text-[11px] text-gray-600\">\r\n                                    Selected: {{ fileNames(field).join(', ') }}\r\n                                </div>\r\n                            </div>\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\r\n\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxFiles']\">\r\n                                    You can upload up to {{ ctrl(field)?.errors?.['maxFiles']?.max }} file(s).\r\n                                </div>\r\n\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxSizeMB']\">\r\n                                    {{ ctrl(field)?.errors?.['maxSizeMB']?.file }} is too large. Max\r\n                                    {{ ctrl(field)?.errors?.['maxSizeMB']?.max }}MB.\r\n                                </div>\r\n\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['accept']\">\r\n                                    {{ ctrl(field)?.errors?.['accept']?.file }} is not an allowed file type.\r\n                                </div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- DEFAULT -->\r\n                        <ng-container *ngSwitchDefault>\r\n                            <input type=\"text\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\r\n                        </ng-container>\r\n\r\n                    </ng-container>\r\n                </ng-template>\r\n            </ng-template>\r\n        </ng-template>\r\n    </form>\r\n</div>", styles: [".amigo-loading{padding:12px;opacity:.85}.amigo-error{padding:12px;border:1px solid #ef4444;border-radius:8px;color:#ef4444}.amigo-form-root{width:100%;box-sizing:border-box}.amigo-header{margin-bottom:12px}.amigo-title{font-size:18px;font-weight:700}.amigo-desc{margin-top:4px;opacity:.8}.amigo-grid{width:100%}.amigo-field{display:block}.amigo-label{display:block;font-size:13px;margin-bottom:6px;font-weight:600}.amigo-required{color:#ef4444;margin-left:4px}.amigo-input{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:14px}.amigo-hint{margin-top:6px;font-size:12px;opacity:.75}.amigo-field-error{margin-top:6px;font-size:12px;color:#ef4444}.amigo-checkbox{display:flex;align-items:center;gap:8px}.amigo-radio{display:flex;flex-direction:column;gap:6px}.amigo-radio-item{display:inline-flex;align-items:center;gap:8px}.amigo-section{margin-bottom:18px}.amigo-section-title{font-weight:700;margin-bottom:10px}.amigo-actions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.amigo-btn{padding:8px 12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer}.amigo-primary{border-color:#111827;background:#111827;color:#fff}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i4.NgClass, selector: "[ngClass]", inputs: ["class", "ngClass"] }, { kind: "directive", type: i4.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i4.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i4.NgTemplateOutlet, selector: "[ngTemplateOutlet]", inputs: ["ngTemplateOutletContext", "ngTemplateOutlet", "ngTemplateOutletInjector"] }, { kind: "directive", type: i4.NgStyle, selector: "[ngStyle]", inputs: ["ngStyle"] }, { kind: "directive", type: i4.NgSwitch, selector: "[ngSwitch]", inputs: ["ngSwitch"] }, { kind: "directive", type: i4.NgSwitchCase, selector: "[ngSwitchCase]", inputs: ["ngSwitchCase"] }, { kind: "directive", type: i4.NgSwitchDefault, selector: "[ngSwitchDefault]" }, { kind: "ngmodule", type: ReactiveFormsModule }, { kind: "directive", type: i5.ɵNgNoValidate, selector: "form:not([ngNoForm]):not([ngNativeValidate])" }, { kind: "directive", type: i5.NgSelectOption, selector: "option", inputs: ["ngValue", "value"] }, { kind: "directive", type: i5.ɵNgSelectMultipleOption, selector: "option", inputs: ["ngValue", "value"] }, { kind: "directive", type: i5.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i5.NumberValueAccessor, selector: "input[type=number][formControlName],input[type=number][formControl],input[type=number][ngModel]" }, { kind: "directive", type: i5.CheckboxControlValueAccessor, selector: "input[type=checkbox][formControlName],input[type=checkbox][formControl],input[type=checkbox][ngModel]" }, { kind: "directive", type: i5.SelectControlValueAccessor, selector: "select:not([multiple])[formControlName],select:not([multiple])[formControl],select:not([multiple])[ngModel]", inputs: ["compareWith"] }, { kind: "directive", type: i5.RadioControlValueAccessor, selector: "input[type=radio][formControlName],input[type=radio][formControl],input[type=radio][ngModel]", inputs: ["name", "formControlName", "value"] }, { kind: "directive", type: i5.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i5.NgControlStatusGroup, selector: "[formGroupName],[formArrayName],[ngModelGroup],[formGroup],[formArray],form:not([ngNoForm]),[ngForm]" }, { kind: "directive", type: i5.FormGroupDirective, selector: "[formGroup]", inputs: ["formGroup"], outputs: ["ngSubmit"], exportAs: ["ngForm"] }, { kind: "directive", type: i5.FormControlName, selector: "[formControlName]", inputs: ["formControlName", "disabled", "ngModel"], outputs: ["ngModelChange"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoFormComponent, decorators: [{
            type: Component,
            args: [{ selector: "amigo-form", standalone: true, imports: [CommonModule, ReactiveFormsModule], template: "<div class=\"w-full h-full flex flex-col mb-6 overflow-auto\">\r\n\r\n    <!-- Loading -->\r\n    <div *ngIf=\"isLoading\" class=\"flex items-center justify-center p-6 text-sm text-gray-600\">\r\n        Loading form\u2026\r\n    </div>\r\n\r\n    <!-- Error -->\r\n    <div *ngIf=\"loadError\" class=\"p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\">\r\n        {{ loadError }}\r\n    </div>\r\n\r\n    <!-- Empty -->\r\n    <div *ngIf=\"!isLoading && !loadError && (!resolvedSchema?.fields || resolvedSchema.fields.length === 0)\"\r\n        class=\"flex justify-center items-center h-100 border border-dotted border-gray-300 rounded-xl bg-white\">\r\n        <h2 class=\"text-sm text-gray-600\">No fields found for this form schema.</h2>\r\n    </div>\r\n\r\n    <form *ngIf=\"!isLoading && !loadError && resolvedSchema?.fields?.length && form\" [formGroup]=\"form\" class=\"text-sm\"\r\n        [ngStyle]=\"getFormStyle()\" [ngClass]=\"resolvedSchema?.style?.formClass || ''\" (ngSubmit)=\"submit()\">\r\n        <h2 class=\"text-2xl my-2\">{{ resolvedSchema.name }}</h2>\r\n\r\n        <p *ngIf=\"resolvedSchema.description\" class=\"text-[13px] text-gray-500 mb-4\">\r\n            {{ resolvedSchema.description }}\r\n        </p>\r\n\r\n        <!-- MULTI STEP PROGRESS -->\r\n        <div *ngIf=\"isMultiStep\" class=\"w-full mb-6 flex flex-col items-center my-3\">\r\n\r\n            <!-- progress bar -->\r\n            <div class=\"w-full h-1 bg-gray-200 rounded-full relative mb-6\">\r\n                <div class=\"h-1 rounded-full transition-all duration-300\" [ngStyle]=\"{\r\n                width: ((activeStepIndex + 1) / totalSteps) * 100 + '%',\r\n                backgroundColor: submitButtonStyle['backgroundColor']\r\n              }\">\r\n                </div>\r\n            </div>\r\n\r\n            <!-- step circles -->\r\n            <div class=\"flex items-center justify-center gap-10\">\r\n                <div *ngFor=\"let step of orderedSteps; let i = index\" class=\"flex flex-col items-center cursor-pointer\"\r\n                    (click)=\"setActiveStep(i)\">\r\n\r\n                    <div class=\"w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all duration-300\"\r\n                        [ngStyle]=\"\r\n                  i === activeStepIndex\r\n                    ? {\r\n                        backgroundColor: submitButtonStyle['backgroundColor'],\r\n                        borderColor: submitButtonStyle['backgroundColor'],\r\n                        color: submitButtonStyle['color']\r\n                      }\r\n                    : {\r\n                        backgroundColor: '#FFFFFF',\r\n                        borderColor: '#9CA3AF',\r\n                        color: '#374151'\r\n                      }\r\n                \">\r\n\r\n                        <!-- if no icon -->\r\n                        <ng-container *ngIf=\"!step.icon\">\r\n                            {{ i + 1 }}\r\n                        </ng-container>\r\n\r\n                        <!-- if icon -->\r\n                        <ng-container *ngIf=\"step.icon\">\r\n                            <i [class]=\"step.icon\" class=\"text-lg\" [ngStyle]=\"\r\n                      i === activeStepIndex\r\n                        ? { color: submitButtonStyle['color'] }\r\n                        : { color: '#6B7280' }\r\n                    \">\r\n                            </i>\r\n                        </ng-container>\r\n\r\n                    </div>\r\n\r\n                    <div class=\"mt-2 text-xs text-gray-600 font-medium\">\r\n                        {{ step.label }}\r\n                    </div>\r\n                </div>\r\n            </div>\r\n\r\n            <div *ngIf=\"visibleFields.length === 0\" class=\"text-xs text-gray-500 my-5\">\r\n                No fields assigned to this step yet.\r\n            </div>\r\n        </div>\r\n\r\n\r\n        <!-- SINGLE-SECTIONAL MODE -->\r\n        <div *ngIf=\"isSectional; else normalOrMulti\">\r\n            <div *ngFor=\"let sec of orderedSections\" class=\"mb-6\">\r\n                <div class=\"flex items-center justify-between mb-2 border-b border-gray-200 pb-2\">\r\n                    <h3 class=\"text-[11px] font-semibold uppercase text-blue-700\">{{ sec.label }}</h3>\r\n                    <span class=\"text-[11px] text-gray-500\">{{ fieldsForSection(sec.id).length }} fields</span>\r\n                </div>\r\n\r\n                <div class=\"grid\" [ngStyle]=\"{\r\n            'grid-template-columns': 'repeat(' + (resolvedSchema.layout?.columns || 1) + ', minmax(0, 1fr))',\r\n            'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\r\n            'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px'\r\n          }\">\r\n                    <div *ngFor=\"let field of fieldsForSection(sec.id); trackBy: trackByFieldId\"\r\n                        [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\r\n                        [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\">\r\n                        <ng-container *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"></ng-container>\r\n                    </div>\r\n                </div>\r\n\r\n                <div *ngIf=\"fieldsForSection(sec.id).length === 0\" class=\"text-xs text-gray-500 mt-2\">\r\n                    No fields in this section yet.\r\n                </div>\r\n            </div>\r\n        </div>\r\n\r\n        <!-- NORMAL (single) + MULTI -->\r\n        <ng-template #normalOrMulti>\r\n            <div class=\"grid\" [ngStyle]=\"{\r\n          'grid-template-columns': 'repeat(' + (resolvedSchema.layout?.columns || 1) + ', minmax(0, 1fr))',\r\n          'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\r\n          'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px'\r\n        }\">\r\n                <div *ngFor=\"let field of visibleFields; trackBy: trackByFieldId\"\r\n                    [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\r\n                    [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\">\r\n                    <ng-container *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"></ng-container>\r\n                </div>\r\n            </div>\r\n        </ng-template>\r\n\r\n        <!-- Multi-step nav -->\r\n        <div *ngIf=\"isMultiStep\" class=\"mt-4 flex items-center justify-between text-xs\">\r\n            <button type=\"button\" class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\r\n                (click)=\"prevStep()\" [disabled]=\"activeStepIndex === 0\">\r\n                \u2190 Previous step\r\n            </button>\r\n\r\n            <button type=\"button\" class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\r\n                (click)=\"nextStep()\" [disabled]=\"activeStepIndex === totalSteps - 1\">\r\n                Next step \u2192\r\n            </button>\r\n        </div>\r\n\r\n        <!-- Submit error (API) -->\r\n        <div *ngIf=\"submitError\" class=\"mt-3 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\">\r\n            {{ submitError }}\r\n        </div>\r\n\r\n        <!-- Actions -->\r\n        <div class=\"mt-4 flex items-center gap-2\">\r\n            <button type=\"submit\" (mouseenter)=\"isSubmitHovered = true\" (mouseleave)=\"isSubmitHovered = false\"\r\n                [ngStyle]=\"submitButtonStyle\" [disabled]=\"isSubmitting\"\r\n                [ngClass]=\"resolvedSchema.style?.buttonClass || 'px-4 py-2 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed'\">\r\n                {{ isSubmitting ? 'Submitting...' : (resolvedSchema.actions?.submitLabel || 'Submit') }}\r\n            </button>\r\n\r\n            <button *ngIf=\"showCancelButton\" type=\"button\" (click)=\"onCancel()\" (mouseenter)=\"isCancelHovered = true\"\r\n                (mouseleave)=\"isCancelHovered = false\" [disabled]=\"isSubmitting\" [ngStyle]=\"cancelButtonStyle\"\r\n                [ngClass]=\"resolvedSchema.style?.buttonClass || 'px-4 py-2 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed'\">\r\n                {{ resolvedSchema.actions?.cancelLabel || 'Cancel' }}\r\n            </button>\r\n        </div>\r\n\r\n\r\n        <!-- Field renderer template -->\r\n        <ng-template #fieldRenderer let-field>\r\n            <!-- INFO CARD (non-input block) -->\r\n            <ng-container *ngIf=\"isCard(field); else notCard\">\r\n                <div [ngStyle]=\"cardStyle(field)\" class=\"w-full flex items-start gap-3\">\r\n                    <!-- Icon -->\r\n                    <div class=\"shrink-0 mt-0.5 text-lg leading-none\" [ngStyle]=\"cardIconStyle(field)\">\r\n                        <i *ngIf=\"isBootstrapIcon(cardIcon(field))\" [class]=\"cardIcon(field)\"></i>\r\n                        <span *ngIf=\"!isBootstrapIcon(cardIcon(field))\">{{ cardIcon(field) }}</span>\r\n                    </div>\r\n\r\n                    <!-- Content -->\r\n                    <div class=\"min-w-0\">\r\n                        <div class=\"text-sm font-semibold leading-tight\">\r\n                            {{ cardTitle(field) }}\r\n                        </div>\r\n\r\n                        <div *ngIf=\"cardBody(field)\" class=\"mt-1 text-xs opacity-90\">\r\n                            {{ cardBody(field) }}\r\n                        </div>\r\n                    </div>\r\n                </div>\r\n            </ng-container>\r\n\r\n            <ng-template #notCard>\r\n\r\n                <!-- BUTTON (non-input block) -->\r\n                <ng-container *ngIf=\"isButton(field); else inputField\">\r\n                    <div class=\"w-full\">\r\n                        <button type=\"button\" (click)=\"onSchemaButtonClick(field)\" [disabled]=\"buttonLoading[field.id]\"\r\n                            class=\"px-4 py-2 rounded-lg text-sm font-semibold border transition\" [ngClass]=\"[\r\n                                  (field.button?.styleVariant || 'primary') === 'primary' ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' :\r\n                                  (field.button?.styleVariant || 'primary') === 'danger' ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' :\r\n                                  'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'\r\n                                ]\">\r\n                            {{ field.button?.label || field.label }}\r\n                            <span *ngIf=\"buttonLoading[field.id]\" class=\"ml-2 text-xs opacity-80\">\u2026</span>\r\n                        </button>\r\n\r\n                        <div *ngIf=\"buttonFeedback[field.id]\" class=\"mt-2 text-xs rounded-lg px-3 py-2 border\"\r\n                            [ngClass]=\"buttonFeedback[field.id].type === 'success'\r\n                               ? 'bg-emerald-50 border-emerald-200 text-emerald-800'\r\n                               : 'bg-rose-50 border-rose-200 text-rose-800'\">\r\n                            {{ buttonFeedback[field.id].message }}\r\n                        </div>\r\n                    </div>\r\n                </ng-container>\r\n\r\n\r\n                <!-- INPUT FIELD -->\r\n                <ng-template #inputField>\r\n                    <label [ngClass]=\"resolvedSchema?.style?.labelClass || 'block text-sm font-medium mb-1'\">\r\n                        {{ field.label }}\r\n                        <span\r\n                            *ngIf=\"field.required === true || field.required === 'true' || field.validations?.required\"\r\n                            class=\"text-red-500\">*</span>\r\n                    </label>\r\n\r\n                    <ng-container [ngSwitch]=\"field.type\">\r\n\r\n                        <!-- TEXT -->\r\n                        <ng-container *ngSwitchCase=\"'text'\">\r\n                            <input type=\"text\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                                    Minimum {{ field.validations?.minLength }} characters required.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\r\n                                </div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- PASSWORD -->\r\n                        <ng-container *ngSwitchCase=\"'password'\">\r\n                            <input type=\"password\" [placeholder]=\"field.placeholder\"\r\n                                [formControlName]=\"controlKey(field)\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                                    Minimum {{ field.validations?.minLength }} characters required.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\r\n                                </div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- NUMBER -->\r\n                        <ng-container *ngSwitchCase=\"'number'\">\r\n                            <input type=\"number\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['min']\">Value should be \u2265 {{ field.validations?.min\r\n                                    }}.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['max']\">Value should be \u2264 {{ field.validations?.max\r\n                                    }}.</div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- EMAIL -->\r\n                        <ng-container *ngSwitchCase=\"'email'\">\r\n                            <input type=\"email\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['email']\">Please enter a valid email address.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                                    Minimum {{ field.validations?.minLength }} characters required.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\r\n                                </div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- TEXTAREA -->\r\n                        <ng-container *ngSwitchCase=\"'textarea'\">\r\n                            <textarea [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\" rows=\"4\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\"></textarea>\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                                    Minimum {{ field.validations?.minLength }} characters required.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                                    Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                                </div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.\r\n                                </div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- SELECT -->\r\n                        <ng-container *ngSwitchCase=\"'select'\">\r\n                            <select [formControlName]=\"controlKey(field)\" [disabled]=\"selectState[field.id]?.loading\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\">\r\n                                <option value=\"\">Select an option</option>\r\n                        \r\n                                <ng-container *ngFor=\"let opt of (field.optionsSource?.mode === 'API'\r\n                              ? (selectState[field.id]?.options || [])\r\n                              : (field.options || []))\">\r\n                                    <option [value]=\"opt.value\">{{ opt.label }}</option>\r\n                                </ng-container>\r\n                            </select>\r\n                        \r\n                            <div *ngIf=\"field.optionsSource?.mode === 'API' && selectState[field.id]?.loading\"\r\n                                class=\"mt-1 text-[11px] text-slate-500\">\r\n                                Loading options\u2026\r\n                            </div>\r\n                        \r\n                            <div *ngIf=\"field.optionsSource?.mode === 'API' && selectState[field.id]?.error\"\r\n                                class=\"mt-1 text-[11px] text-rose-600\">\r\n                                {{ selectState[field.id]?.error }}\r\n                            </div>\r\n                        \r\n                            <div *ngIf=\"field.optionsSource?.mode === 'API'\r\n                                      && !selectState[field.id]?.loading\r\n                                      && !selectState[field.id]?.error\r\n                                      && (selectState[field.id]?.options?.length || 0) === 0\" class=\"mt-1 text-[11px] text-slate-500\">\r\n                                No options available.\r\n                            </div>\r\n                        \r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">Please select an option.</div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n\r\n                        <!-- CHECKBOX -->\r\n                        <ng-container *ngSwitchCase=\"'checkbox'\">\r\n                            <div class=\"flex items-center gap-2\">\r\n                                <input type=\"checkbox\" [formControlName]=\"controlKey(field)\" />\r\n                                <span class=\"text-xs text-gray-700\">Check</span>\r\n                            </div>\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['requiredTrue']\">Please check this box.</div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- RADIO -->\r\n                        <ng-container *ngSwitchCase=\"'radio'\">\r\n                            <div\r\n                                [ngClass]=\"field.optionDirection === 'horizontal' ? 'flex flex-row gap-4 items-center' : 'flex flex-col gap-1'\">\r\n                                <label *ngFor=\"let opt of field.options || []\"\r\n                                    class=\"inline-flex items-center gap-2 text-xs text-gray-700\">\r\n                                    <input type=\"radio\" [value]=\"opt.value\" [formControlName]=\"controlKey(field)\" />\r\n                                    <span>{{ opt.label }}</span>\r\n                                </label>\r\n                            </div>\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">Please choose an option.</div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- DATE -->\r\n                        <ng-container *ngSwitchCase=\"'date'\">\r\n                            <input type=\"date\" [formControlName]=\"controlKey(field)\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['min']\">Date should be on or after {{\r\n                                    field.validations?.min\r\n                                    }}.</div>\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['max']\">Date should be on or before {{\r\n                                    field.validations?.max\r\n                                    }}.</div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- FILE -->\r\n                        <ng-container *ngSwitchCase=\"'file'\">\r\n                            <div class=\"flex flex-col gap-2\">\r\n                                <div class=\"flex items-center gap-2\">\r\n                                    <input #fileInput type=\"file\" [attr.accept]=\"field.accept || null\"\r\n                                        [attr.multiple]=\"field.multiple ? '' : null\"\r\n                                        (change)=\"onFileChange($event, field)\" (blur)=\"ctrl(field)?.markAsTouched()\"\r\n                                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\r\n\r\n                                    <button *ngIf=\"fileNames(field).length\" type=\"button\"\r\n                                        class=\"px-2 py-1 text-[11px] border border-gray-300 rounded hover:bg-gray-100\"\r\n                                        (click)=\"clearFiles(field, fileInput)\">\r\n                                        Clear\r\n                                    </button>\r\n                                </div>\r\n\r\n                                <div class=\"text-[11px] text-gray-500\">\r\n                                    <span *ngIf=\"field.accept\">Allowed: {{ field.accept }}</span>\r\n                                    <span *ngIf=\"field.maxSizeMB\"> \u2022 Max {{ field.maxSizeMB }}MB per file</span>\r\n                                    <span *ngIf=\"field.maxFiles\"> \u2022 Max {{ field.maxFiles }} file(s)</span>\r\n                                </div>\r\n\r\n                                <div *ngIf=\"fileNames(field).length\" class=\"text-[11px] text-gray-600\">\r\n                                    Selected: {{ fileNames(field).join(', ') }}\r\n                                </div>\r\n                            </div>\r\n\r\n                            <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\r\n\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxFiles']\">\r\n                                    You can upload up to {{ ctrl(field)?.errors?.['maxFiles']?.max }} file(s).\r\n                                </div>\r\n\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['maxSizeMB']\">\r\n                                    {{ ctrl(field)?.errors?.['maxSizeMB']?.file }} is too large. Max\r\n                                    {{ ctrl(field)?.errors?.['maxSizeMB']?.max }}MB.\r\n                                </div>\r\n\r\n                                <div *ngIf=\"ctrl(field)?.errors?.['accept']\">\r\n                                    {{ ctrl(field)?.errors?.['accept']?.file }} is not an allowed file type.\r\n                                </div>\r\n                            </div>\r\n                        </ng-container>\r\n\r\n                        <!-- DEFAULT -->\r\n                        <ng-container *ngSwitchDefault>\r\n                            <input type=\"text\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\r\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\r\n                        </ng-container>\r\n\r\n                    </ng-container>\r\n                </ng-template>\r\n            </ng-template>\r\n        </ng-template>\r\n    </form>\r\n</div>", styles: [".amigo-loading{padding:12px;opacity:.85}.amigo-error{padding:12px;border:1px solid #ef4444;border-radius:8px;color:#ef4444}.amigo-form-root{width:100%;box-sizing:border-box}.amigo-header{margin-bottom:12px}.amigo-title{font-size:18px;font-weight:700}.amigo-desc{margin-top:4px;opacity:.8}.amigo-grid{width:100%}.amigo-field{display:block}.amigo-label{display:block;font-size:13px;margin-bottom:6px;font-weight:600}.amigo-required{color:#ef4444;margin-left:4px}.amigo-input{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:14px}.amigo-hint{margin-top:6px;font-size:12px;opacity:.75}.amigo-field-error{margin-top:6px;font-size:12px;color:#ef4444}.amigo-checkbox{display:flex;align-items:center;gap:8px}.amigo-radio{display:flex;flex-direction:column;gap:6px}.amigo-radio-item{display:inline-flex;align-items:center;gap:8px}.amigo-section{margin-bottom:18px}.amigo-section-title{font-weight:700;margin-bottom:10px}.amigo-actions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.amigo-btn{padding:8px 12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer}.amigo-primary{border-color:#111827;background:#111827;color:#fff}\n"] }]
        }], ctorParameters: () => [{ type: AmigoFormService }, { type: i0.ChangeDetectorRef }, { type: i0.NgZone }, { type: AmigoApiExecutionService }, { type: AmigoSelectOptionsService }], propDecorators: { formId: [{
                type: Input
            }], schema: [{
                type: Input
            }], initialValue: [{
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

export { AMIGO_AUTH_TOKEN_PROVIDER, AMIGO_FORM_CONFIG, AMIGO_SKIP_AUTH, AmigoFormComponent, AmigoFormService, AmigoTokenInterceptor, buildFormGroup, normalizeAccept, provideAmigoForm };
//# sourceMappingURL=amigo-amigo-form-renderer.mjs.map
