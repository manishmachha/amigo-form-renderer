import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { AMIGO_FORM_CONFIG, AmigoFormConfig } from './config';
import { ApiEndpointConfig, FormActionSchema, FormSchema, HttpMethod } from './models';
import { AmigoApiExecutionService } from './amigo-api-execution.service';

@Injectable({ providedIn: 'root' })
export class AmigoFormService {
  constructor(
    private http: HttpClient,
    private apiExec: AmigoApiExecutionService,
    @Inject(AMIGO_FORM_CONFIG) private cfg: AmigoFormConfig
  ) {}

  getFormSchemaById(id: string): Observable<FormSchema> {
    const pathBuilder = this.cfg.endpoints?.getFormById;
    const url = pathBuilder ? `${this.cfg.apiBaseUrl}${pathBuilder(id)}` : `${this.cfg.apiBaseUrl}/${id}`;
    return this.http.get<FormSchema>(url);
  }

  submitByAction(action: FormActionSchema, payload: Record<string, any>): Observable<any> {
    const api = (action as any)?.submitApi?.api as ApiEndpointConfig | undefined;

    const endpoint: ApiEndpointConfig | null =
      api?.url
        ? api
        : action?.submitApiUrl
        ? {
            method: ((action.method || 'POST') as string).toUpperCase() as HttpMethod,
            url: action.submitApiUrl,
            headers: [],
            queryParams: [],
          }
        : null;

    if (!endpoint?.url) {
      return throwError(() => new Error('No submit API configuration found'));
    }

    return this.apiExec.execute(endpoint, {
      formValue: payload,
      payloadKey: action.payloadKey || undefined,
      contentType: (action.contentType as any) || 'auto',
    });
  }
}
