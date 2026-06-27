import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, AbstractControl } from '@angular/forms';

@Component({
  selector: 'amigo-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './amigo-select.component.html'
})
export class AmigoSelectComponent {
  @Input() field!: any;
  @Input() form!: FormGroup;
  @Input() resolvedSchema!: any;
  @Input() selectState: Record<string, any> = {};

  controlKey(): string {
    return this.field?.name ?? this.field?.id;
  }

  ctrl(): AbstractControl | null {
    return this.form?.get(this.controlKey()) ?? null;
  }

  get options(): any[] {
    if (this.field?.optionsSource?.mode === 'API') {
      return this.selectState[this.field.id]?.options || [];
    }
    return this.field?.options || [];
  }

  get isGrouped(): boolean {
    const opts = this.options;
    return opts.length > 0 && opts[0].hasOwnProperty('groupLabel') && opts[0].hasOwnProperty('options');
  }

  get groupedOptions(): any[] {
    return this.isGrouped ? this.options : [];
  }

  get flatOptions(): any[] {
    return this.isGrouped ? [] : this.options;
  }

  showError(): boolean {
    const c = this.ctrl();
    return !!(c && c.invalid && (c.touched || c.dirty));
  }
}
