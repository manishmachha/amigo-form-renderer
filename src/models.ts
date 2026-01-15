export type FormType = 'single' | 'multi' | 'single-sectional';

export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'file'
  | 'card'
  | 'password'
  | 'info-card'
  | 'button';

  export type OptionsSourceMode = "STATIC" | "API";
  export type SelectAuthType = "NONE" | "BEARER";
  export type SelectTokenFrom =
    | "LOCAL_STORAGE"
    | "SESSION_STORAGE"
    | "CUSTOM_CALLBACK";

  export interface SelectOptionsResponseMapping {
    labelKey: string; // e.g. "name" or "meta.name"
    valueKey: string; // e.g. "id"
    dataPath?: string; // e.g. "data.items"
  }

  export interface SelectOptionsApiConfig {
    url: string;
    method: HttpMethod;
    secured?: boolean;
    authType?: SelectAuthType;
    tokenFrom?: SelectTokenFrom;
    tokenKey?: string;

    responseMapping: SelectOptionsResponseMapping;
  }

  export interface SelectOptionsSourceSchema {
    mode: OptionsSourceMode;
    api?: SelectOptionsApiConfig;
  }

  export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  export type ButtonStyleVariant = 'primary' | 'secondary' | 'danger';

  export interface KeyValuePair {
    key: string;
    value: string;
  }

  export interface ApiEndpointConfig {
    method: HttpMethod;
    url: string;
    headers?: KeyValuePair[];
    queryParams?: KeyValuePair[];
    /** map request body keys to form values: { "employeeId": "employee.id", "amount": "{{salary}}" } */
    bodyMapping?: Record<string, string>;
  }

  export interface ButtonElementSchema {
    label?: string; // optional override; fallback to field.label
    styleVariant?: ButtonStyleVariant; // default 'primary'
    actionType?: 'API_CALL'; // default 'API_CALL'
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
export interface InfoCardStyle {
  borderColor?: string;
  backgroundColor?: string;
  textColor?: string;
  iconColor?: string;
  borderWidth?: number;
  borderRadius?: number;
}

export interface InfoCardSchema {
  /** Optional icon (emoji/text). Keep it simple to avoid needing icon libraries. */
  icon?: string;
  title?: string;
  body?: string;
  style?: InfoCardStyle;
}

export interface FormFieldOption {
  value: any;
  label: string;
}

export interface FieldValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface FormFieldSchema {
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

export interface FormLayoutSchema {
  rows: number;
  columns: number;
}

export interface FormSpacingSchema {
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

export interface FormStyleSchema {
  // If you rely on Tailwind classes, keep them here.
  formClass?: string;
  fieldWrapperClass?: string;
  labelClass?: string;
  inputClass?: string;
  buttonClass?: string;
  hintClass?: string;
  errorClass?: string;

  // Optional raw values
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

export interface FormActionSchema {
  submitLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;

  // Optional fields used by your composer
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

export interface FormStepConfig {
  id: string;
  label: string;
  order: number;
  fieldIds: string[];
  icon?: string;
}

export interface FormSectionSchema {
  id: string;
  label: string;
  order: number;
  fieldIds: string[];
}

export interface FormSchema {
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
