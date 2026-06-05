import * as i0 from '@angular/core';
import { InjectionToken, Optional, Inject, Injectable, EventEmitter, ViewChild, Input, Output, Component } from '@angular/core';
import * as i5 from '@angular/common';
import { CommonModule } from '@angular/common';
import * as i6 from '@angular/forms';
import { Validators, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import * as i4 from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { tap, map, catchError, finalize } from 'rxjs/operators';
import * as i1 from '@angular/common/http';
import { HTTP_INTERCEPTORS, HttpHeaders, HttpParams } from '@angular/common/http';
import { of, throwError } from 'rxjs';

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
        if (this.cfg?.apiBaseUrl || this.cfg?.selectOptionsBaseUrl) {
            const bases = [this.cfg.apiBaseUrl, this.cfg.selectOptionsBaseUrl]
                .filter((b) => !!b)
                .map((b) => b.replace(/\/+$/, ''));
            const isAmigoCall = req.url.startsWith('/') || bases.some((b) => req.url.startsWith(b));
            if (!isAmigoCall)
                return next.handle(req);
        }
        return next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoTokenInterceptor, deps: [{ token: AMIGO_AUTH_TOKEN_PROVIDER, optional: true }, { token: AMIGO_FORM_CONFIG, optional: true }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoTokenInterceptor });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoTokenInterceptor, decorators: [{
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
        out = out.replace(/\{([^}]+)\}/g, (m, k) => {
            const key = k.trim();
            return has(key) ? enc(params[key]) : m;
        });
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoApiExecutionService, deps: [{ token: i1.HttpClient }, { token: AMIGO_FORM_CONFIG, optional: true }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoApiExecutionService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoApiExecutionService, decorators: [{
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoFormService, deps: [{ token: i1.HttpClient }, { token: AmigoApiExecutionService }, { token: AMIGO_FORM_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoFormService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoFormService, decorators: [{
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
    rawCache = new Map();
    constructor(http, cfg, tokenProvider) {
        this.http = http;
        this.cfg = cfg;
        this.tokenProvider = tokenProvider;
    }
    load(field, _formValue) {
        const api = field.optionsSource?.api;
        if (!api?.url)
            return of([]);
        const cacheKey = `${field.id}::${api.method || "GET"}::${api.url}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return of(cached);
        const url = this.resolveUrl(api.url);
        const method = (api.method || "GET").toUpperCase();
        const shouldBearer = api.secured === true && api.authType === "BEARER";
        let headers = new HttpHeaders();
        if (!shouldBearer) {
            headers = headers.set("X-Amigo-Skip-Auth", "1");
        }
        else {
            const token = this.resolveToken(api);
            if (token)
                headers = headers.set("Authorization", `Bearer ${token}`);
        }
        return this.http.request(method, url, { headers }).pipe(tap((res) => this.rawCache.set(field.id, res)), map((res) => this.mapOptions(res, api)), tap((opts) => this.cache.set(cacheKey, opts)), catchError((err) => {
            const msg = err?.error?.message || err?.message || "Failed to load options.";
            return throwError(() => new Error(msg));
        }));
    }
    clear(fieldId) {
        if (!fieldId) {
            this.cache.clear();
            this.rawCache.clear();
            return;
        }
        for (const k of [...this.cache.keys()]) {
            if (k.startsWith(fieldId + "::"))
                this.cache.delete(k);
        }
        this.rawCache.delete(fieldId);
    }
    getRawResponse(fieldId) {
        return this.rawCache.get(fieldId) ?? null;
    }
    resolveUrl(url) {
        const u = (url || "").trim();
        if (!u)
            return u;
        if (/^https?:\/\//i.test(u))
            return u;
        // Use selectOptionsBaseUrl if available, otherwise fall back into apiBaseUrl
        const base = (this.cfg?.selectOptionsBaseUrl ||
            this.cfg?.apiBaseUrl ||
            "").replace(/\/+$/, "");
        if (!base)
            return u.startsWith("/") ? u : "/" + u;
        if (u.startsWith("/"))
            return base + u;
        return base + "/" + u;
    }
    resolveToken(api) {
        const key = api.tokenKey || "access_token";
        if (api.tokenFrom === "SESSION_STORAGE") {
            return sessionStorage.getItem(key);
        }
        if (api.tokenFrom === "LOCAL_STORAGE" || !api.tokenFrom) {
            return localStorage.getItem(key);
        }
        if (api.tokenFrom === "CUSTOM_CALLBACK") {
            return this.tokenProvider?.() || null;
        }
        return null;
    }
    mapOptions(res, api) {
        const rm = api.responseMapping;
        const labelKey = rm?.labelKey || "label";
        const valueKey = rm?.valueKey || "value";
        const data = rm?.dataPath ? this.getByPath(res, rm.dataPath) : res;
        const arr = Array.isArray(data)
            ? data
            : Array.isArray(data?.items)
                ? data.items
                : [];
        return arr
            .map((item) => ({
            label: item?.[labelKey] ?? "",
            value: item?.[valueKey],
        }))
            .filter((o) => o.label !== "" && o.value !== undefined);
    }
    getByPath(obj, path) {
        if (!obj || !path)
            return obj;
        return path
            .split(".")
            .reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoSelectOptionsService, deps: [{ token: i1.HttpClient }, { token: AMIGO_FORM_CONFIG, optional: true }, { token: AMIGO_AUTH_TOKEN_PROVIDER, optional: true }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoSelectOptionsService, providedIn: "root" });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoSelectOptionsService, decorators: [{
            type: Injectable,
            args: [{ providedIn: "root" }]
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
    dialog;
    formId;
    schema;
    initialValue;
    submitPathParams;
    submitQueryParams;
    submitted = new EventEmitter();
    submitFailed = new EventEmitter();
    isLoading = false;
    loadError = null;
    isSubmitting = false;
    resolvedSchema = null;
    form = null;
    activeStepIndex = 0;
    submitLoading = false;
    submitFeedback;
    isSubmitHovered = false;
    hoverState = {};
    selectState = {};
    buttonLoading = {};
    buttonFeedback = {};
    showReviewDialog = false;
    isReviewed = false;
    reviewDialogTemplate;
    visibilitySub;
    visibilityState = {};
    visibilityUpdating = false;
    cascadingSubs = [];
    constructor(formService, cdr, zone, apiExec, selectOptions, dialog) {
        this.formService = formService;
        this.cdr = cdr;
        this.zone = zone;
        this.apiExec = apiExec;
        this.selectOptions = selectOptions;
        this.dialog = dialog;
    }
    ngOnChanges(changes) {
        if (changes["schema"] || changes["formId"]) {
            this.init();
        }
        if (changes["initialValue"] && this.resolvedSchema) {
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
            this.loadError = "No schema or formId provided.";
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
            if (f.dependentSelect)
                continue; // skip child selects — they load via parent
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
        this.isReviewed = false;
        this.form = buildFormGroup(this.resolvedSchema.fields, this.initialValue);
        this.patchInitialValue();
        this.setupVisibility();
        this.preloadApiSelectOptions();
        this.setupCascadingSelects();
    }
    setupCascadingSelects() {
        // Clean up old subscriptions
        this.cascadingSubs.forEach((s) => s.unsubscribe());
        this.cascadingSubs = [];
        const fields = this.resolvedSchema?.fields ?? [];
        const childFields = fields.filter((f) => f.type === "select" && f.dependentSelect);
        for (const child of childFields) {
            const dep = child.dependentSelect;
            const parentField = fields.find((f) => f.id === dep.parentFieldId);
            if (!parentField)
                continue;
            const parentKey = this.controlKey(parentField);
            const parentCtrl = this.form?.get(parentKey);
            if (!parentCtrl)
                continue;
            // Initialize child as empty
            this.selectState[child.id] = { loading: false, options: [] };
            const sub = parentCtrl.valueChanges.subscribe((parentValue) => {
                this.updateChildOptions(child, dep, parentValue);
            });
            this.cascadingSubs.push(sub);
            // If parent already has a value, populate child immediately
            const currentParentValue = parentCtrl.value;
            if (currentParentValue) {
                this.updateChildOptions(child, dep, currentParentValue);
            }
        }
    }
    updateChildOptions(child, dep, parentValue) {
        const childKey = this.controlKey(child);
        const childCtrl = this.form?.get(childKey);
        if (!parentValue || parentValue === "") {
            this.selectState[child.id] = { loading: false, options: [] };
            if (childCtrl) {
                childCtrl.setValue("", { emitEvent: false });
            }
            this.cdr.detectChanges();
            return;
        }
        // Get the parent's raw response
        const rawResponse = this.selectOptions.getRawResponse(dep.parentFieldId);
        if (!rawResponse) {
            this.selectState[child.id] = { loading: false, options: [] };
            this.cdr.detectChanges();
            return;
        }
        // Find the parent field to determine its response mapping
        const fields = this.resolvedSchema?.fields ?? [];
        const parentField = fields.find((f) => f.id === dep.parentFieldId);
        const parentApi = parentField?.optionsSource?.api;
        const parentDataPath = parentApi?.responseMapping?.dataPath;
        const parentValueKey = parentApi?.responseMapping?.valueKey || "value";
        // Get the array of parent items from the raw response
        let parentItems;
        if (parentDataPath) {
            parentItems = this.getByPath(rawResponse, parentDataPath);
        }
        else {
            parentItems = rawResponse;
        }
        if (!Array.isArray(parentItems)) {
            this.selectState[child.id] = { loading: false, options: [] };
            this.cdr.detectChanges();
            return;
        }
        // Find the selected parent item
        const selectedParent = parentItems.find((item) => String(item?.[parentValueKey]) === String(parentValue));
        if (!selectedParent) {
            this.selectState[child.id] = { loading: false, options: [] };
            if (childCtrl) {
                childCtrl.setValue("", { emitEvent: false });
            }
            this.cdr.detectChanges();
            return;
        }
        // Extract child items from the parent item
        const childItems = this.getByPath(selectedParent, dep.childDataPath);
        const childOptions = Array.isArray(childItems)
            ? childItems
                .map((item) => ({
                label: String(item?.[dep.labelKey] ?? ""),
                value: item?.[dep.valueKey],
            }))
                .filter((o) => o.label !== "" && o.value !== undefined)
            : [];
        this.selectState[child.id] = { loading: false, options: childOptions };
        // Reset child value since parent changed
        if (childCtrl) {
            childCtrl.setValue("", { emitEvent: false });
        }
        this.cdr.detectChanges();
    }
    getByPath(obj, path) {
        if (!obj || !path)
            return obj;
        return path
            .split(".")
            .reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
    }
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
        if (typeof field.maxFiles === "number" && field.maxFiles > 0) {
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
        return this.fieldsForStep(this.activeStepIndex);
    }
    fieldsForStep(index) {
        const s = this.resolvedSchema;
        if (!s)
            return [];
        if (s.formType === "multi" && this.totalSteps > 0) {
            if (index < 0 || index >= this.totalSteps)
                return [];
            const step = this.orderedSteps[index];
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
        return (s.fields ?? [])
            .filter((f) => ids.has(f.id))
            .filter((f) => this.isFieldVisible(f));
    }
    setActiveStep(i) {
        if (i < 0 || i >= this.totalSteps)
            return;
        if (i === this.activeStepIndex)
            return;
        if (i > this.activeStepIndex) {
            // Validate all steps from 0 up to i-1
            for (let stepIdx = 0; stepIdx < i; stepIdx++) {
                const fields = this.fieldsForStep(stepIdx);
                this.touchFields(fields);
                if (this.hasErrors(fields)) {
                    this.activeStepIndex = stepIdx;
                    return;
                }
            }
        }
        this.activeStepIndex = i;
    }
    prevStep() {
        this.setActiveStep(this.activeStepIndex - 1);
    }
    nextStep() {
        this.setActiveStep(this.activeStepIndex + 1);
    }
    async submit(triggerField) {
        if (!this.resolvedSchema || !this.form)
            return;
        this.submitFeedback = undefined;
        let btnField = triggerField;
        if (!btnField && this.resolvedSchema.fields) {
            btnField = this.resolvedSchema.fields.find((f) => f.type === 'button' && f.button?.isSubmit);
        }
        const btn = btnField?.button;
        const triggerValidation = btn?.triggerValidation !== false;
        if (triggerValidation) {
            this.form.markAllAsTouched();
            if (this.form.invalid)
                return;
        }
        const formValue = this.normalizeFormValue();
        const location = await this.getCaptureLocation();
        formValue.geo_location = location;
        const endpoint = btn?.api;
        if (!btnField || !endpoint || !endpoint.url) {
            this.submitted.emit(formValue);
            return;
        }
        this.isSubmitting = true;
        // For isSubmit: true, we send the entire form data as body, bypassing bodyMapping
        const apiConfig = { ...endpoint, bodyMapping: null };
        this.apiExec
            .execute(apiConfig, {
            formValue,
            pathParams: this.submitPathParams,
            queryParams: this.submitQueryParams,
        })
            .pipe(finalize(() => (this.isSubmitting = false)))
            .subscribe({
            next: (res) => {
                this.submitFeedback = {
                    type: "success",
                    message: btn.successMessage || "Submitted successfully.",
                };
                this.submitted.emit({
                    url: apiConfig.url,
                    method: apiConfig.method || 'POST',
                    payload: formValue,
                    headers: apiConfig.headers || [],
                    params: apiConfig.queryParams || [],
                    response: res,
                });
            },
            error: (err) => {
                this.submitFeedback = {
                    type: "error",
                    message: btn.errorMessage ||
                        err?.error?.message ||
                        err?.message ||
                        "Failed to submit. Please try again.",
                };
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
            borderStyle: st.borderWidth ? "solid" : null,
            borderWidth: st.borderWidth ? px(st.borderWidth) : null,
            borderColor: st.borderColor ?? null,
            borderRadius: st.borderRadius ? px(st.borderRadius) : null,
        };
    }
    isBootstrapIcon(icon) {
        const v = (icon || "").trim();
        return v.startsWith("bi ") || v.startsWith("bi-") || v.includes(" bi-");
    }
    isEmptyInput(v) {
        return v === "" || v === null || v === undefined;
    }
    resolveEmptyValue(field) {
        const mode = field?.emptyValue;
        if (mode === "null")
            return null;
        if (mode === "undefined")
            return undefined;
        if (mode === "empty_string")
            return "";
        // default: null for numbers, empty string for everything else
        return field?.type === "number" ? null : "";
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
            if (field.type === "file") {
                continue;
            }
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
            if (field.type === "date" && incoming) {
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
            if (field.type === "number") {
                normalized[key] =
                    value === "" || value === undefined || value === null
                        ? this.resolveEmptyValue(field)
                        : Number(value);
            }
            else if (this.isEmptyInput(value)) {
                normalized[key] = this.resolveEmptyValue(field);
            }
            else {
                normalized[key] = value;
            }
        }
        return normalized;
    }
    getCaptureLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve({ lat: "", long: "" });
                return;
            }
            const timer = setTimeout(() => {
                resolve({ lat: "", long: "" });
            }, 2000);
            navigator.geolocation.getCurrentPosition((pos) => {
                clearTimeout(timer);
                resolve({
                    lat: String(pos.coords.latitude),
                    long: String(pos.coords.longitude),
                });
            }, () => {
                clearTimeout(timer);
                resolve({ lat: "", long: "" });
            }, { timeout: 2000, enableHighAccuracy: false });
        });
    }
    setupVisibility() {
        this.visibilitySub?.unsubscribe();
        if (!this.form || !this.resolvedSchema)
            return;
        this.recomputeVisibility();
        this.visibilitySub = this.form.valueChanges.subscribe(() => {
            if (this.isReviewed) {
                this.isReviewed = false;
                this.cdr.detectChanges();
            }
            if (this.visibilityUpdating)
                return;
            this.recomputeVisibility();
        });
    }
    isFieldVisibleOriginal(field) {
        const rules = field?.visibility?.rules;
        if (!rules || !rules.length)
            return true;
        const key = field?.id || field?.name;
        return this.visibilityState[key] !== false;
    }
    isFieldVisible(field) {
        const isSubmit = field?.type === 'button' &&
            (field?.button?.isSubmit || field?.label?.toLowerCase().includes('submit'));
        if (isSubmit) {
            if (this.isMultiStep && !this.isReviewed) {
                return false;
            }
        }
        return this.isFieldVisibleOriginal(field);
    }
    recomputeVisibility() {
        if (!this.form || !this.resolvedSchema)
            return;
        const raw = this.form.getRawValue
            ? this.form.getRawValue()
            : this.form.value;
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
        const mode = String(vis?.mode || "ALL").toUpperCase();
        const results = rules.map((r) => this.evaluateVisibilityRule(r, raw));
        return mode === "ANY" ? results.some(Boolean) : results.every(Boolean);
    }
    evaluateVisibilityRule(rule, raw) {
        const depKey = this.resolveDependsOnKey(rule?.dependsOn);
        const v = raw?.[depKey];
        const op = String(rule?.operator || "EQUALS").toUpperCase();
        const cmp = rule?.value;
        switch (op) {
            case "CHECKED":
                return v === true;
            case "UNCHECKED":
                return v !== true;
            case "HAS_VALUE":
                return !this.isEmptyValue(v);
            case "NOT_HAS_VALUE":
                return this.isEmptyValue(v);
            case "IN":
                return Array.isArray(cmp) ? cmp.includes(v) : false;
            case "NOT_IN":
                return Array.isArray(cmp) ? !cmp.includes(v) : true;
            case "NOT_EQUALS":
                return Array.isArray(v) ? !v.includes(cmp) : v !== cmp;
            case "EQUALS":
            default:
                return Array.isArray(v) ? v.includes(cmp) : v === cmp;
        }
    }
    resolveDependsOnKey(dep) {
        const d = String(dep || "");
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
        if (typeof v === "string" && v.trim() === "")
            return true;
        if (Array.isArray(v) && v.length === 0)
            return true;
        return false;
    }
    onSchemaButtonClick(field) {
        const btn = field?.button;
        if (btn?.styleVariant === 'link' && btn?.href) {
            window.open(btn.href, '_blank');
            return;
        }
        const endpoint = btn?.api;
        if (!btn || (btn.actionType === "API_CALL" && !endpoint?.url))
            return;
        const triggerValidation = btn.triggerValidation !== false;
        if (triggerValidation) {
            const scope = this.isMultiStep
                ? this.visibleFields
                : (this.resolvedSchema?.fields ?? []);
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
            next: (res) => {
                this.buttonFeedback[field.id] = {
                    type: "success",
                    message: btn.successMessage || "Action completed successfully.",
                };
                this.submitted.emit({
                    url: endpoint.url,
                    method: endpoint.method || 'POST',
                    payload: formValue,
                    headers: endpoint.headers || [],
                    params: endpoint.queryParams || [],
                    response: res,
                });
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
    openReviewDialog() {
        const fields = this.fieldsForStep(this.activeStepIndex);
        this.touchFields(fields);
        if (this.hasErrors(fields))
            return;
        this.dialog.open(this.reviewDialogTemplate, {
            width: '800px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            disableClose: true,
            panelClass: 'amigo-review-dialog'
        });
    }
    closeReviewDialog() {
        this.dialog.closeAll();
    }
    confirmReview() {
        this.isReviewed = true;
        this.dialog.closeAll();
    }
    get reviewData() {
        const data = [];
        if (this.isMultiStep) {
            for (let i = 0; i < this.totalSteps; i++) {
                const step = this.orderedSteps[i];
                const stepFields = this.getFieldsForReview(step);
                if (stepFields.length > 0) {
                    data.push({
                        step: step.label || `Step ${i + 1}`,
                        fields: stepFields
                    });
                }
            }
        }
        return data;
    }
    getFieldsForReview(step) {
        const s = this.resolvedSchema;
        if (!s)
            return [];
        const ids = new Set(step?.fieldIds ?? []);
        return (s.fields ?? [])
            .filter((f) => ids.has(f.id) && !this.isNonInput(f) && this.isFieldVisibleOriginal(f))
            .map((f) => {
            return {
                label: f.label,
                value: this.getReviewValue(f)
            };
        });
    }
    getReviewValue(field) {
        const val = this.form?.get(this.controlKey(field))?.value;
        if (val === null || val === undefined || val === '')
            return '-';
        if (field.type === 'select' || field.type === 'radio') {
            const opts = field.optionsSource?.mode === 'API' ? this.selectState[field.id]?.options : field.options;
            const selectedOpt = (opts || []).find((o) => String(o.value) === String(val));
            return selectedOpt ? selectedOpt.label : val;
        }
        if (field.type === 'checkbox') {
            return val ? 'Yes' : 'No';
        }
        if (field.type === 'file') {
            const names = this.fileNames(field);
            return names.length ? names.join(', ') : '-';
        }
        return val;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoFormComponent, deps: [{ token: AmigoFormService }, { token: i0.ChangeDetectorRef }, { token: i0.NgZone }, { token: AmigoApiExecutionService }, { token: AmigoSelectOptionsService }, { token: i4.MatDialog }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "21.1.5", type: AmigoFormComponent, isStandalone: true, selector: "amigo-form", inputs: { formId: "formId", schema: "schema", initialValue: "initialValue", submitPathParams: "submitPathParams", submitQueryParams: "submitQueryParams", isSubmitting: "isSubmitting" }, outputs: { submitted: "submitted", submitFailed: "submitFailed" }, viewQueries: [{ propertyName: "reviewDialogTemplate", first: true, predicate: ["reviewDialogTemplate"], descendants: true }], usesOnChanges: true, ngImport: i0, template: "<div class=\"w-full h-full flex flex-col mb-6 overflow-auto\">\r\n  <div\r\n    *ngIf=\"isLoading\"\r\n    class=\"flex items-center justify-center p-6 text-sm text-gray-600\"\r\n  >\r\n    Loading form\u2026\r\n  </div>\r\n\r\n  <div\r\n    *ngIf=\"loadError\"\r\n    class=\"p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\"\r\n  >\r\n    {{ loadError }}\r\n  </div>\r\n\r\n  <div\r\n    *ngIf=\"\r\n      !isLoading &&\r\n      !loadError &&\r\n      (!resolvedSchema?.fields || resolvedSchema.fields.length === 0)\r\n    \"\r\n    class=\"flex justify-center items-center h-100 border border-dotted border-gray-300 rounded-xl bg-white\"\r\n  >\r\n    <h2 class=\"text-sm text-gray-600\">No fields found for this form schema.</h2>\r\n  </div>\r\n\r\n  <form\r\n    *ngIf=\"!isLoading && !loadError && resolvedSchema?.fields?.length && form\"\r\n    [formGroup]=\"form\"\r\n    class=\"text-sm\"\r\n    [ngStyle]=\"getFormStyle()\"\r\n    [ngClass]=\"resolvedSchema?.style?.formClass || ''\"\r\n    (ngSubmit)=\"submit()\"\r\n  >\r\n    <h2 class=\"text-2xl my-2\">{{ resolvedSchema.name }}</h2>\r\n\r\n    <p\r\n      *ngIf=\"resolvedSchema.description\"\r\n      class=\"text-[13px] text-gray-500 mb-4\"\r\n    >\r\n      {{ resolvedSchema.description }}\r\n    </p>\r\n\r\n    <div\r\n      *ngIf=\"isMultiStep\"\r\n      class=\"w-full mb-6 flex flex-col items-center my-3\"\r\n    >\r\n      <div class=\"w-full h-1 bg-gray-200 rounded-full relative mb-6\">\r\n        <div\r\n          class=\"h-1 rounded-full transition-all duration-300 bg-blue-600\"\r\n          [ngStyle]=\"{\r\n            width: ((activeStepIndex + 1) / totalSteps) * 100 + '%',\r\n          }\"\r\n        ></div>\r\n      </div>\r\n\r\n      <div class=\"flex items-center justify-between w-full\">\r\n        <div\r\n          *ngFor=\"let step of orderedSteps; let i = index\"\r\n          class=\"flex flex-col items-center cursor-pointer\"\r\n          (click)=\"setActiveStep(i)\"\r\n        >\r\n          <div\r\n            class=\"w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all duration-300\"\r\n            [ngStyle]=\"\r\n              i === activeStepIndex\r\n                ? {\r\n                    backgroundColor: '#2563eb',\r\n                    borderColor: '#2563eb',\r\n                    color: '#ffffff',\r\n                  }\r\n                : {\r\n                    backgroundColor: '#FFFFFF',\r\n                    borderColor: '#9CA3AF',\r\n                    color: '#374151',\r\n                  }\r\n            \"\r\n          >\r\n            <ng-container *ngIf=\"!step.icon\">\r\n              {{ i + 1 }}\r\n            </ng-container>\r\n\r\n            <ng-container *ngIf=\"step.icon\">\r\n              <i\r\n                [class]=\"step.icon\"\r\n                class=\"text-lg\"\r\n                [ngStyle]=\"\r\n                  i === activeStepIndex\r\n                    ? { color: '#ffffff' }\r\n                    : { color: '#6B7280' }\r\n                \"\r\n              >\r\n              </i>\r\n            </ng-container>\r\n          </div>\r\n\r\n          <div class=\"mt-2 text-xs text-gray-600 font-medium\">\r\n            {{ step.label }}\r\n          </div>\r\n        </div>\r\n      </div>\r\n\r\n      <div\r\n        *ngIf=\"visibleFields.length === 0\"\r\n        class=\"text-xs text-gray-500 my-5\"\r\n      >\r\n        No fields assigned to this step yet.\r\n      </div>\r\n    </div>\r\n\r\n    <div *ngIf=\"isSectional; else normalOrMulti\">\r\n      <div *ngFor=\"let sec of orderedSections\" class=\"mb-6\">\r\n        <div\r\n          class=\"flex items-center justify-between mb-2 border-b border-gray-200 pb-2\"\r\n        >\r\n          <h3 class=\"text-[11px] font-semibold uppercase text-blue-700\">\r\n            {{ sec.label }}\r\n          </h3>\r\n          <span\r\n            class=\"text-[11px] text-gray-500\"\r\n            *ngIf=\"fieldsForSection(sec.id) as fields\"\r\n          >\r\n            {{ fields.length }} {{ fields.length === 1 ? \"field\" : \"fields\" }}\r\n          </span>\r\n        </div>\r\n\r\n        <div\r\n          class=\"grid\"\r\n          [ngStyle]=\"{\r\n            'grid-template-columns':\r\n              'repeat(' +\r\n              (resolvedSchema.layout?.columns || 1) +\r\n              ', minmax(0, 1fr))',\r\n            'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\r\n            'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px',\r\n          }\"\r\n        >\r\n          <div\r\n            *ngFor=\"\r\n              let field of fieldsForSection(sec.id);\r\n              trackBy: trackByFieldId\r\n            \"\r\n            [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\r\n            [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\"\r\n          >\r\n            <ng-container\r\n              *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"\r\n            ></ng-container>\r\n          </div>\r\n        </div>\r\n\r\n        <div\r\n          *ngIf=\"fieldsForSection(sec.id).length === 0\"\r\n          class=\"text-xs text-gray-500 mt-2\"\r\n        >\r\n          No fields in this section yet.\r\n        </div>\r\n      </div>\r\n    </div>\r\n\r\n    <ng-template #normalOrMulti>\r\n      <div\r\n        class=\"grid\"\r\n        [ngStyle]=\"{\r\n          'grid-template-columns':\r\n            'repeat(' +\r\n            (resolvedSchema.layout?.columns || 1) +\r\n            ', minmax(0, 1fr))',\r\n          'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\r\n          'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px',\r\n        }\"\r\n      >\r\n        <div\r\n          *ngFor=\"let field of visibleFields; trackBy: trackByFieldId\"\r\n          [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\r\n          [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\"\r\n        >\r\n          <ng-container\r\n            *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"\r\n          ></ng-container>\r\n        </div>\r\n      </div>\r\n    </ng-template>\r\n\r\n    <div\r\n      *ngIf=\"isMultiStep\"\r\n      class=\"mt-4 flex items-center justify-between text-xs w-full\"\r\n    >\r\n      <!-- Previous Step Button / Placeholder -->\r\n      <button\r\n        *ngIf=\"activeStepIndex > 0\"\r\n        type=\"button\"\r\n        class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\r\n        (click)=\"prevStep()\"\r\n      >\r\n        \u2190 Previous step\r\n      </button>\r\n      <div *ngIf=\"activeStepIndex === 0\"></div>\r\n\r\n      <!-- Next Step Button -->\r\n      <button\r\n        *ngIf=\"activeStepIndex < totalSteps - 1\"\r\n        type=\"button\"\r\n        class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\r\n        (click)=\"nextStep()\"\r\n      >\r\n        Next step \u2192\r\n      </button>\r\n\r\n      <!-- Review Button -->\r\n      <button\r\n        *ngIf=\"activeStepIndex === totalSteps - 1 && !isReviewed\"\r\n        type=\"button\"\r\n        class=\"px-3 py-1 border border-blue-600 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50\"\r\n        (click)=\"openReviewDialog()\"\r\n      >\r\n        Review Details\r\n      </button>\r\n    </div>\r\n\r\n    <div\r\n      *ngIf=\"submitFeedback\"\r\n      class=\"mt-3 p-3 rounded border text-sm\"\r\n      [ngClass]=\"\r\n        submitFeedback.type === 'success'\r\n          ? 'border-green-200 bg-green-50 text-green-700'\r\n          : 'border-red-200 bg-red-50 text-red-700'\r\n      \"\r\n    >\r\n      {{ submitFeedback.message }}\r\n    </div>\r\n\r\n    <!-- Removed Fixed Submit Button Container -->\r\n\r\n    <ng-template #fieldRenderer let-field>\r\n      <ng-container *ngIf=\"isCard(field); else notCard\">\r\n        <div [ngStyle]=\"cardStyle(field)\" class=\"w-full flex items-start gap-3\">\r\n          <div\r\n            class=\"shrink-0 mt-0.5 text-lg leading-none\"\r\n            [ngStyle]=\"cardIconStyle(field)\"\r\n          >\r\n            <i\r\n              *ngIf=\"isBootstrapIcon(cardIcon(field))\"\r\n              [class]=\"cardIcon(field)\"\r\n            ></i>\r\n            <span *ngIf=\"!isBootstrapIcon(cardIcon(field))\">{{\r\n              cardIcon(field)\r\n            }}</span>\r\n          </div>\r\n\r\n          <div class=\"min-w-0\">\r\n            <div class=\"text-sm font-semibold leading-tight\">\r\n              {{ cardTitle(field) }}\r\n            </div>\r\n\r\n            <div *ngIf=\"cardBody(field)\" class=\"mt-1 text-xs opacity-90\">\r\n              {{ cardBody(field) }}\r\n            </div>\r\n          </div>\r\n        </div>\r\n      </ng-container>\r\n\r\n      <ng-template #notCard>\r\n        <ng-container *ngIf=\"isButton(field); else inputField\">\r\n          <div class=\"w-full\">\r\n            <button\r\n              [type]=\"field.button?.isSubmit ? 'submit' : 'button'\"\r\n              (click)=\"\r\n                !field.button?.isSubmit ? onSchemaButtonClick(field) : null\r\n              \"\r\n              [disabled]=\"\r\n                field.button?.isSubmit\r\n                  ? isSubmitting\r\n                  : (buttonLoading[field.id] ?? false)\r\n              \"\r\n              class=\"w-full transition disabled:opacity-60 disabled:cursor-not-allowed\"\r\n              (mouseenter)=\"hoverState[field.id] = true\"\r\n              (mouseleave)=\"hoverState[field.id] = false\"\r\n              [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n              [ngStyle]=\"{\r\n                'background-color':\r\n                  field.button?.styleVariant === 'link' ||\r\n                  field.button?.styleVariant === 'outline'\r\n                    ? hoverState[field.id]\r\n                      ? field.button?.hoverBackgroundColor ||\r\n                        (field.button?.styleVariant === 'outline'\r\n                          ? '#eff6ff'\r\n                          : 'transparent')\r\n                      : field.button?.backgroundColor || 'transparent'\r\n                    : hoverState[field.id]\r\n                      ? field.button?.hoverBackgroundColor ||\r\n                        field.button?.backgroundColor ||\r\n                        ''\r\n                      : field.button?.backgroundColor || '',\r\n                color: hoverState[field.id]\r\n                  ? field.button?.hoverTextColor ||\r\n                    field.button?.textColor ||\r\n                    ''\r\n                  : field.button?.textColor || '',\r\n                'border-color':\r\n                  field.button?.styleVariant === 'link'\r\n                    ? 'transparent'\r\n                    : hoverState[field.id]\r\n                      ? field.button?.hoverBackgroundColor ||\r\n                        field.button?.backgroundColor ||\r\n                        ''\r\n                      : field.button?.backgroundColor || '',\r\n                'text-decoration':\r\n                  field.button?.styleVariant === 'link' && hoverState[field.id]\r\n                    ? 'underline'\r\n                    : 'none',\r\n              }\"\r\n              [ngClass]=\"[\r\n                resolvedSchema?.style?.inputClass\r\n                  ? resolvedSchema.style.inputClass.replace('rounded', '')\r\n                  : 'w-full px-2 py-1 text-sm',\r\n                field.button?.styleVariant === 'link' ? '' : 'border',\r\n                !field.button?.backgroundColor &&\r\n                (field.button?.styleVariant || 'primary') === 'primary'\r\n                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'\r\n                  : !field.button?.backgroundColor &&\r\n                      field.button?.styleVariant === 'outline'\r\n                    ? 'bg-transparent text-blue-600 border-blue-600 hover:bg-blue-50'\r\n                    : !field.button?.backgroundColor &&\r\n                        field.button?.styleVariant === 'link'\r\n                      ? 'bg-transparent text-blue-600 border-transparent hover:underline'\r\n                      : !field.button?.backgroundColor &&\r\n                          (field.button?.styleVariant || 'primary') === 'danger'\r\n                        ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'\r\n                        : !field.button?.backgroundColor\r\n                          ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'\r\n                          : '',\r\n              ]\"\r\n            >\r\n              <span class=\"inline-flex items-center justify-center gap-2\">\r\n                <span>\r\n                  {{\r\n                    field.button?.isSubmit && isSubmitting\r\n                      ? \"Submitting...\"\r\n                      : field.button?.label || field.label\r\n                  }}\r\n                </span>\r\n                <span\r\n                  *ngIf=\"!field.button?.isSubmit && buttonLoading[field.id]\"\r\n                  class=\"text-xs opacity-80\"\r\n                  >\u2026</span\r\n                >\r\n              </span>\r\n            </button>\r\n\r\n            <div\r\n              *ngIf=\"buttonFeedback[field.id]\"\r\n              class=\"mt-2 text-xs rounded-lg px-3 py-2 border\"\r\n              [ngClass]=\"\r\n                buttonFeedback[field.id].type === 'success'\r\n                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'\r\n                  : 'bg-rose-50 border-rose-200 text-rose-800'\r\n              \"\r\n            >\r\n              {{ buttonFeedback[field.id].message }}\r\n            </div>\r\n          </div>\r\n        </ng-container>\r\n\r\n        <ng-template #inputField>\r\n          <label\r\n            [ngClass]=\"\r\n              resolvedSchema?.style?.labelClass ||\r\n              'block text-sm font-medium mb-1'\r\n            \"\r\n          >\r\n            {{ field.label }}\r\n            <span\r\n              *ngIf=\"\r\n                field.required === true ||\r\n                field.required === 'true' ||\r\n                field.validations?.required\r\n              \"\r\n              class=\"text-red-500\"\r\n              >*</span\r\n            >\r\n          </label>\r\n\r\n          <ng-container [ngSwitch]=\"field.type\">\r\n            <ng-container *ngSwitchCase=\"'text'\">\r\n              <input\r\n                type=\"text\"\r\n                [placeholder]=\"field.placeholder\"\r\n                [formControlName]=\"controlKey(field)\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              />\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  This field is required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                  Minimum {{ field.validations?.minLength }} characters\r\n                  required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                  Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">\r\n                  Value does not match the required pattern.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'password'\">\r\n              <input\r\n                type=\"password\"\r\n                [placeholder]=\"field.placeholder\"\r\n                [formControlName]=\"controlKey(field)\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              />\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  This field is required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                  Minimum {{ field.validations?.minLength }} characters\r\n                  required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                  Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">\r\n                  Value does not match the required pattern.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'number'\">\r\n              <input\r\n                type=\"number\"\r\n                [placeholder]=\"field.placeholder\"\r\n                [formControlName]=\"controlKey(field)\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              />\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  This field is required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['min']\">\r\n                  Value should be \u2265 {{ field.validations?.min }}.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['max']\">\r\n                  Value should be \u2264 {{ field.validations?.max }}.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'email'\">\r\n              <input\r\n                type=\"email\"\r\n                [placeholder]=\"field.placeholder\"\r\n                [formControlName]=\"controlKey(field)\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              />\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  This field is required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['email']\">\r\n                  Please enter a valid email address.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                  Minimum {{ field.validations?.minLength }} characters\r\n                  required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                  Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">\r\n                  Password must contain mix of Upper and lowercase letters,\r\n                  numbers and special characters\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'textarea'\">\r\n              <textarea\r\n                [placeholder]=\"field.placeholder\"\r\n                [formControlName]=\"controlKey(field)\"\r\n                rows=\"4\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              ></textarea>\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  This field is required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                  Minimum {{ field.validations?.minLength }} characters\r\n                  required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                  Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">\r\n                  Value does not match the required pattern.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'select'\">\r\n              <select\r\n                [formControlName]=\"controlKey(field)\"\r\n                [disabled]=\"selectState[field.id]?.loading ?? false\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              >\r\n                <option value=\"\">Select an option</option>\r\n\r\n                <ng-container\r\n                  *ngFor=\"\r\n                    let opt of field.optionsSource?.mode === 'API'\r\n                      ? selectState[field.id]?.options || []\r\n                      : field.options || []\r\n                  \"\r\n                >\r\n                  <option [value]=\"opt.value\">{{ opt.label }}</option>\r\n                </ng-container>\r\n              </select>\r\n\r\n              <div\r\n                *ngIf=\"\r\n                  field.optionsSource?.mode === 'API' &&\r\n                  selectState[field.id]?.loading\r\n                \"\r\n                class=\"mt-1 text-[11px] text-slate-500\"\r\n              >\r\n                Loading options\u2026\r\n              </div>\r\n\r\n              <div\r\n                *ngIf=\"\r\n                  field.optionsSource?.mode === 'API' &&\r\n                  selectState[field.id]?.error\r\n                \"\r\n                class=\"mt-1 text-[11px] text-rose-600\"\r\n              >\r\n                {{ selectState[field.id]?.error }}\r\n              </div>\r\n\r\n              <div\r\n                *ngIf=\"\r\n                  field.optionsSource?.mode === 'API' &&\r\n                  !selectState[field.id]?.loading &&\r\n                  !selectState[field.id]?.error &&\r\n                  (selectState[field.id]?.options?.length || 0) === 0\r\n                \"\r\n                class=\"mt-1 text-[11px] text-slate-500\"\r\n              >\r\n                No options available.\r\n              </div>\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  Please select an option.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'checkbox'\">\r\n              <div class=\"flex items-center gap-2\">\r\n                <input type=\"checkbox\" [formControlName]=\"controlKey(field)\" />\r\n                <span class=\"text-xs text-gray-700\">Check</span>\r\n              </div>\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['requiredTrue']\">\r\n                  Please check this box.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'radio'\">\r\n              <div\r\n                [ngClass]=\"\r\n                  field.optionDirection === 'horizontal'\r\n                    ? 'flex flex-row gap-4 items-center'\r\n                    : 'flex flex-col gap-1'\r\n                \"\r\n              >\r\n                <label\r\n                  *ngFor=\"let opt of field.options || []\"\r\n                  class=\"inline-flex items-center gap-2 text-xs text-gray-700\"\r\n                >\r\n                  <input\r\n                    type=\"radio\"\r\n                    [value]=\"opt.value\"\r\n                    [formControlName]=\"controlKey(field)\"\r\n                  />\r\n                  <span>{{ opt.label }}</span>\r\n                </label>\r\n              </div>\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  Please choose an option.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'date'\">\r\n              <input\r\n                type=\"date\"\r\n                [formControlName]=\"controlKey(field)\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              />\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  This field is required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['min']\">\r\n                  Date should be on or after {{ field.validations?.min }}.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['max']\">\r\n                  Date should be on or before {{ field.validations?.max }}.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'file'\">\r\n              <div class=\"flex flex-col gap-2\">\r\n                <div class=\"flex items-center gap-2\">\r\n                  <input\r\n                    #fileInput\r\n                    type=\"file\"\r\n                    [attr.accept]=\"field.accept || null\"\r\n                    [attr.multiple]=\"field.multiple ? '' : null\"\r\n                    (change)=\"onFileChange($event, field)\"\r\n                    (blur)=\"ctrl(field)?.markAsTouched()\"\r\n                    [style.borderRadius.px]=\"\r\n                      resolvedSchema?.style?.borderRadius\r\n                    \"\r\n                    [ngClass]=\"\r\n                      resolvedSchema?.style?.inputClass ||\r\n                      'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                    \"\r\n                  />\r\n\r\n                  <button\r\n                    *ngIf=\"fileNames(field).length\"\r\n                    type=\"button\"\r\n                    class=\"px-2 py-1 text-[11px] border border-gray-300 rounded hover:bg-gray-100\"\r\n                    (click)=\"clearFiles(field, fileInput)\"\r\n                  >\r\n                    Clear\r\n                  </button>\r\n                </div>\r\n\r\n                <div class=\"text-[11px] text-gray-500\">\r\n                  <span *ngIf=\"field.accept\">Allowed: {{ field.accept }}</span>\r\n                  <span *ngIf=\"field.maxSizeMB\">\r\n                    \u2022 Max {{ field.maxSizeMB }}MB per file</span\r\n                  >\r\n                  <span *ngIf=\"field.maxFiles\">\r\n                    \u2022 Max {{ field.maxFiles }} file(s)</span\r\n                  >\r\n                </div>\r\n\r\n                <div\r\n                  *ngIf=\"fileNames(field).length\"\r\n                  class=\"text-[11px] text-gray-600\"\r\n                >\r\n                  Selected: {{ fileNames(field).join(\", \") }}\r\n                </div>\r\n              </div>\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  This field is required.\r\n                </div>\r\n\r\n                <div *ngIf=\"ctrl(field)?.errors?.['maxFiles']\">\r\n                  You can upload up to\r\n                  {{ ctrl(field)?.errors?.[\"maxFiles\"]?.max }} file(s).\r\n                </div>\r\n\r\n                <div *ngIf=\"ctrl(field)?.errors?.['maxSizeMB']\">\r\n                  {{ ctrl(field)?.errors?.[\"maxSizeMB\"]?.file }} is too large.\r\n                  Max {{ ctrl(field)?.errors?.[\"maxSizeMB\"]?.max }}MB.\r\n                </div>\r\n\r\n                <div *ngIf=\"ctrl(field)?.errors?.['accept']\">\r\n                  {{ ctrl(field)?.errors?.[\"accept\"]?.file }} is not an allowed\r\n                  file type.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchDefault>\r\n              <input\r\n                type=\"text\"\r\n                [placeholder]=\"field.placeholder\"\r\n                [formControlName]=\"controlKey(field)\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              />\r\n            </ng-container>\r\n          </ng-container>\r\n        </ng-template>\r\n      </ng-template>\r\n    </ng-template>\r\n  </form>\r\n</div>\r\n\r\n<ng-template #reviewDialogTemplate>\r\n  <div class=\"bg-white flex flex-col max-h-[90vh]\">\r\n    <div class=\"px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0\">\r\n      <h3 class=\"text-lg font-semibold text-gray-800 m-0\">Review Form Details</h3>\r\n      <button type=\"button\" (click)=\"closeReviewDialog()\" class=\"text-gray-400 hover:text-gray-600 focus:outline-none bg-transparent border-none cursor-pointer p-0\">\r\n        <svg class=\"w-6 h-6\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M6 18L18 6M6 6l12 12\"></path></svg>\r\n      </button>\r\n    </div>\r\n    \r\n    <div class=\"p-6 overflow-y-auto flex-1\">\r\n      <div *ngFor=\"let stepData of reviewData\" class=\"mb-6 last:mb-0\">\r\n        <h4 class=\"font-medium text-blue-700 border-b border-gray-100 pb-2 mb-4 mt-0\">{{ stepData.step }}</h4>\r\n        <div class=\"grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4\">\r\n          <div *ngFor=\"let fData of stepData.fields\" class=\"flex flex-col\">\r\n            <span class=\"text-xs text-gray-500 mb-1\">{{ fData.label }}</span>\r\n            <span class=\"text-sm font-medium text-gray-800 break-words whitespace-pre-wrap\">{{ fData.value }}</span>\r\n          </div>\r\n        </div>\r\n      </div>\r\n    </div>\r\n    \r\n    <div class=\"px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 shrink-0\">\r\n      <button type=\"button\" class=\"px-4 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700 cursor-pointer transition-colors\" (click)=\"closeReviewDialog()\">Edit Form</button>\r\n      <button type=\"button\" class=\"px-4 py-2 text-sm bg-blue-600 border border-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer transition-colors shadow-sm\" (click)=\"confirmReview()\">Confirm & Close</button>\r\n    </div>\r\n  </div>\r\n</ng-template>\r\n", styles: [".amigo-loading{padding:12px;opacity:.85}.amigo-error{padding:12px;border:1px solid #ef4444;border-radius:8px;color:#ef4444}.amigo-form-root{width:100%;box-sizing:border-box}.amigo-header{margin-bottom:12px}.amigo-title{font-size:18px;font-weight:700}.amigo-desc{margin-top:4px;opacity:.8}.amigo-grid{width:100%}.amigo-field{display:block}.amigo-label{display:block;font-size:13px;margin-bottom:6px;font-weight:600}.amigo-required{color:#ef4444;margin-left:4px}.amigo-input{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:14px}.amigo-hint{margin-top:6px;font-size:12px;opacity:.75}.amigo-field-error{margin-top:6px;font-size:12px;color:#ef4444}.amigo-checkbox{display:flex;align-items:center;gap:8px}.amigo-radio{display:flex;flex-direction:column;gap:6px}.amigo-radio-item{display:inline-flex;align-items:center;gap:8px}.amigo-section{margin-bottom:18px}.amigo-section-title{font-weight:700;margin-bottom:10px}.amigo-actions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.amigo-btn{padding:8px 12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer}.amigo-primary{border-color:#111827;background:#111827;color:#fff}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i5.NgClass, selector: "[ngClass]", inputs: ["class", "ngClass"] }, { kind: "directive", type: i5.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i5.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i5.NgTemplateOutlet, selector: "[ngTemplateOutlet]", inputs: ["ngTemplateOutletContext", "ngTemplateOutlet", "ngTemplateOutletInjector"] }, { kind: "directive", type: i5.NgStyle, selector: "[ngStyle]", inputs: ["ngStyle"] }, { kind: "directive", type: i5.NgSwitch, selector: "[ngSwitch]", inputs: ["ngSwitch"] }, { kind: "directive", type: i5.NgSwitchCase, selector: "[ngSwitchCase]", inputs: ["ngSwitchCase"] }, { kind: "directive", type: i5.NgSwitchDefault, selector: "[ngSwitchDefault]" }, { kind: "ngmodule", type: ReactiveFormsModule }, { kind: "directive", type: i6.ɵNgNoValidate, selector: "form:not([ngNoForm]):not([ngNativeValidate])" }, { kind: "directive", type: i6.NgSelectOption, selector: "option", inputs: ["ngValue", "value"] }, { kind: "directive", type: i6.ɵNgSelectMultipleOption, selector: "option", inputs: ["ngValue", "value"] }, { kind: "directive", type: i6.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i6.NumberValueAccessor, selector: "input[type=number][formControlName],input[type=number][formControl],input[type=number][ngModel]" }, { kind: "directive", type: i6.CheckboxControlValueAccessor, selector: "input[type=checkbox][formControlName],input[type=checkbox][formControl],input[type=checkbox][ngModel]" }, { kind: "directive", type: i6.SelectControlValueAccessor, selector: "select:not([multiple])[formControlName],select:not([multiple])[formControl],select:not([multiple])[ngModel]", inputs: ["compareWith"] }, { kind: "directive", type: i6.RadioControlValueAccessor, selector: "input[type=radio][formControlName],input[type=radio][formControl],input[type=radio][ngModel]", inputs: ["name", "formControlName", "value"] }, { kind: "directive", type: i6.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i6.NgControlStatusGroup, selector: "[formGroupName],[formArrayName],[ngModelGroup],[formGroup],[formArray],form:not([ngNoForm]),[ngForm]" }, { kind: "directive", type: i6.FormGroupDirective, selector: "[formGroup]", inputs: ["formGroup"], outputs: ["ngSubmit"], exportAs: ["ngForm"] }, { kind: "directive", type: i6.FormControlName, selector: "[formControlName]", inputs: ["formControlName", "disabled", "ngModel"], outputs: ["ngModelChange"] }, { kind: "ngmodule", type: MatDialogModule }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoFormComponent, decorators: [{
            type: Component,
            args: [{ selector: "amigo-form", standalone: true, imports: [CommonModule, ReactiveFormsModule, MatDialogModule], template: "<div class=\"w-full h-full flex flex-col mb-6 overflow-auto\">\r\n  <div\r\n    *ngIf=\"isLoading\"\r\n    class=\"flex items-center justify-center p-6 text-sm text-gray-600\"\r\n  >\r\n    Loading form\u2026\r\n  </div>\r\n\r\n  <div\r\n    *ngIf=\"loadError\"\r\n    class=\"p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\"\r\n  >\r\n    {{ loadError }}\r\n  </div>\r\n\r\n  <div\r\n    *ngIf=\"\r\n      !isLoading &&\r\n      !loadError &&\r\n      (!resolvedSchema?.fields || resolvedSchema.fields.length === 0)\r\n    \"\r\n    class=\"flex justify-center items-center h-100 border border-dotted border-gray-300 rounded-xl bg-white\"\r\n  >\r\n    <h2 class=\"text-sm text-gray-600\">No fields found for this form schema.</h2>\r\n  </div>\r\n\r\n  <form\r\n    *ngIf=\"!isLoading && !loadError && resolvedSchema?.fields?.length && form\"\r\n    [formGroup]=\"form\"\r\n    class=\"text-sm\"\r\n    [ngStyle]=\"getFormStyle()\"\r\n    [ngClass]=\"resolvedSchema?.style?.formClass || ''\"\r\n    (ngSubmit)=\"submit()\"\r\n  >\r\n    <h2 class=\"text-2xl my-2\">{{ resolvedSchema.name }}</h2>\r\n\r\n    <p\r\n      *ngIf=\"resolvedSchema.description\"\r\n      class=\"text-[13px] text-gray-500 mb-4\"\r\n    >\r\n      {{ resolvedSchema.description }}\r\n    </p>\r\n\r\n    <div\r\n      *ngIf=\"isMultiStep\"\r\n      class=\"w-full mb-6 flex flex-col items-center my-3\"\r\n    >\r\n      <div class=\"w-full h-1 bg-gray-200 rounded-full relative mb-6\">\r\n        <div\r\n          class=\"h-1 rounded-full transition-all duration-300 bg-blue-600\"\r\n          [ngStyle]=\"{\r\n            width: ((activeStepIndex + 1) / totalSteps) * 100 + '%',\r\n          }\"\r\n        ></div>\r\n      </div>\r\n\r\n      <div class=\"flex items-center justify-between w-full\">\r\n        <div\r\n          *ngFor=\"let step of orderedSteps; let i = index\"\r\n          class=\"flex flex-col items-center cursor-pointer\"\r\n          (click)=\"setActiveStep(i)\"\r\n        >\r\n          <div\r\n            class=\"w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all duration-300\"\r\n            [ngStyle]=\"\r\n              i === activeStepIndex\r\n                ? {\r\n                    backgroundColor: '#2563eb',\r\n                    borderColor: '#2563eb',\r\n                    color: '#ffffff',\r\n                  }\r\n                : {\r\n                    backgroundColor: '#FFFFFF',\r\n                    borderColor: '#9CA3AF',\r\n                    color: '#374151',\r\n                  }\r\n            \"\r\n          >\r\n            <ng-container *ngIf=\"!step.icon\">\r\n              {{ i + 1 }}\r\n            </ng-container>\r\n\r\n            <ng-container *ngIf=\"step.icon\">\r\n              <i\r\n                [class]=\"step.icon\"\r\n                class=\"text-lg\"\r\n                [ngStyle]=\"\r\n                  i === activeStepIndex\r\n                    ? { color: '#ffffff' }\r\n                    : { color: '#6B7280' }\r\n                \"\r\n              >\r\n              </i>\r\n            </ng-container>\r\n          </div>\r\n\r\n          <div class=\"mt-2 text-xs text-gray-600 font-medium\">\r\n            {{ step.label }}\r\n          </div>\r\n        </div>\r\n      </div>\r\n\r\n      <div\r\n        *ngIf=\"visibleFields.length === 0\"\r\n        class=\"text-xs text-gray-500 my-5\"\r\n      >\r\n        No fields assigned to this step yet.\r\n      </div>\r\n    </div>\r\n\r\n    <div *ngIf=\"isSectional; else normalOrMulti\">\r\n      <div *ngFor=\"let sec of orderedSections\" class=\"mb-6\">\r\n        <div\r\n          class=\"flex items-center justify-between mb-2 border-b border-gray-200 pb-2\"\r\n        >\r\n          <h3 class=\"text-[11px] font-semibold uppercase text-blue-700\">\r\n            {{ sec.label }}\r\n          </h3>\r\n          <span\r\n            class=\"text-[11px] text-gray-500\"\r\n            *ngIf=\"fieldsForSection(sec.id) as fields\"\r\n          >\r\n            {{ fields.length }} {{ fields.length === 1 ? \"field\" : \"fields\" }}\r\n          </span>\r\n        </div>\r\n\r\n        <div\r\n          class=\"grid\"\r\n          [ngStyle]=\"{\r\n            'grid-template-columns':\r\n              'repeat(' +\r\n              (resolvedSchema.layout?.columns || 1) +\r\n              ', minmax(0, 1fr))',\r\n            'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\r\n            'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px',\r\n          }\"\r\n        >\r\n          <div\r\n            *ngFor=\"\r\n              let field of fieldsForSection(sec.id);\r\n              trackBy: trackByFieldId\r\n            \"\r\n            [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\r\n            [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\"\r\n          >\r\n            <ng-container\r\n              *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"\r\n            ></ng-container>\r\n          </div>\r\n        </div>\r\n\r\n        <div\r\n          *ngIf=\"fieldsForSection(sec.id).length === 0\"\r\n          class=\"text-xs text-gray-500 mt-2\"\r\n        >\r\n          No fields in this section yet.\r\n        </div>\r\n      </div>\r\n    </div>\r\n\r\n    <ng-template #normalOrMulti>\r\n      <div\r\n        class=\"grid\"\r\n        [ngStyle]=\"{\r\n          'grid-template-columns':\r\n            'repeat(' +\r\n            (resolvedSchema.layout?.columns || 1) +\r\n            ', minmax(0, 1fr))',\r\n          'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\r\n          'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px',\r\n        }\"\r\n      >\r\n        <div\r\n          *ngFor=\"let field of visibleFields; trackBy: trackByFieldId\"\r\n          [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\r\n          [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\"\r\n        >\r\n          <ng-container\r\n            *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"\r\n          ></ng-container>\r\n        </div>\r\n      </div>\r\n    </ng-template>\r\n\r\n    <div\r\n      *ngIf=\"isMultiStep\"\r\n      class=\"mt-4 flex items-center justify-between text-xs w-full\"\r\n    >\r\n      <!-- Previous Step Button / Placeholder -->\r\n      <button\r\n        *ngIf=\"activeStepIndex > 0\"\r\n        type=\"button\"\r\n        class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\r\n        (click)=\"prevStep()\"\r\n      >\r\n        \u2190 Previous step\r\n      </button>\r\n      <div *ngIf=\"activeStepIndex === 0\"></div>\r\n\r\n      <!-- Next Step Button -->\r\n      <button\r\n        *ngIf=\"activeStepIndex < totalSteps - 1\"\r\n        type=\"button\"\r\n        class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\r\n        (click)=\"nextStep()\"\r\n      >\r\n        Next step \u2192\r\n      </button>\r\n\r\n      <!-- Review Button -->\r\n      <button\r\n        *ngIf=\"activeStepIndex === totalSteps - 1 && !isReviewed\"\r\n        type=\"button\"\r\n        class=\"px-3 py-1 border border-blue-600 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50\"\r\n        (click)=\"openReviewDialog()\"\r\n      >\r\n        Review Details\r\n      </button>\r\n    </div>\r\n\r\n    <div\r\n      *ngIf=\"submitFeedback\"\r\n      class=\"mt-3 p-3 rounded border text-sm\"\r\n      [ngClass]=\"\r\n        submitFeedback.type === 'success'\r\n          ? 'border-green-200 bg-green-50 text-green-700'\r\n          : 'border-red-200 bg-red-50 text-red-700'\r\n      \"\r\n    >\r\n      {{ submitFeedback.message }}\r\n    </div>\r\n\r\n    <!-- Removed Fixed Submit Button Container -->\r\n\r\n    <ng-template #fieldRenderer let-field>\r\n      <ng-container *ngIf=\"isCard(field); else notCard\">\r\n        <div [ngStyle]=\"cardStyle(field)\" class=\"w-full flex items-start gap-3\">\r\n          <div\r\n            class=\"shrink-0 mt-0.5 text-lg leading-none\"\r\n            [ngStyle]=\"cardIconStyle(field)\"\r\n          >\r\n            <i\r\n              *ngIf=\"isBootstrapIcon(cardIcon(field))\"\r\n              [class]=\"cardIcon(field)\"\r\n            ></i>\r\n            <span *ngIf=\"!isBootstrapIcon(cardIcon(field))\">{{\r\n              cardIcon(field)\r\n            }}</span>\r\n          </div>\r\n\r\n          <div class=\"min-w-0\">\r\n            <div class=\"text-sm font-semibold leading-tight\">\r\n              {{ cardTitle(field) }}\r\n            </div>\r\n\r\n            <div *ngIf=\"cardBody(field)\" class=\"mt-1 text-xs opacity-90\">\r\n              {{ cardBody(field) }}\r\n            </div>\r\n          </div>\r\n        </div>\r\n      </ng-container>\r\n\r\n      <ng-template #notCard>\r\n        <ng-container *ngIf=\"isButton(field); else inputField\">\r\n          <div class=\"w-full\">\r\n            <button\r\n              [type]=\"field.button?.isSubmit ? 'submit' : 'button'\"\r\n              (click)=\"\r\n                !field.button?.isSubmit ? onSchemaButtonClick(field) : null\r\n              \"\r\n              [disabled]=\"\r\n                field.button?.isSubmit\r\n                  ? isSubmitting\r\n                  : (buttonLoading[field.id] ?? false)\r\n              \"\r\n              class=\"w-full transition disabled:opacity-60 disabled:cursor-not-allowed\"\r\n              (mouseenter)=\"hoverState[field.id] = true\"\r\n              (mouseleave)=\"hoverState[field.id] = false\"\r\n              [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n              [ngStyle]=\"{\r\n                'background-color':\r\n                  field.button?.styleVariant === 'link' ||\r\n                  field.button?.styleVariant === 'outline'\r\n                    ? hoverState[field.id]\r\n                      ? field.button?.hoverBackgroundColor ||\r\n                        (field.button?.styleVariant === 'outline'\r\n                          ? '#eff6ff'\r\n                          : 'transparent')\r\n                      : field.button?.backgroundColor || 'transparent'\r\n                    : hoverState[field.id]\r\n                      ? field.button?.hoverBackgroundColor ||\r\n                        field.button?.backgroundColor ||\r\n                        ''\r\n                      : field.button?.backgroundColor || '',\r\n                color: hoverState[field.id]\r\n                  ? field.button?.hoverTextColor ||\r\n                    field.button?.textColor ||\r\n                    ''\r\n                  : field.button?.textColor || '',\r\n                'border-color':\r\n                  field.button?.styleVariant === 'link'\r\n                    ? 'transparent'\r\n                    : hoverState[field.id]\r\n                      ? field.button?.hoverBackgroundColor ||\r\n                        field.button?.backgroundColor ||\r\n                        ''\r\n                      : field.button?.backgroundColor || '',\r\n                'text-decoration':\r\n                  field.button?.styleVariant === 'link' && hoverState[field.id]\r\n                    ? 'underline'\r\n                    : 'none',\r\n              }\"\r\n              [ngClass]=\"[\r\n                resolvedSchema?.style?.inputClass\r\n                  ? resolvedSchema.style.inputClass.replace('rounded', '')\r\n                  : 'w-full px-2 py-1 text-sm',\r\n                field.button?.styleVariant === 'link' ? '' : 'border',\r\n                !field.button?.backgroundColor &&\r\n                (field.button?.styleVariant || 'primary') === 'primary'\r\n                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'\r\n                  : !field.button?.backgroundColor &&\r\n                      field.button?.styleVariant === 'outline'\r\n                    ? 'bg-transparent text-blue-600 border-blue-600 hover:bg-blue-50'\r\n                    : !field.button?.backgroundColor &&\r\n                        field.button?.styleVariant === 'link'\r\n                      ? 'bg-transparent text-blue-600 border-transparent hover:underline'\r\n                      : !field.button?.backgroundColor &&\r\n                          (field.button?.styleVariant || 'primary') === 'danger'\r\n                        ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'\r\n                        : !field.button?.backgroundColor\r\n                          ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'\r\n                          : '',\r\n              ]\"\r\n            >\r\n              <span class=\"inline-flex items-center justify-center gap-2\">\r\n                <span>\r\n                  {{\r\n                    field.button?.isSubmit && isSubmitting\r\n                      ? \"Submitting...\"\r\n                      : field.button?.label || field.label\r\n                  }}\r\n                </span>\r\n                <span\r\n                  *ngIf=\"!field.button?.isSubmit && buttonLoading[field.id]\"\r\n                  class=\"text-xs opacity-80\"\r\n                  >\u2026</span\r\n                >\r\n              </span>\r\n            </button>\r\n\r\n            <div\r\n              *ngIf=\"buttonFeedback[field.id]\"\r\n              class=\"mt-2 text-xs rounded-lg px-3 py-2 border\"\r\n              [ngClass]=\"\r\n                buttonFeedback[field.id].type === 'success'\r\n                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'\r\n                  : 'bg-rose-50 border-rose-200 text-rose-800'\r\n              \"\r\n            >\r\n              {{ buttonFeedback[field.id].message }}\r\n            </div>\r\n          </div>\r\n        </ng-container>\r\n\r\n        <ng-template #inputField>\r\n          <label\r\n            [ngClass]=\"\r\n              resolvedSchema?.style?.labelClass ||\r\n              'block text-sm font-medium mb-1'\r\n            \"\r\n          >\r\n            {{ field.label }}\r\n            <span\r\n              *ngIf=\"\r\n                field.required === true ||\r\n                field.required === 'true' ||\r\n                field.validations?.required\r\n              \"\r\n              class=\"text-red-500\"\r\n              >*</span\r\n            >\r\n          </label>\r\n\r\n          <ng-container [ngSwitch]=\"field.type\">\r\n            <ng-container *ngSwitchCase=\"'text'\">\r\n              <input\r\n                type=\"text\"\r\n                [placeholder]=\"field.placeholder\"\r\n                [formControlName]=\"controlKey(field)\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              />\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  This field is required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                  Minimum {{ field.validations?.minLength }} characters\r\n                  required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                  Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">\r\n                  Value does not match the required pattern.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'password'\">\r\n              <input\r\n                type=\"password\"\r\n                [placeholder]=\"field.placeholder\"\r\n                [formControlName]=\"controlKey(field)\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              />\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  This field is required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                  Minimum {{ field.validations?.minLength }} characters\r\n                  required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                  Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">\r\n                  Value does not match the required pattern.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'number'\">\r\n              <input\r\n                type=\"number\"\r\n                [placeholder]=\"field.placeholder\"\r\n                [formControlName]=\"controlKey(field)\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              />\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  This field is required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['min']\">\r\n                  Value should be \u2265 {{ field.validations?.min }}.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['max']\">\r\n                  Value should be \u2264 {{ field.validations?.max }}.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'email'\">\r\n              <input\r\n                type=\"email\"\r\n                [placeholder]=\"field.placeholder\"\r\n                [formControlName]=\"controlKey(field)\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              />\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  This field is required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['email']\">\r\n                  Please enter a valid email address.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                  Minimum {{ field.validations?.minLength }} characters\r\n                  required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                  Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">\r\n                  Password must contain mix of Upper and lowercase letters,\r\n                  numbers and special characters\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'textarea'\">\r\n              <textarea\r\n                [placeholder]=\"field.placeholder\"\r\n                [formControlName]=\"controlKey(field)\"\r\n                rows=\"4\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              ></textarea>\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  This field is required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\r\n                  Minimum {{ field.validations?.minLength }} characters\r\n                  required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\r\n                  Maximum {{ field.validations?.maxLength }} characters allowed.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">\r\n                  Value does not match the required pattern.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'select'\">\r\n              <select\r\n                [formControlName]=\"controlKey(field)\"\r\n                [disabled]=\"selectState[field.id]?.loading ?? false\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              >\r\n                <option value=\"\">Select an option</option>\r\n\r\n                <ng-container\r\n                  *ngFor=\"\r\n                    let opt of field.optionsSource?.mode === 'API'\r\n                      ? selectState[field.id]?.options || []\r\n                      : field.options || []\r\n                  \"\r\n                >\r\n                  <option [value]=\"opt.value\">{{ opt.label }}</option>\r\n                </ng-container>\r\n              </select>\r\n\r\n              <div\r\n                *ngIf=\"\r\n                  field.optionsSource?.mode === 'API' &&\r\n                  selectState[field.id]?.loading\r\n                \"\r\n                class=\"mt-1 text-[11px] text-slate-500\"\r\n              >\r\n                Loading options\u2026\r\n              </div>\r\n\r\n              <div\r\n                *ngIf=\"\r\n                  field.optionsSource?.mode === 'API' &&\r\n                  selectState[field.id]?.error\r\n                \"\r\n                class=\"mt-1 text-[11px] text-rose-600\"\r\n              >\r\n                {{ selectState[field.id]?.error }}\r\n              </div>\r\n\r\n              <div\r\n                *ngIf=\"\r\n                  field.optionsSource?.mode === 'API' &&\r\n                  !selectState[field.id]?.loading &&\r\n                  !selectState[field.id]?.error &&\r\n                  (selectState[field.id]?.options?.length || 0) === 0\r\n                \"\r\n                class=\"mt-1 text-[11px] text-slate-500\"\r\n              >\r\n                No options available.\r\n              </div>\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  Please select an option.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'checkbox'\">\r\n              <div class=\"flex items-center gap-2\">\r\n                <input type=\"checkbox\" [formControlName]=\"controlKey(field)\" />\r\n                <span class=\"text-xs text-gray-700\">Check</span>\r\n              </div>\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['requiredTrue']\">\r\n                  Please check this box.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'radio'\">\r\n              <div\r\n                [ngClass]=\"\r\n                  field.optionDirection === 'horizontal'\r\n                    ? 'flex flex-row gap-4 items-center'\r\n                    : 'flex flex-col gap-1'\r\n                \"\r\n              >\r\n                <label\r\n                  *ngFor=\"let opt of field.options || []\"\r\n                  class=\"inline-flex items-center gap-2 text-xs text-gray-700\"\r\n                >\r\n                  <input\r\n                    type=\"radio\"\r\n                    [value]=\"opt.value\"\r\n                    [formControlName]=\"controlKey(field)\"\r\n                  />\r\n                  <span>{{ opt.label }}</span>\r\n                </label>\r\n              </div>\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  Please choose an option.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'date'\">\r\n              <input\r\n                type=\"date\"\r\n                [formControlName]=\"controlKey(field)\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              />\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  This field is required.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['min']\">\r\n                  Date should be on or after {{ field.validations?.min }}.\r\n                </div>\r\n                <div *ngIf=\"ctrl(field)?.errors?.['max']\">\r\n                  Date should be on or before {{ field.validations?.max }}.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchCase=\"'file'\">\r\n              <div class=\"flex flex-col gap-2\">\r\n                <div class=\"flex items-center gap-2\">\r\n                  <input\r\n                    #fileInput\r\n                    type=\"file\"\r\n                    [attr.accept]=\"field.accept || null\"\r\n                    [attr.multiple]=\"field.multiple ? '' : null\"\r\n                    (change)=\"onFileChange($event, field)\"\r\n                    (blur)=\"ctrl(field)?.markAsTouched()\"\r\n                    [style.borderRadius.px]=\"\r\n                      resolvedSchema?.style?.borderRadius\r\n                    \"\r\n                    [ngClass]=\"\r\n                      resolvedSchema?.style?.inputClass ||\r\n                      'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                    \"\r\n                  />\r\n\r\n                  <button\r\n                    *ngIf=\"fileNames(field).length\"\r\n                    type=\"button\"\r\n                    class=\"px-2 py-1 text-[11px] border border-gray-300 rounded hover:bg-gray-100\"\r\n                    (click)=\"clearFiles(field, fileInput)\"\r\n                  >\r\n                    Clear\r\n                  </button>\r\n                </div>\r\n\r\n                <div class=\"text-[11px] text-gray-500\">\r\n                  <span *ngIf=\"field.accept\">Allowed: {{ field.accept }}</span>\r\n                  <span *ngIf=\"field.maxSizeMB\">\r\n                    \u2022 Max {{ field.maxSizeMB }}MB per file</span\r\n                  >\r\n                  <span *ngIf=\"field.maxFiles\">\r\n                    \u2022 Max {{ field.maxFiles }} file(s)</span\r\n                  >\r\n                </div>\r\n\r\n                <div\r\n                  *ngIf=\"fileNames(field).length\"\r\n                  class=\"text-[11px] text-gray-600\"\r\n                >\r\n                  Selected: {{ fileNames(field).join(\", \") }}\r\n                </div>\r\n              </div>\r\n\r\n              <div\r\n                *ngIf=\"showError(field)\"\r\n                class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\r\n              >\r\n                <div *ngIf=\"ctrl(field)?.errors?.['required']\">\r\n                  This field is required.\r\n                </div>\r\n\r\n                <div *ngIf=\"ctrl(field)?.errors?.['maxFiles']\">\r\n                  You can upload up to\r\n                  {{ ctrl(field)?.errors?.[\"maxFiles\"]?.max }} file(s).\r\n                </div>\r\n\r\n                <div *ngIf=\"ctrl(field)?.errors?.['maxSizeMB']\">\r\n                  {{ ctrl(field)?.errors?.[\"maxSizeMB\"]?.file }} is too large.\r\n                  Max {{ ctrl(field)?.errors?.[\"maxSizeMB\"]?.max }}MB.\r\n                </div>\r\n\r\n                <div *ngIf=\"ctrl(field)?.errors?.['accept']\">\r\n                  {{ ctrl(field)?.errors?.[\"accept\"]?.file }} is not an allowed\r\n                  file type.\r\n                </div>\r\n              </div>\r\n            </ng-container>\r\n\r\n            <ng-container *ngSwitchDefault>\r\n              <input\r\n                type=\"text\"\r\n                [placeholder]=\"field.placeholder\"\r\n                [formControlName]=\"controlKey(field)\"\r\n                [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\r\n                [ngClass]=\"\r\n                  resolvedSchema?.style?.inputClass ||\r\n                  'w-full border border-gray-300 rounded px-2 py-1 text-sm'\r\n                \"\r\n              />\r\n            </ng-container>\r\n          </ng-container>\r\n        </ng-template>\r\n      </ng-template>\r\n    </ng-template>\r\n  </form>\r\n</div>\r\n\r\n<ng-template #reviewDialogTemplate>\r\n  <div class=\"bg-white flex flex-col max-h-[90vh]\">\r\n    <div class=\"px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0\">\r\n      <h3 class=\"text-lg font-semibold text-gray-800 m-0\">Review Form Details</h3>\r\n      <button type=\"button\" (click)=\"closeReviewDialog()\" class=\"text-gray-400 hover:text-gray-600 focus:outline-none bg-transparent border-none cursor-pointer p-0\">\r\n        <svg class=\"w-6 h-6\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M6 18L18 6M6 6l12 12\"></path></svg>\r\n      </button>\r\n    </div>\r\n    \r\n    <div class=\"p-6 overflow-y-auto flex-1\">\r\n      <div *ngFor=\"let stepData of reviewData\" class=\"mb-6 last:mb-0\">\r\n        <h4 class=\"font-medium text-blue-700 border-b border-gray-100 pb-2 mb-4 mt-0\">{{ stepData.step }}</h4>\r\n        <div class=\"grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4\">\r\n          <div *ngFor=\"let fData of stepData.fields\" class=\"flex flex-col\">\r\n            <span class=\"text-xs text-gray-500 mb-1\">{{ fData.label }}</span>\r\n            <span class=\"text-sm font-medium text-gray-800 break-words whitespace-pre-wrap\">{{ fData.value }}</span>\r\n          </div>\r\n        </div>\r\n      </div>\r\n    </div>\r\n    \r\n    <div class=\"px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 shrink-0\">\r\n      <button type=\"button\" class=\"px-4 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700 cursor-pointer transition-colors\" (click)=\"closeReviewDialog()\">Edit Form</button>\r\n      <button type=\"button\" class=\"px-4 py-2 text-sm bg-blue-600 border border-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer transition-colors shadow-sm\" (click)=\"confirmReview()\">Confirm & Close</button>\r\n    </div>\r\n  </div>\r\n</ng-template>\r\n", styles: [".amigo-loading{padding:12px;opacity:.85}.amigo-error{padding:12px;border:1px solid #ef4444;border-radius:8px;color:#ef4444}.amigo-form-root{width:100%;box-sizing:border-box}.amigo-header{margin-bottom:12px}.amigo-title{font-size:18px;font-weight:700}.amigo-desc{margin-top:4px;opacity:.8}.amigo-grid{width:100%}.amigo-field{display:block}.amigo-label{display:block;font-size:13px;margin-bottom:6px;font-weight:600}.amigo-required{color:#ef4444;margin-left:4px}.amigo-input{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:14px}.amigo-hint{margin-top:6px;font-size:12px;opacity:.75}.amigo-field-error{margin-top:6px;font-size:12px;color:#ef4444}.amigo-checkbox{display:flex;align-items:center;gap:8px}.amigo-radio{display:flex;flex-direction:column;gap:6px}.amigo-radio-item{display:inline-flex;align-items:center;gap:8px}.amigo-section{margin-bottom:18px}.amigo-section-title{font-weight:700;margin-bottom:10px}.amigo-actions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.amigo-btn{padding:8px 12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer}.amigo-primary{border-color:#111827;background:#111827;color:#fff}\n"] }]
        }], ctorParameters: () => [{ type: AmigoFormService }, { type: i0.ChangeDetectorRef }, { type: i0.NgZone }, { type: AmigoApiExecutionService }, { type: AmigoSelectOptionsService }, { type: i4.MatDialog }], propDecorators: { formId: [{
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
            }], isSubmitting: [{
                type: Input
            }], reviewDialogTemplate: [{
                type: ViewChild,
                args: ['reviewDialogTemplate']
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
