import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'amigo-review-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './amigo-review-dialog.component.html'
})
export class AmigoReviewDialogComponent {
  @Input() reviewData: { step: string, fields: { label: string, value: any }[] }[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  onConfirm(): void {
    this.confirm.emit();
  }
}
