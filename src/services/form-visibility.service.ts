import { Injectable } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FormFieldSchema, FormSchema } from '../models';

@Injectable({
  providedIn: 'root'
})
export class FormVisibilityService {
  private visibilitySub?: Subscription;
  private visibilityState: Record<string, boolean> = {};
  private visibilityUpdating = false;

  setupVisibility(
    form: FormGroup | null, 
    resolvedSchema: FormSchema | null | any, 
    onVisibilityChange?: () => void
  ): void {
    this.visibilitySub?.unsubscribe();
    if (!form || !resolvedSchema) return;
    
    this.recomputeVisibility(form, resolvedSchema);
    
    this.visibilitySub = form.valueChanges.subscribe(() => {
      if (onVisibilityChange) {
        onVisibilityChange();
      }
      
      if (this.visibilityUpdating) return;
      this.recomputeVisibility(form, resolvedSchema);
    });
  }

  isFieldVisibleOriginal(field: any): boolean {
    const rules = field?.visibility?.rules;
    if (!rules || !rules.length) return true;
    const key = field?.id || field?.name;
    return this.visibilityState[key] !== false;
  }

  isFieldVisible(field: any, isMultiStep: boolean, isReviewed: boolean, enableIsReview: boolean = false): boolean {
    const isSubmit = field?.type === 'button' && 
      (field?.button?.isSubmit || field?.label?.toLowerCase().includes('submit'));
    
    if (isSubmit) {
      if (enableIsReview && !isReviewed) {
        return false;
      }
    }
    return this.isFieldVisibleOriginal(field);
  }

  private recomputeVisibility(form: FormGroup, resolvedSchema: any): void {
    if (!form || !resolvedSchema) return;
    const raw = (form as any).getRawValue
      ? (form as any).getRawValue()
      : form.value;

    this.visibilityUpdating = true;
    try {
      for (const f of resolvedSchema.fields as any[]) {
        const visible = this.evaluateVisibility(f, raw);
        const stateKey = f.id || f.name;
        this.visibilityState[stateKey] = visible;

        if (this.isNonInput(f)) continue;
        const c = form.get(this.controlKey(f));
        if (!c) continue;
        if (!visible && c.enabled) c.disable({ emitEvent: false });
        if (visible && c.disabled) c.enable({ emitEvent: false });
      }
    } finally {
      this.visibilityUpdating = false;
    }
  }

  private evaluateVisibility(field: any, raw: Record<string, any>): boolean {
    const vis = field?.visibility;
    const rules = vis?.rules ?? [];
    if (!rules.length) return true;
    const mode = String(vis?.mode || "ALL").toUpperCase();
    const results = rules.map((r: any) => this.evaluateVisibilityRule(r, raw));
    return mode === "ANY" ? results.some(Boolean) : results.every(Boolean);
  }

  private evaluateVisibilityRule(rule: any, raw: Record<string, any>): boolean {
    const depKey = this.resolveDependsOnKey(rule?.dependsOn);
    const v = raw?.[depKey];
    const op = String(rule?.operator || "EQUALS").toUpperCase();
    const cmp = rule?.value;

    switch (op) {
      case "CHECKED":
        return v === true;
      case "UNCHECKED":
        return v !== true;
      case "HAS_VALUE":
        return !this.isEmptyValue(v);
      case "NOT_HAS_VALUE":
        return this.isEmptyValue(v);
      case "IN":
        return Array.isArray(cmp) ? cmp.includes(v) : false;
      case "NOT_IN":
        return Array.isArray(cmp) ? !cmp.includes(v) : true;
      case "NOT_EQUALS":
        return Array.isArray(v) ? !v.includes(cmp) : v !== cmp;
      case "EQUALS":
      default:
        return Array.isArray(v) ? v.includes(cmp) : v === cmp;
    }
  }

  private resolveDependsOnKey(dependsOn: any): string {
    if (!dependsOn) return "";
    if (typeof dependsOn === "string") return dependsOn;
    return dependsOn.id || dependsOn.name || "";
  }

  private isEmptyValue(v: any): boolean {
    if (v === null || v === undefined) return true;
    if (typeof v === "string" && v.trim() === "") return true;
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
  }

  private isNonInput(field: any): boolean {
    const t = field?.type;
    return t === "card" || t === "info-card" || t === "button";
  }

  private controlKey(field: any): string {
    return field?.name ?? field?.id;
  }

  cleanup(): void {
    this.visibilitySub?.unsubscribe();
  }
}
