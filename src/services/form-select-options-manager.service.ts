import { Injectable, signal, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DependentSelectConfig } from '../models';
import { AmigoSelectOptionsService } from '../amigo-select-options.service';
import { FormSchemaManagerService } from './form-schema-manager.service';
import { FormValueManagerService } from './form-value-manager.service';

@Injectable({
  providedIn: 'root'
})
export class FormSelectOptionsManagerService {
  private selectOptions = inject(AmigoSelectOptionsService);
  private schemaManager = inject(FormSchemaManagerService);
  private valueManager = inject(FormValueManagerService);

  readonly selectState = signal<Record<string, { loading: boolean; error?: string; options: any[] }>>({});
  private cascadingSubs: Subscription[] = [];

  preloadApiSelectOptions(form: FormGroup): void {
    const s = this.schemaManager.resolvedSchema();
    const fields = s?.fields ?? [];
    const formValue = this.valueManager.normalizeFormValue(form, s);

    for (const f of fields) {
      if (f.type !== "select") continue;
      if (f.optionsSource?.mode !== "API") continue;
      if (f.dependentSelect) continue;

      this.updateSelectState(f.id, { loading: true, options: [] });

      this.selectOptions.load(f, formValue).subscribe({
        next: (opts) => {
          this.updateSelectState(f.id, { loading: false, options: opts });
        },
        error: () => {
          this.updateSelectState(f.id, {
            loading: false,
            error: "Failed to load options.",
            options: [],
          });
        },
      });
    }
  }

  setupCascadingSelects(form: FormGroup): void {
    this.cleanup();

    const s = this.schemaManager.resolvedSchema();
    const fields = s?.fields ?? [];
    const childFields = fields.filter((f: any) => f.type === "select" && f.dependentSelect);

    for (const child of childFields as any[]) {
      const dep: DependentSelectConfig = child.dependentSelect;
      const parentField = fields.find((f: any) => f.id === dep.parentFieldId);
      if (!parentField) continue;

      const parentKey = this.controlKey(parentField);
      const parentCtrl = form?.get(parentKey);
      if (!parentCtrl) continue;

      this.updateSelectState(child.id, { loading: false, options: [] });

      const sub = parentCtrl.valueChanges.subscribe((parentValue: any) => {
        this.updateChildOptions(child, dep, parentValue, form);
      });
      this.cascadingSubs.push(sub);

      const currentParentValue = parentCtrl.value;
      if (currentParentValue) {
        this.updateChildOptions(child, dep, currentParentValue, form);
      }
    }
  }

  private updateChildOptions(child: any, dep: DependentSelectConfig, parentValue: any, form: FormGroup): void {
    const childKey = this.controlKey(child);
    const childCtrl = form?.get(childKey);

    if (!parentValue || parentValue === "") {
      this.updateSelectState(child.id, { loading: false, options: [] });
      if (childCtrl) childCtrl.setValue("", { emitEvent: false });
      return;
    }

    if (dep.type === "api") {
      const s = this.schemaManager.resolvedSchema();
      const formValue = this.valueManager.normalizeFormValue(form, s!);

      this.updateSelectState(child.id, { loading: true, options: [] });
      this.selectOptions.clear(child.id);

      this.selectOptions.load(child, formValue, parentValue).subscribe({
        next: (opts) => {
          this.updateSelectState(child.id, { loading: false, options: opts });
        },
        error: () => {
          this.updateSelectState(child.id, {
            loading: false,
            error: "Failed to load options.",
            options: [],
          });
        },
      });

      if (childCtrl) childCtrl.setValue("", { emitEvent: false });
      return;
    }

    const rawResponse = this.selectOptions.getRawResponse(dep.parentFieldId);
    if (!rawResponse) {
      this.updateSelectState(child.id, { loading: false, options: [] });
      return;
    }

    const s = this.schemaManager.resolvedSchema();
    const fields = s?.fields ?? [];
    const parentField = fields.find((f: any) => f.id === dep.parentFieldId);
    const parentApi = parentField?.optionsSource?.api;
    const parentDataPath = parentApi?.responseMapping?.dataPath;
    const parentValueKey = parentApi?.responseMapping?.valueKey || "value";

    let parentItems: any[];
    if (parentDataPath) {
      parentItems = this.getByPath(rawResponse, parentDataPath);
    } else {
      parentItems = rawResponse;
    }

    if (!Array.isArray(parentItems)) {
      this.updateSelectState(child.id, { loading: false, options: [] });
      return;
    }

    const selectedParent = parentItems.find(
      (item: any) => String(item?.[parentValueKey]) === String(parentValue)
    );

    if (!selectedParent) {
      this.updateSelectState(child.id, { loading: false, options: [] });
      if (childCtrl) childCtrl.setValue("", { emitEvent: false });
      return;
    }

    const childItems = this.getByPath(selectedParent, dep.childDataPath!);
    const childOptions = Array.isArray(childItems)
      ? childItems
          .map((item: any) => ({
            label: String(item?.[dep.labelKey!] ?? ""),
            value: item?.[dep.valueKey!],
          }))
          .filter((o: any) => o.label !== "" && o.value !== undefined)
      : [];

    this.updateSelectState(child.id, { loading: false, options: childOptions });

    if (childCtrl) childCtrl.setValue("", { emitEvent: false });
  }

  private updateSelectState(id: string, state: { loading: boolean; error?: string; options: any[] }) {
    this.selectState.update(curr => ({ ...curr, [id]: state }));
  }

  private getByPath(obj: any, path: string): any {
    if (!obj || !path) return obj;
    return path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  }

  private controlKey(field: any): string {
    return field?.name ?? field?.id;
  }

  cleanup(): void {
    this.cascadingSubs.forEach((s) => s.unsubscribe());
    this.cascadingSubs = [];
  }
}
