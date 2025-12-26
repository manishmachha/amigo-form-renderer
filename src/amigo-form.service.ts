import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AMIGO_FORM_CONFIG, AmigoFormConfig } from './config';
import { FormSchema } from './models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AmigoFormService {
  constructor(
    private http: HttpClient,
    @Inject(AMIGO_FORM_CONFIG) private cfg: AmigoFormConfig
  ) {}

  getFormSchemaById(id: string): Observable<FormSchema> {
    const pathBuilder = this.cfg.endpoints?.getFormById;
    const url = pathBuilder
      ? `${this.cfg.apiBaseUrl}${pathBuilder(id)}`
      : `${this.cfg.apiBaseUrl}/${id}`;

    return this.http.get<any>(url);
  }
}
