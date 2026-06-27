import { Component, EventEmitter, Input, Output, OnInit, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormFieldSchema } from '../../models';
import { AmigoFieldRendererComponent } from '../amigo-field-renderer/amigo-field-renderer.component';
import { buildFormGroup } from '../../form-group.builder';

@Component({
  selector: 'amigo-array',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, forwardRef(() => AmigoFieldRendererComponent)],
  templateUrl: './amigo-array.component.html',
})
export class AmigoArrayComponent implements OnInit {
  @Input() field!: FormFieldSchema;
  @Input() form!: FormGroup;
  @Input() resolvedSchema: any;

  // Passthroughs for nested field renderer
  @Input() isSubmitting = false;
  @Input() buttonLoading: Record<string, boolean> = {};
  @Input() buttonFeedback: Record<string, { type: 'success' | 'error'; message: string }> = {};
  @Input() selectState: any;

  @Output() buttonClick = new EventEmitter<any>();
  @Output() fileChange = new EventEmitter<any>();
  @Output() clearFile = new EventEmitter<any>();

  ngOnInit() {
    const key = this.controlKey();
    // If the form control for this array is missing, initialize it
    if (!this.formArray) {
      const minItems = this.field.fieldArray?.minItems ?? 1;
      const initialGroups = [];
      for (let i = 0; i < minItems; i++) {
        initialGroups.push(this.createGroup());
      }
      this.form.addControl(key, new FormArray(initialGroups));
    } else {
      // Ensure we have at least minItems
      const minItems = this.field.fieldArray?.minItems ?? 1;
      while (this.formArray.length < minItems) {
        this.addGroup();
      }
    }
  }

  controlKey(): string {
    return this.field?.name || this.field?.id || '';
  }

  get formArray(): FormArray {
    return this.form.get(this.controlKey()) as FormArray;
  }

  get groupLabel(): string {
    return this.field.fieldArray?.label || this.field.label || 'Group';
  }

  get canAdd(): boolean {
    const maxItems = this.field.fieldArray?.maxItems;
    if (typeof maxItems === 'number' && maxItems > 0) {
      return this.formArray.length < maxItems;
    }
    return true; // No max limit
  }

  get canRemove(): boolean {
    const minItems = this.field.fieldArray?.minItems ?? 1;
    return this.formArray.length > minItems;
  }

  addGroup() {
    if (!this.canAdd) return;
    this.formArray.push(this.createGroup());
  }

  removeGroup(index: number) {
    if (!this.canRemove) return;
    this.formArray.removeAt(index);
  }

  private createGroup(): FormGroup {
    const fields = this.field.fieldArray?.fields || [];
    return buildFormGroup(fields);
  }
}
