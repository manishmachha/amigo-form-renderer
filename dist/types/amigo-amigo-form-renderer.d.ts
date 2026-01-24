import * as i0 from '@angular/core';
import { InjectionToken, Provider, OnChanges, EventEmitter, ChangeDetectorRef, NgZone, SimpleChanges } from '@angular/core';
import { FormGroup, AbstractControl } from '@angular/forms';
import { HttpClient, HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

type FieldType = 'text' | 'password' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'file' | 'card' | 'button';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
interface KeyValuePair {
    key: string;
    value: string;
}
interface FieldValidationRules {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
}
interface FormFieldOption {
    label: string;
    value: any;
}
type OptionsSourceMode = 'STATIC' | 'API';
type SelectAuthType = 'NONE' | 'BEARER';
type TokenFrom = 'LOCAL_STORAGE' | 'SESSION_STORAGE' | 'CUSTOM_CALLBACK';
interface SelectOptionsApiResponseMapping {
    labelKey: string;
    valueKey: string;
    dataPath?: string;
}
interface SelectOptionsApiConfig {
    url: string;
    method: HttpMethod;
    secured?: boolean;
    authType?: SelectAuthType;
    tokenFrom?: TokenFrom;
    tokenKey?: string;
    responseMapping: SelectOptionsApiResponseMapping;
}
interface SelectOptionsSourceSchema {
    mode: OptionsSourceMode;
    api?: SelectOptionsApiConfig;
}
type VisibilityOperator = 'CHECKED' | 'UNCHECKED' | 'EQUALS' | 'NOT_EQUALS' | 'HAS_VALUE' | 'NOT_HAS_VALUE' | 'IN' | 'NOT_IN';
interface VisibilityRule {
    dependsOn: string;
    operator: VisibilityOperator;
    value?: any;
}
interface FieldVisibilitySchema {
    mode?: 'ALL' | 'ANY';
    rules: VisibilityRule[];
}
interface ApiEndpointConfig {
    method: HttpMethod;
    url: string;
    headers?: KeyValuePair[];
    queryParams?: KeyValuePair[];
    bodyMapping?: Record<string, string>;
    pathParams?: KeyValuePair[];
}
interface ActionApiConfig {
    triggerValidation?: boolean;
    successMessage?: string;
    errorMessage?: string;
    api: ApiEndpointConfig;
}
type ButtonStyleVariant = 'primary' | 'secondary' | 'danger';
type ButtonActionType = 'API_CALL';
interface ButtonElementSchema {
    label: string;
    styleVariant?: ButtonStyleVariant;
    actionType?: ButtonActionType;
    api?: ApiEndpointConfig;
    successMessage?: string;
    errorMessage?: string;
    triggerValidation?: boolean;
}
interface InfoCardStyleSchema {
    borderWidth?: number;
    borderRadius?: number;
    borderColor?: string;
    backgroundColor?: string;
    textColor?: string;
    iconColor?: string;
}
interface InfoCardSchema {
    title: string;
    body?: string;
    icon?: string;
    style?: InfoCardStyleSchema;
}
interface FormFieldSchema {
    id: string;
    label: string;
    name: string;
    type: FieldType;
    placeholder?: string;
    required?: boolean | string;
    colSpan?: number;
    options?: FormFieldOption[];
    optionDirection?: 'horizontal' | 'vertical';
    optionsSource?: SelectOptionsSourceSchema;
    validations?: FieldValidationRules;
    multiple?: boolean;
    accept?: string;
    maxSizeMB?: number;
    maxFiles?: number;
    card?: InfoCardSchema;
    button?: ButtonElementSchema;
    visibility?: FieldVisibilitySchema;
}
interface FormLayoutSchema {
    columns: number;
}
interface FormSpacingSchema {
    gapX: number;
    gapY: number;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
}
interface FormStyleSchema {
    borderWidth: number;
    borderRadius: number;
    borderColor: string;
    backgroundColor: string;
    textColor: string;
    buttonBackgroundColor: string;
    buttonTextColor: string;
    buttonHoverBackgroundColor?: string;
    buttonHoverTextColor?: string;
    formClass?: string;
    fieldWrapperClass?: string;
    labelClass?: string;
    inputClass?: string;
    buttonClass?: string;
}
interface FormActionSchema {
    submitLabel: string;
    cancelLabel: string;
    submitApiUrl?: string;
    method?: HttpMethod;
    payloadKey?: string;
    contentType?: 'auto' | 'json' | 'multipart';
    submitApi?: ActionApiConfig;
}
type FormType = 'single' | 'multi' | 'single-sectional';
interface FormStepConfig {
    id: string;
    label: string;
    order: number;
    fieldIds: string[];
    icon?: string;
}
interface FormSectionConfig {
    id: string;
    label: string;
    order: number;
    fieldIds: string[];
}
interface FormSchema {
    id: string;
    name: string;
    description?: string;
    fields: FormFieldSchema[];
    layout: FormLayoutSchema;
    spacing: FormSpacingSchema;
    style: FormStyleSchema;
    actions: FormActionSchema;
    formType?: FormType;
    steps?: FormStepConfig[];
    sections?: FormSectionConfig[];
}

type AmigoAuthTokenProvider = () => string | null;
/**
 * Host app will provide this.
 * Example: () => authService.getAuthToken()
 */
declare const AMIGO_AUTH_TOKEN_PROVIDER: InjectionToken<AmigoAuthTokenProvider>;

interface AmigoFormConfig {
    apiBaseUrl: string;
    submitActionBaseUrl: string;
    endpoints?: {
        getFormById?: (id: string) => string;
    };
}
declare const AMIGO_FORM_CONFIG: InjectionToken<AmigoFormConfig>;
declare function provideAmigoForm(config: AmigoFormConfig, tokenProvider?: AmigoAuthTokenProvider): Provider[];

interface AmigoApiExecutionContext {
    formValue: Record<string, any>;
    pathParams?: Record<string, any>;
    queryParams?: Record<string, any>;
    payloadKey?: string;
    contentType?: 'auto' | 'json' | 'multipart';
    skipAuth?: boolean;
}
declare class AmigoApiExecutionService {
    private http;
    private cfg;
    constructor(http: HttpClient, cfg: AmigoFormConfig | null);
    execute(endpoint: ApiEndpointConfig, ctx: AmigoApiExecutionContext): Observable<any>;
    private resolveUrl;
    private buildMappedBody;
    private resolveMappingExpr;
    private resolveString;
    private getByPath;
    private mergeParamsFromObject;
    private scalarToString;
    private hasFile;
    private toFormData;
    private appendFormData;
    private applyPathParams;
    private mergeParamsOverride;
    static ɵfac: i0.ɵɵFactoryDeclaration<AmigoApiExecutionService, [null, { optional: true; }]>;
    static ɵprov: i0.ɵɵInjectableDeclaration<AmigoApiExecutionService>;
}

declare class AmigoFormService {
    private http;
    private apiExec;
    private cfg;
    constructor(http: HttpClient, apiExec: AmigoApiExecutionService, cfg: AmigoFormConfig);
    getFormSchemaById(id: string): Observable<FormSchema>;
    submitByAction(action: FormActionSchema, payload: Record<string, any>): Observable<any>;
    static ɵfac: i0.ɵɵFactoryDeclaration<AmigoFormService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<AmigoFormService>;
}

declare class AmigoSelectOptionsService {
    private http;
    private cfg;
    private tokenProvider;
    private cache;
    constructor(http: HttpClient, cfg: AmigoFormConfig | null, tokenProvider: AmigoAuthTokenProvider | null);
    load(field: FormFieldSchema, _formValue?: Record<string, any>): Observable<FormFieldOption[]>;
    clear(fieldId?: string): void;
    private resolveUrl;
    private resolveToken;
    private mapOptions;
    private getByPath;
    static ɵfac: i0.ɵɵFactoryDeclaration<AmigoSelectOptionsService, [null, { optional: true; }, { optional: true; }]>;
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
    submitPathParams?: Record<string, any>;
    submitQueryParams?: Record<string, any>;
    submitted: EventEmitter<any>;
    submitFailed: EventEmitter<any>;
    cancelled: EventEmitter<void>;
    isLoading: boolean;
    loadError: string | null;
    isSubmitting: boolean;
    submitError: string | null;
    resolvedSchema: any | null;
    form: FormGroup | null;
    activeStepIndex: number;
    submitLoading: boolean;
    submitFeedback?: {
        type: 'success' | 'error';
        message: string;
    };
    isSubmitHovered: boolean;
    isCancelHovered: boolean;
    selectState: Record<string, {
        loading: boolean;
        error?: string;
        options: any[];
    }>;
    buttonLoading: Record<string, boolean>;
    buttonFeedback: Record<string, {
        type: 'success' | 'error';
        message: string;
    }>;
    private visibilitySub?;
    private visibilityState;
    private visibilityUpdating;
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
    private setupVisibility;
    isFieldVisible(field: any): boolean;
    private recomputeVisibility;
    private evaluateVisibility;
    private evaluateVisibilityRule;
    private resolveDependsOnKey;
    private isEmptyValue;
    onSchemaButtonClick(field: any): void;
    private resolveSubmitApi;
    static ɵfac: i0.ɵɵFactoryDeclaration<AmigoFormComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<AmigoFormComponent, "amigo-form", never, { "formId": { "alias": "formId"; "required": false; }; "schema": { "alias": "schema"; "required": false; }; "initialValue": { "alias": "initialValue"; "required": false; }; "submitPathParams": { "alias": "submitPathParams"; "required": false; }; "submitQueryParams": { "alias": "submitQueryParams"; "required": false; }; }, { "submitted": "submitted"; "submitFailed": "submitFailed"; "cancelled": "cancelled"; }, never, never, true, never>;
}

declare function buildFormGroup(fields: FormFieldSchema[], initialValue?: Record<string, any>): FormGroup;
declare function normalizeAccept(a?: string): string | undefined;

declare class AmigoTokenInterceptor implements HttpInterceptor {
    private tokenProvider;
    private cfg;
    constructor(tokenProvider: AmigoAuthTokenProvider | null, cfg: AmigoFormConfig | null);
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>>;
    static ɵfac: i0.ɵɵFactoryDeclaration<AmigoTokenInterceptor, [{ optional: true; }, { optional: true; }]>;
    static ɵprov: i0.ɵɵInjectableDeclaration<AmigoTokenInterceptor>;
}

export { AMIGO_AUTH_TOKEN_PROVIDER, AMIGO_FORM_CONFIG, AmigoFormComponent, AmigoFormService, AmigoTokenInterceptor, buildFormGroup, normalizeAccept, provideAmigoForm };
export type { ActionApiConfig, AmigoAuthTokenProvider, AmigoFormConfig, ApiEndpointConfig, ButtonActionType, ButtonElementSchema, ButtonStyleVariant, FieldType, FieldValidationRules, FieldVisibilitySchema, FormActionSchema, FormFieldOption, FormFieldSchema, FormLayoutSchema, FormSchema, FormSectionConfig, FormSpacingSchema, FormStepConfig, FormStyleSchema, FormType, HttpMethod, InfoCardSchema, InfoCardStyleSchema, KeyValuePair, OptionsSourceMode, SelectAuthType, SelectOptionsApiConfig, SelectOptionsApiResponseMapping, SelectOptionsSourceSchema, TokenFrom, VisibilityOperator, VisibilityRule };
