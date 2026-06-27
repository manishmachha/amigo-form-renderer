import { Injectable, signal } from '@angular/core';
import { AmigoFormService } from '../amigo-form.service';
import { FormSchema, FormType } from '../models';
import { normalizeAccept } from '../form-group.builder';

@Injectable({
  providedIn: 'root'
})
export class FormSchemaManagerService {
  readonly isLoading = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);
  readonly resolvedSchema = signal<any | null>(null);

  constructor(private formService: AmigoFormService) {}

  init(formId?: string, schemaInput?: FormSchema): void {
    this.loadError.set(null);

    if (schemaInput) {
      this.applySchema(schemaInput);
      return;
    }

    if (!formId) {
      this.resolvedSchema.set(null);
      this.loadError.set("No schema or formId provided.");
      return;
    }

    this.isLoading.set(true);

    this.formService.getFormSchemaById(formId).subscribe({
      next: (res: any) => {
        this.applySchema(res?.form_data ?? res);
        this.isLoading.set(false);
      },
      error: (e) => {
        this.isLoading.set(false);
        this.loadError.set(e?.message ?? "Failed to load form schema");
      },
    });
  }

  private applySchema(raw: any): void {
    const s: any = typeof raw === "string" ? JSON.parse(raw) : raw;
    const formType: FormType = (s?.formType ?? "single") as FormType;

    const fields = (s?.fields ?? []).map((f: any) => {
      if (f?.type === "file") return { ...f, accept: normalizeAccept(f.accept) };
      return f;
    });

    const parsedSchema = {
      ...s,
      formType,
      layout: s?.layout ?? { rows: 1, columns: 1 },
      fields,
      steps: s?.steps ?? [],
      sections: s?.sections ?? [],
      spacing: s?.spacing ?? {},
      style: s?.style ?? {},
      actions: s?.actions ?? {},
      draftConfig: s?.draftConfig,
    };

    this.resolvedSchema.set(parsedSchema);
  }
}
