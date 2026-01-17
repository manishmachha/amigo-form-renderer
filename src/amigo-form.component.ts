import { ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, AbstractControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { FormSchema, FormFieldSchema, FormType, FormActionSchema, ActionApiConfig } from './models';
import { AmigoFormService } from './amigo-form.service';
import { buildFormGroup, normalizeAccept } from './form-group.builder';
import { AmigoApiExecutionService } from './amigo-api-execution.service';
import { AmigoSelectOptionsService } from './amigo-select-options.service';
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

  
  @Output() submitFailed = new EventEmitter<any>();

  @Output() cancelled = new EventEmitter<void>();

  isLoading = false;
  loadError: string | null = null;

  isSubmitting = false;
  submitError: string | null = null;

  resolvedSchema: any | null = null;
  form: FormGroup | null = null;

  activeStepIndex = 0;
  submitLoading = false;
  submitFeedback?: { type: 'success' | 'error'; message: string };
  isSubmitHovered = false;
  isCancelHovered = false;
  selectState: Record<string, { loading: boolean; error?: string; options: any[] }> = {};
  buttonLoading: Record<string, boolean> = {};
  buttonFeedback: Record<string, { type: 'success' | 'error'; message: string }> = {};

  private visibilitySub?: Subscription;
  private visibilityState: Record<string, boolean> = {};
  private visibilityUpdating = false;

  constructor(
    private formService: AmigoFormService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private apiExec: AmigoApiExecutionService,
    private selectOptions: AmigoSelectOptionsService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['schema'] || changes['formId']) {
      this.init();
    }
    if (changes['initialValue'] && this.resolvedSchema) {
      this.form = buildFormGroup(this.resolvedSchema!.fields, this.initialValue);
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
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges(); //  ensure UI shows loading immediately

    this.formService.getFormSchemaById(this.formId).subscribe({
      next: (res: any) => {
        this.zone.run(() => {
          this.applySchema(res?.form_data ?? res);
          this.isLoading = false;
          this.cdr.detectChanges(); //  render immediately
        });
      },
      error: (e) => {
        this.zone.run(() => {
          this.isLoading = false;
          this.loadError = e?.message ?? 'Failed to load form schema';
          this.cdr.detectChanges();
        });
      },
    });
  }

  private preloadApiSelectOptions(): void {
    const fields = this.resolvedSchema?.fields ?? [];
    const formValue = this.normalizeFormValue();

    for (const f of fields) {
      if (f.type !== 'select') continue;
      if (f.optionsSource?.mode !== 'API') continue;

      this.selectState[f.id] = { loading: true, options: [] };

      this.selectOptions.load(f, formValue).subscribe({
        next: (opts) => {
          this.selectState[f.id] = { loading: false, options: opts };
          this.cdr.detectChanges();
        },
        error: () => {
          this.selectState[f.id] = {
            loading: false,
            error: 'Failed to load options.',
            options: [],
          };
          this.cdr.detectChanges();
        },
      });
    }
  }

  private applySchema(raw: any): void {
    const s: any = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const formType: FormType = (s?.formType ?? 'single') as FormType;

    const fields = (s?.fields ?? []).map((f: any) => {
      if (f?.type === 'file') return { ...f, accept: normalizeAccept(f.accept) };
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
    this.patchInitialValue();
    this.setupVisibility();
    this.preloadApiSelectOptions();
  }

  isCard(field: FormFieldSchema | any): boolean {
    const t = (field as any)?.type;
    return t === 'card' || t === 'info-card';
  }

  cardIcon(field: any): string {
    return field?.card?.icon || '';
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

  onFileChange(evt: Event, field: FormFieldSchema): void {
    const input = evt.target as HTMLInputElement;
    const files = input?.files ? Array.from(input.files) : [];

    const key = this.controlKey(field);
    const c = this.form?.get(key);
    if (!c) return;

    let normalized = field.multiple ? files : files.slice(0, 1);

    if (typeof field.maxFiles === 'number' && field.maxFiles > 0) {
      normalized = normalized.slice(0, field.maxFiles);
    }

    c.setValue(field.multiple ? normalized : (normalized[0] ?? null));
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

  trackByFieldId = (_: number, field: any) => field?.id ?? field?.name ?? _;

  get orderedSteps() {
    const s = this.resolvedSchema;
    return [...(s?.steps ?? [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  }

  get totalSteps(): number {
    return this.orderedSteps.length;
  }

  get isMultiStep(): boolean {
    return this.resolvedSchema?.formType === 'multi' && this.totalSteps > 0;
  }

  get visibleFields(): FormFieldSchema[] {
    const s = this.resolvedSchema;
    if (!s) return [];

    if (s.formType === 'multi' && this.totalSteps > 0) {
      const step = this.orderedSteps[this.activeStepIndex];
      const ids = new Set(step?.fieldIds ?? []);
      if (!ids.size) return [];
      return (s.fields ?? []).filter((f: any) => ids.has(f.id)).filter((f: any) => this.isFieldVisible(f));
    }

    return (s.fields ?? []).filter((f: any) => this.isFieldVisible(f));
  }

  get orderedSections() {
    const s = this.resolvedSchema;
    if (!s || s.formType !== 'single-sectional') return [];
    return [...(s.sections ?? [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  }

  get isSectional(): boolean {
    return this.resolvedSchema?.formType === 'single-sectional' && this.orderedSections.length > 0;
  }

  fieldsForSection(sectionId: string): FormFieldSchema[] {
    const s = this.resolvedSchema;
    if (!s) return [];
    const section = (s.sections ?? []).find((x: any) => x.id === sectionId);
    const ids = new Set(section?.fieldIds ?? []);
    return (s.fields ?? []).filter((f: any) => ids.has(f.id)).filter((f: any) => this.isFieldVisible(f));
  }

  setActiveStep(i: number) {
    this.activeStepIndex = i;
  }

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

    this.activeStepIndex = Math.min(this.totalSteps - 1, this.activeStepIndex + 1);
  }

  submit(): void {
    if (!this.resolvedSchema || !this.form) return;

    this.submitError = null;
    this.submitFeedback = undefined;

    const action: FormActionSchema | undefined = this.resolvedSchema?.actions;
    const submitCfg = this.resolveSubmitApi();

    const triggerValidation = submitCfg?.triggerValidation !== false;
    if (triggerValidation) {
      this.form.markAllAsTouched();
      if (this.form.invalid) return;
    }

    const payload = this.normalizePayload(this.form.value);

    if (!submitCfg) {
      this.submitted.emit(payload);
      return;
    }

    this.isSubmitting = true;
    this.apiExec
      .execute(submitCfg.api, {
        formValue: payload,
        payloadKey: action?.payloadKey || undefined,
        contentType: (action?.contentType as any) || 'auto',
      })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (res) => {
          this.submitFeedback = {
            type: 'success',
            message: submitCfg.successMessage || 'Submitted successfully.',
          };
          this.submitted.emit({ payload, response: res, action });
        },
        error: (err) => {
          const msg =
            submitCfg.errorMessage ||
            err?.error?.message ||
            err?.message ||
            'Failed to submit. Please try again.';
          this.submitError = msg;
          this.submitFeedback = { type: 'error', message: msg };
          this.submitFailed.emit(err);
        },
      });
  }

  private touchFields(fields: FormFieldSchema[]): void {
    if (!this.form) return;
    for (const f of fields as any[]) {
      if (this.isNonInput(f)) continue;
      if (!this.isFieldVisible(f)) continue;
      const c = this.form.get(this.controlKey(f));
      if (!c || c.disabled) continue;
      c.markAsTouched();
      c.updateValueAndValidity({ emitEvent: false });
    }
  }

  private hasErrors(fields: FormFieldSchema[]): boolean {
    if (!this.form) return true;
    return (fields as any[])
      .filter((f) => !this.isNonInput(f))
      .filter((f) => this.isFieldVisible(f))
      .some((f) => {
        const c = this.form!.get(this.controlKey(f));
        return !!(c && c.enabled && c.invalid);
      });
  }

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
    return v.startsWith('bi ') || v.startsWith('bi-') || v.includes(' bi-');
  }

  get showCancelButton(): boolean {
    const a: any = this.resolvedSchema?.actions ?? {};
    return a.showCancel !== false;
  }

  private normalizePayload(payload: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};

    for (const field of this.resolvedSchema?.fields ?? []) {
      const key = this.controlKey(field);
      const value = payload[key];

      if (field.type === 'number') {
        normalized[key] = value === '' || value === undefined ? null : Number(value);
      } else {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  private patchInitialValue(): void {
    if (!this.form || !this.resolvedSchema || !this.initialValue) return;

    const patch: Record<string, any> = {};
    const inputFields = (this.resolvedSchema.fields ?? []).filter((f: any) => !this.isCard(f));

    for (const field of inputFields) {
      const key = this.controlKey(field);

      const incoming =
        this.initialValue[key] ??
        (field?.name ? this.initialValue[field.name] : undefined) ??
        (field?.id ? this.initialValue[field.id] : undefined);

      if (incoming === undefined) continue;

      if (field.type === 'file') {
        continue;
      }

      if (field.type === 'number') {
        patch[key] = incoming === '' || incoming === null ? null : Number(incoming);
        continue;
      }

      if (field.type === 'checkbox') {
        patch[key] = incoming === true || incoming === 'true' || incoming === 1 || incoming === '1';
        continue;
      }

      if (field.type === 'date' && incoming) {
        patch[key] = String(incoming).slice(0, 10);
        continue;
      }

      patch[key] = incoming;
    }

    this.form.patchValue(patch, { emitEvent: false });

    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  isButton(field: any): boolean {
    return (field?.type ?? '') === 'button';
  }

  private isNonInput(field: any): boolean {
    const t = field?.type;
    return t === 'card' || t === 'info-card' || t === 'button';
  }

  private normalizeFormValue(): Record<string, any> {
    if (!this.form) return {};
    const raw = this.form.value;
    const normalized: Record<string, any> = {};

    for (const field of this.resolvedSchema?.fields ?? []) {
      if (this.isNonInput(field)) continue;
      const key = this.controlKey(field);
      const value = raw[key];
      normalized[key] =
        field.type === 'number'
          ? value === '' || value === undefined
            ? null
            : Number(value)
          : value;
    }
    return normalized;
  }


  private setupVisibility(): void {
    this.visibilitySub?.unsubscribe();
    if (!this.form || !this.resolvedSchema) return;
    this.recomputeVisibility();
    this.visibilitySub = this.form.valueChanges.subscribe(() => {
      if (this.visibilityUpdating) return;
      this.recomputeVisibility();
    });
  }

  isFieldVisible(field: any): boolean {
    const rules = field?.visibility?.rules;
    if (!rules || !rules.length) return true;
    const key = field?.id || field?.name;
    return this.visibilityState[key] !== false;
  }

  private recomputeVisibility(): void {
    if (!this.form || !this.resolvedSchema) return;
    const raw = (this.form as any).getRawValue ? (this.form as any).getRawValue() : this.form.value;

    this.visibilityUpdating = true;
    try {
      for (const f of this.resolvedSchema.fields as any[]) {
        const visible = this.evaluateVisibility(f, raw);
        const stateKey = f.id || f.name;
        this.visibilityState[stateKey] = visible;

        if (this.isNonInput(f)) continue;
        const c = this.form.get(this.controlKey(f));
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
    const mode = String(vis?.mode || 'ALL').toUpperCase();
    const results = rules.map((r: any) => this.evaluateVisibilityRule(r, raw));
    return mode === 'ANY' ? results.some(Boolean) : results.every(Boolean);
  }

  private evaluateVisibilityRule(rule: any, raw: Record<string, any>): boolean {
    const depKey = this.resolveDependsOnKey(rule?.dependsOn);
    const v = raw?.[depKey];
    const op = String(rule?.operator || 'EQUALS').toUpperCase();
    const cmp = rule?.value;

    switch (op) {
      case 'CHECKED':
        return v === true;
      case 'UNCHECKED':
        return v !== true;
      case 'HAS_VALUE':
        return !this.isEmptyValue(v);
      case 'NOT_HAS_VALUE':
        return this.isEmptyValue(v);
      case 'IN':
        return Array.isArray(cmp) ? cmp.includes(v) : false;
      case 'NOT_IN':
        return Array.isArray(cmp) ? !cmp.includes(v) : true;
      case 'NOT_EQUALS':
        return Array.isArray(v) ? !v.includes(cmp) : v !== cmp;
      case 'EQUALS':
      default:
        return Array.isArray(v) ? v.includes(cmp) : v === cmp;
    }
  }

  private resolveDependsOnKey(dep: any): string {
    const d = String(dep || '');
    if (!d) return d;
    if (this.form?.get(d)) return d;
    const fields = (this.resolvedSchema?.fields ?? []) as any[];
    const byId = fields.find((f) => f.id === d);
    if (byId) return this.controlKey(byId);
    const byName = fields.find((f) => f.name === d);
    if (byName) return this.controlKey(byName);
    return d;
  }

  private isEmptyValue(v: any): boolean {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string' && v.trim() === '') return true;
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
  }

  onSchemaButtonClick(field: any): void {
    const btn = field?.button;
    const endpoint = btn?.api;
    if (!btn || (btn.actionType === 'API_CALL' && !endpoint)) return;

    const triggerValidation = btn.triggerValidation !== false;

    if (triggerValidation) {
      const scope = this.isMultiStep ? this.visibleFields : (this.resolvedSchema?.fields ?? []);
      this.touchFields(scope.filter((f: any) => !this.isNonInput(f)));
      if (this.hasErrors(scope.filter((f: any) => !this.isNonInput(f)))) return;
    }

    const formValue = this.normalizeFormValue();
    this.buttonLoading[field.id] = true;
    delete this.buttonFeedback[field.id];

    this.apiExec
      .execute(endpoint!, { formValue })
      .pipe(finalize(() => (this.buttonLoading[field.id] = false)))
      .subscribe({
        next: () => {
          this.buttonFeedback[field.id] = {
            type: 'success',
            message: btn.successMessage || 'Action completed successfully.',
          };
        },
        error: (err) => {
          this.buttonFeedback[field.id] = {
            type: 'error',
            message: btn.errorMessage || err?.error?.message || err?.message || 'Action failed.',
          };
        },
      });
  }

  private resolveSubmitApi(): ActionApiConfig | null {
    const a: any = this.resolvedSchema?.actions;
    if (a?.submitApi?.api?.url) {
      return {
        triggerValidation: a.submitApi.triggerValidation !== false,
        successMessage: a.submitApi.successMessage,
        errorMessage: a.submitApi.errorMessage,
        api: a.submitApi.api,
      };
    }

    if (a?.submitApiUrl) {
      return {
        triggerValidation: true,
        api: {
          method: (a.method || 'POST') as any,
          url: a.submitApiUrl,
          headers: [],
          queryParams: [],
        },
      };
    }

    return null;
  }
}

function px(v: any): string | null {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? `${n}px` : null;
}
