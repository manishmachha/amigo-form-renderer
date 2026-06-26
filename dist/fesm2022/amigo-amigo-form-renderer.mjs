import * as i0 from '@angular/core';
import { EventEmitter, Output, Input, Component, InjectionToken, Optional, Inject, Injectable, signal, inject, computed, effect, ViewChild } from '@angular/core';
import * as i1 from '@angular/common';
import { CommonModule } from '@angular/common';
import * as i2 from '@angular/forms';
import { Validators, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import * as i1$2 from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { finalize, tap, map, catchError } from 'rxjs/operators';
import * as i1$1 from '@angular/common/http';
import { HTTP_INTERCEPTORS, HttpHeaders, HttpParams } from '@angular/common/http';
import { of, throwError } from 'rxjs';

function buildFormGroup(fields, initialValue) {
    const group = {};
    for (const f of fields) {
        const t = String(f?.type ?? '');
        if (t === 'card' || t === 'info-card' || t === 'button')
            continue;
        const v = f.validations ?? {};
        const required = f.required === true || f.required === 'true' || v.required === true;
        const validators = [];
        if (required) {
            if (t === 'checkbox')
                validators.push(Validators.requiredTrue);
            else if (t === 'file')
                validators.push(fileRequiredValidator());
            else
                validators.push(Validators.required);
        }
        if (typeof v.minLength === 'number')
            validators.push(Validators.minLength(v.minLength));
        if (typeof v.maxLength === 'number')
            validators.push(Validators.maxLength(v.maxLength));
        if (typeof v.min === 'number')
            validators.push(Validators.min(v.min));
        if (typeof v.max === 'number')
            validators.push(Validators.max(v.max));
        if (v.pattern)
            validators.push(Validators.pattern(v.pattern));
        if (t === 'email')
            validators.push(Validators.email);
        if (t === 'file') {
            const maxFiles = typeof f.maxFiles === 'number' ? f.maxFiles : f.multiple ? undefined : 1;
            const maxSizeMB = typeof f.maxSizeMB === 'number' ? f.maxSizeMB : undefined;
            const accept = normalizeAccept(f.accept);
            if (maxFiles !== undefined)
                validators.push(fileMaxFilesValidator(maxFiles));
            if (maxSizeMB !== undefined)
                validators.push(fileMaxSizeValidator(maxSizeMB));
            if (accept)
                validators.push(fileAcceptValidator(accept));
        }
        const key = f.name ?? f.id;
        const init = initialValue?.[key] ??
            (t === 'checkbox'
                ? false
                : t === 'select' || t === 'radio'
                    ? null
                    : t === 'file'
                        ? null
                        : '');
        group[key] = new FormControl(init, validators);
    }
    return new FormGroup(group);
}
function normalizeAccept(a) {
    if (!a)
        return undefined;
    const s = String(a).trim().toLowerCase();
    return s || undefined;
}
function fileRequiredValidator() {
    return (c) => {
        const v = c.value;
        if (!v)
            return { required: true };
        if (Array.isArray(v))
            return v.length ? null : { required: true };
        return null;
    };
}
function fileMaxFilesValidator(maxFiles) {
    return (c) => {
        const v = c.value;
        if (!v)
            return null;
        const count = Array.isArray(v) ? v.length : 1;
        return count > maxFiles ? { maxFiles: { maxFiles, actual: count } } : null;
    };
}
function fileMaxSizeValidator(maxSizeMB) {
    const maxBytes = maxSizeMB * 1024 * 1024;
    return (c) => {
        const v = c.value;
        if (!v)
            return null;
        const files = Array.isArray(v) ? v : [v];
        const tooLarge = files.find((f) => f?.size > maxBytes);
        return tooLarge ? { maxSizeMB: { maxSizeMB, actualBytes: tooLarge.size } } : null;
    };
}
function fileAcceptValidator(accept) {
    const parts = accept
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    const isOk = (file) => {
        const mime = (file.type || '').toLowerCase();
        const name = (file.name || '').toLowerCase();
        for (const p of parts) {
            if (p.startsWith('.')) {
                if (name.endsWith(p))
                    return true;
            }
            else if (p.endsWith('/*')) {
                const prefix = p.slice(0, -1);
                if (mime.startsWith(prefix))
                    return true;
            }
            else {
                if (mime === p)
                    return true;
            }
        }
        return false;
    };
    return (c) => {
        const v = c.value;
        if (!v)
            return null;
        const files = Array.isArray(v) ? v : [v];
        const bad = files.find((f) => f && !isOk(f));
        return bad ? { accept: { accept, bad: bad.name } } : null;
    };
}

class AmigoStepperComponent {
    orderedSteps = [];
    activeStepIndex = 0;
    totalSteps = 0;
    visibleFieldsCount = 0;
    stepChanged = new EventEmitter();
    onStepClick(index) {
        this.stepChanged.emit(index);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoStepperComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "21.1.5", type: AmigoStepperComponent, isStandalone: true, selector: "amigo-stepper", inputs: { orderedSteps: "orderedSteps", activeStepIndex: "activeStepIndex", totalSteps: "totalSteps", visibleFieldsCount: "visibleFieldsCount" }, outputs: { stepChanged: "stepChanged" }, ngImport: i0, template: "<div class=\"w-full mb-6 flex flex-col items-center my-3\">\n  <div class=\"w-full h-1 bg-gray-200 rounded-full relative mb-6\">\n    <div\n      class=\"h-1 rounded-full transition-all duration-300 bg-blue-600\"\n      [ngStyle]=\"{\n        width: ((activeStepIndex + 1) / totalSteps) * 100 + '%'\n      }\"\n    ></div>\n  </div>\n\n  <div class=\"flex items-center justify-between w-full\">\n    <div\n      *ngFor=\"let step of orderedSteps; let i = index\"\n      class=\"flex flex-col items-center cursor-pointer\"\n      (click)=\"onStepClick(i)\"\n    >\n      <div\n        class=\"w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all duration-300\"\n        [ngStyle]=\"\n          i === activeStepIndex\n            ? {\n                backgroundColor: '#2563eb',\n                borderColor: '#2563eb',\n                color: '#ffffff'\n              }\n            : {\n                backgroundColor: '#FFFFFF',\n                borderColor: '#9CA3AF',\n                color: '#374151'\n              }\n        \"\n      >\n        <ng-container *ngIf=\"!step.icon\">\n          {{ i + 1 }}\n        </ng-container>\n\n        <ng-container *ngIf=\"step.icon\">\n          <i\n            [class]=\"step.icon\"\n            class=\"text-lg\"\n            [ngStyle]=\"\n              i === activeStepIndex\n                ? { color: '#ffffff' }\n                : { color: '#6B7280' }\n            \"\n          >\n          </i>\n        </ng-container>\n      </div>\n\n      <div class=\"mt-2 text-xs text-gray-600 font-medium\">\n        {{ step.label }}\n      </div>\n    </div>\n  </div>\n\n  <div\n    *ngIf=\"visibleFieldsCount === 0\"\n    class=\"text-xs text-gray-500 my-5\"\n  >\n    No fields assigned to this step yet.\n  </div>\n</div>\n", dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i1.NgStyle, selector: "[ngStyle]", inputs: ["ngStyle"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoStepperComponent, decorators: [{
            type: Component,
            args: [{ selector: 'amigo-stepper', standalone: true, imports: [CommonModule], template: "<div class=\"w-full mb-6 flex flex-col items-center my-3\">\n  <div class=\"w-full h-1 bg-gray-200 rounded-full relative mb-6\">\n    <div\n      class=\"h-1 rounded-full transition-all duration-300 bg-blue-600\"\n      [ngStyle]=\"{\n        width: ((activeStepIndex + 1) / totalSteps) * 100 + '%'\n      }\"\n    ></div>\n  </div>\n\n  <div class=\"flex items-center justify-between w-full\">\n    <div\n      *ngFor=\"let step of orderedSteps; let i = index\"\n      class=\"flex flex-col items-center cursor-pointer\"\n      (click)=\"onStepClick(i)\"\n    >\n      <div\n        class=\"w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all duration-300\"\n        [ngStyle]=\"\n          i === activeStepIndex\n            ? {\n                backgroundColor: '#2563eb',\n                borderColor: '#2563eb',\n                color: '#ffffff'\n              }\n            : {\n                backgroundColor: '#FFFFFF',\n                borderColor: '#9CA3AF',\n                color: '#374151'\n              }\n        \"\n      >\n        <ng-container *ngIf=\"!step.icon\">\n          {{ i + 1 }}\n        </ng-container>\n\n        <ng-container *ngIf=\"step.icon\">\n          <i\n            [class]=\"step.icon\"\n            class=\"text-lg\"\n            [ngStyle]=\"\n              i === activeStepIndex\n                ? { color: '#ffffff' }\n                : { color: '#6B7280' }\n            \"\n          >\n          </i>\n        </ng-container>\n      </div>\n\n      <div class=\"mt-2 text-xs text-gray-600 font-medium\">\n        {{ step.label }}\n      </div>\n    </div>\n  </div>\n\n  <div\n    *ngIf=\"visibleFieldsCount === 0\"\n    class=\"text-xs text-gray-500 my-5\"\n  >\n    No fields assigned to this step yet.\n  </div>\n</div>\n" }]
        }], propDecorators: { orderedSteps: [{
                type: Input
            }], activeStepIndex: [{
                type: Input
            }], totalSteps: [{
                type: Input
            }], visibleFieldsCount: [{
                type: Input
            }], stepChanged: [{
                type: Output
            }] } });

class AmigoCardComponent {
    field;
    cardIcon() {
        return this.field?.card?.icon || "";
    }
    cardTitle() {
        return this.field?.card?.title || this.field?.label || "Info";
    }
    cardBody() {
        return this.field?.card?.body || "";
    }
    cardStyle() {
        const cs = this.field?.card?.style ?? {};
        const borderWidth = cs.borderWidth ?? 1;
        const borderRadius = cs.borderRadius ?? 12;
        const borderColor = cs.borderColor ?? "#BBF7D0";
        const backgroundColor = cs.backgroundColor ?? "#F0FDF4";
        const textColor = cs.textColor ?? "#166534";
        return {
            borderStyle: "solid",
            borderWidth: `${borderWidth}px`,
            borderColor,
            borderRadius: `${borderRadius}px`,
            backgroundColor,
            color: textColor,
            padding: "12px",
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
        };
    }
    cardIconStyle() {
        const cs = this.field?.card?.style ?? {};
        const textColor = cs.textColor ?? "#166534";
        return {
            color: cs.iconColor ?? textColor,
            fontSize: "18px",
            lineHeight: "1",
            marginTop: "2px",
        };
    }
    isBootstrapIcon(icon) {
        const v = (icon || "").trim();
        return v.startsWith("bi ") || v.startsWith("bi-") || v.includes(" bi-");
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoCardComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "21.1.5", type: AmigoCardComponent, isStandalone: true, selector: "amigo-card", inputs: { field: "field" }, ngImport: i0, template: "<div [ngStyle]=\"cardStyle()\" class=\"w-full flex items-start gap-3\">\n  <div\n    class=\"shrink-0 mt-0.5 text-lg leading-none\"\n    [ngStyle]=\"cardIconStyle()\"\n  >\n    <i\n      *ngIf=\"isBootstrapIcon(cardIcon())\"\n      [class]=\"cardIcon()\"\n    ></i>\n    <span *ngIf=\"!isBootstrapIcon(cardIcon())\">{{ cardIcon() }}</span>\n  </div>\n\n  <div class=\"min-w-0\">\n    <div class=\"text-sm font-semibold leading-tight\">\n      {{ cardTitle() }}\n    </div>\n\n    <div *ngIf=\"cardBody()\" class=\"mt-1 text-xs opacity-90\">\n      {{ cardBody() }}\n    </div>\n  </div>\n</div>\n", dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i1.NgStyle, selector: "[ngStyle]", inputs: ["ngStyle"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoCardComponent, decorators: [{
            type: Component,
            args: [{ selector: 'amigo-card', standalone: true, imports: [CommonModule], template: "<div [ngStyle]=\"cardStyle()\" class=\"w-full flex items-start gap-3\">\n  <div\n    class=\"shrink-0 mt-0.5 text-lg leading-none\"\n    [ngStyle]=\"cardIconStyle()\"\n  >\n    <i\n      *ngIf=\"isBootstrapIcon(cardIcon())\"\n      [class]=\"cardIcon()\"\n    ></i>\n    <span *ngIf=\"!isBootstrapIcon(cardIcon())\">{{ cardIcon() }}</span>\n  </div>\n\n  <div class=\"min-w-0\">\n    <div class=\"text-sm font-semibold leading-tight\">\n      {{ cardTitle() }}\n    </div>\n\n    <div *ngIf=\"cardBody()\" class=\"mt-1 text-xs opacity-90\">\n      {{ cardBody() }}\n    </div>\n  </div>\n</div>\n" }]
        }], propDecorators: { field: [{
                type: Input
            }] } });

class AmigoButtonComponent {
    field;
    resolvedSchema;
    isSubmitting = false;
    buttonLoading = {};
    buttonFeedback = {};
    buttonClick = new EventEmitter();
    isHovered = false;
    onButtonClickHandler() {
        if (!this.field.button?.isSubmit) {
            this.buttonClick.emit(this.field);
        }
    }
    get isLoading() {
        return this.field.button?.isSubmit ? this.isSubmitting : (this.buttonLoading[this.field.id] ?? false);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoButtonComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "21.1.5", type: AmigoButtonComponent, isStandalone: true, selector: "amigo-button", inputs: { field: "field", resolvedSchema: "resolvedSchema", isSubmitting: "isSubmitting", buttonLoading: "buttonLoading", buttonFeedback: "buttonFeedback" }, outputs: { buttonClick: "buttonClick" }, ngImport: i0, template: "<div class=\"w-full\">\n  <button\n    [type]=\"field.button?.isSubmit ? 'submit' : 'button'\"\n    (click)=\"onButtonClickHandler()\"\n    [disabled]=\"isLoading\"\n    class=\"w-full transition disabled:opacity-60 disabled:cursor-not-allowed\"\n    (mouseenter)=\"isHovered = true\"\n    (mouseleave)=\"isHovered = false\"\n    [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n    [ngStyle]=\"{\n      'background-color':\n        field.button?.styleVariant === 'link' ||\n        field.button?.styleVariant === 'outline'\n          ? isHovered\n            ? field.button?.hoverBackgroundColor ||\n              (field.button?.styleVariant === 'outline'\n                ? '#eff6ff'\n                : 'transparent')\n            : field.button?.backgroundColor || 'transparent'\n          : isHovered\n            ? field.button?.hoverBackgroundColor ||\n              field.button?.backgroundColor ||\n              ''\n            : field.button?.backgroundColor || '',\n      color: isHovered\n        ? field.button?.hoverTextColor ||\n          field.button?.textColor ||\n          ''\n        : field.button?.textColor || '',\n      'border-color':\n        field.button?.styleVariant === 'link'\n          ? 'transparent'\n          : isHovered\n            ? field.button?.hoverBackgroundColor ||\n              field.button?.backgroundColor ||\n              ''\n            : field.button?.backgroundColor || '',\n      'text-decoration':\n        field.button?.styleVariant === 'link' && isHovered\n          ? 'underline'\n          : 'none',\n    }\"\n    [ngClass]=\"[\n      resolvedSchema?.style?.inputClass\n        ? resolvedSchema.style.inputClass.replace('rounded', '')\n        : 'w-full px-2 py-1 text-sm',\n      field.button?.styleVariant === 'link' ? '' : 'border',\n      !field.button?.backgroundColor &&\n      (field.button?.styleVariant || 'primary') === 'primary'\n        ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'\n        : !field.button?.backgroundColor &&\n            field.button?.styleVariant === 'outline'\n          ? 'bg-transparent text-blue-600 border-blue-600 hover:bg-blue-50'\n          : !field.button?.backgroundColor &&\n              field.button?.styleVariant === 'link'\n            ? 'bg-transparent text-blue-600 border-transparent hover:underline'\n            : !field.button?.backgroundColor &&\n                (field.button?.styleVariant || 'primary') === 'danger'\n              ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'\n              : !field.button?.backgroundColor\n                ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'\n                : '',\n    ]\"\n  >\n    <span class=\"inline-flex items-center justify-center gap-2\">\n      <span>\n        {{\n          field.button?.isSubmit && isSubmitting\n            ? \"Submitting...\"\n            : field.button?.label || field.label\n        }}\n      </span>\n      <span\n        *ngIf=\"!field.button?.isSubmit && buttonLoading[field.id]\"\n        class=\"text-xs opacity-80\"\n        >\u2026</span\n      >\n    </span>\n  </button>\n\n  <div\n    *ngIf=\"buttonFeedback[field.id]\"\n    class=\"mt-2 text-xs rounded-lg px-3 py-2 border\"\n    [ngClass]=\"\n      buttonFeedback[field.id].type === 'success'\n        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'\n        : 'bg-rose-50 border-rose-200 text-rose-800'\n    \"\n  >\n    {{ buttonFeedback[field.id].message }}\n  </div>\n</div>\n", dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgClass, selector: "[ngClass]", inputs: ["class", "ngClass"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i1.NgStyle, selector: "[ngStyle]", inputs: ["ngStyle"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoButtonComponent, decorators: [{
            type: Component,
            args: [{ selector: 'amigo-button', standalone: true, imports: [CommonModule], template: "<div class=\"w-full\">\n  <button\n    [type]=\"field.button?.isSubmit ? 'submit' : 'button'\"\n    (click)=\"onButtonClickHandler()\"\n    [disabled]=\"isLoading\"\n    class=\"w-full transition disabled:opacity-60 disabled:cursor-not-allowed\"\n    (mouseenter)=\"isHovered = true\"\n    (mouseleave)=\"isHovered = false\"\n    [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n    [ngStyle]=\"{\n      'background-color':\n        field.button?.styleVariant === 'link' ||\n        field.button?.styleVariant === 'outline'\n          ? isHovered\n            ? field.button?.hoverBackgroundColor ||\n              (field.button?.styleVariant === 'outline'\n                ? '#eff6ff'\n                : 'transparent')\n            : field.button?.backgroundColor || 'transparent'\n          : isHovered\n            ? field.button?.hoverBackgroundColor ||\n              field.button?.backgroundColor ||\n              ''\n            : field.button?.backgroundColor || '',\n      color: isHovered\n        ? field.button?.hoverTextColor ||\n          field.button?.textColor ||\n          ''\n        : field.button?.textColor || '',\n      'border-color':\n        field.button?.styleVariant === 'link'\n          ? 'transparent'\n          : isHovered\n            ? field.button?.hoverBackgroundColor ||\n              field.button?.backgroundColor ||\n              ''\n            : field.button?.backgroundColor || '',\n      'text-decoration':\n        field.button?.styleVariant === 'link' && isHovered\n          ? 'underline'\n          : 'none',\n    }\"\n    [ngClass]=\"[\n      resolvedSchema?.style?.inputClass\n        ? resolvedSchema.style.inputClass.replace('rounded', '')\n        : 'w-full px-2 py-1 text-sm',\n      field.button?.styleVariant === 'link' ? '' : 'border',\n      !field.button?.backgroundColor &&\n      (field.button?.styleVariant || 'primary') === 'primary'\n        ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'\n        : !field.button?.backgroundColor &&\n            field.button?.styleVariant === 'outline'\n          ? 'bg-transparent text-blue-600 border-blue-600 hover:bg-blue-50'\n          : !field.button?.backgroundColor &&\n              field.button?.styleVariant === 'link'\n            ? 'bg-transparent text-blue-600 border-transparent hover:underline'\n            : !field.button?.backgroundColor &&\n                (field.button?.styleVariant || 'primary') === 'danger'\n              ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'\n              : !field.button?.backgroundColor\n                ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'\n                : '',\n    ]\"\n  >\n    <span class=\"inline-flex items-center justify-center gap-2\">\n      <span>\n        {{\n          field.button?.isSubmit && isSubmitting\n            ? \"Submitting...\"\n            : field.button?.label || field.label\n        }}\n      </span>\n      <span\n        *ngIf=\"!field.button?.isSubmit && buttonLoading[field.id]\"\n        class=\"text-xs opacity-80\"\n        >\u2026</span\n      >\n    </span>\n  </button>\n\n  <div\n    *ngIf=\"buttonFeedback[field.id]\"\n    class=\"mt-2 text-xs rounded-lg px-3 py-2 border\"\n    [ngClass]=\"\n      buttonFeedback[field.id].type === 'success'\n        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'\n        : 'bg-rose-50 border-rose-200 text-rose-800'\n    \"\n  >\n    {{ buttonFeedback[field.id].message }}\n  </div>\n</div>\n" }]
        }], propDecorators: { field: [{
                type: Input
            }], resolvedSchema: [{
                type: Input
            }], isSubmitting: [{
                type: Input
            }], buttonLoading: [{
                type: Input
            }], buttonFeedback: [{
                type: Input
            }], buttonClick: [{
                type: Output
            }] } });

class AmigoInputComponent {
    field;
    form;
    resolvedSchema;
    controlKey() {
        return this.field?.name ?? this.field?.id;
    }
    ctrl() {
        return this.form?.get(this.controlKey()) ?? null;
    }
    showError() {
        const c = this.ctrl();
        return !!(c && c.invalid && (c.touched || c.dirty));
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoInputComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "21.1.5", type: AmigoInputComponent, isStandalone: true, selector: "amigo-input", inputs: { field: "field", form: "form", resolvedSchema: "resolvedSchema" }, ngImport: i0, template: "<ng-container [formGroup]=\"form\">\n  <ng-container [ngSwitch]=\"field.type\">\n    <ng-container *ngSwitchCase=\"'text'\">\n      <input\n        type=\"text\"\n        [placeholder]=\"field.placeholder\"\n        [formControlName]=\"controlKey()\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      />\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          This field is required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['minlength']\">\n          Minimum {{ field.validations?.minLength }} characters\n          required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['maxlength']\">\n          Maximum {{ field.validations?.maxLength }} characters allowed.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['pattern']\">\n          Value does not match the required pattern.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchCase=\"'password'\">\n      <input\n        type=\"password\"\n        [placeholder]=\"field.placeholder\"\n        [formControlName]=\"controlKey()\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      />\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          This field is required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['minlength']\">\n          Minimum {{ field.validations?.minLength }} characters\n          required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['maxlength']\">\n          Maximum {{ field.validations?.maxLength }} characters allowed.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['pattern']\">\n          Value does not match the required pattern.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchCase=\"'number'\">\n      <input\n        type=\"number\"\n        [placeholder]=\"field.placeholder\"\n        [formControlName]=\"controlKey()\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      />\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          This field is required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['min']\">\n          Value should be \u2265 {{ field.validations?.min }}.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['max']\">\n          Value should be \u2264 {{ field.validations?.max }}.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchCase=\"'email'\">\n      <input\n        type=\"email\"\n        [placeholder]=\"field.placeholder\"\n        [formControlName]=\"controlKey()\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      />\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          This field is required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['email']\">\n          Please enter a valid email address.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['minlength']\">\n          Minimum {{ field.validations?.minLength }} characters\n          required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['maxlength']\">\n          Maximum {{ field.validations?.maxLength }} characters allowed.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['pattern']\">\n          Value does not match the required pattern.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchCase=\"'textarea'\">\n      <textarea\n        [placeholder]=\"field.placeholder\"\n        [formControlName]=\"controlKey()\"\n        rows=\"4\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      ></textarea>\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          This field is required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['minlength']\">\n          Minimum {{ field.validations?.minLength }} characters\n          required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['maxlength']\">\n          Maximum {{ field.validations?.maxLength }} characters allowed.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['pattern']\">\n          Value does not match the required pattern.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchCase=\"'date'\">\n      <input\n        type=\"date\"\n        [formControlName]=\"controlKey()\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      />\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          This field is required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['min']\">\n          Date should be on or after {{ field.validations?.min }}.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['max']\">\n          Date should be on or before {{ field.validations?.max }}.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchDefault>\n      <input\n        type=\"text\"\n        [placeholder]=\"field.placeholder\"\n        [formControlName]=\"controlKey()\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      />\n    </ng-container>\n  </ng-container>\n</ng-container>\n", dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgClass, selector: "[ngClass]", inputs: ["class", "ngClass"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i1.NgSwitch, selector: "[ngSwitch]", inputs: ["ngSwitch"] }, { kind: "directive", type: i1.NgSwitchCase, selector: "[ngSwitchCase]", inputs: ["ngSwitchCase"] }, { kind: "directive", type: i1.NgSwitchDefault, selector: "[ngSwitchDefault]" }, { kind: "ngmodule", type: ReactiveFormsModule }, { kind: "directive", type: i2.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i2.NumberValueAccessor, selector: "input[type=number][formControlName],input[type=number][formControl],input[type=number][ngModel]" }, { kind: "directive", type: i2.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i2.NgControlStatusGroup, selector: "[formGroupName],[formArrayName],[ngModelGroup],[formGroup],[formArray],form:not([ngNoForm]),[ngForm]" }, { kind: "directive", type: i2.FormGroupDirective, selector: "[formGroup]", inputs: ["formGroup"], outputs: ["ngSubmit"], exportAs: ["ngForm"] }, { kind: "directive", type: i2.FormControlName, selector: "[formControlName]", inputs: ["formControlName", "disabled", "ngModel"], outputs: ["ngModelChange"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoInputComponent, decorators: [{
            type: Component,
            args: [{ selector: 'amigo-input', standalone: true, imports: [CommonModule, ReactiveFormsModule], template: "<ng-container [formGroup]=\"form\">\n  <ng-container [ngSwitch]=\"field.type\">\n    <ng-container *ngSwitchCase=\"'text'\">\n      <input\n        type=\"text\"\n        [placeholder]=\"field.placeholder\"\n        [formControlName]=\"controlKey()\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      />\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          This field is required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['minlength']\">\n          Minimum {{ field.validations?.minLength }} characters\n          required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['maxlength']\">\n          Maximum {{ field.validations?.maxLength }} characters allowed.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['pattern']\">\n          Value does not match the required pattern.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchCase=\"'password'\">\n      <input\n        type=\"password\"\n        [placeholder]=\"field.placeholder\"\n        [formControlName]=\"controlKey()\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      />\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          This field is required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['minlength']\">\n          Minimum {{ field.validations?.minLength }} characters\n          required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['maxlength']\">\n          Maximum {{ field.validations?.maxLength }} characters allowed.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['pattern']\">\n          Value does not match the required pattern.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchCase=\"'number'\">\n      <input\n        type=\"number\"\n        [placeholder]=\"field.placeholder\"\n        [formControlName]=\"controlKey()\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      />\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          This field is required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['min']\">\n          Value should be \u2265 {{ field.validations?.min }}.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['max']\">\n          Value should be \u2264 {{ field.validations?.max }}.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchCase=\"'email'\">\n      <input\n        type=\"email\"\n        [placeholder]=\"field.placeholder\"\n        [formControlName]=\"controlKey()\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      />\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          This field is required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['email']\">\n          Please enter a valid email address.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['minlength']\">\n          Minimum {{ field.validations?.minLength }} characters\n          required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['maxlength']\">\n          Maximum {{ field.validations?.maxLength }} characters allowed.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['pattern']\">\n          Value does not match the required pattern.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchCase=\"'textarea'\">\n      <textarea\n        [placeholder]=\"field.placeholder\"\n        [formControlName]=\"controlKey()\"\n        rows=\"4\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      ></textarea>\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          This field is required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['minlength']\">\n          Minimum {{ field.validations?.minLength }} characters\n          required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['maxlength']\">\n          Maximum {{ field.validations?.maxLength }} characters allowed.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['pattern']\">\n          Value does not match the required pattern.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchCase=\"'date'\">\n      <input\n        type=\"date\"\n        [formControlName]=\"controlKey()\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      />\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          This field is required.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['min']\">\n          Date should be on or after {{ field.validations?.min }}.\n        </div>\n        <div *ngIf=\"ctrl()?.errors?.['max']\">\n          Date should be on or before {{ field.validations?.max }}.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchDefault>\n      <input\n        type=\"text\"\n        [placeholder]=\"field.placeholder\"\n        [formControlName]=\"controlKey()\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      />\n    </ng-container>\n  </ng-container>\n</ng-container>\n" }]
        }], propDecorators: { field: [{
                type: Input
            }], form: [{
                type: Input
            }], resolvedSchema: [{
                type: Input
            }] } });

class AmigoSelectComponent {
    field;
    form;
    resolvedSchema;
    selectState = {};
    controlKey() {
        return this.field?.name ?? this.field?.id;
    }
    ctrl() {
        return this.form?.get(this.controlKey()) ?? null;
    }
    showError() {
        const c = this.ctrl();
        return !!(c && c.invalid && (c.touched || c.dirty));
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoSelectComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "21.1.5", type: AmigoSelectComponent, isStandalone: true, selector: "amigo-select", inputs: { field: "field", form: "form", resolvedSchema: "resolvedSchema", selectState: "selectState" }, ngImport: i0, template: "<ng-container [formGroup]=\"form\">\n  <ng-container [ngSwitch]=\"field.type\">\n    <ng-container *ngSwitchCase=\"'select'\">\n      <select\n        [formControlName]=\"controlKey()\"\n        [disabled]=\"selectState[field.id]?.loading ?? false\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      >\n        <option value=\"\">Select an option</option>\n\n        <ng-container\n          *ngFor=\"\n            let opt of field.optionsSource?.mode === 'API'\n              ? selectState[field.id]?.options || []\n              : field.options || []\n          \"\n        >\n          <option [value]=\"opt.value\">{{ opt.label }}</option>\n        </ng-container>\n      </select>\n\n      <div\n        *ngIf=\"\n          field.optionsSource?.mode === 'API' &&\n          selectState[field.id]?.loading\n        \"\n        class=\"mt-1 text-[11px] text-slate-500\"\n      >\n        Loading options\u2026\n      </div>\n\n      <div\n        *ngIf=\"\n          field.optionsSource?.mode === 'API' &&\n          selectState[field.id]?.error\n        \"\n        class=\"mt-1 text-[11px] text-rose-600\"\n      >\n        {{ selectState[field.id]?.error }}\n      </div>\n\n      <div\n        *ngIf=\"\n          field.optionsSource?.mode === 'API' &&\n          !selectState[field.id]?.loading &&\n          !selectState[field.id]?.error &&\n          (selectState[field.id]?.options?.length || 0) === 0\n        \"\n        class=\"mt-1 text-[11px] text-slate-500\"\n      >\n        No options available.\n      </div>\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          Please select an option.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchCase=\"'checkbox'\">\n      <div class=\"flex items-center gap-2\">\n        <input type=\"checkbox\" [formControlName]=\"controlKey()\" />\n        <span class=\"text-xs text-gray-700\">Check</span>\n      </div>\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['requiredTrue']\">\n          Please check this box.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchCase=\"'radio'\">\n      <div\n        [ngClass]=\"\n          field.optionDirection === 'horizontal'\n            ? 'flex flex-row gap-4 items-center'\n            : 'flex flex-col gap-1'\n        \"\n      >\n        <label\n          *ngFor=\"let opt of field.options || []\"\n          class=\"inline-flex items-center gap-2 text-xs text-gray-700\"\n        >\n          <input\n            type=\"radio\"\n            [value]=\"opt.value\"\n            [formControlName]=\"controlKey()\"\n          />\n          <span>{{ opt.label }}</span>\n        </label>\n      </div>\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          Please choose an option.\n        </div>\n      </div>\n    </ng-container>\n  </ng-container>\n</ng-container>\n", dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgClass, selector: "[ngClass]", inputs: ["class", "ngClass"] }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i1.NgSwitch, selector: "[ngSwitch]", inputs: ["ngSwitch"] }, { kind: "directive", type: i1.NgSwitchCase, selector: "[ngSwitchCase]", inputs: ["ngSwitchCase"] }, { kind: "ngmodule", type: ReactiveFormsModule }, { kind: "directive", type: i2.NgSelectOption, selector: "option", inputs: ["ngValue", "value"] }, { kind: "directive", type: i2.ɵNgSelectMultipleOption, selector: "option", inputs: ["ngValue", "value"] }, { kind: "directive", type: i2.DefaultValueAccessor, selector: "input:not([type=checkbox])[formControlName],textarea[formControlName],input:not([type=checkbox])[formControl],textarea[formControl],input:not([type=checkbox])[ngModel],textarea[ngModel],[ngDefaultControl]" }, { kind: "directive", type: i2.CheckboxControlValueAccessor, selector: "input[type=checkbox][formControlName],input[type=checkbox][formControl],input[type=checkbox][ngModel]" }, { kind: "directive", type: i2.SelectControlValueAccessor, selector: "select:not([multiple])[formControlName],select:not([multiple])[formControl],select:not([multiple])[ngModel]", inputs: ["compareWith"] }, { kind: "directive", type: i2.RadioControlValueAccessor, selector: "input[type=radio][formControlName],input[type=radio][formControl],input[type=radio][ngModel]", inputs: ["name", "formControlName", "value"] }, { kind: "directive", type: i2.NgControlStatus, selector: "[formControlName],[ngModel],[formControl]" }, { kind: "directive", type: i2.NgControlStatusGroup, selector: "[formGroupName],[formArrayName],[ngModelGroup],[formGroup],[formArray],form:not([ngNoForm]),[ngForm]" }, { kind: "directive", type: i2.FormGroupDirective, selector: "[formGroup]", inputs: ["formGroup"], outputs: ["ngSubmit"], exportAs: ["ngForm"] }, { kind: "directive", type: i2.FormControlName, selector: "[formControlName]", inputs: ["formControlName", "disabled", "ngModel"], outputs: ["ngModelChange"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoSelectComponent, decorators: [{
            type: Component,
            args: [{ selector: 'amigo-select', standalone: true, imports: [CommonModule, ReactiveFormsModule], template: "<ng-container [formGroup]=\"form\">\n  <ng-container [ngSwitch]=\"field.type\">\n    <ng-container *ngSwitchCase=\"'select'\">\n      <select\n        [formControlName]=\"controlKey()\"\n        [disabled]=\"selectState[field.id]?.loading ?? false\"\n        [style.borderRadius.px]=\"resolvedSchema?.style?.borderRadius\"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      >\n        <option value=\"\">Select an option</option>\n\n        <ng-container\n          *ngFor=\"\n            let opt of field.optionsSource?.mode === 'API'\n              ? selectState[field.id]?.options || []\n              : field.options || []\n          \"\n        >\n          <option [value]=\"opt.value\">{{ opt.label }}</option>\n        </ng-container>\n      </select>\n\n      <div\n        *ngIf=\"\n          field.optionsSource?.mode === 'API' &&\n          selectState[field.id]?.loading\n        \"\n        class=\"mt-1 text-[11px] text-slate-500\"\n      >\n        Loading options\u2026\n      </div>\n\n      <div\n        *ngIf=\"\n          field.optionsSource?.mode === 'API' &&\n          selectState[field.id]?.error\n        \"\n        class=\"mt-1 text-[11px] text-rose-600\"\n      >\n        {{ selectState[field.id]?.error }}\n      </div>\n\n      <div\n        *ngIf=\"\n          field.optionsSource?.mode === 'API' &&\n          !selectState[field.id]?.loading &&\n          !selectState[field.id]?.error &&\n          (selectState[field.id]?.options?.length || 0) === 0\n        \"\n        class=\"mt-1 text-[11px] text-slate-500\"\n      >\n        No options available.\n      </div>\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          Please select an option.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchCase=\"'checkbox'\">\n      <div class=\"flex items-center gap-2\">\n        <input type=\"checkbox\" [formControlName]=\"controlKey()\" />\n        <span class=\"text-xs text-gray-700\">Check</span>\n      </div>\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['requiredTrue']\">\n          Please check this box.\n        </div>\n      </div>\n    </ng-container>\n\n    <ng-container *ngSwitchCase=\"'radio'\">\n      <div\n        [ngClass]=\"\n          field.optionDirection === 'horizontal'\n            ? 'flex flex-row gap-4 items-center'\n            : 'flex flex-col gap-1'\n        \"\n      >\n        <label\n          *ngFor=\"let opt of field.options || []\"\n          class=\"inline-flex items-center gap-2 text-xs text-gray-700\"\n        >\n          <input\n            type=\"radio\"\n            [value]=\"opt.value\"\n            [formControlName]=\"controlKey()\"\n          />\n          <span>{{ opt.label }}</span>\n        </label>\n      </div>\n\n      <div\n        *ngIf=\"showError()\"\n        class=\"mt-1 text-[11px] text-red-600\"\n      >\n        <div *ngIf=\"ctrl()?.errors?.['required']\">\n          Please choose an option.\n        </div>\n      </div>\n    </ng-container>\n  </ng-container>\n</ng-container>\n" }]
        }], propDecorators: { field: [{
                type: Input
            }], form: [{
                type: Input
            }], resolvedSchema: [{
                type: Input
            }], selectState: [{
                type: Input
            }] } });

class AmigoFileComponent {
    field;
    form;
    resolvedSchema;
    fileChange = new EventEmitter();
    clearFile = new EventEmitter();
    controlKey() {
        return this.field?.name ?? this.field?.id;
    }
    ctrl() {
        return this.form?.get(this.controlKey()) ?? null;
    }
    showError() {
        const c = this.ctrl();
        return !!(c && c.invalid && (c.touched || c.dirty));
    }
    onFileChangeHandler(evt) {
        this.fileChange.emit({ evt, field: this.field });
    }
    clearFileHandler(inputEl) {
        this.clearFile.emit({ field: this.field, inputEl });
    }
    fileNames() {
        const v = this.ctrl()?.value;
        if (!v)
            return [];
        if (Array.isArray(v))
            return v.map((f) => f?.name).filter(Boolean);
        if (v instanceof File)
            return [v.name];
        if (typeof FileList !== "undefined" && v instanceof FileList) {
            return Array.from(v)
                .map((f) => f?.name)
                .filter(Boolean);
        }
        return [];
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoFileComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "21.1.5", type: AmigoFileComponent, isStandalone: true, selector: "amigo-file", inputs: { field: "field", form: "form", resolvedSchema: "resolvedSchema" }, outputs: { fileChange: "fileChange", clearFile: "clearFile" }, ngImport: i0, template: "<ng-container [formGroup]=\"form\">\n  <div class=\"flex flex-col gap-2\">\n    <div class=\"flex items-center gap-2\">\n      <input\n        #fileInput\n        type=\"file\"\n        [attr.accept]=\"field.accept || null\"\n        [attr.multiple]=\"field.multiple ? '' : null\"\n        (change)=\"onFileChangeHandler($event)\"\n        (blur)=\"ctrl()?.markAsTouched()\"\n        [style.borderRadius.px]=\"\n          resolvedSchema?.style?.borderRadius\n        \"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      />\n\n      <button\n        *ngIf=\"fileNames().length\"\n        type=\"button\"\n        class=\"px-2 py-1 text-[11px] border border-gray-300 rounded hover:bg-gray-100\"\n        (click)=\"clearFileHandler(fileInput)\"\n      >\n        Clear\n      </button>\n    </div>\n\n    <div class=\"text-[11px] text-gray-500\">\n      <span *ngIf=\"field.accept\">Allowed: {{ field.accept }}</span>\n      <span *ngIf=\"field.maxSizeMB\">\n        \u2022 Max {{ field.maxSizeMB }}MB per file</span\n      >\n      <span *ngIf=\"field.maxFiles\">\n        \u2022 Max {{ field.maxFiles }} file(s)</span\n      >\n    </div>\n\n    <div\n      *ngIf=\"fileNames().length\"\n      class=\"text-[11px] text-gray-600\"\n    >\n      Selected: {{ fileNames().join(\", \") }}\n    </div>\n  </div>\n\n  <div\n    *ngIf=\"showError()\"\n    class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\n  >\n    <div *ngIf=\"ctrl()?.errors?.['required']\">\n      This field is required.\n    </div>\n\n    <div *ngIf=\"ctrl()?.errors?.['maxFiles']\">\n      You can upload up to\n      {{ ctrl()?.errors?.[\"maxFiles\"]?.max }} file(s).\n    </div>\n\n    <div *ngIf=\"ctrl()?.errors?.['maxSizeMB']\">\n      {{ ctrl()?.errors?.[\"maxSizeMB\"]?.file }} is too large.\n      Max {{ ctrl()?.errors?.[\"maxSizeMB\"]?.max }}MB.\n    </div>\n\n    <div *ngIf=\"ctrl()?.errors?.['accept']\">\n      {{ ctrl()?.errors?.[\"accept\"]?.file }} is not an allowed\n      file type.\n    </div>\n  </div>\n</ng-container>\n", dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgClass, selector: "[ngClass]", inputs: ["class", "ngClass"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: ReactiveFormsModule }, { kind: "directive", type: i2.NgControlStatusGroup, selector: "[formGroupName],[formArrayName],[ngModelGroup],[formGroup],[formArray],form:not([ngNoForm]),[ngForm]" }, { kind: "directive", type: i2.FormGroupDirective, selector: "[formGroup]", inputs: ["formGroup"], outputs: ["ngSubmit"], exportAs: ["ngForm"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoFileComponent, decorators: [{
            type: Component,
            args: [{ selector: 'amigo-file', standalone: true, imports: [CommonModule, ReactiveFormsModule], template: "<ng-container [formGroup]=\"form\">\n  <div class=\"flex flex-col gap-2\">\n    <div class=\"flex items-center gap-2\">\n      <input\n        #fileInput\n        type=\"file\"\n        [attr.accept]=\"field.accept || null\"\n        [attr.multiple]=\"field.multiple ? '' : null\"\n        (change)=\"onFileChangeHandler($event)\"\n        (blur)=\"ctrl()?.markAsTouched()\"\n        [style.borderRadius.px]=\"\n          resolvedSchema?.style?.borderRadius\n        \"\n        [ngClass]=\"\n          resolvedSchema?.style?.inputClass ||\n          'w-full border border-gray-300 rounded px-2 py-1 text-sm'\n        \"\n      />\n\n      <button\n        *ngIf=\"fileNames().length\"\n        type=\"button\"\n        class=\"px-2 py-1 text-[11px] border border-gray-300 rounded hover:bg-gray-100\"\n        (click)=\"clearFileHandler(fileInput)\"\n      >\n        Clear\n      </button>\n    </div>\n\n    <div class=\"text-[11px] text-gray-500\">\n      <span *ngIf=\"field.accept\">Allowed: {{ field.accept }}</span>\n      <span *ngIf=\"field.maxSizeMB\">\n        \u2022 Max {{ field.maxSizeMB }}MB per file</span\n      >\n      <span *ngIf=\"field.maxFiles\">\n        \u2022 Max {{ field.maxFiles }} file(s)</span\n      >\n    </div>\n\n    <div\n      *ngIf=\"fileNames().length\"\n      class=\"text-[11px] text-gray-600\"\n    >\n      Selected: {{ fileNames().join(\", \") }}\n    </div>\n  </div>\n\n  <div\n    *ngIf=\"showError()\"\n    class=\"mt-1 text-[11px] text-red-600 space-y-0.5\"\n  >\n    <div *ngIf=\"ctrl()?.errors?.['required']\">\n      This field is required.\n    </div>\n\n    <div *ngIf=\"ctrl()?.errors?.['maxFiles']\">\n      You can upload up to\n      {{ ctrl()?.errors?.[\"maxFiles\"]?.max }} file(s).\n    </div>\n\n    <div *ngIf=\"ctrl()?.errors?.['maxSizeMB']\">\n      {{ ctrl()?.errors?.[\"maxSizeMB\"]?.file }} is too large.\n      Max {{ ctrl()?.errors?.[\"maxSizeMB\"]?.max }}MB.\n    </div>\n\n    <div *ngIf=\"ctrl()?.errors?.['accept']\">\n      {{ ctrl()?.errors?.[\"accept\"]?.file }} is not an allowed\n      file type.\n    </div>\n  </div>\n</ng-container>\n" }]
        }], propDecorators: { field: [{
                type: Input
            }], form: [{
                type: Input
            }], resolvedSchema: [{
                type: Input
            }], fileChange: [{
                type: Output
            }], clearFile: [{
                type: Output
            }] } });

class AmigoFieldRendererComponent {
    field;
    form;
    resolvedSchema;
    isSubmitting = false;
    buttonLoading = {};
    buttonFeedback = {};
    selectState = {};
    buttonClick = new EventEmitter();
    fileChange = new EventEmitter();
    clearFile = new EventEmitter();
    isCard() {
        const t = this.field?.type;
        return t === "card" || t === "info-card";
    }
    isButton() {
        return (this.field?.type ?? "") === "button";
    }
    isSelectOrRadioOrCheckbox() {
        const t = this.field?.type;
        return t === "select" || t === "radio" || t === "checkbox";
    }
    isFile() {
        return this.field?.type === "file";
    }
    onButtonClickHandler(field) {
        this.buttonClick.emit(field);
    }
    onFileChangeHandler(eventData) {
        this.fileChange.emit(eventData);
    }
    onClearFileHandler(eventData) {
        this.clearFile.emit(eventData);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoFieldRendererComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "21.1.5", type: AmigoFieldRendererComponent, isStandalone: true, selector: "amigo-field-renderer", inputs: { field: "field", form: "form", resolvedSchema: "resolvedSchema", isSubmitting: "isSubmitting", buttonLoading: "buttonLoading", buttonFeedback: "buttonFeedback", selectState: "selectState" }, outputs: { buttonClick: "buttonClick", fileChange: "fileChange", clearFile: "clearFile" }, ngImport: i0, template: "<ng-container *ngIf=\"isCard(); else notCard\">\n  <amigo-card [field]=\"field\"></amigo-card>\n</ng-container>\n\n<ng-template #notCard>\n  <ng-container *ngIf=\"isButton(); else inputGroup\">\n    <amigo-button\n      [field]=\"field\"\n      [resolvedSchema]=\"resolvedSchema\"\n      [isSubmitting]=\"isSubmitting\"\n      [buttonLoading]=\"buttonLoading\"\n      [buttonFeedback]=\"buttonFeedback\"\n      (buttonClick)=\"onButtonClickHandler($event)\"\n    ></amigo-button>\n  </ng-container>\n\n  <ng-template #inputGroup>\n    <label\n      [ngClass]=\"\n        resolvedSchema?.style?.labelClass ||\n        'block text-sm font-medium mb-1'\n      \"\n    >\n      {{ field.label }}\n      <span\n        *ngIf=\"\n          field.required === true ||\n          field.required === 'true' ||\n          field.validations?.required\n        \"\n        class=\"text-red-500\"\n        >*</span\n      >\n    </label>\n\n    <ng-container *ngIf=\"isSelectOrRadioOrCheckbox(); else fileOrInput\">\n      <amigo-select\n        [field]=\"field\"\n        [form]=\"form\"\n        [resolvedSchema]=\"resolvedSchema\"\n        [selectState]=\"selectState\"\n      ></amigo-select>\n    </ng-container>\n    \n    <ng-template #fileOrInput>\n      <ng-container *ngIf=\"isFile(); else standardInput\">\n        <amigo-file\n          [field]=\"field\"\n          [form]=\"form\"\n          [resolvedSchema]=\"resolvedSchema\"\n          (fileChange)=\"onFileChangeHandler($event)\"\n          (clearFile)=\"onClearFileHandler($event)\"\n        ></amigo-file>\n      </ng-container>\n      \n      <ng-template #standardInput>\n        <amigo-input\n          [field]=\"field\"\n          [form]=\"form\"\n          [resolvedSchema]=\"resolvedSchema\"\n        ></amigo-input>\n      </ng-template>\n    </ng-template>\n  </ng-template>\n</ng-template>\n", dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgClass, selector: "[ngClass]", inputs: ["class", "ngClass"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "ngmodule", type: ReactiveFormsModule }, { kind: "component", type: AmigoCardComponent, selector: "amigo-card", inputs: ["field"] }, { kind: "component", type: AmigoButtonComponent, selector: "amigo-button", inputs: ["field", "resolvedSchema", "isSubmitting", "buttonLoading", "buttonFeedback"], outputs: ["buttonClick"] }, { kind: "component", type: AmigoInputComponent, selector: "amigo-input", inputs: ["field", "form", "resolvedSchema"] }, { kind: "component", type: AmigoSelectComponent, selector: "amigo-select", inputs: ["field", "form", "resolvedSchema", "selectState"] }, { kind: "component", type: AmigoFileComponent, selector: "amigo-file", inputs: ["field", "form", "resolvedSchema"], outputs: ["fileChange", "clearFile"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoFieldRendererComponent, decorators: [{
            type: Component,
            args: [{ selector: 'amigo-field-renderer', standalone: true, imports: [
                        CommonModule,
                        ReactiveFormsModule,
                        AmigoCardComponent,
                        AmigoButtonComponent,
                        AmigoInputComponent,
                        AmigoSelectComponent,
                        AmigoFileComponent
                    ], template: "<ng-container *ngIf=\"isCard(); else notCard\">\n  <amigo-card [field]=\"field\"></amigo-card>\n</ng-container>\n\n<ng-template #notCard>\n  <ng-container *ngIf=\"isButton(); else inputGroup\">\n    <amigo-button\n      [field]=\"field\"\n      [resolvedSchema]=\"resolvedSchema\"\n      [isSubmitting]=\"isSubmitting\"\n      [buttonLoading]=\"buttonLoading\"\n      [buttonFeedback]=\"buttonFeedback\"\n      (buttonClick)=\"onButtonClickHandler($event)\"\n    ></amigo-button>\n  </ng-container>\n\n  <ng-template #inputGroup>\n    <label\n      [ngClass]=\"\n        resolvedSchema?.style?.labelClass ||\n        'block text-sm font-medium mb-1'\n      \"\n    >\n      {{ field.label }}\n      <span\n        *ngIf=\"\n          field.required === true ||\n          field.required === 'true' ||\n          field.validations?.required\n        \"\n        class=\"text-red-500\"\n        >*</span\n      >\n    </label>\n\n    <ng-container *ngIf=\"isSelectOrRadioOrCheckbox(); else fileOrInput\">\n      <amigo-select\n        [field]=\"field\"\n        [form]=\"form\"\n        [resolvedSchema]=\"resolvedSchema\"\n        [selectState]=\"selectState\"\n      ></amigo-select>\n    </ng-container>\n    \n    <ng-template #fileOrInput>\n      <ng-container *ngIf=\"isFile(); else standardInput\">\n        <amigo-file\n          [field]=\"field\"\n          [form]=\"form\"\n          [resolvedSchema]=\"resolvedSchema\"\n          (fileChange)=\"onFileChangeHandler($event)\"\n          (clearFile)=\"onClearFileHandler($event)\"\n        ></amigo-file>\n      </ng-container>\n      \n      <ng-template #standardInput>\n        <amigo-input\n          [field]=\"field\"\n          [form]=\"form\"\n          [resolvedSchema]=\"resolvedSchema\"\n        ></amigo-input>\n      </ng-template>\n    </ng-template>\n  </ng-template>\n</ng-template>\n" }]
        }], propDecorators: { field: [{
                type: Input
            }], form: [{
                type: Input
            }], resolvedSchema: [{
                type: Input
            }], isSubmitting: [{
                type: Input
            }], buttonLoading: [{
                type: Input
            }], buttonFeedback: [{
                type: Input
            }], selectState: [{
                type: Input
            }], buttonClick: [{
                type: Output
            }], fileChange: [{
                type: Output
            }], clearFile: [{
                type: Output
            }] } });

class AmigoReviewDialogComponent {
    reviewData = [];
    close = new EventEmitter();
    confirm = new EventEmitter();
    onClose() {
        this.close.emit();
    }
    onConfirm() {
        this.confirm.emit();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoReviewDialogComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "21.1.5", type: AmigoReviewDialogComponent, isStandalone: true, selector: "amigo-review-dialog", inputs: { reviewData: "reviewData" }, outputs: { close: "close", confirm: "confirm" }, ngImport: i0, template: "<div class=\"bg-white flex flex-col max-h-[90vh]\">\n  <div class=\"px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0\">\n    <h3 class=\"text-lg font-semibold text-gray-800 m-0\">Review Form Details</h3>\n    <button type=\"button\" (click)=\"onClose()\" class=\"text-gray-400 hover:text-gray-600 focus:outline-none bg-transparent border-none cursor-pointer p-0\">\n      <svg class=\"w-6 h-6\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M6 18L18 6M6 6l12 12\"></path></svg>\n    </button>\n  </div>\n  \n  <div class=\"p-6 overflow-y-auto flex-1\">\n    <div *ngFor=\"let stepData of reviewData\" class=\"mb-6 last:mb-0\">\n      <h4 class=\"font-medium text-blue-700 border-b border-gray-100 pb-2 mb-4 mt-0\">{{ stepData.step }}</h4>\n      <div class=\"grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4\">\n        <div *ngFor=\"let fData of stepData.fields\" class=\"flex flex-col\">\n          <span class=\"text-xs text-gray-500 mb-1\">{{ fData.label }}</span>\n          <span class=\"text-sm font-medium text-gray-800 break-words whitespace-pre-wrap\">{{ fData.value }}</span>\n        </div>\n      </div>\n    </div>\n  </div>\n  \n  <div class=\"px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 shrink-0\">\n    <button type=\"button\" class=\"px-4 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700 cursor-pointer transition-colors\" (click)=\"onClose()\">Edit Form</button>\n    <button type=\"button\" class=\"px-4 py-2 text-sm bg-blue-600 border border-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer transition-colors shadow-sm\" (click)=\"onConfirm()\">Confirm & Close</button>\n  </div>\n</div>\n", dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoReviewDialogComponent, decorators: [{
            type: Component,
            args: [{ selector: 'amigo-review-dialog', standalone: true, imports: [CommonModule], template: "<div class=\"bg-white flex flex-col max-h-[90vh]\">\n  <div class=\"px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0\">\n    <h3 class=\"text-lg font-semibold text-gray-800 m-0\">Review Form Details</h3>\n    <button type=\"button\" (click)=\"onClose()\" class=\"text-gray-400 hover:text-gray-600 focus:outline-none bg-transparent border-none cursor-pointer p-0\">\n      <svg class=\"w-6 h-6\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M6 18L18 6M6 6l12 12\"></path></svg>\n    </button>\n  </div>\n  \n  <div class=\"p-6 overflow-y-auto flex-1\">\n    <div *ngFor=\"let stepData of reviewData\" class=\"mb-6 last:mb-0\">\n      <h4 class=\"font-medium text-blue-700 border-b border-gray-100 pb-2 mb-4 mt-0\">{{ stepData.step }}</h4>\n      <div class=\"grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4\">\n        <div *ngFor=\"let fData of stepData.fields\" class=\"flex flex-col\">\n          <span class=\"text-xs text-gray-500 mb-1\">{{ fData.label }}</span>\n          <span class=\"text-sm font-medium text-gray-800 break-words whitespace-pre-wrap\">{{ fData.value }}</span>\n        </div>\n      </div>\n    </div>\n  </div>\n  \n  <div class=\"px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 shrink-0\">\n    <button type=\"button\" class=\"px-4 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700 cursor-pointer transition-colors\" (click)=\"onClose()\">Edit Form</button>\n    <button type=\"button\" class=\"px-4 py-2 text-sm bg-blue-600 border border-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer transition-colors shadow-sm\" (click)=\"onConfirm()\">Confirm & Close</button>\n  </div>\n</div>\n" }]
        }], propDecorators: { reviewData: [{
                type: Input
            }], close: [{
                type: Output
            }], confirm: [{
                type: Output
            }] } });

/**
 * Host app will provide this.
 * Example: () => authService.getAuthToken()
 */
const AMIGO_AUTH_TOKEN_PROVIDER = new InjectionToken('AMIGO_AUTH_TOKEN_PROVIDER');

class AmigoTokenInterceptor {
    tokenProvider;
    cfg;
    constructor(tokenProvider, cfg) {
        this.tokenProvider = tokenProvider;
        this.cfg = cfg;
    }
    intercept(req, next) {
        if (req.headers.has('X-Amigo-Skip-Auth')) {
            const cleaned = req.clone({ headers: req.headers.delete('X-Amigo-Skip-Auth') });
            return next.handle(cleaned);
        }
        if (!this.tokenProvider)
            return next.handle(req);
        const token = this.tokenProvider?.();
        if (!token)
            return next.handle(req);
        if (this.cfg?.apiBaseUrl || this.cfg?.selectOptionsBaseUrl) {
            const bases = [this.cfg.apiBaseUrl, this.cfg.selectOptionsBaseUrl]
                .filter((b) => !!b)
                .map((b) => b.replace(/\/+$/, ''));
            const isAmigoCall = req.url.startsWith('/') || bases.some((b) => req.url.startsWith(b));
            if (!isAmigoCall)
                return next.handle(req);
        }
        return next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoTokenInterceptor, deps: [{ token: AMIGO_AUTH_TOKEN_PROVIDER, optional: true }, { token: AMIGO_FORM_CONFIG, optional: true }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoTokenInterceptor });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoTokenInterceptor, decorators: [{
            type: Injectable
        }], ctorParameters: () => [{ type: undefined, decorators: [{
                    type: Optional
                }, {
                    type: Inject,
                    args: [AMIGO_AUTH_TOKEN_PROVIDER]
                }] }, { type: undefined, decorators: [{
                    type: Optional
                }, {
                    type: Inject,
                    args: [AMIGO_FORM_CONFIG]
                }] }] });

const AMIGO_FORM_CONFIG = new InjectionToken('AMIGO_FORM_CONFIG');
function provideAmigoForm(config, tokenProvider) {
    const providers = [
        { provide: AMIGO_FORM_CONFIG, useValue: config },
        // Register interceptor
        { provide: HTTP_INTERCEPTORS, useClass: AmigoTokenInterceptor, multi: true },
    ];
    // Optional token provider
    if (tokenProvider) {
        providers.push({ provide: AMIGO_AUTH_TOKEN_PROVIDER, useValue: tokenProvider });
    }
    return providers;
}

class AmigoApiExecutionService {
    http;
    cfg;
    constructor(http, cfg) {
        this.http = http;
        this.cfg = cfg;
    }
    execute(endpoint, ctx) {
        const method = (endpoint?.method || 'POST').toUpperCase();
        const baseUrl = this.resolveUrl(endpoint?.url || '');
        const url = this.applyPathParams(baseUrl, ctx.pathParams);
        let headers = new HttpHeaders();
        if (ctx.skipAuth)
            headers = headers.set('X-Amigo-Skip-Auth', '1');
        for (const h of endpoint?.headers || []) {
            if (!h?.key)
                continue;
            const v = this.resolveString(h.value, ctx.formValue);
            if (v !== undefined && v !== null && String(v).length)
                headers = headers.set(h.key, String(v));
        }
        let params = new HttpParams();
        for (const q of endpoint?.queryParams || []) {
            if (!q?.key)
                continue;
            const v = this.resolveString(q.value, ctx.formValue);
            if (v === undefined || v === null || v === '')
                continue;
            params = params.set(q.key, String(v));
        }
        params = this.mergeParamsOverride(params, ctx.queryParams);
        const mapped = this.buildMappedBody(endpoint?.bodyMapping, ctx.formValue);
        const payload = ctx.payloadKey ? { [ctx.payloadKey]: mapped } : mapped;
        if (method === 'GET') {
            const merged = this.mergeParamsFromObject(params, payload);
            return this.http.request(method, url, { headers, params: merged });
        }
        const contentType = ctx.contentType || 'auto';
        const useMultipart = contentType === 'multipart' || (contentType === 'auto' && this.hasFile(payload));
        if (useMultipart) {
            const fd = this.toFormData(payload);
            return this.http.request(method, url, { headers, params, body: fd });
        }
        headers = headers.set('Content-Type', 'application/json');
        return this.http.request(method, url, { headers, params, body: payload });
    }
    resolveUrl(url) {
        const u = (url || '').trim();
        if (!u)
            return u;
        if (/^https?:\/\//i.test(u))
            return u;
        const base = (this.cfg?.submitActionBaseUrl || '').replace(/\/+$/, '');
        if (!base)
            return u.startsWith('/') ? u : '/' + u;
        if (u.startsWith('/'))
            return base + u;
        return base + '/' + u;
    }
    buildMappedBody(mapping, formValue) {
        if (!mapping)
            return formValue;
        if (Array.isArray(mapping)) {
            const out = {};
            for (const kv of mapping) {
                if (!kv?.key)
                    continue;
                out[kv.key] = this.resolveMappingExpr(kv.value, formValue);
            }
            return out;
        }
        if (typeof mapping === 'object') {
            const out = {};
            for (const k of Object.keys(mapping)) {
                out[k] = this.resolveMappingExpr(mapping[k], formValue);
            }
            return out;
        }
        return formValue;
    }
    resolveMappingExpr(expr, formValue) {
        if (expr === null || expr === undefined)
            return expr;
        if (typeof expr !== 'string')
            return expr;
        const s = expr.trim();
        const m = s.match(/^\{\{\s*([^}]+)\s*\}\}$/);
        if (m)
            return this.getByPath(formValue, m[1].trim());
        if (Object.prototype.hasOwnProperty.call(formValue, s))
            return formValue[s];
        return this.resolveString(s, formValue);
    }
    resolveString(template, formValue) {
        const t = String(template ?? '');
        return t.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, path) => {
            const v = this.getByPath(formValue, String(path).trim());
            return v === undefined || v === null ? '' : String(v);
        });
    }
    getByPath(obj, path) {
        const parts = (path || '')
            .split('.')
            .map((p) => p.trim())
            .filter(Boolean);
        let cur = obj;
        for (const p of parts) {
            if (cur == null)
                return undefined;
            cur = cur[p];
        }
        return cur;
    }
    mergeParamsFromObject(params, obj) {
        if (!obj || typeof obj !== 'object')
            return params;
        let p = params;
        for (const [k, v] of Object.entries(obj)) {
            if (v === undefined || v === null)
                continue;
            if (Array.isArray(v)) {
                for (const item of v) {
                    if (item === undefined || item === null)
                        continue;
                    p = p.append(k, this.scalarToString(item));
                }
                continue;
            }
            p = p.set(k, this.scalarToString(v));
        }
        return p;
    }
    scalarToString(v) {
        if (v instanceof Date)
            return v.toISOString();
        if (typeof v === 'object')
            return JSON.stringify(v);
        return String(v);
    }
    hasFile(v) {
        if (!v)
            return false;
        if (typeof File !== 'undefined' && v instanceof File)
            return true;
        if (Array.isArray(v))
            return v.some((x) => this.hasFile(x));
        if (typeof v === 'object')
            return Object.values(v).some((x) => this.hasFile(x));
        return false;
    }
    toFormData(obj) {
        const fd = new FormData();
        this.appendFormData(fd, obj, '');
        return fd;
    }
    appendFormData(fd, value, keyPrefix) {
        if (value === undefined || value === null)
            return;
        const isFile = typeof File !== 'undefined' && value instanceof File;
        if (isFile) {
            fd.append(keyPrefix, value);
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((v, i) => {
                const k = keyPrefix ? `${keyPrefix}[${i}]` : String(i);
                this.appendFormData(fd, v, k);
            });
            return;
        }
        if (typeof value === 'object') {
            Object.entries(value).forEach(([k, v]) => {
                const next = keyPrefix ? `${keyPrefix}.${k}` : k;
                this.appendFormData(fd, v, next);
            });
            return;
        }
        fd.append(keyPrefix, String(value));
    }
    applyPathParams(url, params) {
        if (!params || !url)
            return url;
        const has = (k) => Object.prototype.hasOwnProperty.call(params, k);
        const enc = (v) => encodeURIComponent(v === undefined || v === null ? '' : String(v));
        let out = url;
        // {id} style
        out = out.replace(/\{([^}]+)\}/g, (m, k) => {
            const key = k.trim();
            return has(key) ? enc(params[key]) : m;
        });
        // :id style
        out = out.replace(/:([A-Za-z0-9_]+)/g, (m, k) => (has(k) ? enc(params[k]) : m));
        return out;
    }
    mergeParamsOverride(params, obj) {
        if (!obj || typeof obj !== 'object')
            return params;
        let p = params;
        for (const [k, v] of Object.entries(obj)) {
            if (v === undefined || v === null)
                continue;
            p = p.delete(k);
            if (Array.isArray(v)) {
                for (const item of v) {
                    if (item === undefined || item === null)
                        continue;
                    p = p.append(k, this.scalarToString(item));
                }
                continue;
            }
            p = p.set(k, this.scalarToString(v));
        }
        return p;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoApiExecutionService, deps: [{ token: i1$1.HttpClient }, { token: AMIGO_FORM_CONFIG, optional: true }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoApiExecutionService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoApiExecutionService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1$1.HttpClient }, { type: undefined, decorators: [{
                    type: Optional
                }, {
                    type: Inject,
                    args: [AMIGO_FORM_CONFIG]
                }] }] });

class FormVisibilityService {
    visibilitySub;
    visibilityState = {};
    visibilityUpdating = false;
    setupVisibility(form, resolvedSchema, onVisibilityChange) {
        this.visibilitySub?.unsubscribe();
        if (!form || !resolvedSchema)
            return;
        this.recomputeVisibility(form, resolvedSchema);
        this.visibilitySub = form.valueChanges.subscribe(() => {
            if (onVisibilityChange) {
                onVisibilityChange();
            }
            if (this.visibilityUpdating)
                return;
            this.recomputeVisibility(form, resolvedSchema);
        });
    }
    isFieldVisibleOriginal(field) {
        const rules = field?.visibility?.rules;
        if (!rules || !rules.length)
            return true;
        const key = field?.id || field?.name;
        return this.visibilityState[key] !== false;
    }
    isFieldVisible(field, isMultiStep, isReviewed) {
        const isSubmit = field?.type === 'button' &&
            (field?.button?.isSubmit || field?.label?.toLowerCase().includes('submit'));
        if (isSubmit) {
            if (isMultiStep && !isReviewed) {
                return false;
            }
        }
        return this.isFieldVisibleOriginal(field);
    }
    recomputeVisibility(form, resolvedSchema) {
        if (!form || !resolvedSchema)
            return;
        const raw = form.getRawValue
            ? form.getRawValue()
            : form.value;
        this.visibilityUpdating = true;
        try {
            for (const f of resolvedSchema.fields) {
                const visible = this.evaluateVisibility(f, raw);
                const stateKey = f.id || f.name;
                this.visibilityState[stateKey] = visible;
                if (this.isNonInput(f))
                    continue;
                const c = form.get(this.controlKey(f));
                if (!c)
                    continue;
                if (!visible && c.enabled)
                    c.disable({ emitEvent: false });
                if (visible && c.disabled)
                    c.enable({ emitEvent: false });
            }
        }
        finally {
            this.visibilityUpdating = false;
        }
    }
    evaluateVisibility(field, raw) {
        const vis = field?.visibility;
        const rules = vis?.rules ?? [];
        if (!rules.length)
            return true;
        const mode = String(vis?.mode || "ALL").toUpperCase();
        const results = rules.map((r) => this.evaluateVisibilityRule(r, raw));
        return mode === "ANY" ? results.some(Boolean) : results.every(Boolean);
    }
    evaluateVisibilityRule(rule, raw) {
        const depKey = this.resolveDependsOnKey(rule?.dependsOn);
        const v = raw?.[depKey];
        const op = String(rule?.operator || "EQUALS").toUpperCase();
        const cmp = rule?.value;
        switch (op) {
            case "CHECKED":
                return v === true;
            case "UNCHECKED":
                return v !== true;
            case "HAS_VALUE":
                return !this.isEmptyValue(v);
            case "NOT_HAS_VALUE":
                return this.isEmptyValue(v);
            case "IN":
                return Array.isArray(cmp) ? cmp.includes(v) : false;
            case "NOT_IN":
                return Array.isArray(cmp) ? !cmp.includes(v) : true;
            case "NOT_EQUALS":
                return Array.isArray(v) ? !v.includes(cmp) : v !== cmp;
            case "EQUALS":
            default:
                return Array.isArray(v) ? v.includes(cmp) : v === cmp;
        }
    }
    resolveDependsOnKey(dependsOn) {
        if (!dependsOn)
            return "";
        if (typeof dependsOn === "string")
            return dependsOn;
        return dependsOn.id || dependsOn.name || "";
    }
    isEmptyValue(v) {
        if (v === null || v === undefined)
            return true;
        if (typeof v === "string" && v.trim() === "")
            return true;
        if (Array.isArray(v) && v.length === 0)
            return true;
        return false;
    }
    isNonInput(field) {
        const t = field?.type;
        return t === "card" || t === "info-card" || t === "button";
    }
    controlKey(field) {
        return field?.name ?? field?.id;
    }
    cleanup() {
        this.visibilitySub?.unsubscribe();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormVisibilityService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormVisibilityService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormVisibilityService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root'
                }]
        }] });

class FormSubmissionService {
    apiExec;
    constructor(apiExec) {
        this.apiExec = apiExec;
    }
    async submit(form, resolvedSchema, normalizedFormValue, options) {
        if (!resolvedSchema || !form)
            return;
        options.onStateChange({ isSubmitting: false, feedback: undefined });
        let btnField = options.triggerField;
        if (!btnField && resolvedSchema.fields) {
            btnField = resolvedSchema.fields.find((f) => f.type === 'button' && f.button?.isSubmit);
        }
        const btn = btnField?.button;
        const triggerValidation = btn?.triggerValidation !== false;
        if (triggerValidation) {
            form.markAllAsTouched();
            if (form.invalid)
                return;
        }
        const location = await this.getCaptureLocation();
        const formValue = { ...normalizedFormValue, geo_location: location };
        const endpoint = btn?.api;
        if (!btnField || !endpoint || !endpoint.url) {
            options.onSuccess(formValue);
            return;
        }
        options.onStateChange({ isSubmitting: true });
        // For isSubmit: true, we send the entire form data as body, bypassing bodyMapping
        const apiConfig = { ...endpoint, bodyMapping: null };
        this.apiExec
            .execute(apiConfig, {
            formValue,
            pathParams: options.submitPathParams,
            queryParams: options.submitQueryParams,
        })
            .pipe(finalize(() => {
            // Just state update, wait for next/error to set feedback
            options.onStateChange({ isSubmitting: false });
        }))
            .subscribe({
            next: (res) => {
                options.onStateChange({
                    isSubmitting: false,
                    feedback: {
                        type: "success",
                        message: btn.successMessage || "Submitted successfully.",
                    }
                });
                options.onSuccess({
                    url: apiConfig.url,
                    method: apiConfig.method || 'POST',
                    payload: formValue,
                    headers: apiConfig.headers || [],
                    params: apiConfig.queryParams || [],
                    response: res,
                });
            },
            error: (err) => {
                options.onStateChange({
                    isSubmitting: false,
                    feedback: {
                        type: "error",
                        message: btn.errorMessage ||
                            err?.error?.message ||
                            err?.message ||
                            "Failed to submit. Please try again.",
                    }
                });
                options.onError(err);
            },
        });
    }
    getCaptureLocation() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve({ lat: "", long: "" });
                return;
            }
            const timer = setTimeout(() => {
                resolve({ lat: "", long: "" });
            }, 2000);
            navigator.geolocation.getCurrentPosition((pos) => {
                clearTimeout(timer);
                resolve({
                    lat: String(pos.coords.latitude),
                    long: String(pos.coords.longitude),
                });
            }, () => {
                clearTimeout(timer);
                resolve({ lat: "", long: "" });
            }, { timeout: 2000, enableHighAccuracy: false });
        });
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormSubmissionService, deps: [{ token: AmigoApiExecutionService }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormSubmissionService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormSubmissionService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root'
                }]
        }], ctorParameters: () => [{ type: AmigoApiExecutionService }] });

