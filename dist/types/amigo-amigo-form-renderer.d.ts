import * as i0 from '@angular/core';
import { InjectionToken, Provider, OnChanges, EventEmitter, ChangeDetectorRef, NgZone, SimpleChanges } from '@angular/core';
import { FormGroup, AbstractControl } from '@angular/forms';
import { HttpClient, HttpContextToken, HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

type FormType = 'single' | 'multi' | 'single-sectional';
type FieldType = 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'file' | 'card' | 'password' | 'info-card' | 'button';
type OptionsSourceMode = "STATIC" | "API";
type SelectAuthType = "NONE" | "BEARER";
type SelectTokenFrom = "LOCAL_STORAGE" | "SESSION_STORAGE" | "CUSTOM_CALLBACK";
interface SelectOptionsResponseMapping {
    labelKey: string;
    valueKey: string;
    dataPath?: string;
}
interface SelectOptionsApiConfig {
    url: string;
    method: HttpMethod;
    secured?: boolean;
    authType?: SelectAuthType;
    tokenFrom?: SelectTokenFrom;
    tokenKey?: string;
    responseMapping: SelectOptionsResponseMapping;
}
interface SelectOptionsSourceSchema {
    mode: OptionsSourceMode;
    api?: SelectOptionsApiConfig;
}
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type ButtonStyleVariant = 'primary' | 'secondary' | 'danger';
interface KeyValuePair {
    key: string;
    value: string;
}
interface ApiEndpointConfig {
    method: HttpMethod;
    url: string;
    headers?: KeyValuePair[];
    queryParams?: KeyValuePair[];
    /** map request body keys to form values: { "employeeId": "employee.id", "amount": "{{salary}}" } */
    bodyMapping?: Record<string, string>;
}
interface ButtonElementSchema {
    label?: string;
    styleVariant?: ButtonStyleVariant;
    actionType?: 'API_CALL';
    api?: ApiEndpointConfig;
    successMessage?: string;
    errorMessage?: string;
    /** default true */
    triggerValidation?: boolean;
}
/**
 * Informational card (non-input) that can be placed inside the form layout.
 * Used to show messages like “Secure Verification”.
 */
interface InfoCardStyle {
    borderColor?: string;
    backgroundColor?: string;
    textColor?: string;
    iconColor?: string;
    borderWidth?: number;
    borderRadius?: number;
}
interface InfoCardSchema {
    /** Optional icon (emoji/text). Keep it simple to avoid needing icon libraries. */
    icon?: string;
    title?: string;
    body?: string;
    style?: InfoCardStyle;
}
interface FormFieldOption {
    value: any;
    label: string;
}
interface FieldValidationRules {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
}
interface FormFieldSchema {
    id: string;
    label: string;
    type: FieldType;
    name: string;
    placeholder?: string;
    /**
     * For input fields this can be boolean or 'true'/'false'.
     * For non-input blocks like cards, it may be omitted.
     */
    required?: string | boolean;
    /** Informational card configuration (used when type is 'card' or 'info-card'). */
    card?: InfoCardSchema;
    /**
     * FILE upload configuration (emitted by form-composer-canvas)
     * Example accept: "image/*,.pdf"
     */
    accept?: string;
    multiple?: boolean;
    /** Maximum number of files allowed (default 1) */
    maxFiles?: number;
    /** Maximum allowed size per file in MB (composer uses maxSizeMB) */
    maxSizeMB?: number;
    options?: FormFieldOption[];
    optionDirection?: "horizontal" | "vertical";
    row?: number;
    col?: number;
    colSpan?: number;
    validations?: FieldValidationRules;
    step?: number;
    section?: number;
    optionsSource?: SelectOptionsSourceSchema;
}
interface FormLayoutSchema {
    rows: number;
    columns: number;
}
interface FormSpacingSchema {
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    gapX?: number;
    gapY?: number;
}
interface FormStyleSchema {
    formClass?: string;
    fieldWrapperClass?: string;
    labelClass?: string;
    inputClass?: string;
    buttonClass?: string;
    hintClass?: string;
    errorClass?: string;
    borderWidth?: number;
    borderRadius?: number;
    borderColor?: string;
    backgroundColor?: string;
    textColor?: string;
    buttonBackgroundColor?: string;
    buttonTextColor?: string;
    buttonHoverBackgroundColor?: string;
    buttonHoverTextColor?: string;
}
interface FormActionSchema {
    submitLabel?: string;
    cancelLabel?: string;
    showCancel?: boolean;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    submitApiUrl?: string;
    /**
     * Optional:
     * - auto: JSON unless files exist (recommended)
     * - json: always JSON (will fail for File objects)
     * - multipart: always FormData
     */
    contentType?: 'auto' | 'json' | 'multipart';
    /**
     * Optional: if you want to wrap payload inside a key
     * Example: payloadKey="data" => { data: <formValue> }
     */
    payloadKey?: string;
}
interface FormStepConfig {
    id: string;
    label: string;
    order: number;
    fieldIds: string[];
    icon?: string;
}
interface FormSectionSchema {
    id: string;
    label: string;
    order: number;
    fieldIds: string[];
}
interface FormSchema {
    name: string;
    description?: string;
    formType?: FormType;
    layout: FormLayoutSchema;
    spacing?: FormSpacingSchema;
    style?: FormStyleSchema;
    actions?: FormActionSchema;
    fields: FormFieldSchema[];
    steps?: FormStepConfig[];
    sections?: FormSectionSchema[];
}

type AmigoAuthTokenProvider = () => string | null;
/**
 * Host app will provide this.
 * Example: () => authService.getAuthToken()
 */
declare const AMIGO_AUTH_TOKEN_PROVIDER: InjectionToken<AmigoAuthTokenProvider>;

interface AmigoFormConfig {
    apiBaseUrl: string;
    endpoints?: {
        getFormById?: (id: string) => string;
    };
}
declare const AMIGO_FORM_CONFIG: InjectionToken<AmigoFormConfig>;
declare function provideAmigoForm(config: AmigoFormConfig, tokenProvider?: AmigoAuthTokenProvider): Provider[];

declare class AmigoFormService {
    private http;
    private cfg;
    constructor(http: HttpClient, cfg: AmigoFormConfig);
    getFormSchemaById(id: string): Observable<FormSchema>;
    /**
     * Calls submit API based on FormActionSchema.
     * - Auto uses FormData if any file exists in payload (or contentType='multipart')
     * - GET uses query params
     */
    submitByAction(action: FormActionSchema, payload: Record<string, any>, schema?: FormSchema): Observable<any>;
    private resolveUrl;
    private payloadHasFiles;
    private toFormData;
    private toHttpParams;
    static ɵfac: i0.ɵɵFactoryDeclaration<AmigoFormService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<AmigoFormService>;
}

type TokenFrom = 'LOCAL_STORAGE' | 'SESSION_STORAGE' | 'CUSTOM_CALLBACK';
type AuthType = 'NONE' | 'BEARER';
interface BearerAuthConfig {
    secured?: boolean;
    authType?: AuthType;
    tokenFrom?: TokenFrom;
    tokenKey?: string;
}
interface ExecuteOptions {
    /** values from the reactive form (normalized) */
    formValue?: Record<string, any>;
    /** true => do NOT let interceptor attach global token */
    skipGlobalAuth?: boolean;
    /** optional per-request bearer auth (mainly for select API) */
    bearerAuth?: BearerAuthConfig;
}
declare class AmigoApiExecutionService {
    private http;
    private cfg;
    private tokenProvider;
    constructor(http: HttpClient, cfg: AmigoFormConfig | null, tokenProvider: AmigoAuthTokenProvider | null);
    execute(endpoint: ApiEndpointConfig, opts?: ExecuteOptions): Observable<any>;
    private resolveUrl;
    private buildBearerHeader;
    private toHeaderRecord;
    private toHttpParams;
    private buildBody;
    private resolveExpr;
    private interpolate;
    private getByPath;
    private payloadHasFiles;
    private toFormData;
    static ɵfac: i0.ɵɵFactoryDeclaration<AmigoApiExecutionService, [null, { optional: true; }, { optional: true; }]>;
    static ɵprov: i0.ɵɵInjectableDeclaration<AmigoApiExecutionService>;
}

declare class AmigoSelectOptionsService {
    private api;
    private cache;
    constructor(api: AmigoApiExecutionService);
    load(field: FormFieldSchema, formValue: Record<string, any>): Observable<FormFieldOption[]>;
    private mapResponseToOptions;
    private getByPath;
    static ɵfac: i0.ɵɵFactoryDeclaration<AmigoSelectOptionsService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<AmigoSelectOptionsService>;
}

declare class AmigoFormComponent implements OnChanges {
    private formService;
    private cdr;
    private zone;
    private apiExec;
    private selectOptions;
    formId?: string;
    schema?: FormSchema;
    initialValue?: Record<string, any>;
    /**
     * Emits:
     * - if NO submitApiUrl => raw form value (backward compatible)
     * - if submitApiUrl exists => { payload, response, action }
     */
    submitted: EventEmitter<any>;
    /** Emits error object when API submit fails */
    submitFailed: EventEmitter<any>;
    cancelled: EventEmitter<void>;
    isLoading: boolean;
    loadError: string | null;
    isSubmitting: boolean;
    submitError: string | null;
    resolvedSchema: any | null;
    form: FormGroup | null;
    activeStepIndex: number;
    isSubmitHovered: boolean;
    isCancelHovered: boolean;
    selectState: Record<string, {
        loading: boolean;
        error?: string;
        options: any[];
    }>;
    buttonLoading: Record<string, boolean>;
    buttonFeedback: Record<string, {
        type: "success" | "error";
        message: string;
    }>;
    constructor(formService: AmigoFormService, cdr: ChangeDetectorRef, zone: NgZone, apiExec: AmigoApiExecutionService, selectOptions: AmigoSelectOptionsService);
    ngOnChanges(changes: SimpleChanges): void;
    private init;
    private preloadApiSelectOptions;
    private applySchema;
    isCard(field: FormFieldSchema | any): boolean;
    cardIcon(field: any): string;
    cardTitle(field: any): string;
    cardBody(field: any): string;
    cardStyle(field: any): Record<string, any>;
    cardIconStyle(field: any): Record<string, any>;
    controlKey(field: any): string;
    ctrl(field: any): AbstractControl | null;
    showError(field: any): boolean;
    onFileChange(evt: Event, field: FormFieldSchema): void;
    fileNames(field: FormFieldSchema): string[];
    clearFiles(field: FormFieldSchema, inputEl: HTMLInputElement): void;
    trackByFieldId: (_: number, field: any) => any;
    get orderedSteps(): any[];
    get totalSteps(): number;
    get isMultiStep(): boolean;
    get visibleFields(): FormFieldSchema[];
    get orderedSections(): any[];
    get isSectional(): boolean;
    fieldsForSection(sectionId: string): FormFieldSchema[];
    setActiveStep(i: number): void;
    onCancel(): void;
    prevStep(): void;
    nextStep(): void;
    submit(): void;
    private touchFields;
    private hasErrors;
    getFormStyle(): Record<string, any>;
    get submitButtonStyle(): {
        [key: string]: string;
    };
    get cancelButtonStyle(): {
        [key: string]: string;
    };
    isBootstrapIcon(icon: string | null | undefined): boolean;
    get showCancelButton(): boolean;
    private normalizePayload;
    private patchInitialValue;
    isButton(field: any): boolean;
    private isNonInput;
    private normalizeFormValue;
    onSchemaButtonClick(field: any): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<AmigoFormComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<AmigoFormComponent, "amigo-form", never, { "formId": { "alias": "formId"; "required": false; }; "schema": { "alias": "schema"; "required": false; }; "initialValue": { "alias": "initialValue"; "required": false; }; }, { "submitted": "submitted"; "submitFailed": "submitFailed"; "cancelled": "cancelled"; }, never, never, true, never>;
}

declare function buildFormGroup(fields: FormFieldSchema[], initialValue?: Record<string, any>): FormGroup;
declare function normalizeAccept(a?: string): string | undefined;

declare const AMIGO_SKIP_AUTH: HttpContextToken<boolean>;
declare class AmigoTokenInterceptor implements HttpInterceptor {
    private tokenProvider;
    private cfg;
    constructor(tokenProvider: AmigoAuthTokenProvider | null, cfg: AmigoFormConfig | null);
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>>;
    static ɵfac: i0.ɵɵFactoryDeclaration<AmigoTokenInterceptor, [{ optional: true; }, { optional: true; }]>;
    static ɵprov: i0.ɵɵInjectableDeclaration<AmigoTokenInterceptor>;
}

export { AMIGO_AUTH_TOKEN_PROVIDER, AMIGO_FORM_CONFIG, AMIGO_SKIP_AUTH, AmigoFormComponent, AmigoFormService, AmigoTokenInterceptor, buildFormGroup, normalizeAccept, provideAmigoForm };
export type { AmigoAuthTokenProvider, AmigoFormConfig, ApiEndpointConfig, ButtonElementSchema, ButtonStyleVariant, FieldType, FieldValidationRules, FormActionSchema, FormFieldOption, FormFieldSchema, FormLayoutSchema, FormSchema, FormSectionSchema, FormSpacingSchema, FormStepConfig, FormStyleSchema, FormType, HttpMethod, InfoCardSchema, InfoCardStyle, KeyValuePair, OptionsSourceMode, SelectAuthType, SelectOptionsApiConfig, SelectOptionsResponseMapping, SelectOptionsSourceSchema, SelectTokenFrom };
