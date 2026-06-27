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
    const fields = this.getAllFields(s?.fields ?? []);
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
    const fields = this.getAllFields(s?.fields ?? []);
    const childFields = fields.filter((f: any) => f.type === "select" && f.dependentSelect);

    for (const child of childFields as any[]) {
      const dep: DependentSelectConfig = child.dependentSelect;
      
      const parentKeys: string[] = [];
      const primaryParent = fields.find((f: any) => f.id === dep.parentFieldId);
      if (primaryParent) parentKeys.push(this.controlKey(primaryParent));

      for (const p of dep.additionalParents || []) {
        const pf = fields.find((f: any) => f.id === p.parentFieldId);
        if (pf) parentKeys.push(this.controlKey(pf));
      }

      if (parentKeys.length === 0) continue;

      this.updateSelectState(child.id, { loading: false, options: [] });

      for (const pk of parentKeys) {
        const ctrl = form?.get(pk);
        if (!ctrl) continue;
        const sub = ctrl.valueChanges.subscribe(() => {
          this.updateChildOptions(child, dep, form);
        });
        this.cascadingSubs.push(sub);
      }

      this.updateChildOptions(child, dep, form);
    }
  }

  private updateChildOptions(child: any, dep: DependentSelectConfig, form: FormGroup): void {
    const s = this.schemaManager.resolvedSchema();
    const fields = s?.fields ?? [];
    
    const parentValuesMap: Record<string, any> = {};
    let primaryValue: any = null;

    const primaryParent = fields.find((f: any) => f.id === dep.parentFieldId);
    if (primaryParent) {
      const pk = this.controlKey(primaryParent);
      primaryValue = form?.get(pk)?.value;
      parentValuesMap[dep.parentFieldId] = primaryValue;
    }

    for (const p of dep.additionalParents || []) {
      const pf = fields.find((f: any) => f.id === p.parentFieldId);
      if (pf) {
        const pk = this.controlKey(pf);
        parentValuesMap[p.parentFieldId] = form?.get(pk)?.value;
      }
    }

    console.log(`[FormSelectOptionsManager] updateChildOptions for child: ${child.id}, parentValues:`, parentValuesMap);

    const childKey = this.controlKey(child);
    const childCtrl = form?.get(childKey);

    if (!primaryValue || primaryValue === "") {
      console.log(`[FormSelectOptionsManager] Primary parent value is empty, clearing child options.`);
      this.updateSelectState(child.id, { loading: false, options: [] });
      if (childCtrl) childCtrl.setValue("", { emitEvent: false });
      return;
    }

    if (dep.type === "api") {
      console.log(`[FormSelectOptionsManager] Triggering API request for child: ${child.id}`);
      const formValue = this.valueManager.normalizeFormValue(form, s!);

      this.updateSelectState(child.id, { loading: true, options: [] });
      this.selectOptions.clear(child.id);

      this.selectOptions.load(child, formValue, parentValuesMap).subscribe({
        next: (opts) => {
          console.log(`[FormSelectOptionsManager] API request successful, received options:`, opts);
          this.updateSelectState(child.id, { loading: false, options: opts });
        },
        error: (err) => {
          console.error(`[FormSelectOptionsManager] API request failed:`, err);
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

    console.log(`[FormSelectOptionsManager] Fallback to local filtering for child: ${child.id}`);

    const rawResponse = this.selectOptions.getRawResponse(dep.parentFieldId);
    if (!rawResponse) {
      this.updateSelectState(child.id, { loading: false, options: [] });
      return;
    }

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
      (item: any) => String(item?.[parentValueKey]) === String(primaryValue)
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

  private getAllFields(fields: any[]): any[] {
    let all: any[] = [];
    for (const f of fields) {
      all.push(f);
      if (f.type === 'array' && f.fieldArray?.fields) {
        all = all.concat(this.getAllFields(f.fieldArray.fields));
      }
    }
    return all;
  }
}