class FormReviewService {
    visibility;
    constructor(visibility) {
        this.visibility = visibility;
    }
    generateReviewData(form, resolvedSchema, isMultiStep, orderedSteps, selectState) {
        const data = [];
        if (isMultiStep && orderedSteps && orderedSteps.length > 0) {
            for (let i = 0; i < orderedSteps.length; i++) {
                const step = orderedSteps[i];
                const stepFields = this.getFieldsForReview(step, form, resolvedSchema, selectState);
                if (stepFields.length > 0) {
                    data.push({
                        step: step.label || `Step ${i + 1}`,
                        fields: stepFields
                    });
                }
            }
        }
        return data;
    }
    getFieldsForReview(step, form, resolvedSchema, selectState) {
        const s = resolvedSchema;
        if (!s)
            return [];
        const ids = new Set(step?.fieldIds ?? []);
        return (s.fields ?? [])
            .filter((f) => ids.has(f.id) && !this.isNonInput(f) && this.visibility.isFieldVisibleOriginal(f))
            .map((f) => {
            return {
                label: f.label,
                value: this.getReviewValue(f, form, selectState)
            };
        });
    }
    getReviewValue(field, form, selectState) {
        const val = form?.get(this.controlKey(field))?.value;
        if (val === null || val === undefined || val === '')
            return '-';
        if (field.type === 'select' || field.type === 'radio') {
            const opts = field.optionsSource?.mode === 'API' ? selectState[field.id]?.options : field.options;
            const selectedOpt = (opts || []).find((o) => String(o.value) === String(val));
            return selectedOpt ? selectedOpt.label : val;
        }
        if (field.type === 'checkbox') {
            return val ? 'Yes' : 'No';
        }
        if (field.type === 'file') {
            const names = this.fileNames(field, form);
            return names.length ? names.join(', ') : '-';
        }
        return val;
    }
    isNonInput(field) {
        const t = field?.type;
        return t === "card" || t === "info-card" || t === "button";
    }
    controlKey(field) {
        return field?.name ?? field?.id;
    }
    fileNames(field, form) {
        const v = form?.get(this.controlKey(field))?.value;
        if (!v)
            return [];
        if (Array.isArray(v))
            return v.map((f) => f?.name).filter(Boolean);
        if (v instanceof File)
            return [v.name];
        if (typeof FileList !== "undefined" && v instanceof FileList) {
            return Array.from(v)
                .map((f) => f?.name)
                .filter(Boolean);
        }
        return [];
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormReviewService, deps: [{ token: FormVisibilityService }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormReviewService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormReviewService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root'
                }]
        }], ctorParameters: () => [{ type: FormVisibilityService }] });

