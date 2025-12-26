import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { FormFieldSchema } from './models';

export function buildFormGroup(
  fields: FormFieldSchema[],
  initialValue?: Record<string, any>
): FormGroup {
  const group: Record<string, FormControl> = {};

  for (const f of fields) {
    // Info cards are purely visual blocks and must NOT create form controls.
    if (f.type === 'card' || f.type === 'info-card') continue;

    const v = f.validations ?? {};

    // robust required parsing (boolean OR "true"/"false" strings)
    const required =
      f.required === true || f.required === 'true' || v.required === true;

    const validators: ValidatorFn[] = [];

    // required mapping
    if (required) {
      if (f.type === 'checkbox') validators.push(Validators.requiredTrue);
      else if (f.type === 'file') validators.push(fileRequiredValidator());
      else validators.push(Validators.required);
    }

    // string length rules
    if (typeof v.minLength === 'number')
      validators.push(Validators.minLength(v.minLength));
    if (typeof v.maxLength === 'number')
      validators.push(Validators.maxLength(v.maxLength));

    // numeric/date min/max (note: Angular Validators.min/max are numeric; if you want date min/max, handle separately)
    if (typeof v.min === 'number') validators.push(Validators.min(v.min));
    if (typeof v.max === 'number') validators.push(Validators.max(v.max));

    // pattern
    if (v.pattern) validators.push(Validators.pattern(v.pattern));

    //  email validator like template-driven
    if (f.type === 'email') validators.push(Validators.email);

    //  file-specific validators
    if (f.type === 'file') {
      const maxFiles =
        typeof f.maxFiles === 'number'
          ? f.maxFiles
          : f.multiple
          ? undefined
          : 1;

      const maxSizeMB =
        typeof f.maxSizeMB === 'number' ? f.maxSizeMB : undefined;

      const accept = normalizeAccept(f.accept);

      if (maxFiles !== undefined)
        validators.push(fileMaxFilesValidator(maxFiles));
      if (maxSizeMB !== undefined)
        validators.push(fileMaxSizeValidator(maxSizeMB));
      if (accept) validators.push(fileAcceptValidator(accept));
    }

    const key = f.name ?? f.id;

    const init =
      initialValue?.[key] ??
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

export function normalizeAccept(a?: string): string | undefined {
  if (!a) return undefined;
  const s = String(a).trim().toLowerCase();
  if (!s) return undefined;

  // handle common composer shorthand like "pdf"
  if (s === 'pdf') return '.pdf,application/pdf';

  // if already looks valid
  if (s.startsWith('.') || s.includes('/') || s.includes(',')) return a;

  // fallback: treat as extension
  return `.${s}`;
}

function normalizeFiles(value: any): File[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof FileList !== 'undefined' && value instanceof FileList) {
    return Array.from(value);
  }
  if (typeof File !== 'undefined' && value instanceof File) {
    return [value];
  }
  return [];
}

function fileRequiredValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const files = normalizeFiles(control.value);
    return files.length ? null : { required: true };
  };
}

function fileMaxFilesValidator(maxFiles: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const files = normalizeFiles(control.value);
    return files.length > maxFiles
      ? { maxFiles: { max: maxFiles, actual: files.length } }
      : null;
  };
}

function fileMaxSizeValidator(maxSizeMB: number): ValidatorFn {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return (control: AbstractControl): ValidationErrors | null => {
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
function fileAcceptValidator(accept: string): ValidatorFn {
  const tokens = (accept || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return (control: AbstractControl): ValidationErrors | null => {
    const files = normalizeFiles(control.value);
    if (!files.length || !tokens.length) return null;

    const bad = files.find((f) => !isAcceptedFile(f, tokens));
    return bad ? { accept: { accept, file: bad.name, type: bad.type } } : null;
  };
}

function isAcceptedFile(file: File, tokens: string[]): boolean {
  const name = (file?.name || '').toLowerCase();
  const type = (file?.type || '').toLowerCase();

  return tokens.some((t) => {
    const tok = t.toLowerCase();
    if (!tok) return true;

    // extension
    if (tok.startsWith('.')) return name.endsWith(tok);

    // wildcard mime, e.g. image/*
    if (tok.endsWith('/*')) {
      const prefix = tok.slice(0, tok.length - 1); // keep trailing '/'
      return type.startsWith(prefix);
    }

    // exact mime
    if (tok.includes('/')) {
      if (type) return type === tok;

      // fallback when browser doesn't provide MIME type
      if (tok === 'application/pdf') return name.endsWith('.pdf');

      return false;
    }

    return false;
  });
}
