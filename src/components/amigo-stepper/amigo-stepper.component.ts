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
  @Input() highestCompletedStep = 0;
  @Input() isDraftEnabled = false;

  @Output() stepChanged = new EventEmitter<number>();

  get progressWidth(): string {
    const stepToUse = this.isDraftEnabled 
      ? Math.max(this.activeStepIndex, this.highestCompletedStep)
      : this.activeStepIndex;
    
    return `${((stepToUse + 1) / this.totalSteps) * 100}%`;
  }

  onStepClick(index: number): void {
    if (this.isDraftEnabled && index > this.highestCompletedStep) {
      return;
    }
    this.stepChanged.emit(index);
  }
}
