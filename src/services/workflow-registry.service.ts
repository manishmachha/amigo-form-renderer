import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, Optional } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AMIGO_FORM_CONFIG, AmigoFormConfig } from '../config';
import { WorkflowIntegrationConfig } from '../models';

@Injectable({ providedIn: 'root' })
export class WorkflowRegistryService {
  constructor(
    private http: HttpClient,
    @Optional() @Inject(AMIGO_FORM_CONFIG) private readonly cfg: AmigoFormConfig | null,
  ) {}

  /** Notify Form Builder that this form was submitted (starts matching workflows). */
  registerAutomaticTrigger(formId: string | null | undefined): Observable<unknown> {
    if (!formId) {
      return of(null);
    }
    if (this.cfg?.autoWorkflowTrigger === false) {
      return of(null);
    }
    const base = (this.cfg?.apiBaseUrl ?? '/forms').replace(/\/$/, '');
    const url = `${base}/${formId}/submissions`;
    const body: Record<string, unknown> = {};
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      body['external_submission_id'] = crypto.randomUUID();
    }
    return this.http.post(url, body).pipe(
      tap((res) => console.debug('workflow auto-trigger registry', res)),
      catchError((err) => {
        console.error('workflow auto-trigger registry failed', err);
        return of(null);
      }),
    );
  }

  registerAfterThirdPartySubmit(
    config: WorkflowIntegrationConfig | undefined,
    thirdPartyResponse: unknown,
  ): Observable<unknown> {
    if (!config?.registryUrl || !config.formId) {
      return of(null);
    }
    const externalId = this.resolveExternalId(thirdPartyResponse, config.externalSubmissionIdPath);
    const body: Record<string, unknown> = {};
    if (externalId) {
      body['external_submission_id'] = externalId;
    }
    if (config.correlationId) body['correlation_id'] = config.correlationId;
    if (config.workflowInstanceId) body['workflow_instance_id'] = config.workflowInstanceId;
    if (config.actionKey) body['action_key'] = config.actionKey;
    return this.http.post(config.registryUrl, body).pipe(
      tap((res) => console.debug('workflow registry', res)),
      catchError((err) => {
        console.error('workflow registry failed', err);
        return of(null);
      }),
    );
  }

  notifyWorkflowAfterSubmit(
    formId: string | null | undefined,
    workflowIntegration: WorkflowIntegrationConfig | undefined,
    thirdPartyResponse?: unknown,
  ): Observable<unknown> {
    if (workflowIntegration?.registryUrl && workflowIntegration?.formId) {
      return this.registerAfterThirdPartySubmit(workflowIntegration, thirdPartyResponse ?? {});
    }
    return this.registerAutomaticTrigger(formId ?? workflowIntegration?.formId);
  }

  private resolveExternalId(response: unknown, path?: string): string | null {
    if (!path) {
      if (response && typeof response === 'object' && 'id' in (response as object)) {
        return String((response as { id: unknown }).id);
      }
      return null;
    }
    let cur: unknown = response;
    for (const segment of path.split('.')) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = (cur as Record<string, unknown>)[segment];
    }
    return cur != null ? String(cur) : null;
  }
}
