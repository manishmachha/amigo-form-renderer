import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormGroup,
  AbstractControl,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { FormSchema, FormFieldSchema, FormType } from './models';
import { AmigoFormService } from './amigo-form.service';
import { buildFormGroup, normalizeAccept } from './form-group.builder';

@Component({
  selector: 'amigo-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './amigo-form.component.html',
  styleUrl: './amigo-form.component.css',
})
export class AmigoFormComponent implements OnChanges {
  @Input() formId?: string;
  @Input() schema?: FormSchema;
  @Input() initialValue?: Record<string, any>;

  @Output() submitted = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  isLoading = false;
  loadError: string | null = null;

  resolvedSchema: any | null = null;
  form: FormGroup | null = null;

  activeStepIndex = 0;

  isSubmitHovered = false;
  isCancelHovered = false;

  constructor(private formService: AmigoFormService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['schema'] || changes['formId']) {
      this.init();
    }
  }

  private init(): void {
    this.loadError = null;

    if (this.schema) {
      this.applySchema(this.schema as any);
      return;
    }

    if (!this.formId) {
      this.resolvedSchema = null;
      this.form = null;
      this.loadError = 'No schema or formId provided.';
      return;
    }

    this.isLoading = true;
    this.formService
      .getFormSchemaById(this.formId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (res: any) => {
          this.applySchema(res?.form_data ?? res);
        },
        error: (e) =>
          (this.loadError = e?.message ?? 'Failed to load form schema'),
      });
  }

  private applySchema(raw: any): void {
    const s: any = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const formType: FormType = (s?.formType ?? 'single') as FormType;

    // normalize file accept tokens in schema
    const fields = (s?.fields ?? []).map((f: any) => {
      if (f?.type === 'file')
        return { ...f, accept: normalizeAccept(f.accept) };
      return f;
    });

    this.resolvedSchema = {
      ...s,
      formType,
      layout: s?.layout ?? { rows: 1, columns: 1 },
      fields,
      steps: s?.steps ?? [],
      sections: s?.sections ?? [],
      spacing: s?.spacing ?? {},
      style: s?.style ?? {},
      actions: s?.actions ?? {},
    };

    this.activeStepIndex = 0;
    this.form = buildFormGroup(this.resolvedSchema!.fields, this.initialValue);
  }

  // ---------- info cards ----------
  // Non-input blocks that can be placed inside the form layout.

  isCard(field: FormFieldSchema | any): boolean {
    const t = (field as any)?.type;
    return t === 'card' || t === 'info-card';
  }

  cardIcon(field: any): string {
    return field?.card?.icon || '✅';
  }

  cardTitle(field: any): string {
    return field?.card?.title || field?.label || 'Info';
  }

  cardBody(field: any): string {
    return field?.card?.body || '';
  }

  cardStyle(field: any): Record<string, any> {
    const cs = field?.card?.style ?? {};

    const borderWidth = cs.borderWidth ?? 1;
    const borderRadius = cs.borderRadius ?? 12;
    const borderColor = cs.borderColor ?? '#BBF7D0';
    const backgroundColor = cs.backgroundColor ?? '#F0FDF4';
    const textColor = cs.textColor ?? '#166534';

    return {
      borderStyle: 'solid',
      borderWidth: `${borderWidth}px`,
      borderColor,
      borderRadius: `${borderRadius}px`,
      backgroundColor,
      color: textColor,
      padding: '12px',
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
    };
  }

  cardIconStyle(field: any): Record<string, any> {
    const cs = field?.card?.style ?? {};
    const textColor = cs.textColor ?? '#166534';
    return {
      color: cs.iconColor ?? textColor,
      fontSize: '18px',
      lineHeight: '1',
      marginTop: '2px',
    };
  }

  // ---------- keys & controls ----------

  controlKey(field: any): string {
    return field?.name ?? field?.id;
  }

  ctrl(field: any): AbstractControl | null {
    return this.form?.get(this.controlKey(field)) ?? null;
  }

  showError(field: any): boolean {
    const c = this.ctrl(field);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  // ---------- file inputs ----------

  onFileChange(evt: Event, field: FormFieldSchema): void {
    const input = evt.target as HTMLInputElement;
    const files = input?.files ? Array.from(input.files) : [];

    const key = this.controlKey(field);
    const c = this.form?.get(key);
    if (!c) return;

    // If multiple is off, keep only first file.
    let normalized = field.multiple ? files : files.slice(0, 1);

    // If schema has maxFiles, clip to maxFiles (UX nicety)
    if (typeof field.maxFiles === 'number' && field.maxFiles > 0) {
      normalized = normalized.slice(0, field.maxFiles);
    }

    // store as File[] or File
    c.setValue(field.multiple ? normalized : normalized[0] ?? null);
    c.markAsTouched();
    c.updateValueAndValidity();
  }

  fileNames(field: FormFieldSchema): string[] {
    const v = this.ctrl(field)?.value;
    if (!v) return [];
    if (Array.isArray(v)) return v.map((f: File) => f?.name).filter(Boolean);
    if (v instanceof File) return [v.name];
    if (typeof FileList !== 'undefined' && v instanceof FileList) {
      return Array.from(v)
        .map((f) => f?.name)
        .filter(Boolean);
    }
    return [];
  }

  clearFiles(field: FormFieldSchema, inputEl: HTMLInputElement): void {
    const c = this.ctrl(field);
    if (!c) return;
    c.setValue(null);
    c.markAsTouched();
    c.updateValueAndValidity();
    if (inputEl) inputEl.value = '';
  }

  // ---------- visibility helpers ----------

  trackByFieldId = (_: number, field: any) => field?.id ?? field?.name ?? _;

  get orderedSteps() {
    const s = this.resolvedSchema;
    return [...(s?.steps ?? [])].sort(
      (a, b) => (a?.order ?? 0) - (b?.order ?? 0)
    );
  }

  get totalSteps(): number {
    return this.orderedSteps.length;
  }

  get isMultiStep(): boolean {
    return this.resolvedSchema?.formType === 'multi' && this.totalSteps > 0;
  }

  get currentStepLabel(): string {
    return this.orderedSteps[this.activeStepIndex]?.label ?? '';
  }

  get visibleFields(): FormFieldSchema[] {
    const s = this.resolvedSchema;
    if (!s) return [];

    if (s.formType === 'multi' && this.totalSteps > 0) {
      const step = this.orderedSteps[this.activeStepIndex];
      const ids = new Set(step?.fieldIds ?? []);
      if (!ids.size) return [];
      return (s.fields ?? []).filter((f: any) => ids.has(f.id));
    }

    return s.fields ?? [];
  }

  get orderedSections() {
    const s = this.resolvedSchema;
    if (!s || s.formType !== 'single-sectional') return [];
    return [...(s.sections ?? [])].sort(
      (a, b) => (a?.order ?? 0) - (b?.order ?? 0)
    );
  }

  get isSectional(): boolean {
    return (
      this.resolvedSchema?.formType === 'single-sectional' &&
      this.orderedSections.length > 0
    );
  }

  fieldsForSection(sectionId: string): FormFieldSchema[] {
    const s = this.resolvedSchema;
    if (!s) return [];
    const section = (s.sections ?? []).find((x: any) => x.id === sectionId);
    const ids = new Set(section?.fieldIds ?? []);
    return (s.fields ?? []).filter((f: any) => ids.has(f.id));
  }

  setActiveStep(i: number) {
    this.activeStepIndex = i;
  }

  // ---------- actions ----------

  onCancel(): void {
    this.cancelled.emit();
  }

  prevStep(): void {
    this.activeStepIndex = Math.max(0, this.activeStepIndex - 1);
  }

  nextStep(): void {
    const s = this.resolvedSchema;
    if (!s || s.formType !== 'multi') return;

    const current = this.visibleFields;
    this.touchFields(current);
    if (this.hasErrors(current)) return;

    this.activeStepIndex = Math.min(
      this.totalSteps - 1,
      this.activeStepIndex + 1
    );
  }

  submit(): void {
    if (!this.resolvedSchema || !this.form) return;

    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.submitted.emit(this.form.getRawValue());
  }

  private touchFields(fields: FormFieldSchema[]): void {
    if (!this.form) return;
    for (const f of fields as any[]) {
      if (this.isCard(f)) continue;
      const c = this.form.get(this.controlKey(f));
      c?.markAsTouched();
      c?.updateValueAndValidity();
    }
  }

  private hasErrors(fields: FormFieldSchema[]): boolean {
    if (!this.form) return true;
    return (fields as any[])
      .filter((f) => !this.isCard(f))
      .some((f) => this.form!.get(this.controlKey(f))?.invalid);
  }

  // ---------- styling helpers ----------

  getFormStyle(): Record<string, any> {
    const sp: any = this.resolvedSchema?.spacing ?? {};
    const st: any = this.resolvedSchema?.style ?? {};

    return {
      marginTop: px(sp.marginTop),
      marginRight: px(sp.marginRight),
      marginBottom: px(sp.marginBottom),
      marginLeft: px(sp.marginLeft),
      paddingTop: px(sp.paddingTop),
      paddingRight: px(sp.paddingRight),
      paddingBottom: px(sp.paddingBottom),
      paddingLeft: px(sp.paddingLeft),
      backgroundColor: st.backgroundColor ?? null,
      color: st.textColor ?? null,
      borderStyle: st.borderWidth ? 'solid' : null,
      borderWidth: st.borderWidth ? px(st.borderWidth) : null,
      borderColor: st.borderColor ?? null,
      borderRadius: st.borderRadius ? px(st.borderRadius) : null,
    };
  }

  get submitButtonStyle(): { [key: string]: string } {
    const st: any = this.resolvedSchema?.style ?? {};
    const baseBg = st.buttonBackgroundColor ?? '#111827';
    const baseText = st.buttonTextColor ?? '#ffffff';
    const hoverBg = st.buttonHoverBackgroundColor ?? baseBg;
    const hoverText = st.buttonHoverTextColor ?? baseText;

    return {
      backgroundColor: this.isSubmitHovered ? hoverBg : baseBg,
      color: this.isSubmitHovered ? hoverText : baseText,
      borderRadius: st.borderRadius ? `${st.borderRadius}px` : '10px',
    };
  }

  get cancelButtonStyle(): { [key: string]: string } {
    const st: any = this.resolvedSchema?.style ?? {};
    const baseBg = '#FFFFFF';
    const baseText = st.buttonBackgroundColor ?? '#111827';
    const baseBorder = st.buttonBackgroundColor ?? '#111827';

    const hoverBg = st.buttonHoverBackgroundColor ?? baseBg;
    const hoverText = st.buttonHoverTextColor ?? baseText;
    const hoverBorder = st.buttonHoverBackgroundColor ?? baseBorder;

    const isHover = this.isCancelHovered;

    return {
      backgroundColor: isHover ? hoverBg : baseBg,
      color: isHover ? hoverText : baseText,
      border: `1px solid ${isHover ? hoverBorder : baseBorder}`,
      borderRadius: st.borderRadius ? `${st.borderRadius}px` : '10px',
    };
  }

  isBootstrapIcon(icon: string | null | undefined): boolean {
    const v = (icon || '').trim();
    // common pattern: "bi bi-xxx"
    return v.startsWith('bi ') || v.startsWith('bi-') || v.includes(' bi-');
  }
}

function px(v: any): string | null {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? `${n}px` : null;
}
