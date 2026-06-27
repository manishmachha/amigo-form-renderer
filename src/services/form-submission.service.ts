import { Injectable, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { AmigoApiExecutionService } from '../amigo-api-execution.service';
import { FormSchema, FormFieldSchema } from '../models';

export interface SubmitOptions {
  triggerField?: any;
  submitPathParams?: Record<string, any>;
  submitQueryParams?: Record<string, any>;
  submitHeaders?: Record<string, string>;
  submitAdditionalBody?: Record<string, any>;
  onStateChange: (state: { isSubmitting: boolean; feedback?: { type: 'success' | 'error', message: string } }) => void;
  onSuccess: (result: any) => void;
  onError: (error: any) => void;
}

@Injectable({
  providedIn: 'root'
})
export class FormSubmissionService {
  constructor(private apiExec: AmigoApiExecutionService) {}

  async submit(
    form: FormGroup | null,
    resolvedSchema: FormSchema | null | any,
    normalizedFormValue: Record<string, any>,
    options: SubmitOptions
  ): Promise<void> {
    if (!resolvedSchema || !form) return;

    options.onStateChange({ isSubmitting: false, feedback: undefined });

    let btnField = options.triggerField;
    if (!btnField && resolvedSchema.fields) {
      btnField = resolvedSchema.fields.find((f: any) => f.type === 'button' && f.button?.isSubmit);
    }

    const btn = btnField?.button;
    const triggerValidation = btn?.triggerValidation !== false;

    if (triggerValidation) {
      form.markAllAsTouched();
      if (form.invalid) return;
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
        additionalHeaders: options.submitHeaders,
        additionalBody: options.submitAdditionalBody,
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
              message:
                btn.errorMessage ||
                err?.error?.message ||
                err?.message ||
                "Failed to submit. Please try again.",
            }
          });
          options.onError(err);
        },
      });
  }

  private getCaptureLocation(): Promise<{ lat: string; long: string }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: "", long: "" });
        return;
      }

      const timer = setTimeout(() => {
        resolve({ lat: "", long: "" });
      }, 2000);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          resolve({
            lat: String(pos.coords.latitude),
            long: String(pos.coords.longitude),
          });
        },
        () => {
          clearTimeout(timer);
          resolve({ lat: "", long: "" });
        },
        { timeout: 2000, enableHighAccuracy: false },
      );
    });
  }
}
