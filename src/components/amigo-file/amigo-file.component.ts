import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, AbstractControl } from '@angular/forms';
import { FormFieldSchema } from '../../models';

@Component({
  selector: 'amigo-file',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './amigo-file.component.html'
})
export class AmigoFileComponent {
  @Input() field!: FormFieldSchema;
  @Input() form!: FormGroup;
  @Input() resolvedSchema!: any;

  @Output() fileChange = new EventEmitter<{ evt: Event, field: any }>();
  @Output() clearFile = new EventEmitter<{ field: any, inputEl: HTMLInputElement }>();

  controlKey(): string {
    return this.field?.name ?? this.field?.id;
  }

  ctrl(): AbstractControl | null {
    return this.form?.get(this.controlKey()) ?? null;
  }

  showError(): boolean {
    const c = this.ctrl();
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  onFileChangeHandler(evt: Event): void {
    this.fileChange.emit({ evt, field: this.field });
  }

  clearFileHandler(inputEl: HTMLInputElement): void {
    this.clearFile.emit({ field: this.field, inputEl });
  }

  fileNames(): string[] {
    const v = this.ctrl()?.value;
    if (!v) return [];
    if (Array.isArray(v)) return v.map((f: File) => f?.name).filter(Boolean);
    if (v instanceof File) return [v.name];
    if (typeof FileList !== "undefined" && v instanceof FileList) {
      return Array.from(v)
        .map((f: File) => f?.name)
        .filter(Boolean);
    }
    return [];
  }
}
