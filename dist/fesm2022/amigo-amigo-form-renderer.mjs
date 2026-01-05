import * as i0 from '@angular/core';
import { InjectionToken, Optional, Inject, Injectable, EventEmitter, Output, Input, Component } from '@angular/core';
import * as i2 from '@angular/common';
import { CommonModule } from '@angular/common';
import * as i3 from '@angular/forms';
import { Validators, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import * as i1 from '@angular/common/http';
import { HTTP_INTERCEPTORS, HttpParams } from '@angular/common/http';
import { throwError } from 'rxjs';

function buildFormGroup(fields, initialValue) {
    const group = {};
    for (const f of fields) {
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
            const maxFiles = typeof f.maxFiles === 'number'
                ? f.maxFiles
                : f.multiple
                    ? undefined
                    : 1;
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

class AmigoFormComponent {
    formService;
    cdr;
    zone;
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
    constructor(formService, cdr, zone) {
        this.formService = formService;
        this.cdr = cdr;
        this.zone = zone;
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
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoFormComponent, deps: [{ token: AmigoFormService }, { token: i0.ChangeDetectorRef }, { token: i0.NgZone }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "21.0.6", type: AmigoFormComponent, isStandalone: true, selector: "amigo-form", inputs: { formId: "formId", schema: "schema", initialValue: "initialValue" }, outputs: { submitted: "submitted", submitFailed: "submitFailed", cancelled: "cancelled" }, usesOnChanges: true, ngImport: i0, template: "<div class=\"w-full h-full flex flex-col mb-6 overflow-auto\">\n\n    <!-- Loading -->\n    <div *ngIf=\"isLoading\" class=\"flex items-center justify-center p-6 text-sm text-gray-600\">\n        Loading form\u2026\n    </div>\n\n    <!-- Error -->\n    <div *ngIf=\"loadError\" class=\"p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\">\n        {{ loadError }}\n    </div>\n\n    <!-- Empty -->\n    <div *ngIf=\"!isLoading && !loadError && (!resolvedSchema?.fields || resolvedSchema.fields.length === 0)\"\n        class=\"flex justify-center items-center h-100 border border-dotted border-gray-300 rounded-xl bg-white\">\n        <h2 class=\"text-sm text-gray-600\">No fields found for this form schema.</h2>\n    </div>\n\n    <form *ngIf=\"!isLoading && !loadError && resolvedSchema?.fields?.length && form\" [formGroup]=\"form\" class=\"text-sm\"\n        [ngStyle]=\"getFormStyle()\" [ngClass]=\"resolvedSchema?.style?.formClass || ''\" (ngSubmit)=\"submit()\">\n        <h2 class=\"text-2xl my-2\">{{ resolvedSchema.name }}</h2>\n\n        <p *ngIf=\"resolvedSchema.description\" class=\"text-[13px] text-gray-500 mb-4\">\n            {{ resolvedSchema.description }}\n        </p>\n\n        <!-- MULTI STEP PROGRESS -->\n        <div *ngIf=\"isMultiStep\" class=\"w-full mb-6 flex flex-col items-center my-3\">\n        \n            <!-- progress bar -->\n            <div class=\"w-full h-1 bg-gray-200 rounded-full relative mb-6\">\n                <div class=\"h-1 rounded-full transition-all duration-300\" [ngStyle]=\"{\n                width: ((activeStepIndex + 1) / totalSteps) * 100 + '%',\n                backgroundColor: submitButtonStyle['backgroundColor']\n              }\">\n                </div>\n            </div>\n        \n            <!-- step circles -->\n            <div class=\"flex items-center justify-center gap-10\">\n                <div *ngFor=\"let step of orderedSteps; let i = index\" class=\"flex flex-col items-center cursor-pointer\"\n                    (click)=\"setActiveStep(i)\">\n        \n                    <div class=\"w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all duration-300\"\n                        [ngStyle]=\"\n                  i === activeStepIndex\n                    ? {\n                        backgroundColor: submitButtonStyle['backgroundColor'],\n                        borderColor: submitButtonStyle['backgroundColor'],\n                        color: submitButtonStyle['color']\n                      }\n                    : {\n                        backgroundColor: '#FFFFFF',\n                        borderColor: '#9CA3AF',\n                        color: '#374151'\n                      }\n                \">\n        \n                        <!-- if no icon -->\n                        <ng-container *ngIf=\"!step.icon\">\n                            {{ i + 1 }}\n                        </ng-container>\n        \n                        <!-- if icon -->\n                        <ng-container *ngIf=\"step.icon\">\n                            <i [class]=\"step.icon\" class=\"text-lg\" [ngStyle]=\"\n                      i === activeStepIndex\n                        ? { color: submitButtonStyle['color'] }\n                        : { color: '#6B7280' }\n                    \">\n                            </i>\n                        </ng-container>\n        \n                    </div>\n        \n                    <div class=\"mt-2 text-xs text-gray-600 font-medium\">\n                        {{ step.label }}\n                    </div>\n                </div>\n            </div>\n        \n            <div *ngIf=\"visibleFields.length === 0\" class=\"text-xs text-gray-500 my-5\">\n                No fields assigned to this step yet.\n            </div>\n        </div>\n\n\n        <!-- SINGLE-SECTIONAL MODE -->\n        <div *ngIf=\"isSectional; else normalOrMulti\">\n            <div *ngFor=\"let sec of orderedSections\" class=\"mb-6\">\n                <div class=\"flex items-center justify-between mb-2 border-b border-gray-200 pb-2\">\n                    <h3 class=\"text-[11px] font-semibold uppercase text-blue-700\">{{ sec.label }}</h3>\n                    <span class=\"text-[11px] text-gray-500\">{{ fieldsForSection(sec.id).length }} fields</span>\n                </div>\n\n                <div class=\"grid\" [ngStyle]=\"{\n            'grid-template-columns': 'repeat(' + (resolvedSchema.layout?.columns || 1) + ', minmax(0, 1fr))',\n            'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\n            'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px'\n          }\">\n                    <div *ngFor=\"let field of fieldsForSection(sec.id); trackBy: trackByFieldId\"\n                        [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\n                        [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\">\n                        <ng-container *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"></ng-container>\n                    </div>\n                </div>\n\n                <div *ngIf=\"fieldsForSection(sec.id).length === 0\" class=\"text-xs text-gray-500 mt-2\">\n                    No fields in this section yet.\n                </div>\n            </div>\n        </div>\n\n        <!-- NORMAL (single) + MULTI -->\n        <ng-template #normalOrMulti>\n            <div class=\"grid\" [ngStyle]=\"{\n          'grid-template-columns': 'repeat(' + (resolvedSchema.layout?.columns || 1) + ', minmax(0, 1fr))',\n          'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\n          'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px'\n        }\">\n                <div *ngFor=\"let field of visibleFields; trackBy: trackByFieldId\"\n                    [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\n                    [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\">\n                    <ng-container *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"></ng-container>\n                </div>\n            </div>\n        </ng-template>\n\n        <!-- Multi-step nav -->\n        <div *ngIf=\"isMultiStep\" class=\"mt-4 flex items-center justify-between text-xs\">\n            <button type=\"button\" class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\n                (click)=\"prevStep()\" [disabled]=\"activeStepIndex === 0\">\n                \u2190 Previous step\n            </button>\n\n            <button type=\"button\" class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\n                (click)=\"nextStep()\" [disabled]=\"activeStepIndex === totalSteps - 1\">\n                Next step \u2192\n            </button>\n        </div>\n\n        <!-- Submit error (API) -->\n        <div *ngIf=\"submitError\" class=\"mt-3 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\">\n            {{ submitError }}\n        </div>\n        \n        <!-- Actions -->\n        <div class=\"mt-4 flex items-center gap-2\">\n            <button type=\"submit\" (mouseenter)=\"isSubmitHovered = true\" (mouseleave)=\"isSubmitHovered = false\"\n                [ngStyle]=\"submitButtonStyle\" [disabled]=\"isSubmitting\"\n                [ngClass]=\"resolvedSchema.style?.buttonClass || 'px-4 py-2 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed'\">\n                {{ isSubmitting ? 'Submitting...' : (resolvedSchema.actions?.submitLabel || 'Submit') }}\n            </button>\n        \n            <button *ngIf=\"showCancelButton\" type=\"button\" (click)=\"onCancel()\" (mouseenter)=\"isCancelHovered = true\"\n                (mouseleave)=\"isCancelHovered = false\" [disabled]=\"isSubmitting\" [ngStyle]=\"cancelButtonStyle\"\n                [ngClass]=\"resolvedSchema.style?.buttonClass || 'px-4 py-2 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed'\">\n                {{ resolvedSchema.actions?.cancelLabel || 'Cancel' }}\n            </button>\n        </div>\n\n\n        <!-- Field renderer template -->\n        <ng-template #fieldRenderer let-field>\n            <!-- INFO CARD (non-input block) -->\n            <ng-container *ngIf=\"isCard(field); else inputField\">\n                <div [ngStyle]=\"cardStyle(field)\" class=\"w-full flex items-start gap-3\">\n                    <!-- Icon -->\n                    <div class=\"shrink-0 mt-0.5 text-lg leading-none\" [ngStyle]=\"cardIconStyle(field)\">\n                        <!-- If it's a bootstrap-icons class like \"bi bi-shield-check\" -->\n                        <i *ngIf=\"isBootstrapIcon(cardIcon(field))\" [class]=\"cardIcon(field)\"></i>\n            \n                        <!-- Else treat it like a normal emoji/text icon -->\n                        <span *ngIf=\"!isBootstrapIcon(cardIcon(field))\">{{ cardIcon(field) }}</span>\n                    </div>\n            \n                    <!-- Content -->\n                    <div class=\"min-w-0\">\n                        <div class=\"text-sm font-semibold leading-tight\">\n                            {{ cardTitle(field) }}\n                        </div>\n            \n                        <div *ngIf=\"cardBody(field)\" class=\"mt-1 text-xs opacity-90\">\n                            {{ cardBody(field) }}\n                        </div>\n                    </div>\n                </div>\n            </ng-container>\n\n\n            <!-- INPUT FIELD -->\n            <ng-template #inputField>\n                <label [ngClass]=\"resolvedSchema?.style?.labelClass || 'block text-sm font-medium mb-1'\">\n                    {{ field.label }}\n                    <span *ngIf=\"field.required === true || field.required === 'true' || field.validations?.required\"\n                        class=\"text-red-500\">*</span>\n                </label>\n\n                <ng-container [ngSwitch]=\"field.type\">\n\n                <!-- TEXT -->\n                <ng-container *ngSwitchCase=\"'text'\">\n                    <input type=\"text\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                            Minimum {{ field.validations?.minLength }} characters required.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                            Maximum {{ field.validations?.maxLength }} characters allowed.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.</div>\n                    </div>\n                </ng-container>\n\n                <!-- PASSWORD -->\n                <ng-container *ngSwitchCase=\"'password'\">\n                    <input type=\"password\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                            Minimum {{ field.validations?.minLength }} characters required.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                            Maximum {{ field.validations?.maxLength }} characters allowed.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.</div>\n                    </div>\n                </ng-container>\n\n                <!-- NUMBER -->\n                <ng-container *ngSwitchCase=\"'number'\">\n                    <input type=\"number\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['min']\">Value should be \u2265 {{ field.validations?.min }}.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['max']\">Value should be \u2264 {{ field.validations?.max }}.</div>\n                    </div>\n                </ng-container>\n\n                <!-- EMAIL -->\n                <ng-container *ngSwitchCase=\"'email'\">\n                    <input type=\"email\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['email']\">Please enter a valid email address.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                            Minimum {{ field.validations?.minLength }} characters required.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                            Maximum {{ field.validations?.maxLength }} characters allowed.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.</div>\n                    </div>\n                </ng-container>\n\n                <!-- TEXTAREA -->\n                <ng-container *ngSwitchCase=\"'textarea'\">\n                    <textarea [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\" rows=\"4\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\"></textarea>\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                            Minimum {{ field.validations?.minLength }} characters required.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                            Maximum {{ field.validations?.maxLength }} characters allowed.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.</div>\n                    </div>\n                </ng-container>\n\n                <!-- SELECT -->\n                <ng-container *ngSwitchCase=\"'select'\">\n                    <select [formControlName]=\"controlKey(field)\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\">\n                        <option [ngValue]=\"null\" disabled>\n                            {{ field.placeholder || 'Select an option' }}\n                        </option>\n                        <option *ngFor=\"let opt of field.options || []\" [ngValue]=\"opt.value\">\n                            {{ opt.label }}\n                        </option>\n                    </select>\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">Please select an option.</div>\n                    </div>\n                </ng-container>\n\n                <!-- CHECKBOX -->\n                <ng-container *ngSwitchCase=\"'checkbox'\">\n                    <div class=\"flex items-center gap-2\">\n                        <input type=\"checkbox\" [formControlName]=\"controlKey(field)\" />\n                        <span class=\"text-xs text-gray-700\">Check</span>\n                    </div>\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['requiredTrue']\">Please check this box.</div>\n                    </div>\n                </ng-container>\n\n                <!-- RADIO -->\n                <ng-container *ngSwitchCase=\"'radio'\">\n                    <div\n                        [ngClass]=\"field.optionDirection === 'horizontal' ? 'flex flex-row gap-4 items-center' : 'flex flex-col gap-1'\">\n                        <label *ngFor=\"let opt of field.options || []\"\n                            class=\"inline-flex items-center gap-2 text-xs text-gray-700\">\n                            <input type=\"radio\" [value]=\"opt.value\" [formControlName]=\"controlKey(field)\" />\n                            <span>{{ opt.label }}</span>\n                        </label>\n                    </div>\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">Please choose an option.</div>\n                    </div>\n                </ng-container>\n\n                <!-- DATE -->\n                <ng-container *ngSwitchCase=\"'date'\">\n                    <input type=\"date\" [formControlName]=\"controlKey(field)\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['min']\">Date should be on or after {{ field.validations?.min\n                            }}.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['max']\">Date should be on or before {{ field.validations?.max\n                            }}.</div>\n                    </div>\n                </ng-container>\n\n                <!-- FILE -->\n                <ng-container *ngSwitchCase=\"'file'\">\n                    <div class=\"flex flex-col gap-2\">\n                        <div class=\"flex items-center gap-2\">\n                            <input #fileInput type=\"file\" [attr.accept]=\"field.accept || null\"\n                                [attr.multiple]=\"field.multiple ? '' : null\" (change)=\"onFileChange($event, field)\"\n                                (blur)=\"ctrl(field)?.markAsTouched()\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                            <button *ngIf=\"fileNames(field).length\" type=\"button\"\n                                class=\"px-2 py-1 text-[11px] border border-gray-300 rounded hover:bg-gray-100\"\n                                (click)=\"clearFiles(field, fileInput)\">\n                                Clear\n                            </button>\n                        </div>\n\n                        <div class=\"text-[11px] text-gray-500\">\n                            <span *ngIf=\"field.accept\">Allowed: {{ field.accept }}</span>\n                            <span *ngIf=\"field.maxSizeMB\"> \u2022 Max {{ field.maxSizeMB }}MB per file</span>\n                            <span *ngIf=\"field.maxFiles\"> \u2022 Max {{ field.maxFiles }} file(s)</span>\n                        </div>\n\n                        <div *ngIf=\"fileNames(field).length\" class=\"text-[11px] text-gray-600\">\n                            Selected: {{ fileNames(field).join(', ') }}\n                        </div>\n                    </div>\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n\n                        <div *ngIf=\"ctrl(field)?.errors?.['maxFiles']\">\n                            You can upload up to {{ ctrl(field)?.errors?.['maxFiles']?.max }} file(s).\n                        </div>\n\n                        <div *ngIf=\"ctrl(field)?.errors?.['maxSizeMB']\">\n                            {{ ctrl(field)?.errors?.['maxSizeMB']?.file }} is too large. Max\n                            {{ ctrl(field)?.errors?.['maxSizeMB']?.max }}MB.\n                        </div>\n\n                        <div *ngIf=\"ctrl(field)?.errors?.['accept']\">\n                            {{ ctrl(field)?.errors?.['accept']?.file }} is not an allowed file type.\n                        </div>\n                    </div>\n                </ng-container>\n\n                <!-- DEFAULT -->\n                <ng-container *ngSwitchDefault>\n                    <input type=\"text\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n                </ng-container>\n\n                </ng-container>\n            </ng-template>\n        </ng-template>\n    </form>\n</div>", styles: [".amigo-loading{padding:12px;opacity:.85}.amigo-error{padding:12px;border:1px solid #ef4444;border-radius:8px;color:#ef4444}.amigo-form-root{width:100%;box-sizing:border-box}.amigo-header{margin-bottom:12px}.amigo-title{font-size:18px;font-weight:700}.amigo-desc{margin-top:4px;opacity:.8}.amigo-grid{width:100%}.amigo-field{display:block}.amigo-label{display:block;font-size:13px;margin-bottom:6px;font-weight:600}.amigo-required{color:#ef4444;margin-left:4px}.amigo-input{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:14px}.amigo-hint{margin-top:6px;font-size:12px;opacity:.75}.amigo-field-error{margin-top:6px;font-size:12px;color:#ef4444}.amigo-checkbox{display:flex;align-items:center;gap:8px}.amigo-radio{display:flex;flex-direction:column;gap:6px}.amigo-radio-item{display:inline-flex;align-items:center;gap:8px}.amigo-section{margin-bottom:18px}.amigo-section-title{font-weight:700;margin-bottom:10px}.amigo-actions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.amigo-btn{padding:8px 12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer}.amigo-primary{border-color:#111827;background:#111827;color:#fff}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i2.NgClass, selector: "[ngClass]", inputs: ["class", "ngClass"] }, { kind: "directive", type: i2.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i2.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i2.NgTemplateOutlet, selector: "[ngTemplateOutlet]", inputs: ["ngTemplateOutletContext", "ngTemplateOutlet", "ngTemplateOutletInjector"] }, { kind: "directive", type: i2.NgStyle, selector: "[ngStyle]", inputs: ["ngStyle"] }, { kind: "directive", type: i2.NgSwitch, selector: "[ngSwitch]", inputs: ["ngSwitch"] }, { kind: "directive", type: i2.NgSwitchCase, selector: "[ngSwitchCase]", inputs: ["ngSwitchCase"] }, { kind: "directive", type: i2.NgSwitchDefault, selector: "[ngSwitchDefault]" }, { kind: "ngmodule", type: ReactiveFormsModule }, { kind: "directive", type: i3.ɵNgNoValidate, selector: "form:not([ngNoForm]):not([ngNativeValidate])" }, { kind: "directive", type: i3.NgSelectOption, selector: "option", inputs: ["ngValue", "value"] }, { kind: "directive", type: i3.ɵNgSelectMultipleOption, selector: "option", inputs: ["ngValue", "value"] }, { kind: "directive", type: i3.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i3.NumberValueAccessor, selector: "input[type=number][formControlName],input[type=number][formControl],input[type=number][ngModel]" }, { kind: "directive", type: i3.CheckboxControlValueAccessor, selector: "input[type=checkbox][formControlName],input[type=checkbox][formControl],input[type=checkbox][ngModel]" }, { kind: "directive", type: i3.SelectControlValueAccessor, selector: "select:not([multiple])[formControlName],select:not([multiple])[formControl],select:not([multiple])[ngModel]", inputs: ["compareWith"] }, { kind: "directive", type: i3.RadioControlValueAccessor, selector: "input[type=radio][formControlName],input[type=radio][formControl],input[type=radio][ngModel]", inputs: ["name", "formControlName", "value"] }, { kind: "directive", type: i3.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i3.NgControlStatusGroup, selector: "[formGroupName],[formArrayName],[ngModelGroup],[formGroup],[formArray],form:not([ngNoForm]),[ngForm]" }, { kind: "directive", type: i3.FormGroupDirective, selector: "[formGroup]", inputs: ["formGroup"], outputs: ["ngSubmit"], exportAs: ["ngForm"] }, { kind: "directive", type: i3.FormControlName, selector: "[formControlName]", inputs: ["formControlName", "disabled", "ngModel"], outputs: ["ngModelChange"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.0.6", ngImport: i0, type: AmigoFormComponent, decorators: [{
            type: Component,
            args: [{ selector: "amigo-form", standalone: true, imports: [CommonModule, ReactiveFormsModule], template: "<div class=\"w-full h-full flex flex-col mb-6 overflow-auto\">\n\n    <!-- Loading -->\n    <div *ngIf=\"isLoading\" class=\"flex items-center justify-center p-6 text-sm text-gray-600\">\n        Loading form\u2026\n    </div>\n\n    <!-- Error -->\n    <div *ngIf=\"loadError\" class=\"p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\">\n        {{ loadError }}\n    </div>\n\n    <!-- Empty -->\n    <div *ngIf=\"!isLoading && !loadError && (!resolvedSchema?.fields || resolvedSchema.fields.length === 0)\"\n        class=\"flex justify-center items-center h-100 border border-dotted border-gray-300 rounded-xl bg-white\">\n        <h2 class=\"text-sm text-gray-600\">No fields found for this form schema.</h2>\n    </div>\n\n    <form *ngIf=\"!isLoading && !loadError && resolvedSchema?.fields?.length && form\" [formGroup]=\"form\" class=\"text-sm\"\n        [ngStyle]=\"getFormStyle()\" [ngClass]=\"resolvedSchema?.style?.formClass || ''\" (ngSubmit)=\"submit()\">\n        <h2 class=\"text-2xl my-2\">{{ resolvedSchema.name }}</h2>\n\n        <p *ngIf=\"resolvedSchema.description\" class=\"text-[13px] text-gray-500 mb-4\">\n            {{ resolvedSchema.description }}\n        </p>\n\n        <!-- MULTI STEP PROGRESS -->\n        <div *ngIf=\"isMultiStep\" class=\"w-full mb-6 flex flex-col items-center my-3\">\n        \n            <!-- progress bar -->\n            <div class=\"w-full h-1 bg-gray-200 rounded-full relative mb-6\">\n                <div class=\"h-1 rounded-full transition-all duration-300\" [ngStyle]=\"{\n                width: ((activeStepIndex + 1) / totalSteps) * 100 + '%',\n                backgroundColor: submitButtonStyle['backgroundColor']\n              }\">\n                </div>\n            </div>\n        \n            <!-- step circles -->\n            <div class=\"flex items-center justify-center gap-10\">\n                <div *ngFor=\"let step of orderedSteps; let i = index\" class=\"flex flex-col items-center cursor-pointer\"\n                    (click)=\"setActiveStep(i)\">\n        \n                    <div class=\"w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all duration-300\"\n                        [ngStyle]=\"\n                  i === activeStepIndex\n                    ? {\n                        backgroundColor: submitButtonStyle['backgroundColor'],\n                        borderColor: submitButtonStyle['backgroundColor'],\n                        color: submitButtonStyle['color']\n                      }\n                    : {\n                        backgroundColor: '#FFFFFF',\n                        borderColor: '#9CA3AF',\n                        color: '#374151'\n                      }\n                \">\n        \n                        <!-- if no icon -->\n                        <ng-container *ngIf=\"!step.icon\">\n                            {{ i + 1 }}\n                        </ng-container>\n        \n                        <!-- if icon -->\n                        <ng-container *ngIf=\"step.icon\">\n                            <i [class]=\"step.icon\" class=\"text-lg\" [ngStyle]=\"\n                      i === activeStepIndex\n                        ? { color: submitButtonStyle['color'] }\n                        : { color: '#6B7280' }\n                    \">\n                            </i>\n                        </ng-container>\n        \n                    </div>\n        \n                    <div class=\"mt-2 text-xs text-gray-600 font-medium\">\n                        {{ step.label }}\n                    </div>\n                </div>\n            </div>\n        \n            <div *ngIf=\"visibleFields.length === 0\" class=\"text-xs text-gray-500 my-5\">\n                No fields assigned to this step yet.\n            </div>\n        </div>\n\n\n        <!-- SINGLE-SECTIONAL MODE -->\n        <div *ngIf=\"isSectional; else normalOrMulti\">\n            <div *ngFor=\"let sec of orderedSections\" class=\"mb-6\">\n                <div class=\"flex items-center justify-between mb-2 border-b border-gray-200 pb-2\">\n                    <h3 class=\"text-[11px] font-semibold uppercase text-blue-700\">{{ sec.label }}</h3>\n                    <span class=\"text-[11px] text-gray-500\">{{ fieldsForSection(sec.id).length }} fields</span>\n                </div>\n\n                <div class=\"grid\" [ngStyle]=\"{\n            'grid-template-columns': 'repeat(' + (resolvedSchema.layout?.columns || 1) + ', minmax(0, 1fr))',\n            'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\n            'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px'\n          }\">\n                    <div *ngFor=\"let field of fieldsForSection(sec.id); trackBy: trackByFieldId\"\n                        [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\n                        [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\">\n                        <ng-container *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"></ng-container>\n                    </div>\n                </div>\n\n                <div *ngIf=\"fieldsForSection(sec.id).length === 0\" class=\"text-xs text-gray-500 mt-2\">\n                    No fields in this section yet.\n                </div>\n            </div>\n        </div>\n\n        <!-- NORMAL (single) + MULTI -->\n        <ng-template #normalOrMulti>\n            <div class=\"grid\" [ngStyle]=\"{\n          'grid-template-columns': 'repeat(' + (resolvedSchema.layout?.columns || 1) + ', minmax(0, 1fr))',\n          'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\n          'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px'\n        }\">\n                <div *ngFor=\"let field of visibleFields; trackBy: trackByFieldId\"\n                    [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\n                    [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\">\n                    <ng-container *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"></ng-container>\n                </div>\n            </div>\n        </ng-template>\n\n        <!-- Multi-step nav -->\n        <div *ngIf=\"isMultiStep\" class=\"mt-4 flex items-center justify-between text-xs\">\n            <button type=\"button\" class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\n                (click)=\"prevStep()\" [disabled]=\"activeStepIndex === 0\">\n                \u2190 Previous step\n            </button>\n\n            <button type=\"button\" class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\n                (click)=\"nextStep()\" [disabled]=\"activeStepIndex === totalSteps - 1\">\n                Next step \u2192\n            </button>\n        </div>\n\n        <!-- Submit error (API) -->\n        <div *ngIf=\"submitError\" class=\"mt-3 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\">\n            {{ submitError }}\n        </div>\n        \n        <!-- Actions -->\n        <div class=\"mt-4 flex items-center gap-2\">\n            <button type=\"submit\" (mouseenter)=\"isSubmitHovered = true\" (mouseleave)=\"isSubmitHovered = false\"\n                [ngStyle]=\"submitButtonStyle\" [disabled]=\"isSubmitting\"\n                [ngClass]=\"resolvedSchema.style?.buttonClass || 'px-4 py-2 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed'\">\n                {{ isSubmitting ? 'Submitting...' : (resolvedSchema.actions?.submitLabel || 'Submit') }}\n            </button>\n        \n            <button *ngIf=\"showCancelButton\" type=\"button\" (click)=\"onCancel()\" (mouseenter)=\"isCancelHovered = true\"\n                (mouseleave)=\"isCancelHovered = false\" [disabled]=\"isSubmitting\" [ngStyle]=\"cancelButtonStyle\"\n                [ngClass]=\"resolvedSchema.style?.buttonClass || 'px-4 py-2 rounded text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed'\">\n                {{ resolvedSchema.actions?.cancelLabel || 'Cancel' }}\n            </button>\n        </div>\n\n\n        <!-- Field renderer template -->\n        <ng-template #fieldRenderer let-field>\n            <!-- INFO CARD (non-input block) -->\n            <ng-container *ngIf=\"isCard(field); else inputField\">\n                <div [ngStyle]=\"cardStyle(field)\" class=\"w-full flex items-start gap-3\">\n                    <!-- Icon -->\n                    <div class=\"shrink-0 mt-0.5 text-lg leading-none\" [ngStyle]=\"cardIconStyle(field)\">\n                        <!-- If it's a bootstrap-icons class like \"bi bi-shield-check\" -->\n                        <i *ngIf=\"isBootstrapIcon(cardIcon(field))\" [class]=\"cardIcon(field)\"></i>\n            \n                        <!-- Else treat it like a normal emoji/text icon -->\n                        <span *ngIf=\"!isBootstrapIcon(cardIcon(field))\">{{ cardIcon(field) }}</span>\n                    </div>\n            \n                    <!-- Content -->\n                    <div class=\"min-w-0\">\n                        <div class=\"text-sm font-semibold leading-tight\">\n                            {{ cardTitle(field) }}\n                        </div>\n            \n                        <div *ngIf=\"cardBody(field)\" class=\"mt-1 text-xs opacity-90\">\n                            {{ cardBody(field) }}\n                        </div>\n                    </div>\n                </div>\n            </ng-container>\n\n\n            <!-- INPUT FIELD -->\n            <ng-template #inputField>\n                <label [ngClass]=\"resolvedSchema?.style?.labelClass || 'block text-sm font-medium mb-1'\">\n                    {{ field.label }}\n                    <span *ngIf=\"field.required === true || field.required === 'true' || field.validations?.required\"\n                        class=\"text-red-500\">*</span>\n                </label>\n\n                <ng-container [ngSwitch]=\"field.type\">\n\n                <!-- TEXT -->\n                <ng-container *ngSwitchCase=\"'text'\">\n                    <input type=\"text\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                            Minimum {{ field.validations?.minLength }} characters required.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                            Maximum {{ field.validations?.maxLength }} characters allowed.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.</div>\n                    </div>\n                </ng-container>\n\n                <!-- PASSWORD -->\n                <ng-container *ngSwitchCase=\"'password'\">\n                    <input type=\"password\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                            Minimum {{ field.validations?.minLength }} characters required.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                            Maximum {{ field.validations?.maxLength }} characters allowed.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.</div>\n                    </div>\n                </ng-container>\n\n                <!-- NUMBER -->\n                <ng-container *ngSwitchCase=\"'number'\">\n                    <input type=\"number\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['min']\">Value should be \u2265 {{ field.validations?.min }}.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['max']\">Value should be \u2264 {{ field.validations?.max }}.</div>\n                    </div>\n                </ng-container>\n\n                <!-- EMAIL -->\n                <ng-container *ngSwitchCase=\"'email'\">\n                    <input type=\"email\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['email']\">Please enter a valid email address.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                            Minimum {{ field.validations?.minLength }} characters required.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                            Maximum {{ field.validations?.maxLength }} characters allowed.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.</div>\n                    </div>\n                </ng-container>\n\n                <!-- TEXTAREA -->\n                <ng-container *ngSwitchCase=\"'textarea'\">\n                    <textarea [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\" rows=\"4\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\"></textarea>\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['minlength']\">\n                            Minimum {{ field.validations?.minLength }} characters required.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['maxlength']\">\n                            Maximum {{ field.validations?.maxLength }} characters allowed.\n                        </div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['pattern']\">Value does not match the required pattern.</div>\n                    </div>\n                </ng-container>\n\n                <!-- SELECT -->\n                <ng-container *ngSwitchCase=\"'select'\">\n                    <select [formControlName]=\"controlKey(field)\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\">\n                        <option [ngValue]=\"null\" disabled>\n                            {{ field.placeholder || 'Select an option' }}\n                        </option>\n                        <option *ngFor=\"let opt of field.options || []\" [ngValue]=\"opt.value\">\n                            {{ opt.label }}\n                        </option>\n                    </select>\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">Please select an option.</div>\n                    </div>\n                </ng-container>\n\n                <!-- CHECKBOX -->\n                <ng-container *ngSwitchCase=\"'checkbox'\">\n                    <div class=\"flex items-center gap-2\">\n                        <input type=\"checkbox\" [formControlName]=\"controlKey(field)\" />\n                        <span class=\"text-xs text-gray-700\">Check</span>\n                    </div>\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['requiredTrue']\">Please check this box.</div>\n                    </div>\n                </ng-container>\n\n                <!-- RADIO -->\n                <ng-container *ngSwitchCase=\"'radio'\">\n                    <div\n                        [ngClass]=\"field.optionDirection === 'horizontal' ? 'flex flex-row gap-4 items-center' : 'flex flex-col gap-1'\">\n                        <label *ngFor=\"let opt of field.options || []\"\n                            class=\"inline-flex items-center gap-2 text-xs text-gray-700\">\n                            <input type=\"radio\" [value]=\"opt.value\" [formControlName]=\"controlKey(field)\" />\n                            <span>{{ opt.label }}</span>\n                        </label>\n                    </div>\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">Please choose an option.</div>\n                    </div>\n                </ng-container>\n\n                <!-- DATE -->\n                <ng-container *ngSwitchCase=\"'date'\">\n                    <input type=\"date\" [formControlName]=\"controlKey(field)\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['min']\">Date should be on or after {{ field.validations?.min\n                            }}.</div>\n                        <div *ngIf=\"ctrl(field)?.errors?.['max']\">Date should be on or before {{ field.validations?.max\n                            }}.</div>\n                    </div>\n                </ng-container>\n\n                <!-- FILE -->\n                <ng-container *ngSwitchCase=\"'file'\">\n                    <div class=\"flex flex-col gap-2\">\n                        <div class=\"flex items-center gap-2\">\n                            <input #fileInput type=\"file\" [attr.accept]=\"field.accept || null\"\n                                [attr.multiple]=\"field.multiple ? '' : null\" (change)=\"onFileChange($event, field)\"\n                                (blur)=\"ctrl(field)?.markAsTouched()\"\n                                [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n\n                            <button *ngIf=\"fileNames(field).length\" type=\"button\"\n                                class=\"px-2 py-1 text-[11px] border border-gray-300 rounded hover:bg-gray-100\"\n                                (click)=\"clearFiles(field, fileInput)\">\n                                Clear\n                            </button>\n                        </div>\n\n                        <div class=\"text-[11px] text-gray-500\">\n                            <span *ngIf=\"field.accept\">Allowed: {{ field.accept }}</span>\n                            <span *ngIf=\"field.maxSizeMB\"> \u2022 Max {{ field.maxSizeMB }}MB per file</span>\n                            <span *ngIf=\"field.maxFiles\"> \u2022 Max {{ field.maxFiles }} file(s)</span>\n                        </div>\n\n                        <div *ngIf=\"fileNames(field).length\" class=\"text-[11px] text-gray-600\">\n                            Selected: {{ fileNames(field).join(', ') }}\n                        </div>\n                    </div>\n\n                    <div *ngIf=\"showError(field)\" class=\"mt-1 text-[11px] text-red-600 space-y-0.5\">\n                        <div *ngIf=\"ctrl(field)?.errors?.['required']\">This field is required.</div>\n\n                        <div *ngIf=\"ctrl(field)?.errors?.['maxFiles']\">\n                            You can upload up to {{ ctrl(field)?.errors?.['maxFiles']?.max }} file(s).\n                        </div>\n\n                        <div *ngIf=\"ctrl(field)?.errors?.['maxSizeMB']\">\n                            {{ ctrl(field)?.errors?.['maxSizeMB']?.file }} is too large. Max\n                            {{ ctrl(field)?.errors?.['maxSizeMB']?.max }}MB.\n                        </div>\n\n                        <div *ngIf=\"ctrl(field)?.errors?.['accept']\">\n                            {{ ctrl(field)?.errors?.['accept']?.file }} is not an allowed file type.\n                        </div>\n                    </div>\n                </ng-container>\n\n                <!-- DEFAULT -->\n                <ng-container *ngSwitchDefault>\n                    <input type=\"text\" [placeholder]=\"field.placeholder\" [formControlName]=\"controlKey(field)\"\n                        [ngClass]=\"resolvedSchema?.style?.inputClass || 'w-full border border-gray-300 rounded px-2 py-1 text-sm'\" />\n                </ng-container>\n\n                </ng-container>\n            </ng-template>\n        </ng-template>\n    </form>\n</div>", styles: [".amigo-loading{padding:12px;opacity:.85}.amigo-error{padding:12px;border:1px solid #ef4444;border-radius:8px;color:#ef4444}.amigo-form-root{width:100%;box-sizing:border-box}.amigo-header{margin-bottom:12px}.amigo-title{font-size:18px;font-weight:700}.amigo-desc{margin-top:4px;opacity:.8}.amigo-grid{width:100%}.amigo-field{display:block}.amigo-label{display:block;font-size:13px;margin-bottom:6px;font-weight:600}.amigo-required{color:#ef4444;margin-left:4px}.amigo-input{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:14px}.amigo-hint{margin-top:6px;font-size:12px;opacity:.75}.amigo-field-error{margin-top:6px;font-size:12px;color:#ef4444}.amigo-checkbox{display:flex;align-items:center;gap:8px}.amigo-radio{display:flex;flex-direction:column;gap:6px}.amigo-radio-item{display:inline-flex;align-items:center;gap:8px}.amigo-section{margin-bottom:18px}.amigo-section-title{font-weight:700;margin-bottom:10px}.amigo-actions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.amigo-btn{padding:8px 12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer}.amigo-primary{border-color:#111827;background:#111827;color:#fff}\n"] }]
        }], ctorParameters: () => [{ type: AmigoFormService }, { type: i0.ChangeDetectorRef }, { type: i0.NgZone }], propDecorators: { formId: [{
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

export { AMIGO_AUTH_TOKEN_PROVIDER, AMIGO_FORM_CONFIG, AmigoFormComponent, AmigoFormService, AmigoTokenInterceptor, buildFormGroup, normalizeAccept, provideAmigoForm };
//# sourceMappingURL=amigo-amigo-form-renderer.mjs.map
