import { Component, EventEmitter, Input, Output, OnInit, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, AbstractControl, FormArray } from '@angular/forms';
import { FormFieldSchema, FormSchema } from '../../models';
import { buildFormGroup } from '../../form-group.builder';

import { AmigoCardComponent } from '../amigo-card/amigo-card.component';
import { AmigoButtonComponent } from '../amigo-button/amigo-button.component';
import { AmigoInputComponent } from '../amigo-input/amigo-input.component';
import { AmigoSelectComponent } from '../amigo-select/amigo-select.component';
import { AmigoFileComponent } from '../amigo-file/amigo-file.component';

// --- Field Renderer Component ---
@Component({
  selector: 'amigo-field-renderer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AmigoCardComponent,
    AmigoButtonComponent,
    AmigoInputComponent,
    AmigoSelectComponent,
    AmigoFileComponent,
    forwardRef(() => AmigoArrayComponent)
  ],
  templateUrl: './amigo-field-renderer.component.html'
})
export class AmigoFieldRendererComponent {
  @Input() field!: any;
  @Input() form!: FormGroup;
  @Input() resolvedSchema!: FormSchema | any;
  @Input() isSubmitting = false;
  
  @Input() buttonLoading: Record<string, boolean> = {};
  @Input() buttonFeedback: Record<string, any> = {};
  @Input() selectState: Record<string, any> = {};

  @Output() buttonClick = new EventEmitter<any>();
  @Output() fileChange = new EventEmitter<{ evt: Event, field: any }>();
  @Output() clearFile = new EventEmitter<{ field: any, inputEl: HTMLInputElement }>();

  isCard(): boolean {
    const t = this.field?.type;
    return t === "card" || t === "info-card";
  }

  isButton(): boolean {
    return (this.field?.type ?? "") === "button";
  }
  
  isArray(): boolean {
    return (this.field?.type ?? "") === "array";
  }
  
  isSelectOrRadioOrCheckbox(): boolean {
    const t = this.field?.type;
    return t === "select" || t === "radio" || t === "checkbox";
  }
  
  isFile(): boolean {
    return this.field?.type === "file";
  }

  onButtonClickHandler(field: any): void {
    this.buttonClick.emit(field);
  }

  onFileChangeHandler(eventData: { evt: Event, field: any }): void {
    this.fileChange.emit(eventData);
  }

  onClearFileHandler(eventData: { field: any, inputEl: HTMLInputElement }): void {
    this.clearFile.emit(eventData);
  }
}

// --- Array Component ---
@Component({
  selector: 'amigo-array',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AmigoFieldRendererComponent],
  templateUrl: '../amigo-array/amigo-array.component.html',
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
