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
  | 'info-card';

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
  optionDirection?: 'horizontal' | 'vertical';
  row?: number;
  col?: number;
  colSpan?: number;
  validations?: FieldValidationRules;
  step?: number;
  section?: number;
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
