export type FieldType =
  | 'text'
  | 'password'
  | 'number'
  | 'email'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'file'
  | 'card'
  | 'button';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface FieldValidationRules {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
}

export interface FormFieldOption {
  label: string;
  value: any;
}

export type OptionsSourceMode = 'STATIC' | 'API';
export type SelectAuthType = 'NONE' | 'BEARER';
export type TokenFrom = 'LOCAL_STORAGE' | 'SESSION_STORAGE' | 'CUSTOM_CALLBACK';

export interface SelectOptionsApiResponseMapping {
  labelKey: string;
  valueKey: string;
  dataPath?: string;
}

export interface SelectOptionsApiConfig {
  url: string;
  method: HttpMethod;
  secured?: boolean;
  authType?: SelectAuthType;
  tokenFrom?: TokenFrom;
  tokenKey?: string;
  responseMapping: SelectOptionsApiResponseMapping;
}

export interface SelectOptionsSourceSchema {
  mode: OptionsSourceMode;
  api?: SelectOptionsApiConfig;
}

export type VisibilityOperator =
  | 'CHECKED'
  | 'UNCHECKED'
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'HAS_VALUE'
  | 'NOT_HAS_VALUE'
  | 'IN'
  | 'NOT_IN';

export interface VisibilityRule {
  dependsOn: string;
  operator: VisibilityOperator;
  value?: any;
}

export interface FieldVisibilitySchema {
  mode?: 'ALL' | 'ANY';
  rules: VisibilityRule[];
}

export interface ApiEndpointConfig {
  method: HttpMethod;
  url: string;
  headers?: KeyValuePair[];
  queryParams?: KeyValuePair[];
  bodyMapping?: Record<string, string>;
  pathParams?: KeyValuePair[];
}

export interface ActionApiConfig {
  triggerValidation?: boolean;
  successMessage?: string;
  errorMessage?: string;
  api: ApiEndpointConfig;
}

export type ButtonStyleVariant = 'primary' | 'secondary' | 'danger';
export type ButtonActionType = 'API_CALL';

export interface ButtonElementSchema {
  label: string;
  styleVariant?: ButtonStyleVariant;
  actionType?: ButtonActionType;
  api?: ApiEndpointConfig;
  successMessage?: string;
  errorMessage?: string;
  triggerValidation?: boolean;
}

export interface InfoCardStyleSchema {
  borderWidth?: number;
  borderRadius?: number;
  borderColor?: string;
  backgroundColor?: string;
  textColor?: string;
  iconColor?: string;
}

export interface InfoCardSchema {
  title: string;
  body?: string;
  icon?: string;
  style?: InfoCardStyleSchema;
}

export interface FormFieldSchema {
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

export interface FormLayoutSchema {
  columns: number;
}

export interface FormSpacingSchema {
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

export interface FormStyleSchema {
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

export interface FormActionSchema {
  submitLabel: string;
  cancelLabel: string;

  submitApiUrl?: string;
  method?: HttpMethod;

  payloadKey?: string;
  contentType?: 'auto' | 'json' | 'multipart';

  submitApi?: ActionApiConfig;
}

export type FormType = 'single' | 'multi' | 'single-sectional';

export interface FormStepConfig {
  id: string;
  label: string;
  order: number;
  fieldIds: string[];
  icon?: string;
}

export interface FormSectionConfig {
  id: string;
  label: string;
  order: number;
  fieldIds: string[];
}

export interface FormSchema {
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
