import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { WorkflowIntegrationConfig } from '../models';

@Injectable({ providedIn: 'root' })
export class WorkflowRegistryService {
  constructor(private http: HttpClient) {}

  registerAfterThirdPartySubmit(
    config: WorkflowIntegrationConfig | undefined,
    thirdPartyResponse: unknown
  ): Observable<unknown> {
    if (!config?.registryUrl || !config.formId) {
      return of(null);
    }
    const externalId = this.resolveExternalId(thirdPartyResponse, config.externalSubmissionIdPath);
    if (!externalId) {
      console.warn('workflowIntegration: could not resolve external_submission_id from response');
      return of(null);
    }
    const body: Record<string, unknown> = {
      external_submission_id: externalId,
    };
    if (config.correlationId) body['correlation_id'] = config.correlationId;
    if (config.workflowInstanceId) body['workflow_instance_id'] = config.workflowInstanceId;
    if (config.actionKey) body['action_key'] = config.actionKey;
    return this.http.post(config.registryUrl, body).pipe(
      tap((res) => console.debug('workflow registry', res)),
      catchError((err) => {
        console.error('workflow registry failed', err);
        return of(null);
      })
    );
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
