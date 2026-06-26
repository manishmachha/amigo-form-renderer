import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'amigo-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './amigo-button.component.html'
})
export class AmigoButtonComponent {
  @Input() field!: any;
  @Input() resolvedSchema!: any;
  @Input() isSubmitting = false;
  
  @Input() buttonLoading: Record<string, boolean> = {};
  @Input() buttonFeedback: Record<string, any> = {};

  @Output() buttonClick = new EventEmitter<any>();

  isHovered = false;

  onButtonClickHandler(): void {
    if (!this.field.button?.isSubmit) {
      this.buttonClick.emit(this.field);
    }
  }

  get isLoading(): boolean {
    return this.field.button?.isSubmit ? this.isSubmitting : (this.buttonLoading[this.field.id] ?? false);
  }
}
