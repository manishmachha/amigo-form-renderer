import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, AbstractControl } from '@angular/forms';

@Component({
  selector: 'amigo-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './amigo-input.component.html'
})
export class AmigoInputComponent {
  @Input() field!: any;
  @Input() form!: FormGroup;
  @Input() resolvedSchema!: any;

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
}