class AmigoFormService {
    http;
    apiExec;
    cfg;
    constructor(http, apiExec, cfg) {
        this.http = http;
        this.apiExec = apiExec;
        this.cfg = cfg;
    }
    getFormSchemaById(id) {
        const pathBuilder = this.cfg.endpoints?.getFormById;
        const url = pathBuilder ? `${this.cfg.apiBaseUrl}${pathBuilder(id)}` : `${this.cfg.apiBaseUrl}/${id}`;
        return this.http.get(url);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoFormService, deps: [{ token: i1$1.HttpClient }, { token: AmigoApiExecutionService }, { token: AMIGO_FORM_CONFIG }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoFormService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoFormService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1$1.HttpClient }, { type: AmigoApiExecutionService }, { type: undefined, decorators: [{
                    type: Inject,
                    args: [AMIGO_FORM_CONFIG]
                }] }] });

class FormSchemaManagerService {
    formService;
    isLoading = signal(false, ...(ngDevMode ? [{ debugName: "isLoading" }] : []));
    loadError = signal(null, ...(ngDevMode ? [{ debugName: "loadError" }] : []));
    resolvedSchema = signal(null, ...(ngDevMode ? [{ debugName: "resolvedSchema" }] : []));
    constructor(formService) {
        this.formService = formService;
    }
    init(formId, schemaInput) {
        this.loadError.set(null);
        if (schemaInput) {
            this.applySchema(schemaInput);
            return;
        }
        if (!formId) {
            this.resolvedSchema.set(null);
            this.loadError.set("No schema or formId provided.");
            return;
        }
        this.isLoading.set(true);
        this.formService.getFormSchemaById(formId).subscribe({
            next: (res) => {
                this.applySchema(res?.form_data ?? res);
                this.isLoading.set(false);
            },
            error: (e) => {
                this.isLoading.set(false);
                this.loadError.set(e?.message ?? "Failed to load form schema");
            },
        });
    }
    applySchema(raw) {
        const s = typeof raw === "string" ? JSON.parse(raw) : raw;
        const formType = (s?.formType ?? "single");
        const fields = (s?.fields ?? []).map((f) => {
            if (f?.type === "file")
                return { ...f, accept: normalizeAccept(f.accept) };
            return f;
        });
        const parsedSchema = {
            ...s,
            formType,
            layout: s?.layout ?? { rows: 1, columns: 1 },
            fields,
            steps: s?.steps ?? [],
            sections: s?.sections ?? [],
            spacing: s?.spacing ?? {},
            style: s?.style ?? {},
            actions: s?.actions ?? {},
        };
        this.resolvedSchema.set(parsedSchema);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormSchemaManagerService, deps: [{ token: AmigoFormService }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormSchemaManagerService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormSchemaManagerService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root'
                }]
        }], ctorParameters: () => [{ type: AmigoFormService }] });

