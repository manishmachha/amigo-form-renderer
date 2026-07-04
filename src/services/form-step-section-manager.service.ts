import { Injectable, signal, computed, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { FormFieldSchema } from '../models';
import { FormSchemaManagerService } from './form-schema-manager.service';
import { FormVisibilityService } from './form-visibility.service';

@Injectable({
  providedIn: 'root'
})
export class FormStepSectionManagerService {
  private schemaManager = inject(FormSchemaManagerService);
  private visibility = inject(FormVisibilityService);

  readonly activeStepIndex = signal<number>(0);
  readonly highestCompletedStep = signal<number>(0);
  readonly isReviewed = signal<boolean>(false);

  readonly orderedSteps = computed(() => {
    const s = this.schemaManager.resolvedSchema();
    return [...(s?.steps ?? [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  });

  readonly totalSteps = computed(() => this.orderedSteps().length);

  readonly isMultiStep = computed(() => {
    const s = this.schemaManager.resolvedSchema();
    return s?.formType === "multi" && this.totalSteps() > 0;
  });

  readonly orderedSections = computed(() => {
    const s = this.schemaManager.resolvedSchema();
    if (!s) return [];
    return [...(s.sections ?? [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  });

  readonly isSectional = computed(() => {
    const s = this.schemaManager.resolvedSchema();
    return s?.formType === "single-sectional" || (s?.formType === "single" && (s.sections?.length ?? 0) > 0);
  });

  readonly visibleFields = computed(() => {
    return this.fieldsForStep(this.activeStepIndex());
  });

  fieldsForStep(index: number): FormFieldSchema[] {
    const s = this.schemaManager.resolvedSchema();
    if (!s) return [];

    if (s.formType === "multi" && this.totalSteps() > 0) {
      if (index < 0 || index >= this.totalSteps()) return [];
      const step = this.orderedSteps()[index];
      const ids = new Set(step?.fieldIds ?? []);
      if (!ids.size) return [];
      return (s.fields ?? [])
        .filter((f: any) => ids.has(f.id))
        .filter((f: any) => this.visibility.isFieldVisible(f, this.isMultiStep(), this.isReviewed(), s.enableIsReview));
    }

    return (s.fields ?? []).filter((f: any) => this.visibility.isFieldVisible(f, this.isMultiStep(), this.isReviewed(), s.enableIsReview));
  }

  fieldsForSection(sectionId: string): FormFieldSchema[] {
    const s = this.schemaManager.resolvedSchema();
    if (!s) return [];
    const section = (s.sections ?? []).find((x: any) => x.id === sectionId);
    const ids = new Set(section?.fieldIds ?? []);
    return (s.fields ?? [])
      .filter((f: any) => ids.has(f.id))
      .filter((f: any) => this.visibility.isFieldVisible(f, this.isMultiStep(), this.isReviewed(), s.enableIsReview));
  }

  setActiveStep(i: number, form: FormGroup | null) {
    if (i < 0 || i >= this.totalSteps()) return;
    if (i === this.activeStepIndex()) return;

    const s = this.schemaManager.resolvedSchema();
    const isDraftEnabled = s?.draftConfig?.enabled === true;

    // Prevent navigation to uncompleted steps via stepper icons if drafting is enabled
    if (isDraftEnabled && i > this.highestCompletedStep()) {
      return;
    }

    if (i > this.activeStepIndex()) {
      for (let stepIdx = 0; stepIdx < i; stepIdx++) {
        const fields = this.fieldsForStep(stepIdx);
        this.touchFields(fields, form);
        if (this.hasErrors(fields, form)) {
          this.activeStepIndex.set(stepIdx);
          return;
        }
      }
    }
    this.activeStepIndex.set(i);
  }

  prevStep(form: FormGroup | null): void {
    this.setActiveStep(this.activeStepIndex() - 1, form);
  }

  nextStep(form: FormGroup | null): void {
    this.setActiveStep(this.activeStepIndex() + 1, form);
  }

  touchFields(fields: FormFieldSchema[], form: FormGroup | null): void {
    if (!form) return;
    for (const f of fields as any[]) {
      if (this.isNonInput(f)) continue;
      const s = this.schemaManager.resolvedSchema();
      if (!this.visibility.isFieldVisible(f, this.isMultiStep(), this.isReviewed(), s?.enableIsReview)) continue;
      const c = form.get(this.controlKey(f));
      if (!c || c.disabled) continue;
      c.markAsTouched();
      c.updateValueAndValidity({ emitEvent: false });
    }
  }

  hasErrors(fields: FormFieldSchema[], form: FormGroup | null): boolean {
    if (!form) return true;
    return (fields as any[])
      .filter((f) => !this.isNonInput(f))
      .filter((f) => {
        const s = this.schemaManager.resolvedSchema();
        return this.visibility.isFieldVisible(f, this.isMultiStep(), this.isReviewed(), s?.enableIsReview);
      })
      .some((f) => {
        const c = form!.get(this.controlKey(f));
        return !!(c && c.enabled && c.invalid);
      });
  }

  private isNonInput(field: any): boolean {
    const t = field?.type;
    return t === "card" || t === "info-card" || t === "button";
  }

  private controlKey(field: any): string {
    return field?.name ?? field?.id;
  }
}
