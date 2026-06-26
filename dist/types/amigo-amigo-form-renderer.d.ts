import * as i0 from '@angular/core';
import { InjectionToken, Provider, OnChanges, OnDestroy, EventEmitter, TemplateRef, ChangeDetectorRef, SimpleChanges } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient, HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

type FieldType = "text" | "password" | "number" | "email" | "textarea" | "select" | "checkbox" | "radio" | "date" | "file" | "card" | "button";
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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
type OptionsSourceMode = "STATIC" | "API";
type SelectAuthType = "NONE" | "BEARER";
type TokenFrom = "LOCAL_STORAGE" | "SESSION_STORAGE" | "CUSTOM_CALLBACK";
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
interface DependentSelectConfig {
    parentFieldId: string;
    childDataPath?: string;
    labelKey?: string;
    valueKey?: string;
    type?: 'local' | 'api';
    queryParamName?: string;
    urlPlaceholder?: string;
}
type EmptyValueType = "empty_string" | "null" | "undefined";
type VisibilityOperator = "CHECKED" | "UNCHECKED" | "EQUALS" | "NOT_EQUALS" | "HAS_VALUE" | "NOT_HAS_VALUE" | "IN" | "NOT_IN";
interface VisibilityRule {
    dependsOn: string;
    operator: VisibilityOperator;
    value?: any;
}
interface FieldVisibilitySchema {
    mode?: "ALL" | "ANY";
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
type ButtonStyleVariant = "primary" | "outline" | "link";
type ButtonActionType = "API_CALL";
interface ButtonElementSchema {
    label: string;
    styleVariant?: ButtonStyleVariant;
    actionType?: ButtonActionType;
    api?: ApiEndpointConfig;
    successMessage?: string;
    errorMessage?: string;
    triggerValidation?: boolean;
    isSubmit?: boolean;
    backgroundColor?: string;
    textColor?: string;
    hoverBackgroundColor?: string;
    hoverTextColor?: string;
    href?: string;
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
    optionDirection?: "horizontal" | "vertical";
    optionsSource?: SelectOptionsSourceSchema;
    dependentSelect?: DependentSelectConfig;
    validations?: FieldValidationRules;
    multiple?: boolean;
    accept?: string;
    maxSizeMB?: number;
    maxFiles?: number;
    card?: InfoCardSchema;
    button?: ButtonElementSchema;
    visibility?: FieldVisibilitySchema;
    emptyValue?: EmptyValueType;
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
    formClass?: string;
    fieldWrapperClass?: string;
    labelClass?: string;
    inputClass?: string;
    buttonClass?: string;
}
interface FormActionSchema {
    submitLabel: string;
    method?: HttpMethod;
    payloadKey?: string;
    contentType?: "auto" | "json" | "multipart";
}
type FormType = "single" | "multi" | "single-sectional";
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
    selectOptionsBaseUrl?: string;
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

declare class FormVisibilityService {
    private visibilitySub?;
    private visibilityState;
    private visibilityUpdating;
    setupVisibility(form: FormGroup | null, resolvedSchema: FormSchema | null | any, onVisibilityChange?: () => void): void;
    isFieldVisibleOriginal(field: any): boolean;
    isFieldVisible(field: any, isMultiStep: boolean, isReviewed: boolean): boolean;
    private recomputeVisibility;
    private evaluateVisibility;
    private evaluateVisibilityRule;
    private resolveDependsOnKey;
    private isEmptyValue;
    private isNonInput;
    private controlKey;
    cleanup(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<FormVisibilityService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<FormVisibilityService>;
}

interface SubmitOptions {
    triggerField?: any;
    submitPathParams?: Record<string, any>;
    submitQueryParams?: Record<string, any>;
    onStateChange: (state: {
        isSubmitting: boolean;
        feedback?: {
            type: 'success' | 'error';
            message: string;
        };
    }) => void;
    onSuccess: (result: any) => void;
    onError: (error: any) => void;
}
declare class FormSubmissionService {
    private apiExec;
    constructor(apiExec: AmigoApiExecutionService);
    submit(form: FormGroup | null, resolvedSchema: FormSchema | null | any, normalizedFormValue: Record<string, any>, options: SubmitOptions): Promise<void>;
    private getCaptureLocation;
    static ɵfac: i0.ɵɵFactoryDeclaration<FormSubmissionService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<FormSubmissionService>;
}

declare class FormReviewService {
    private visibility;
    constructor(visibility: FormVisibilityService);
    generateReviewData(form: FormGroup | null, resolvedSchema: FormSchema | null | any, isMultiStep: boolean, orderedSteps: any[], selectState: Record<string, any>): {
        step: string;
        fields: {
            label: string;
            value: any;
        }[];
    }[];
    private getFieldsForReview;
    private getReviewValue;
    private isNonInput;
    private controlKey;
    private fileNames;
    static ɵfac: i0.ɵɵFactoryDeclaration<FormReviewService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<FormReviewService>;
}

declare class AmigoFormService {
    private http;
    private apiExec;
    private cfg;
    constructor(http: HttpClient, apiExec: AmigoApiExecutionService, cfg: AmigoFormConfig);
    getFormSchemaById(id: string): Observable<FormSchema>;
    static ɵfac: i0.ɵɵFactoryDeclaration<AmigoFormService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<AmigoFormService>;
}

declare class FormSchemaManagerService {
    private formService;
    readonly isLoading: i0.WritableSignal<boolean>;
    readonly loadError: i0.WritableSignal<string>;
    readonly resolvedSchema: i0.WritableSignal<any>;
    constructor(formService: AmigoFormService);
    init(formId?: string, schemaInput?: FormSchema): void;
    private applySchema;
    static ɵfac: i0.ɵɵFactoryDeclaration<FormSchemaManagerService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<FormSchemaManagerService>;
}

declare class FormValueManagerService {
    patchInitialValue(form: FormGroup, resolvedSchema: FormSchema, initialValue?: Record<string, any>): void;
    normalizeFormValue(form: FormGroup, resolvedSchema: FormSchema): Record<string, any>;
    private resolveEmptyValue;
    private isEmptyInput;
    private isNonInput;
    private isCard;
    private controlKey;
    static ɵfac: i0.ɵɵFactoryDeclaration<FormValueManagerService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<FormValueManagerService>;
}

declare class FormStepSectionManagerService {
    private schemaManager;
    private visibility;
    readonly activeStepIndex: i0.WritableSignal<number>;
    readonly isReviewed: i0.WritableSignal<boolean>;
    readonly orderedSteps: i0.Signal<any[]>;
    readonly totalSteps: i0.Signal<number>;
    readonly isMultiStep: i0.Signal<boolean>;
    readonly orderedSections: i0.Signal<any[]>;
    readonly isSectional: i0.Signal<boolean>;
    readonly visibleFields: i0.Signal<FormFieldSchema[]>;
    fieldsForStep(index: number): FormFieldSchema[];
    fieldsForSection(sectionId: string): FormFieldSchema[];
    setActiveStep(i: number, form: FormGroup | null): void;
    prevStep(form: FormGroup | null): void;
    nextStep(form: FormGroup | null): void;
    touchFields(fields: FormFieldSchema[], form: FormGroup | null): void;
    hasErrors(fields: FormFieldSchema[], form: FormGroup | null): boolean;
    private isNonInput;
    private controlKey;
    static ɵfac: i0.ɵɵFactoryDeclaration<FormStepSectionManagerService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<FormStepSectionManagerService>;
}

declare class FormSelectOptionsManagerService {
    private selectOptions;
    private schemaManager;
    private valueManager;
    readonly selectState: i0.WritableSignal<Record<string, {
        loading: boolean;
        error?: string;
        options: any[];
    }>>;
    private cascadingSubs;
    preloadApiSelectOptions(form: FormGroup): void;
    setupCascadingSelects(form: FormGroup): void;
    private updateChildOptions;
    private updateSelectState;
    private getByPath;
    private controlKey;
    cleanup(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<FormSelectOptionsManagerService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<FormSelectOptionsManagerService>;
}

declare class AmigoFormComponent implements OnChanges, OnDestroy {
    private cdr;
    private dialog;
    private apiExec;
    private visibility;
    private submission;
    private reviewService;
    schemaManager: FormSchemaManagerService;
    valueManager: FormValueManagerService;
    stepSectionManager: FormStepSectionManagerService;
    selectOptionsManager: FormSelectOptionsManagerService;
    formId?: string;
    schema?: FormSchema;
    initialValue?: Record<string, any>;
    submitPathParams?: Record<string, any>;
    submitQueryParams?: Record<string, any>;
    submitted: EventEmitter<any>;
    submitFailed: EventEmitter<any>;
    isSubmitting: boolean;
    form: FormGroup | null;
    submitFeedback?: {
        type: "success" | "error";
        message: string;
    };
    buttonLoading: Record<string, boolean>;
    buttonFeedback: Record<string, {
        type: "success" | "error";
        message: string;
    }>;
    reviewDialogTemplate: TemplateRef<any>;
    constructor(cdr: ChangeDetectorRef, dialog: MatDialog, apiExec: AmigoApiExecutionService, visibility: FormVisibilityService, submission: FormSubmissionService, reviewService: FormReviewService, schemaManager: FormSchemaManagerService, valueManager: FormValueManagerService, stepSectionManager: FormStepSectionManagerService, selectOptionsManager: FormSelectOptionsManagerService);
    ngOnChanges(changes: SimpleChanges): void;
    ngOnDestroy(): void;
    get isLoading(): boolean;
    get loadError(): string;
    get resolvedSchema(): any;
    get isMultiStep(): boolean;
    get totalSteps(): number;
    get orderedSteps(): any[];
    get activeStepIndex(): number;
    get isSectional(): boolean;
    get orderedSections(): any[];
    get isReviewed(): boolean;
    get selectState(): Record<string, {
        loading: boolean;
        error?: string;
        options: any[];
    }>;
    get visibleFields(): FormFieldSchema[];
    fieldsForStep(index: number): FormFieldSchema[];
    fieldsForSection(sectionId: string): FormFieldSchema[];
    setActiveStep(i: number): void;
    prevStep(): void;
    nextStep(): void;
    trackByFieldId: (_: number, field: any) => any;
    getFormStyle(): Record<string, any>;
    private px;
    submit(triggerField?: any): Promise<void>;
    onSchemaButtonClick(field: any): void;
    onFileChange(evt: Event, field: FormFieldSchema): void;
    clearFiles(field: FormFieldSchema, inputEl: HTMLInputElement): void;
    openReviewDialog(): void;
    closeReviewDialog(): void;
    confirmReview(): void;
    get reviewData(): {
        step: string;
        fields: {
            label: string;
            value: any;
        }[];
    }[];
    private isNonInput;
    static ɵfac: i0.ɵɵFactoryDeclaration<AmigoFormComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<AmigoFormComponent, "amigo-form", never, { "formId": { "alias": "formId"; "required": false; }; "schema": { "alias": "schema"; "required": false; }; "initialValue": { "alias": "initialValue"; "required": false; }; "submitPathParams": { "alias": "submitPathParams"; "required": false; }; "submitQueryParams": { "alias": "submitQueryParams"; "required": false; }; "isSubmitting": { "alias": "isSubmitting"; "required": false; }; }, { "submitted": "submitted"; "submitFailed": "submitFailed"; }, never, never, true, never>;
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
export type { ActionApiConfig, AmigoAuthTokenProvider, AmigoFormConfig, ApiEndpointConfig, ButtonActionType, ButtonElementSchema, ButtonStyleVariant, DependentSelectConfig, EmptyValueType, FieldType, FieldValidationRules, FieldVisibilitySchema, FormActionSchema, FormFieldOption, FormFieldSchema, FormLayoutSchema, FormSchema, FormSectionConfig, FormSpacingSchema, FormStepConfig, FormStyleSchema, FormType, HttpMethod, InfoCardSchema, InfoCardStyleSchema, KeyValuePair, OptionsSourceMode, SelectAuthType, SelectOptionsApiConfig, SelectOptionsApiResponseMapping, SelectOptionsSourceSchema, TokenFrom, VisibilityOperator, VisibilityRule };