class FormValueManagerService {
    patchInitialValue(form, resolvedSchema, initialValue) {
        if (!form || !resolvedSchema || !initialValue)
            return;
        const patch = {};
        const inputFields = (resolvedSchema.fields ?? []).filter((f) => !this.isCard(f));
        for (const field of inputFields) {
            const key = this.controlKey(field);
            const incoming = initialValue[key] ??
                (field?.name ? initialValue[field.name] : undefined) ??
                (field?.id ? initialValue[field.id] : undefined);
            if (incoming === undefined)
                continue;
            if (field.type === "file")
                continue;
            if (field.type === "number") {
                patch[key] = incoming === "" || incoming === null ? null : Number(incoming);
                continue;
            }
            if (field.type === "checkbox") {
                patch[key] = incoming === true || incoming === "true" || incoming === 1 || incoming === "1";
                continue;
            }
            if (field.type === "date" && incoming) {
                patch[key] = String(incoming).slice(0, 10);
                continue;
            }
            patch[key] = incoming;
        }
        form.patchValue(patch, { emitEvent: false });
        form.markAsPristine();
        form.markAsUntouched();
    }
    normalizeFormValue(form, resolvedSchema) {
        if (!form)
            return {};
        const raw = form.value;
        const normalized = {};
        for (const field of resolvedSchema?.fields ?? []) {
            if (this.isNonInput(field))
                continue;
            const key = this.controlKey(field);
            const value = raw[key];
            if (field.type === "number") {
                normalized[key] =
                    value === "" || value === undefined || value === null
                        ? this.resolveEmptyValue(field)
                        : Number(value);
            }
            else if (this.isEmptyInput(value)) {
                normalized[key] = this.resolveEmptyValue(field);
            }
            else {
                normalized[key] = value;
            }
        }
        return normalized;
    }
    resolveEmptyValue(field) {
        const mode = field?.emptyValue;
        if (mode === "null")
            return null;
        if (mode === "undefined")
            return undefined;
        if (mode === "empty_string")
            return "";
        return field?.type === "number" ? null : "";
    }
    isEmptyInput(v) {
        return v === "" || v === null || v === undefined;
    }
    isNonInput(field) {
        const t = field?.type;
        return t === "card" || t === "info-card" || t === "button";
    }
    isCard(field) {
        const t = field?.type;
        return t === "card" || t === "info-card";
    }
    controlKey(field) {
        return field?.name ?? field?.id;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormValueManagerService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormValueManagerService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormValueManagerService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root'
                }]
        }] });

