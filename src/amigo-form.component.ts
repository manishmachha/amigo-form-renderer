import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  TemplateRef,
  effect,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormGroup } from "@angular/forms";
import { MatDialogModule, MatDialog } from "@angular/material/dialog";
import { HttpClient } from "@angular/common/http";
import { finalize, firstValueFrom } from "rxjs";

import { FormSchema, FormFieldSchema } from "./models";
import { buildFormGroup } from "./form-group.builder";
import { AmigoApiExecutionService } from "./amigo-api-execution.service";

import { FormVisibilityService } from "./services/form-visibility.service";
import { FormSubmissionService } from "./services/form-submission.service";
import { FormReviewService } from "./services/form-review.service";
import { FormSchemaManagerService } from "./services/form-schema-manager.service";
import { FormValueManagerService } from "./services/form-value-manager.service";
import { FormStepSectionManagerService } from "./services/form-step-section-manager.service";
import { FormSelectOptionsManagerService } from "./services/form-select-options-manager.service";
import { FormCalculationManagerService } from './services/form-calculation-manager.service';

import { AmigoStepperComponent } from "./components/amigo-stepper/amigo-stepper.component";
import { AmigoFieldRendererComponent } from "./components/amigo-field-renderer/amigo-field-renderer.component";
import { AmigoReviewDialogComponent } from "./components/amigo-review-dialog/amigo-review-dialog.component";

@Component({
  selector: "amigo-form",
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    AmigoStepperComponent,
    AmigoFieldRendererComponent,
    AmigoReviewDialogComponent
  ],
  templateUrl: "./amigo-form.component.html",
  styleUrl: "./amigo-form.component.css",
  providers: [
    FormSchemaManagerService,
    FormStepSectionManagerService,
    FormValueManagerService,
    FormVisibilityService,
    FormSelectOptionsManagerService,
    FormReviewService,
    FormSubmissionService,
    FormCalculationManagerService
  ]
})
export class AmigoFormComponent implements OnChanges, OnDestroy {
  @Input() formId?: string;
  @Input() schema?: FormSchema;
  @Input() initialValue?: Record<string, any>;
  @Input() submitPathParams?: Record<string, any>;
  @Input() submitQueryParams?: Record<string, any>;
  @Input() submitHeaders?: Record<string, string>;
  @Input() submitAdditionalBody?: Record<string, any>;

  @Output() submitted = new EventEmitter<any>();
  @Output() submitFailed = new EventEmitter<any>();

  @Input() isSubmitting = false;
  
  @Input() draftId?: string;
  @Output() draftIdChange = new EventEmitter<string>();

  isDrafting = false;

  form: FormGroup | null = null;
  submitFeedback?: { type: "success" | "error"; message: string };
  buttonLoading: Record<string, boolean> = {};
  buttonFeedback: Record<string, { type: "success" | "error"; message: string }> = {};

  @ViewChild('reviewDialogTemplate') reviewDialogTemplate!: TemplateRef<any>;

  constructor(
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private apiExec: AmigoApiExecutionService,
    private visibility: FormVisibilityService,
    private submission: FormSubmissionService,
    private reviewService: FormReviewService,
    public schemaManager: FormSchemaManagerService,
    public valueManager: FormValueManagerService,
    public stepSectionManager: FormStepSectionManagerService,
    public selectOptionsManager: FormSelectOptionsManagerService,
    private calculationManager: FormCalculationManagerService,
    private http: HttpClient
  ) {
    // Re-initialize form when schema resolves
    effect(() => {
      const s = this.schemaManager.resolvedSchema();
      if (s) {
        this.initForm(s);
      } else {
        this.form = null;
      }
    });
  }

