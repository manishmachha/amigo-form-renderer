import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'amigo-stepper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './amigo-stepper.component.html'
})
export class AmigoStepperComponent {
  @Input() orderedSteps: any[] = [];
  @Input() activeStepIndex = 0;
  @Input() totalSteps = 0;
  @Input() visibleFieldsCount = 0;

  @Output() stepChanged = new EventEmitter<number>();

  onStepClick(index: number): void {
    this.stepChanged.emit(index);
  }
}
