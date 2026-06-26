import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, AbstractControl } from '@angular/forms';
import { FormFieldSchema, FormSchema } from '../../models';

import { AmigoCardComponent } from '../amigo-card/amigo-card.component';
import { AmigoButtonComponent } from '../amigo-button/amigo-button.component';
import { AmigoInputComponent } from '../amigo-input/amigo-input.component';
import { AmigoSelectComponent } from '../amigo-select/amigo-select.component';
import { AmigoFileComponent } from '../amigo-file/amigo-file.component';

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
    AmigoFileComponent
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
