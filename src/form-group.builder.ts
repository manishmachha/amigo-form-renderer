import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { FormFieldSchema } from './models';

export function buildFormGroup(fields: FormFieldSchema[], initialValue?: Record<string, any>): FormGroup {
  const group: Record<string, FormControl> = {};
  for (const f of fields as any[]) {
    const t = String(f?.type ?? '');
    if (t === 'card' || t === 'info-card' || t === 'button') continue;

    const v = f.validations ?? {};
    const required = f.required === true || f.required === 'true' || v.required === true;

    const validators: ValidatorFn[] = [];
    if (required) {
      if (t === 'checkbox') validators.push(Validators.requiredTrue);
      else if (t === 'file') validators.push(fileRequiredValidator());
      else validators.push(Validators.required);
    }

    if (typeof v.minLength === 'number') validators.push(Validators.minLength(v.minLength));
    if (typeof v.maxLength === 'number') validators.push(Validators.maxLength(v.maxLength));
    if (typeof v.min === 'number') validators.push(Validators.min(v.min));
    if (typeof v.max === 'number') validators.push(Validators.max(v.max));
    if (v.pattern) validators.push(Validators.pattern(v.pattern));
    if (t === 'email') validators.push(Validators.email);

    if (t === 'file') {
      const maxFiles = typeof f.maxFiles === 'number' ? f.maxFiles : f.multiple ? undefined : 1;
      const maxSizeMB = typeof f.maxSizeMB === 'number' ? f.maxSizeMB : undefined;
      const accept = normalizeAccept(f.accept);

      if (maxFiles !== undefined) validators.push(fileMaxFilesValidator(maxFiles));
      if (maxSizeMB !== undefined) validators.push(fileMaxSizeValidator(maxSizeMB));
      if (accept) validators.push(fileAcceptValidator(accept));
    }

    const key = f.name ?? f.id;
    const init =
      initialValue?.[key] ??
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

export function normalizeAccept(a?: string): string | undefined {
  if (!a) return undefined;
  const s = String(a).trim().toLowerCase();
  return s || undefined;
}

function fileRequiredValidator(): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = c.value;
    if (!v) return { required: true };
    if (Array.isArray(v)) return v.length ? null : { required: true };
    return null;
  };
}

function fileMaxFilesValidator(maxFiles: number): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = c.value;
    if (!v) return null;
    const count = Array.isArray(v) ? v.length : 1;
    return count > maxFiles ? { maxFiles: { maxFiles, actual: count } } : null;
  };
}

function fileMaxSizeValidator(maxSizeMB: number): ValidatorFn {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return (c: AbstractControl): ValidationErrors | null => {
    const v = c.value;
    if (!v) return null;
    const files: File[] = Array.isArray(v) ? v : [v];
    const tooLarge = files.find((f) => f?.size > maxBytes);
    return tooLarge ? { maxSizeMB: { maxSizeMB, actualBytes: tooLarge.size } } : null;
  };
}

function fileAcceptValidator(accept: string): ValidatorFn {
  const parts = accept
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const isOk = (file: File): boolean => {
    const mime = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();

    for (const p of parts) {
      if (p.startsWith('.')) {
        if (name.endsWith(p)) return true;
      } else if (p.endsWith('/*')) {
        const prefix = p.slice(0, -1);
        if (mime.startsWith(prefix)) return true;
      } else {
        if (mime === p) return true;
      }
    }

    return false;
  };

  return (c: AbstractControl): ValidationErrors | null => {
    const v = c.value;
    if (!v) return null;
    const files: File[] = Array.isArray(v) ? v : [v];
    const bad = files.find((f) => f && !isOk(f));
    return bad ? { accept: { accept, bad: bad.name } } : null;
  };
}
