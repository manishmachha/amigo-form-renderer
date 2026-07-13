import { Injectable } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { FormSchema, FormFieldSchema } from '../models';
import { FormVisibilityService } from './form-visibility.service';

@Injectable({
  providedIn: 'root'
})
export class FormReviewService {
  constructor(private visibility: FormVisibilityService) {}

  generateReviewData(
    form: FormGroup | null,
    resolvedSchema: FormSchema | null | any,
    isMultiStep: boolean,
    orderedSteps: any[],
    selectState: Record<string, any>
  ): { step: string, fields: { label: string, value: any }[] }[] {
    const data: { step: string, fields: { label: string, value: any }[] }[] = [];
    if (isMultiStep && orderedSteps && orderedSteps.length > 0) {
      for (let i = 0; i < orderedSteps.length; i++) {
        const step = orderedSteps[i];
        const stepFields = this.getFieldsForReview(step, form, resolvedSchema, selectState);
        if (stepFields.length > 0) {
          data.push({
            step: step.label || `Step ${i + 1}`,
            fields: stepFields
          });
        }
      }
    } else if (resolvedSchema?.formType === 'single-sectional' && resolvedSchema?.sections?.length > 0) {
      for (let i = 0; i < resolvedSchema.sections.length; i++) {
        const section = resolvedSchema.sections[i];
        const sectionFields = this.getFieldsForReview(section, form, resolvedSchema, selectState);
        if (sectionFields.length > 0) {
          data.push({
            step: section.label || `Section ${i + 1}`,
            fields: sectionFields
          });
        }
      }
    } else {
      // Single page form
      const allFields = (resolvedSchema?.fields ?? [])
        .filter((f: any) => !this.isNonInput(f) && this.visibility.isFieldVisibleOriginal(f))
        .map((f: any) => {
          return {
            label: f.label,
            value: this.getReviewValue(f, form, selectState)
          };
        });

      if (allFields.length > 0) {
        data.push({
          step: 'Form Details',
          fields: allFields
        });
      }
    }
    return data;
  }

  private getFieldsForReview(
    step: any,
    form: FormGroup | null,
    resolvedSchema: any,
    selectState: Record<string, any>
  ): { label: string, value: any }[] {
    const s = resolvedSchema;
    if (!s) return [];
    const ids = new Set(step?.fieldIds ?? []);
    return (s.fields ?? [])
      .filter((f: any) => ids.has(f.id) && !this.isNonInput(f) && this.visibility.isFieldVisibleOriginal(f))
      .map((f: any) => {
        return {
          label: f.label,
          value: this.getReviewValue(f, form, selectState)
        };
      });
  }

  private getReviewValue(
    field: any,
    form: FormGroup | null,
    selectState: Record<string, any>
  ): string {
    const val = form?.get(this.controlKey(field))?.value;
    if (val === null || val === undefined || val === '') return '-';
    
    if (field.type === 'select' || field.type === 'radio') {
      const opts = field.optionsSource?.mode === 'API' ? selectState[field.id]?.options : field.options;
      const selectedOpt = (opts || []).find((o: any) => String(o.value) === String(val));
      return selectedOpt ? selectedOpt.label : val;
    }
    if (field.type === 'checkbox') {
      return val ? 'Yes' : 'No';
    }
    if (field.type === 'file') {
      const names = this.fileNames(field, form);
      return names.length ? names.join(', ') : '-';
    }
    if (field.type === 'array' && Array.isArray(val)) {
      if (val.length === 0) return 'No items added';
      const itemLabel = field.fieldArray?.label || field.label || field.name || 'Item';
      return val.map((group, i) => {
        const parts = Object.entries(group)
          .map(([k, v]) => {
            const childField = field.fieldArray?.fields?.find((f: any) => (f.name ?? f.id) === k);
            const childLabel = childField ? childField.label : k;
            
            let formattedV = v;
            if (v === null || v === undefined || v === '') formattedV = '-';
            else if (typeof v === 'boolean') formattedV = v ? 'Yes' : 'No';
            else if (Array.isArray(v)) formattedV = v.join(', ');
            else if (v instanceof File) formattedV = v.name;
            
            if (childField && childField.unit && formattedV !== '-') {
              formattedV = `${formattedV} ${childField.unit}`;
            }
            
            return `  • ${childLabel}: ${formattedV}`;
          })
          .join('\n');
        return `\n${itemLabel} ${i + 1}:\n${parts}`;
      }).join('\n');
    }
    
    const displayVal = String(val);
    if (field.unit && displayVal !== '-') {
      return `${displayVal} ${field.unit}`;
    }
    return val;
  }

  private isNonInput(field: any): boolean {
    const t = field?.type;
    return t === "card" || t === "info-card" || t === "button";
  }

  private controlKey(field: any): string {
    return field?.name ?? field?.id;
  }

  private fileNames(field: FormFieldSchema, form: FormGroup | null): string[] {
    const v = form?.get(this.controlKey(field))?.value;
    if (!v) return [];
    if (Array.isArray(v)) return v.map((f: File) => f?.name).filter(Boolean);
    if (v instanceof File) return [v.name];
    if (typeof FileList !== "undefined" && v instanceof FileList) {
      return Array.from(v)
        .map((f) => f?.name)
        .filter(Boolean);
    }
    return [];
  }
}