class FormStepSectionManagerService {
    schemaManager = inject(FormSchemaManagerService);
    visibility = inject(FormVisibilityService);
    activeStepIndex = signal(0, ...(ngDevMode ? [{ debugName: "activeStepIndex" }] : []));
    isReviewed = signal(false, ...(ngDevMode ? [{ debugName: "isReviewed" }] : []));
    orderedSteps = computed(() => {
        const s = this.schemaManager.resolvedSchema();
        return [...(s?.steps ?? [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
    }, ...(ngDevMode ? [{ debugName: "orderedSteps" }] : []));
    totalSteps = computed(() => this.orderedSteps().length, ...(ngDevMode ? [{ debugName: "totalSteps" }] : []));
    isMultiStep = computed(() => {
        const s = this.schemaManager.resolvedSchema();
        return s?.formType === "multi" && this.totalSteps() > 0;
    }, ...(ngDevMode ? [{ debugName: "isMultiStep" }] : []));
    orderedSections = computed(() => {
        const s = this.schemaManager.resolvedSchema();
        if (!s || s.formType !== "single-sectional")
            return [];
        return [...(s.sections ?? [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
    }, ...(ngDevMode ? [{ debugName: "orderedSections" }] : []));
    isSectional = computed(() => {
        const s = this.schemaManager.resolvedSchema();
        return s?.formType === "single-sectional" && this.orderedSections().length > 0;
    }, ...(ngDevMode ? [{ debugName: "isSectional" }] : []));
    visibleFields = computed(() => {
        return this.fieldsForStep(this.activeStepIndex());
    }, ...(ngDevMode ? [{ debugName: "visibleFields" }] : []));
    fieldsForStep(index) {
        const s = this.schemaManager.resolvedSchema();
        if (!s)
            return [];
        if (s.formType === "multi" && this.totalSteps() > 0) {
            if (index < 0 || index >= this.totalSteps())
                return [];
            const step = this.orderedSteps()[index];
            const ids = new Set(step?.fieldIds ?? []);
            if (!ids.size)
                return [];
            return (s.fields ?? [])
                .filter((f) => ids.has(f.id))
                .filter((f) => this.visibility.isFieldVisible(f, this.isMultiStep(), this.isReviewed()));
        }
        return (s.fields ?? []).filter((f) => this.visibility.isFieldVisible(f, this.isMultiStep(), this.isReviewed()));
    }
    fieldsForSection(sectionId) {
        const s = this.schemaManager.resolvedSchema();
        if (!s)
            return [];
        const section = (s.sections ?? []).find((x) => x.id === sectionId);
        const ids = new Set(section?.fieldIds ?? []);
        return (s.fields ?? [])
            .filter((f) => ids.has(f.id))
            .filter((f) => this.visibility.isFieldVisible(f, this.isMultiStep(), this.isReviewed()));
    }
    setActiveStep(i, form) {
        if (i < 0 || i >= this.totalSteps())
            return;
        if (i === this.activeStepIndex())
            return;
        if (i > this.activeStepIndex()) {
            for (let stepIdx = 0; stepIdx < i; stepIdx++) {
                const fields = this.fieldsForStep(stepIdx);
                this.touchFields(fields, form);
                if (this.hasErrors(fields, form)) {
                    this.activeStepIndex.set(stepIdx);
                    return;
                }
            }
        }
        this.activeStepIndex.set(i);
    }
    prevStep(form) {
        this.setActiveStep(this.activeStepIndex() - 1, form);
    }
    nextStep(form) {
        this.setActiveStep(this.activeStepIndex() + 1, form);
    }
    touchFields(fields, form) {
        if (!form)
            return;
        for (const f of fields) {
            if (this.isNonInput(f))
                continue;
            if (!this.visibility.isFieldVisible(f, this.isMultiStep(), this.isReviewed()))
                continue;
            const c = form.get(this.controlKey(f));
            if (!c || c.disabled)
                continue;
            c.markAsTouched();
            c.updateValueAndValidity({ emitEvent: false });
        }
    }
    hasErrors(fields, form) {
        if (!form)
            return true;
        return fields
            .filter((f) => !this.isNonInput(f))
            .filter((f) => this.visibility.isFieldVisible(f, this.isMultiStep(), this.isReviewed()))
            .some((f) => {
            const c = form.get(this.controlKey(f));
            return !!(c && c.enabled && c.invalid);
        });
    }
    isNonInput(field) {
        const t = field?.type;
        return t === "card" || t === "info-card" || t === "button";
    }
    controlKey(field) {
        return field?.name ?? field?.id;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormStepSectionManagerService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormStepSectionManagerService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormStepSectionManagerService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root'
                }]
        }] });

class AmigoSelectOptionsService {
    http;
    cfg;
    tokenProvider;
    cache = new Map();
    rawCache = new Map();
    constructor(http, cfg, tokenProvider) {
        this.http = http;
        this.cfg = cfg;
        this.tokenProvider = tokenProvider;
    }
    load(field, _formValue) {
        const api = field.optionsSource?.api;
        if (!api?.url)
            return of([]);
        const cacheKey = `${field.id}::${api.method || "GET"}::${api.url}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return of(cached);
        const url = this.resolveUrl(api.url);
        const method = (api.method || "GET").toUpperCase();
        const shouldBearer = api.secured === true && api.authType === "BEARER";
        let headers = new HttpHeaders();
        if (!shouldBearer) {
            headers = headers.set("X-Amigo-Skip-Auth", "1");
        }
        else {
            const token = this.resolveToken(api);
            if (token)
                headers = headers.set("Authorization", `Bearer ${token}`);
        }
        return this.http.request(method, url, { headers }).pipe(tap((res) => this.rawCache.set(field.id, res)), map((res) => this.mapOptions(res, api)), tap((opts) => this.cache.set(cacheKey, opts)), catchError((err) => {
            const msg = err?.error?.message || err?.message || "Failed to load options.";
            return throwError(() => new Error(msg));
        }));
    }
    clear(fieldId) {
        if (!fieldId) {
            this.cache.clear();
            this.rawCache.clear();
            return;
        }
        for (const k of [...this.cache.keys()]) {
            if (k.startsWith(fieldId + "::"))
                this.cache.delete(k);
        }
        this.rawCache.delete(fieldId);
    }
    getRawResponse(fieldId) {
        return this.rawCache.get(fieldId) ?? null;
    }
    resolveUrl(url) {
        const u = (url || "").trim();
        if (!u)
            return u;
        if (/^https?:\/\//i.test(u))
            return u;
        // Use selectOptionsBaseUrl if available, otherwise fall back into apiBaseUrl
        const base = (this.cfg?.selectOptionsBaseUrl ||
            this.cfg?.apiBaseUrl ||
            "").replace(/\/+$/, "");
        if (!base)
            return u.startsWith("/") ? u : "/" + u;
        if (u.startsWith("/"))
            return base + u;
        return base + "/" + u;
    }
    resolveToken(api) {
        const key = api.tokenKey || "access_token";
        if (api.tokenFrom === "SESSION_STORAGE") {
            return sessionStorage.getItem(key);
        }
        if (api.tokenFrom === "LOCAL_STORAGE" || !api.tokenFrom) {
            return localStorage.getItem(key);
        }
        if (api.tokenFrom === "CUSTOM_CALLBACK") {
            return this.tokenProvider?.() || null;
        }
        return null;
    }
    mapOptions(res, api) {
        const rm = api.responseMapping;
        const labelKey = rm?.labelKey || "label";
        const valueKey = rm?.valueKey || "value";
        const data = rm?.dataPath ? this.getByPath(res, rm.dataPath) : res;
        const arr = Array.isArray(data)
            ? data
            : Array.isArray(data?.items)
                ? data.items
                : [];
        return arr
            .map((item) => ({
            label: item?.[labelKey] ?? "",
            value: item?.[valueKey],
        }))
            .filter((o) => o.label !== "" && o.value !== undefined);
    }
    getByPath(obj, path) {
        if (!obj || !path)
            return obj;
        return path
            .split(".")
            .reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoSelectOptionsService, deps: [{ token: i1$1.HttpClient }, { token: AMIGO_FORM_CONFIG, optional: true }, { token: AMIGO_AUTH_TOKEN_PROVIDER, optional: true }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoSelectOptionsService, providedIn: "root" });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoSelectOptionsService, decorators: [{
            type: Injectable,
            args: [{ providedIn: "root" }]
        }], ctorParameters: () => [{ type: i1$1.HttpClient }, { type: undefined, decorators: [{
                    type: Optional
                }, {
                    type: Inject,
                    args: [AMIGO_FORM_CONFIG]
                }] }, { type: undefined, decorators: [{
                    type: Optional
                }, {
                    type: Inject,
                    args: [AMIGO_AUTH_TOKEN_PROVIDER]
                }] }] });

class FormSelectOptionsManagerService {
    selectOptions = inject(AmigoSelectOptionsService);
    schemaManager = inject(FormSchemaManagerService);
    valueManager = inject(FormValueManagerService);
    selectState = signal({}, ...(ngDevMode ? [{ debugName: "selectState" }] : []));
    cascadingSubs = [];
    preloadApiSelectOptions(form) {
        const s = this.schemaManager.resolvedSchema();
        const fields = s?.fields ?? [];
        const formValue = this.valueManager.normalizeFormValue(form, s);
        for (const f of fields) {
            if (f.type !== "select")
                continue;
            if (f.optionsSource?.mode !== "API")
                continue;
            if (f.dependentSelect)
                continue;
            this.updateSelectState(f.id, { loading: true, options: [] });
            this.selectOptions.load(f, formValue).subscribe({
                next: (opts) => {
                    this.updateSelectState(f.id, { loading: false, options: opts });
                },
                error: () => {
                    this.updateSelectState(f.id, {
                        loading: false,
                        error: "Failed to load options.",
                        options: [],
                    });
                },
            });
        }
    }
    setupCascadingSelects(form) {
        this.cleanup();
        const s = this.schemaManager.resolvedSchema();
        const fields = s?.fields ?? [];
        const childFields = fields.filter((f) => f.type === "select" && f.dependentSelect);
        for (const child of childFields) {
            const dep = child.dependentSelect;
            const parentField = fields.find((f) => f.id === dep.parentFieldId);
            if (!parentField)
                continue;
            const parentKey = this.controlKey(parentField);
            const parentCtrl = form?.get(parentKey);
            if (!parentCtrl)
                continue;
            this.updateSelectState(child.id, { loading: false, options: [] });
            const sub = parentCtrl.valueChanges.subscribe((parentValue) => {
                this.updateChildOptions(child, dep, parentValue, form);
            });
            this.cascadingSubs.push(sub);
            const currentParentValue = parentCtrl.value;
            if (currentParentValue) {
                this.updateChildOptions(child, dep, currentParentValue, form);
            }
        }
    }
    updateChildOptions(child, dep, parentValue, form) {
        const childKey = this.controlKey(child);
        const childCtrl = form?.get(childKey);
        if (!parentValue || parentValue === "") {
            this.updateSelectState(child.id, { loading: false, options: [] });
            if (childCtrl)
                childCtrl.setValue("", { emitEvent: false });
            return;
        }
        const rawResponse = this.selectOptions.getRawResponse(dep.parentFieldId);
        if (!rawResponse) {
            this.updateSelectState(child.id, { loading: false, options: [] });
            return;
        }
        const s = this.schemaManager.resolvedSchema();
        const fields = s?.fields ?? [];
        const parentField = fields.find((f) => f.id === dep.parentFieldId);
        const parentApi = parentField?.optionsSource?.api;
        const parentDataPath = parentApi?.responseMapping?.dataPath;
        const parentValueKey = parentApi?.responseMapping?.valueKey || "value";
        let parentItems;
        if (parentDataPath) {
            parentItems = this.getByPath(rawResponse, parentDataPath);
        }
        else {
            parentItems = rawResponse;
        }
        if (!Array.isArray(parentItems)) {
            this.updateSelectState(child.id, { loading: false, options: [] });
            return;
        }
        const selectedParent = parentItems.find((item) => String(item?.[parentValueKey]) === String(parentValue));
        if (!selectedParent) {
            this.updateSelectState(child.id, { loading: false, options: [] });
            if (childCtrl)
                childCtrl.setValue("", { emitEvent: false });
            return;
        }
        const childItems = this.getByPath(selectedParent, dep.childDataPath);
        const childOptions = Array.isArray(childItems)
            ? childItems
                .map((item) => ({
                label: String(item?.[dep.labelKey] ?? ""),
                value: item?.[dep.valueKey],
            }))
                .filter((o) => o.label !== "" && o.value !== undefined)
            : [];
        this.updateSelectState(child.id, { loading: false, options: childOptions });
        if (childCtrl)
            childCtrl.setValue("", { emitEvent: false });
    }
    updateSelectState(id, state) {
        this.selectState.update(curr => ({ ...curr, [id]: state }));
    }
    getByPath(obj, path) {
        if (!obj || !path)
            return obj;
        return path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
    }
    controlKey(field) {
        return field?.name ?? field?.id;
    }
    cleanup() {
        this.cascadingSubs.forEach((s) => s.unsubscribe());
        this.cascadingSubs = [];
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormSelectOptionsManagerService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormSelectOptionsManagerService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: FormSelectOptionsManagerService, decorators: [{
            type: Injectable,
            args: [{
                    providedIn: 'root'
                }]
        }] });

class AmigoFormComponent {
    cdr;
    dialog;
    apiExec;
    visibility;
    submission;
    reviewService;
    schemaManager;
    valueManager;
    stepSectionManager;
    selectOptionsManager;
    formId;
    schema;
    initialValue;
    submitPathParams;
    submitQueryParams;
    submitted = new EventEmitter();
    submitFailed = new EventEmitter();
    isSubmitting = false;
    form = null;
    submitFeedback;
    buttonLoading = {};
    buttonFeedback = {};
    reviewDialogTemplate;
    constructor(cdr, dialog, apiExec, visibility, submission, reviewService, schemaManager, valueManager, stepSectionManager, selectOptionsManager) {
        this.cdr = cdr;
        this.dialog = dialog;
        this.apiExec = apiExec;
        this.visibility = visibility;
        this.submission = submission;
        this.reviewService = reviewService;
        this.schemaManager = schemaManager;
        this.valueManager = valueManager;
        this.stepSectionManager = stepSectionManager;
        this.selectOptionsManager = selectOptionsManager;
        // Re-initialize form when schema resolves
        effect(() => {
            const s = this.schemaManager.resolvedSchema();
            if (s) {
                this.stepSectionManager.activeStepIndex.set(0);
                this.stepSectionManager.isReviewed.set(false);
                this.form = buildFormGroup(s.fields, this.initialValue);
                this.valueManager.patchInitialValue(this.form, s, this.initialValue);
                this.visibility.setupVisibility(this.form, s, () => {
                    if (this.stepSectionManager.isReviewed()) {
                        this.stepSectionManager.isReviewed.set(false);
                        this.cdr.detectChanges();
                    }
                });
                this.selectOptionsManager.preloadApiSelectOptions(this.form);
                this.selectOptionsManager.setupCascadingSelects(this.form);
            }
            else {
                this.form = null;
            }
        });
    }
    ngOnChanges(changes) {
        if (changes["schema"] || changes["formId"]) {
            this.schemaManager.init(this.formId, this.schema);
        }
        if (changes["initialValue"] && this.resolvedSchema) {
            this.form = buildFormGroup(this.resolvedSchema.fields, this.initialValue);
            this.valueManager.patchInitialValue(this.form, this.resolvedSchema, this.initialValue);
        }
    }
    ngOnDestroy() {
        this.visibility.cleanup();
        this.selectOptionsManager.cleanup();
    }
    // View Helpers Delegations
    get isLoading() { return this.schemaManager.isLoading(); }
    get loadError() { return this.schemaManager.loadError(); }
    get resolvedSchema() { return this.schemaManager.resolvedSchema(); }
    get isMultiStep() { return this.stepSectionManager.isMultiStep(); }
    get totalSteps() { return this.stepSectionManager.totalSteps(); }
    get orderedSteps() { return this.stepSectionManager.orderedSteps(); }
    get activeStepIndex() { return this.stepSectionManager.activeStepIndex(); }
    get isSectional() { return this.stepSectionManager.isSectional(); }
    get orderedSections() { return this.stepSectionManager.orderedSections(); }
    get isReviewed() { return this.stepSectionManager.isReviewed(); }
    get selectState() { return this.selectOptionsManager.selectState(); }
    get visibleFields() {
        return this.stepSectionManager.visibleFields();
    }
    fieldsForStep(index) {
        return this.stepSectionManager.fieldsForStep(index);
    }
    fieldsForSection(sectionId) {
        return this.stepSectionManager.fieldsForSection(sectionId);
    }
    setActiveStep(i) {
        this.stepSectionManager.setActiveStep(i, this.form);
    }
    prevStep() {
        this.stepSectionManager.prevStep(this.form);
    }
    nextStep() {
        this.stepSectionManager.nextStep(this.form);
    }
    trackByFieldId = (_, field) => field?.id ?? field?.name ?? _;
    getFormStyle() {
        const sp = this.resolvedSchema?.spacing ?? {};
        const st = this.resolvedSchema?.style ?? {};
        return {
            marginTop: this.px(sp.marginTop),
            marginRight: this.px(sp.marginRight),
            marginBottom: this.px(sp.marginBottom),
            marginLeft: this.px(sp.marginLeft),
            paddingTop: this.px(sp.paddingTop),
            paddingRight: this.px(sp.paddingRight),
            paddingBottom: this.px(sp.paddingBottom),
            paddingLeft: this.px(sp.paddingLeft),
            backgroundColor: st.backgroundColor ?? null,
            color: st.textColor ?? null,
            borderStyle: st.borderWidth ? "solid" : null,
            borderWidth: st.borderWidth ? this.px(st.borderWidth) : null,
            borderColor: st.borderColor ?? null,
            borderRadius: st.borderRadius ? this.px(st.borderRadius) : null,
        };
    }
    px(v) {
        if (v === undefined || v === null)
            return null;
        const n = Number(v);
        return Number.isFinite(n) ? `${n}px` : null;
    }
    async submit(triggerField) {
        this.submitFeedback = undefined;
        const formValue = this.valueManager.normalizeFormValue(this.form, this.resolvedSchema);
        await this.submission.submit(this.form, this.resolvedSchema, formValue, {
            triggerField,
            submitPathParams: this.submitPathParams,
            submitQueryParams: this.submitQueryParams,
            onStateChange: (state) => {
                this.isSubmitting = state.isSubmitting;
                if (state.feedback)
                    this.submitFeedback = state.feedback;
                this.cdr.detectChanges();
            },
            onSuccess: (res) => this.submitted.emit(res),
            onError: (err) => this.submitFailed.emit(err)
        });
    }
    onSchemaButtonClick(field) {
        const btn = field?.button;
        if (btn?.styleVariant === 'link' && btn?.href) {
            window.open(btn.href, '_blank');
            return;
        }
        const endpoint = btn?.api;
        if (!btn || (btn.actionType === "API_CALL" && !endpoint?.url))
            return;
        const triggerValidation = btn.triggerValidation !== false;
        if (triggerValidation) {
            const scope = this.isMultiStep
                ? this.visibleFields
                : (this.resolvedSchema?.fields ?? []);
            const inputs = scope.filter((f) => this.isNonInput(f) === false);
            this.stepSectionManager.touchFields(inputs, this.form);
            if (this.stepSectionManager.hasErrors(inputs, this.form))
                return;
        }
        const formValue = this.valueManager.normalizeFormValue(this.form, this.resolvedSchema);
        this.buttonLoading[field.id] = true;
        delete this.buttonFeedback[field.id];
        this.apiExec
            .execute(endpoint, { formValue })
            .pipe(finalize(() => (this.buttonLoading[field.id] = false)))
            .subscribe({
            next: (res) => {
                this.buttonFeedback[field.id] = {
                    type: "success",
                    message: btn.successMessage || "Action completed successfully.",
                };
                this.submitted.emit({
                    url: endpoint.url,
                    method: endpoint.method || 'POST',
                    payload: formValue,
                    headers: endpoint.headers || [],
                    params: endpoint.queryParams || [],
                    response: res,
                });
            },
            error: (err) => {
                this.buttonFeedback[field.id] = {
                    type: "error",
                    message: btn.errorMessage || err?.error?.message || err?.message || "Action failed.",
                };
            },
        });
    }
    onFileChange(evt, field) {
        const input = evt.target;
        const files = input?.files ? Array.from(input.files) : [];
        const c = this.form?.get(field.name ?? field.id);
        if (!c)
            return;
        let normalized = field.multiple ? files : files.slice(0, 1);
        if (typeof field.maxFiles === "number" && field.maxFiles > 0) {
            normalized = normalized.slice(0, field.maxFiles);
        }
        c.setValue(field.multiple ? normalized : (normalized[0] ?? null));
        c.markAsTouched();
        c.updateValueAndValidity();
    }
    clearFiles(field, inputEl) {
        const c = this.form?.get(field.name ?? field.id);
        if (!c)
            return;
        c.setValue(null);
        c.markAsTouched();
        c.updateValueAndValidity();
        if (inputEl)
            inputEl.value = "";
    }
    openReviewDialog() {
        const fields = this.fieldsForStep(this.activeStepIndex);
        this.stepSectionManager.touchFields(fields, this.form);
        if (this.stepSectionManager.hasErrors(fields, this.form))
            return;
        this.dialog.open(this.reviewDialogTemplate, {
            width: '800px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            disableClose: true,
            panelClass: 'amigo-review-dialog'
        });
    }
    closeReviewDialog() {
        this.dialog.closeAll();
    }
    confirmReview() {
        this.stepSectionManager.isReviewed.set(true);
        this.dialog.closeAll();
    }
    get reviewData() {
        return this.reviewService.generateReviewData(this.form, this.resolvedSchema, this.isMultiStep, this.orderedSteps, this.selectState);
    }
    isNonInput(field) {
        const t = field?.type;
        return t === "card" || t === "info-card" || t === "button";
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoFormComponent, deps: [{ token: i0.ChangeDetectorRef }, { token: i1$2.MatDialog }, { token: AmigoApiExecutionService }, { token: FormVisibilityService }, { token: FormSubmissionService }, { token: FormReviewService }, { token: FormSchemaManagerService }, { token: FormValueManagerService }, { token: FormStepSectionManagerService }, { token: FormSelectOptionsManagerService }], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "21.1.5", type: AmigoFormComponent, isStandalone: true, selector: "amigo-form", inputs: { formId: "formId", schema: "schema", initialValue: "initialValue", submitPathParams: "submitPathParams", submitQueryParams: "submitQueryParams", isSubmitting: "isSubmitting" }, outputs: { submitted: "submitted", submitFailed: "submitFailed" }, viewQueries: [{ propertyName: "reviewDialogTemplate", first: true, predicate: ["reviewDialogTemplate"], descendants: true }], usesOnChanges: true, ngImport: i0, template: "<div class=\"w-full h-full flex flex-col mb-6 overflow-auto\">\n  <div\n    *ngIf=\"isLoading\"\n    class=\"flex items-center justify-center p-6 text-sm text-gray-600\"\n  >\n    Loading form\u2026\n  </div>\n\n  <div\n    *ngIf=\"loadError\"\n    class=\"p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\"\n  >\n    {{ loadError }}\n  </div>\n\n  <div\n    *ngIf=\"\n      !isLoading &&\n      !loadError &&\n      (!resolvedSchema?.fields || resolvedSchema.fields.length === 0)\n    \"\n    class=\"flex justify-center items-center h-100 border border-dotted border-gray-300 rounded-xl bg-white\"\n  >\n    <h2 class=\"text-sm text-gray-600\">No fields found for this form schema.</h2>\n  </div>\n\n  <form\n    *ngIf=\"!isLoading && !loadError && resolvedSchema?.fields?.length && form\"\n    [formGroup]=\"form\"\n    class=\"text-sm\"\n    [ngStyle]=\"getFormStyle()\"\n    [ngClass]=\"resolvedSchema?.style?.formClass || ''\"\n    (ngSubmit)=\"submit()\"\n  >\n    <h2 class=\"text-2xl my-2\">{{ resolvedSchema.name }}</h2>\n\n    <p\n      *ngIf=\"resolvedSchema.description\"\n      class=\"text-[13px] text-gray-500 mb-4\"\n    >\n      {{ resolvedSchema.description }}\n    </p>\n\n    <amigo-stepper\n      *ngIf=\"isMultiStep\"\n      [orderedSteps]=\"orderedSteps\"\n      [activeStepIndex]=\"activeStepIndex\"\n      [totalSteps]=\"totalSteps\"\n      [visibleFieldsCount]=\"visibleFields.length\"\n      (stepChanged)=\"setActiveStep($event)\"\n    ></amigo-stepper>\n\n    <div *ngIf=\"isSectional; else normalOrMulti\">\n      <div *ngFor=\"let sec of orderedSections\" class=\"mb-6 bg-white border border-gray-200 rounded-lg p-5 shadow-sm\">\n        <div\n          class=\"flex items-center justify-between mb-4 border-b border-gray-100 pb-3\"\n        >\n          <h3 class=\"text-sm font-semibold text-gray-800\">\n            {{ sec.label }}\n          </h3>\n          <span\n            class=\"text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded\"\n            *ngIf=\"fieldsForSection(sec.id) as fields\"\n          >\n            {{ fields.length }} {{ fields.length === 1 ? \"field\" : \"fields\" }}\n          </span>\n        </div>\n\n        <div\n          class=\"grid\"\n          [ngStyle]=\"{\n            'grid-template-columns':\n              'repeat(' +\n              (resolvedSchema.layout?.columns || 1) +\n              ', minmax(0, 1fr))',\n            'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\n            'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px',\n          }\"\n        >\n          <div\n            *ngFor=\"\n              let field of fieldsForSection(sec.id);\n              trackBy: trackByFieldId\n            \"\n            [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\n            [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\"\n          >\n            <ng-container\n              *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"\n            ></ng-container>\n          </div>\n        </div>\n\n        <div\n          *ngIf=\"fieldsForSection(sec.id).length === 0\"\n          class=\"text-xs text-gray-400 mt-2 italic\"\n        >\n          No fields in this section yet.\n        </div>\n      </div>\n    </div>\n\n    <ng-template #normalOrMulti>\n      <div\n        class=\"grid\"\n        [ngStyle]=\"{\n          'grid-template-columns':\n            'repeat(' +\n            (resolvedSchema.layout?.columns || 1) +\n            ', minmax(0, 1fr))',\n          'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\n          'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px',\n        }\"\n      >\n        <div\n          *ngFor=\"let field of visibleFields; trackBy: trackByFieldId\"\n          [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\n          [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\"\n        >\n          <ng-container\n            *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"\n          ></ng-container>\n        </div>\n      </div>\n    </ng-template>\n\n    <div\n      *ngIf=\"isMultiStep\"\n      class=\"mt-4 flex items-center justify-between text-xs w-full\"\n    >\n      <!-- Previous Step Button / Placeholder -->\n      <button\n        *ngIf=\"activeStepIndex > 0\"\n        type=\"button\"\n        class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\n        (click)=\"prevStep()\"\n      >\n        \u2190 Previous step\n      </button>\n      <div *ngIf=\"activeStepIndex === 0\"></div>\n\n      <!-- Next Step Button -->\n      <button\n        *ngIf=\"activeStepIndex < totalSteps - 1\"\n        type=\"button\"\n        class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\n        (click)=\"nextStep()\"\n      >\n        Next step \u2192\n      </button>\n\n      <!-- Review Button -->\n      <button\n        *ngIf=\"activeStepIndex === totalSteps - 1 && !isReviewed\"\n        type=\"button\"\n        class=\"px-3 py-1 border border-blue-600 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50\"\n        (click)=\"openReviewDialog()\"\n      >\n        Review Details\n      </button>\n    </div>\n\n    <div\n      *ngIf=\"submitFeedback\"\n      class=\"mt-3 p-3 rounded border text-sm\"\n      [ngClass]=\"\n        submitFeedback.type === 'success'\n          ? 'border-green-200 bg-green-50 text-green-700'\n          : 'border-red-200 bg-red-50 text-red-700'\n      \"\n    >\n      {{ submitFeedback.message }}\n    </div>\n\n    <ng-template #fieldRenderer let-field>\n      <amigo-field-renderer\n        [field]=\"field\"\n        [form]=\"form\"\n        [resolvedSchema]=\"resolvedSchema\"\n        [isSubmitting]=\"isSubmitting\"\n        [buttonLoading]=\"buttonLoading\"\n        [buttonFeedback]=\"buttonFeedback\"\n        [selectState]=\"selectState\"\n        (buttonClick)=\"onSchemaButtonClick($event)\"\n        (fileChange)=\"onFileChange($event.evt, $event.field)\"\n        (clearFile)=\"clearFiles($event.field, $event.inputEl)\"\n      ></amigo-field-renderer>\n    </ng-template>\n  </form>\n</div>\n\n<ng-template #reviewDialogTemplate>\n  <amigo-review-dialog\n    [reviewData]=\"reviewData\"\n    (close)=\"closeReviewDialog()\"\n    (confirm)=\"confirmReview()\"\n  ></amigo-review-dialog>\n</ng-template>\n", styles: [".amigo-loading{padding:12px;opacity:.85}.amigo-error{padding:12px;border:1px solid #ef4444;border-radius:8px;color:#ef4444}.amigo-form-root{width:100%;box-sizing:border-box}.amigo-header{margin-bottom:12px}.amigo-title{font-size:18px;font-weight:700}.amigo-desc{margin-top:4px;opacity:.8}.amigo-grid{width:100%}.amigo-field{display:block}.amigo-label{display:block;font-size:13px;margin-bottom:6px;font-weight:600}.amigo-required{color:#ef4444;margin-left:4px}.amigo-input{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:14px}.amigo-hint{margin-top:6px;font-size:12px;opacity:.75}.amigo-field-error{margin-top:6px;font-size:12px;color:#ef4444}.amigo-checkbox{display:flex;align-items:center;gap:8px}.amigo-radio{display:flex;flex-direction:column;gap:6px}.amigo-radio-item{display:inline-flex;align-items:center;gap:8px}.amigo-section{margin-bottom:18px}.amigo-section-title{font-weight:700;margin-bottom:10px}.amigo-actions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.amigo-btn{padding:8px 12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer}.amigo-primary{border-color:#111827;background:#111827;color:#fff}\n"], dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgClass, selector: "[ngClass]", inputs: ["class", "ngClass"] }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i1.NgTemplateOutlet, selector: "[ngTemplateOutlet]", inputs: ["ngTemplateOutletContext", "ngTemplateOutlet", "ngTemplateOutletInjector"] }, { kind: "directive", type: i1.NgStyle, selector: "[ngStyle]", inputs: ["ngStyle"] }, { kind: "ngmodule", type: ReactiveFormsModule }, { kind: "directive", type: i2.ɵNgNoValidate, selector: "form:not([ngNoForm]):not([ngNativeValidate])" }, { kind: "directive", type: i2.NgControlStatusGroup, selector: "[formGroupName],[formArrayName],[ngModelGroup],[formGroup],[formArray],form:not([ngNoForm]),[ngForm]" }, { kind: "directive", type: i2.FormGroupDirective, selector: "[formGroup]", inputs: ["formGroup"], outputs: ["ngSubmit"], exportAs: ["ngForm"] }, { kind: "ngmodule", type: MatDialogModule }, { kind: "component", type: AmigoStepperComponent, selector: "amigo-stepper", inputs: ["orderedSteps", "activeStepIndex", "totalSteps", "visibleFieldsCount"], outputs: ["stepChanged"] }, { kind: "component", type: AmigoFieldRendererComponent, selector: "amigo-field-renderer", inputs: ["field", "form", "resolvedSchema", "isSubmitting", "buttonLoading", "buttonFeedback", "selectState"], outputs: ["buttonClick", "fileChange", "clearFile"] }, { kind: "component", type: AmigoReviewDialogComponent, selector: "amigo-review-dialog", inputs: ["reviewData"], outputs: ["close", "confirm"] }] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.1.5", ngImport: i0, type: AmigoFormComponent, decorators: [{
            type: Component,
            args: [{ selector: "amigo-form", standalone: true, imports: [
                        CommonModule,
                        ReactiveFormsModule,
                        MatDialogModule,
                        AmigoStepperComponent,
                        AmigoFieldRendererComponent,
                        AmigoReviewDialogComponent
                    ], template: "<div class=\"w-full h-full flex flex-col mb-6 overflow-auto\">\n  <div\n    *ngIf=\"isLoading\"\n    class=\"flex items-center justify-center p-6 text-sm text-gray-600\"\n  >\n    Loading form\u2026\n  </div>\n\n  <div\n    *ngIf=\"loadError\"\n    class=\"p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm\"\n  >\n    {{ loadError }}\n  </div>\n\n  <div\n    *ngIf=\"\n      !isLoading &&\n      !loadError &&\n      (!resolvedSchema?.fields || resolvedSchema.fields.length === 0)\n    \"\n    class=\"flex justify-center items-center h-100 border border-dotted border-gray-300 rounded-xl bg-white\"\n  >\n    <h2 class=\"text-sm text-gray-600\">No fields found for this form schema.</h2>\n  </div>\n\n  <form\n    *ngIf=\"!isLoading && !loadError && resolvedSchema?.fields?.length && form\"\n    [formGroup]=\"form\"\n    class=\"text-sm\"\n    [ngStyle]=\"getFormStyle()\"\n    [ngClass]=\"resolvedSchema?.style?.formClass || ''\"\n    (ngSubmit)=\"submit()\"\n  >\n    <h2 class=\"text-2xl my-2\">{{ resolvedSchema.name }}</h2>\n\n    <p\n      *ngIf=\"resolvedSchema.description\"\n      class=\"text-[13px] text-gray-500 mb-4\"\n    >\n      {{ resolvedSchema.description }}\n    </p>\n\n    <amigo-stepper\n      *ngIf=\"isMultiStep\"\n      [orderedSteps]=\"orderedSteps\"\n      [activeStepIndex]=\"activeStepIndex\"\n      [totalSteps]=\"totalSteps\"\n      [visibleFieldsCount]=\"visibleFields.length\"\n      (stepChanged)=\"setActiveStep($event)\"\n    ></amigo-stepper>\n\n    <div *ngIf=\"isSectional; else normalOrMulti\">\n      <div *ngFor=\"let sec of orderedSections\" class=\"mb-6 bg-white border border-gray-200 rounded-lg p-5 shadow-sm\">\n        <div\n          class=\"flex items-center justify-between mb-4 border-b border-gray-100 pb-3\"\n        >\n          <h3 class=\"text-sm font-semibold text-gray-800\">\n            {{ sec.label }}\n          </h3>\n          <span\n            class=\"text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded\"\n            *ngIf=\"fieldsForSection(sec.id) as fields\"\n          >\n            {{ fields.length }} {{ fields.length === 1 ? \"field\" : \"fields\" }}\n          </span>\n        </div>\n\n        <div\n          class=\"grid\"\n          [ngStyle]=\"{\n            'grid-template-columns':\n              'repeat(' +\n              (resolvedSchema.layout?.columns || 1) +\n              ', minmax(0, 1fr))',\n            'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\n            'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px',\n          }\"\n        >\n          <div\n            *ngFor=\"\n              let field of fieldsForSection(sec.id);\n              trackBy: trackByFieldId\n            \"\n            [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\n            [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\"\n          >\n            <ng-container\n              *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"\n            ></ng-container>\n          </div>\n        </div>\n\n        <div\n          *ngIf=\"fieldsForSection(sec.id).length === 0\"\n          class=\"text-xs text-gray-400 mt-2 italic\"\n        >\n          No fields in this section yet.\n        </div>\n      </div>\n    </div>\n\n    <ng-template #normalOrMulti>\n      <div\n        class=\"grid\"\n        [ngStyle]=\"{\n          'grid-template-columns':\n            'repeat(' +\n            (resolvedSchema.layout?.columns || 1) +\n            ', minmax(0, 1fr))',\n          'column-gap': (resolvedSchema.spacing?.gapX ?? 12) + 'px',\n          'row-gap': (resolvedSchema.spacing?.gapY ?? 12) + 'px',\n        }\"\n      >\n        <div\n          *ngFor=\"let field of visibleFields; trackBy: trackByFieldId\"\n          [ngStyle]=\"{ 'grid-column': 'span ' + (field.colSpan || 1) }\"\n          [ngClass]=\"resolvedSchema.style?.fieldWrapperClass || 'mb-3'\"\n        >\n          <ng-container\n            *ngTemplateOutlet=\"fieldRenderer; context: { $implicit: field }\"\n          ></ng-container>\n        </div>\n      </div>\n    </ng-template>\n\n    <div\n      *ngIf=\"isMultiStep\"\n      class=\"mt-4 flex items-center justify-between text-xs w-full\"\n    >\n      <!-- Previous Step Button / Placeholder -->\n      <button\n        *ngIf=\"activeStepIndex > 0\"\n        type=\"button\"\n        class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\n        (click)=\"prevStep()\"\n      >\n        \u2190 Previous step\n      </button>\n      <div *ngIf=\"activeStepIndex === 0\"></div>\n\n      <!-- Next Step Button -->\n      <button\n        *ngIf=\"activeStepIndex < totalSteps - 1\"\n        type=\"button\"\n        class=\"px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50\"\n        (click)=\"nextStep()\"\n      >\n        Next step \u2192\n      </button>\n\n      <!-- Review Button -->\n      <button\n        *ngIf=\"activeStepIndex === totalSteps - 1 && !isReviewed\"\n        type=\"button\"\n        class=\"px-3 py-1 border border-blue-600 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50\"\n        (click)=\"openReviewDialog()\"\n      >\n        Review Details\n      </button>\n    </div>\n\n    <div\n      *ngIf=\"submitFeedback\"\n      class=\"mt-3 p-3 rounded border text-sm\"\n      [ngClass]=\"\n        submitFeedback.type === 'success'\n          ? 'border-green-200 bg-green-50 text-green-700'\n          : 'border-red-200 bg-red-50 text-red-700'\n      \"\n    >\n      {{ submitFeedback.message }}\n    </div>\n\n    <ng-template #fieldRenderer let-field>\n      <amigo-field-renderer\n        [field]=\"field\"\n        [form]=\"form\"\n        [resolvedSchema]=\"resolvedSchema\"\n        [isSubmitting]=\"isSubmitting\"\n        [buttonLoading]=\"buttonLoading\"\n        [buttonFeedback]=\"buttonFeedback\"\n        [selectState]=\"selectState\"\n        (buttonClick)=\"onSchemaButtonClick($event)\"\n        (fileChange)=\"onFileChange($event.evt, $event.field)\"\n        (clearFile)=\"clearFiles($event.field, $event.inputEl)\"\n      ></amigo-field-renderer>\n    </ng-template>\n  </form>\n</div>\n\n<ng-template #reviewDialogTemplate>\n  <amigo-review-dialog\n    [reviewData]=\"reviewData\"\n    (close)=\"closeReviewDialog()\"\n    (confirm)=\"confirmReview()\"\n  ></amigo-review-dialog>\n</ng-template>\n", styles: [".amigo-loading{padding:12px;opacity:.85}.amigo-error{padding:12px;border:1px solid #ef4444;border-radius:8px;color:#ef4444}.amigo-form-root{width:100%;box-sizing:border-box}.amigo-header{margin-bottom:12px}.amigo-title{font-size:18px;font-weight:700}.amigo-desc{margin-top:4px;opacity:.8}.amigo-grid{width:100%}.amigo-field{display:block}.amigo-label{display:block;font-size:13px;margin-bottom:6px;font-weight:600}.amigo-required{color:#ef4444;margin-left:4px}.amigo-input{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:14px}.amigo-hint{margin-top:6px;font-size:12px;opacity:.75}.amigo-field-error{margin-top:6px;font-size:12px;color:#ef4444}.amigo-checkbox{display:flex;align-items:center;gap:8px}.amigo-radio{display:flex;flex-direction:column;gap:6px}.amigo-radio-item{display:inline-flex;align-items:center;gap:8px}.amigo-section{margin-bottom:18px}.amigo-section-title{font-weight:700;margin-bottom:10px}.amigo-actions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.amigo-btn{padding:8px 12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer}.amigo-primary{border-color:#111827;background:#111827;color:#fff}\n"] }]
        }], ctorParameters: () => [{ type: i0.ChangeDetectorRef }, { type: i1$2.MatDialog }, { type: AmigoApiExecutionService }, { type: FormVisibilityService }, { type: FormSubmissionService }, { type: FormReviewService }, { type: FormSchemaManagerService }, { type: FormValueManagerService }, { type: FormStepSectionManagerService }, { type: FormSelectOptionsManagerService }], propDecorators: { formId: [{
                type: Input
            }], schema: [{
                type: Input
            }], initialValue: [{
                type: Input
            }], submitPathParams: [{
                type: Input
            }], submitQueryParams: [{
                type: Input
            }], submitted: [{
                type: Output
            }], submitFailed: [{
                type: Output
            }], isSubmitting: [{
                type: Input
            }], reviewDialogTemplate: [{
                type: ViewChild,
                args: ['reviewDialogTemplate']
            }] } });

/**
 * Generated bundle index. Do not edit.
 */

export { AMIGO_AUTH_TOKEN_PROVIDER, AMIGO_FORM_CONFIG, AmigoFormComponent, AmigoFormService, AmigoTokenInterceptor, buildFormGroup, normalizeAccept, provideAmigoForm };
//# sourceMappingURL=amigo-amigo-form-renderer.mjs.map