  private initForm(s: any) {
    let startStep = 0;
    if (this.initialValue && typeof this.initialValue['currentStep'] === 'number') {
       // Assume currentStep is 1-indexed from the API
       startStep = Math.max(0, this.initialValue['currentStep'] - 1);
    }
    this.stepSectionManager.activeStepIndex.set(startStep);
    this.stepSectionManager.highestCompletedStep.set(startStep);
    this.stepSectionManager.isReviewed.set(false);

    this.form = buildFormGroup(s.fields, this.initialValue);
    
    this.valueManager.patchInitialValue(this.form, s, this.initialValue);
    
    this.visibility.setupVisibility(this.form, s, () => {
      if (this.stepSectionManager.isReviewed()) {
        this.stepSectionManager.isReviewed.set(false);
        this.cdr.detectChanges();
      }
    });

    this.selectOptionsManager.preloadApiSelectOptions(this.form);
    this.selectOptionsManager.setupCascadingSelects(this.form);
    this.calculationManager.setupCalculations(this.form, s.fields || []);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["schema"] || changes["formId"]) {
      this.schemaManager.init(this.formId, this.schema);
    }
    if (changes["initialValue"] && this.resolvedSchema && !changes["initialValue"].firstChange) {
      this.initForm(this.resolvedSchema);
    }
  }

  ngOnDestroy(): void {
    this.visibility.cleanup();
    this.selectOptionsManager.cleanup();
    this.calculationManager.cleanup();
  }

  // View Helpers Delegations
  get isLoading() { return this.schemaManager.isLoading(); }
  get loadError() { return this.schemaManager.loadError(); }
  get resolvedSchema() { return this.schemaManager.resolvedSchema(); }
  
  get isMultiStep() { return this.stepSectionManager.isMultiStep(); }
  get totalSteps() { return this.stepSectionManager.totalSteps(); }
  get orderedSteps() { return this.stepSectionManager.orderedSteps(); }
  get activeStepIndex() { return this.stepSectionManager.activeStepIndex(); }
  
  get isSectional() { return this.stepSectionManager.isSectional(); }
  get orderedSections() { return this.stepSectionManager.orderedSections(); }
  
  get isReviewed() { return this.stepSectionManager.isReviewed(); }
  get selectState() { return this.selectOptionsManager.selectState(); }

  get visibleFields(): FormFieldSchema[] {
    return this.stepSectionManager.visibleFields();
  }

  fieldsForStep(index: number): FormFieldSchema[] {
    return this.stepSectionManager.fieldsForStep(index);
  }

  sectionsForStep(index: number) {
    if (index < 0 || index >= this.totalSteps) return [];
    const stepId = this.orderedSteps[index].id;
    return this.orderedSections.filter(s => s.stepId === stepId);
  }

  get sectionsForActiveStep() {
    return this.sectionsForStep(this.activeStepIndex);
  }

  fieldsForSectionInActiveStep(sectionId: string): FormFieldSchema[] {
    const stepFields = this.visibleFields;
    const s = this.resolvedSchema;
    if (!s) return [];
    const section = (s.sections ?? []).find((x: any) => x.id === sectionId);
    const ids = new Set(section?.fieldIds ?? []);
    return stepFields.filter(f => ids.has(f.id));
  }

  get unsectionedFieldsForActiveStep(): FormFieldSchema[] {
    const stepFields = this.visibleFields;
    const s = this.resolvedSchema;
    if (!s) return stepFields;
    const sections = this.sectionsForActiveStep;
    const sectionedIds = new Set<string>();
    for (const sec of sections) {
      (sec.fieldIds ?? []).forEach(id => sectionedIds.add(id));
    }
    return stepFields.filter(f => !sectionedIds.has(f.id));
  }

  fieldsForSection(sectionId: string): FormFieldSchema[] {
    return this.stepSectionManager.fieldsForSection(sectionId);
  }

  setActiveStep(i: number) {
    this.stepSectionManager.setActiveStep(i, this.form);
  }

  prevStep(): void {
    this.stepSectionManager.prevStep(this.form);
  }

  async nextStep(): Promise<void> {
    const fields = this.fieldsForStep(this.activeStepIndex);
    this.stepSectionManager.touchFields(fields, this.form);
    if (this.stepSectionManager.hasErrors(fields, this.form)) return;

    const draftConfig = this.resolvedSchema?.draftConfig;
    if (this.isMultiStep && draftConfig?.enabled && draftConfig.apiUrl) {
      try {
        this.isDrafting = true;
        this.cdr.detectChanges();

        const stepValue = this.getValuesForFields(fields);
        const payload: any = {
          step: this.activeStepIndex + 1,
          ...stepValue
        };

        if (this.draftId) {
          payload.id = this.draftId;
        }

        const method = (draftConfig.method || 'POST').toLowerCase();
        
        let req$: any;
        if (method === 'put') {
          req$ = this.http.put(draftConfig.apiUrl, payload);
        } else {
          req$ = this.http.post(draftConfig.apiUrl, payload);
        }

        const res: any = await firstValueFrom(req$);

        // If it's the first step (or we don't have a draft ID yet), extract it from response
        if (this.activeStepIndex === 0 || !this.draftId) {
          const path = draftConfig.draftIdPath || 'data.id';
          const newDraftId = this.extractValueFromPath(res, path);
          if (newDraftId) {
            this.draftId = newDraftId;
            this.draftIdChange.emit(newDraftId);
          }
        }
      } catch (err: any) {
        console.error('Draft API Error:', err);
        const errMsg = err?.error?.message || err?.message || 'Failed to save draft. Please try again.';
        this.submitFeedback = { type: 'error', message: errMsg };
        this.isDrafting = false;
        this.cdr.detectChanges();
        return; 
      } finally {
        this.isDrafting = false;
        this.cdr.detectChanges();
      }
    }

    this.submitFeedback = undefined; // clear any previous draft error
    const nextIdx = this.activeStepIndex + 1;
    this.stepSectionManager.highestCompletedStep.set(
      Math.max(this.stepSectionManager.highestCompletedStep(), nextIdx)
    );
    this.stepSectionManager.nextStep(this.form);
  }

  private getValuesForFields(fields: FormFieldSchema[]): Record<string, any> {
    const values: Record<string, any> = {};
    if (!this.form) return values;
    for (const f of fields) {
      if (this.isNonInput(f)) continue;
      const key = f.name ?? f.id;
      values[key] = this.form.get(key)?.value;
    }
    return values;
  }

  private extractValueFromPath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    const keys = path.split('.');
    let curr = obj;
    for (const k of keys) {
      if (curr === null || curr === undefined) return undefined;
      curr = curr[k];
    }
    return curr;
  }

  trackByFieldId = (_: number, field: any) => field?.id ?? field?.name ?? _;

  getFormStyle(): Record<string, any> {
    const sp: any = this.resolvedSchema?.spacing ?? {};
    const st: any = this.resolvedSchema?.style ?? {};
    return {
      marginTop: this.px(sp.marginTop),
      marginRight: this.px(sp.marginRight),
      marginBottom: this.px(sp.marginBottom),
      marginLeft: this.px(sp.marginLeft),
      paddingTop: this.px(sp.paddingTop),
      paddingRight: this.px(sp.paddingRight),
      paddingBottom: this.px(sp.paddingBottom),
      paddingLeft: this.px(sp.paddingLeft),
      backgroundColor: st.backgroundColor ?? null,
      color: st.textColor ?? null,
      borderStyle: st.borderWidth ? "solid" : null,
      borderWidth: st.borderWidth ? this.px(st.borderWidth) : null,
      borderColor: st.borderColor ?? null,
      borderRadius: st.borderRadius ? this.px(st.borderRadius) : null,
    };
  }

  private px(v: any): string | null {
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? `${n}px` : null;
  }

  async submit(triggerField?: any): Promise<void> {
    this.submitFeedback = undefined;
    const formValue = this.valueManager.normalizeFormValue(this.form!, this.resolvedSchema);
    
    await this.submission.submit(this.form, this.resolvedSchema, formValue, {
      triggerField,
      submitPathParams: this.submitPathParams,
      submitQueryParams: this.submitQueryParams,
      submitHeaders: this.submitHeaders,
      submitAdditionalBody: this.submitAdditionalBody,
      onStateChange: (state) => {
        this.isSubmitting = state.isSubmitting;
        if (state.feedback) this.submitFeedback = state.feedback;
        this.cdr.detectChanges();
      },
      onSuccess: (res) => this.submitted.emit(res),
      onError: (err) => this.submitFailed.emit(err)
    });
  }

  onSchemaButtonClick(field: any): void {
    const btn = field?.button;
    if (btn?.styleVariant === 'link' && btn?.href) {
      window.open(btn.href, '_blank');
      return;
    }
    
    const endpoint = btn?.api;
    if (!btn || (btn.actionType === "API_CALL" && !endpoint?.url)) return;

    const triggerValidation = btn.triggerValidation !== false;

    if (triggerValidation) {
      const scope = this.isMultiStep
        ? this.visibleFields
        : (this.resolvedSchema?.fields ?? []);
      const inputs = scope.filter((f: any) => this.isNonInput(f) === false);
      this.stepSectionManager.touchFields(inputs, this.form);
      if (this.stepSectionManager.hasErrors(inputs, this.form)) return;
    }

    const formValue = this.valueManager.normalizeFormValue(this.form!, this.resolvedSchema);
    this.buttonLoading[field.id] = true;
    delete this.buttonFeedback[field.id];

    this.apiExec
      .execute(endpoint!, { formValue })
      .pipe(finalize(() => (this.buttonLoading[field.id] = false)))
      .subscribe({
        next: (res) => {
          this.buttonFeedback[field.id] = {
            type: "success",
            message: btn.successMessage || "Action completed successfully.",
          };
          this.submitted.emit({
            url: endpoint.url,
            method: endpoint.method || 'POST',
            payload: formValue,
            headers: endpoint.headers || [],
            params: endpoint.queryParams || [],
            response: res,
          });
        },
        error: (err) => {
          this.buttonFeedback[field.id] = {
            type: "error",
            message: btn.errorMessage || err?.error?.message || err?.message || "Action failed.",
          };
        },
      });
  }

  onFileChange(evt: Event, field: FormFieldSchema): void {
    const input = evt.target as HTMLInputElement;
    const files = input?.files ? Array.from(input.files) : [];

    const c = this.form?.get(field.name ?? field.id);
    if (!c) return;

    let normalized = field.multiple ? files : files.slice(0, 1);

    if (typeof field.maxFiles === "number" && field.maxFiles > 0) {
      normalized = normalized.slice(0, field.maxFiles);
    }

    c.setValue(field.multiple ? normalized : (normalized[0] ?? null));
    c.markAsTouched();
    c.updateValueAndValidity();
  }

  clearFiles(field: FormFieldSchema, inputEl: HTMLInputElement): void {
    const c = this.form?.get(field.name ?? field.id);
    if (!c) return;
    c.setValue(null);
    c.markAsTouched();
    c.updateValueAndValidity();
    if (inputEl) inputEl.value = "";
  }

  openReviewDialog() {
    const fields = this.fieldsForStep(this.activeStepIndex);
    this.stepSectionManager.touchFields(fields, this.form);
    if (this.stepSectionManager.hasErrors(fields, this.form)) return;
    this.dialog.open(this.reviewDialogTemplate, {
      width: '800px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      disableClose: true,
      panelClass: 'amigo-review-dialog'
    });
  }

  closeReviewDialog() {
    this.dialog.closeAll();
  }

  confirmReview() {
    this.stepSectionManager.isReviewed.set(true);
    this.dialog.closeAll();
  }

  get reviewData() {
    return this.reviewService.generateReviewData(
      this.form, 
      this.resolvedSchema, 
      this.isMultiStep, 
      this.orderedSteps, 
      this.selectState
    );
  }

  private isNonInput(field: any): boolean {
    const t = field?.type;
    return t === "card" || t === "info-card" || t === "button";
  }
}
