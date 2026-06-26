import { Injectable } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { FormSchema } from '../models';

@Injectable({
  providedIn: 'root'
})
export class FormValueManagerService {

  patchInitialValue(form: FormGroup, resolvedSchema: FormSchema, initialValue?: Record<string, any>): void {
    if (!form || !resolvedSchema || !initialValue) return;

    const patch: Record<string, any> = {};
    const inputFields = (resolvedSchema.fields ?? []).filter(
      (f: any) => !this.isCard(f),
    );

    for (const field of inputFields) {
      const key = this.controlKey(field);

      const incoming =
        initialValue[key] ??
        (field?.name ? initialValue[field.name] : undefined) ??
        (field?.id ? initialValue[field.id] : undefined);

      if (incoming === undefined) continue;
      if (field.type === "file") continue;
      if (field.type === "number") {
        patch[key] = incoming === "" || incoming === null ? null : Number(incoming);
        continue;
      }
      if (field.type === "checkbox") {
        patch[key] = incoming === true || incoming === "true" || incoming === 1 || incoming === "1";
        continue;
      }
      if (field.type === "date" && incoming) {
        patch[key] = String(incoming).slice(0, 10);
        continue;
      }
      patch[key] = incoming;
    }

    form.patchValue(patch, { emitEvent: false });
    form.markAsPristine();
    form.markAsUntouched();
  }

  normalizeFormValue(form: FormGroup, resolvedSchema: FormSchema): Record<string, any> {
    if (!form) return {};
    const raw = form.value;
    const normalized: Record<string, any> = {};

    for (const field of resolvedSchema?.fields ?? []) {
      if (this.isNonInput(field)) continue;
      const key = this.controlKey(field);
      const value = raw[key];
      if (field.type === "number") {
        normalized[key] =
          value === "" || value === undefined || value === null
            ? this.resolveEmptyValue(field)
            : Number(value);
      } else if (this.isEmptyInput(value)) {
        normalized[key] = this.resolveEmptyValue(field);
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  }

  private resolveEmptyValue(field: any): any {
    const mode = field?.emptyValue;
    if (mode === "null") return null;
    if (mode === "undefined") return undefined;
    if (mode === "empty_string") return "";
    return field?.type === "number" ? null : "";
  }

  private isEmptyInput(v: any): boolean {
    return v === "" || v === null || v === undefined;
  }

  private isNonInput(field: any): boolean {
    const t = field?.type;
    return t === "card" || t === "info-card" || t === "button";
  }

  private isCard(field: any): boolean {
    const t = field?.type;
    return t === "card" || t === "info-card";
  }

  private controlKey(field: any): string {
    return field?.name ?? field?.id;
  }
}
