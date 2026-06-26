import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, AbstractControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'amigo-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatButtonModule],
  templateUrl: './amigo-input.component.html'
})
export class AmigoInputComponent {
  @Input() field!: any;
  @Input() form!: FormGroup;
  @Input() resolvedSchema!: any;

  showPassword = false;

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
