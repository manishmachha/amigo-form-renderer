import { Injectable, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FormFieldSchema } from '../models';

@Injectable({
  providedIn: 'root'
})
export class FormCalculationManagerService implements OnDestroy {
  private subs: Subscription[] = [];

  setupCalculations(form: FormGroup, fields: FormFieldSchema[]) {
    this.cleanup();

    for (const field of fields) {
      if (field.calculation && field.type === 'number') {
        const calc = field.calculation;
        const targetKey = field.name || field.id;
        const targetCtrl = form.get(targetKey);

        if (!targetCtrl) continue;

        if (calc.type !== 'custom' && calc.sourceFieldId) {
          const sourceField = fields.find(f => f.id === calc.sourceFieldId);
          if (sourceField) {
            const sourceKey = sourceField.name || sourceField.id;
            const sourceCtrl = form.get(sourceKey);

            if (sourceCtrl) {
              const sub = sourceCtrl.valueChanges.subscribe(val => {
                const numVal = parseFloat(val);
                if (isNaN(numVal)) {
                  targetCtrl.setValue(null, { emitEvent: false });
                  return;
                }
                
                let result = 0;
                switch (calc.type) {
                  case 'hourlyToDaily': result = numVal * 24; break;
                  case 'dailyToMonthly': result = numVal * 30; break;
                  case 'dailyToYearly': result = numVal * 365; break;
                  case 'weeklyToMonthly': result = numVal * 4; break;
                  case 'quarterlyToYearly': result = numVal * 4; break;
                  case 'halfYearlyToYearly': result = numVal * 2; break;
                }
                
                if (targetCtrl.value !== result) {
                  targetCtrl.setValue(result, { emitEvent: false });
                }
              });
              this.subs.push(sub);
            }
          }
        } else if (calc.type === 'custom' && calc.customExpression) {
          const sub = form.valueChanges.subscribe(formValue => {
            try {
              // Create a function that uses 'with' to expose form values as variables
              const fn = new Function('form', `
                with (form) {
                   return ${calc.customExpression};
                }
              `);
              const result = fn(formValue);
              
              if (typeof result === 'number' && !isNaN(result)) {
                if (targetCtrl.value !== result) {
                  targetCtrl.setValue(result, { emitEvent: false });
                }
              }
            } catch (e) {
              // Ignore evaluation errors, as fields might be empty or invalid during typing
            }
          });
          this.subs.push(sub);
        }
      }
    }
  }

  cleanup() {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
  }

  ngOnDestroy() {
    this.cleanup();
  }
}
