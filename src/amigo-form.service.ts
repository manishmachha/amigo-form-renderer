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


}
