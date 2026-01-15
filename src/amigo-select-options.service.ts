import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { catchError, map, shareReplay } from "rxjs/operators";
import { AmigoApiExecutionService } from "./amigo-api-execution.service";
import { FormFieldOption, FormFieldSchema } from "./models";

@Injectable({ providedIn: "root" })
export class AmigoSelectOptionsService {
  private cache = new Map<string, Observable<FormFieldOption[]>>();

  constructor(private api: AmigoApiExecutionService) {}

  load(
    field: FormFieldSchema,
    formValue: Record<string, any>
  ): Observable<FormFieldOption[]> {
    const src = field.optionsSource;
    if (!src || src.mode !== "API" || !src.api) {
      return of(field.options ?? []);
    }

    const a = src.api;
    const key = `${field.id}::${a.method}::${a.url}::${
      a.responseMapping.dataPath || ""
    }::${a.responseMapping.labelKey}::${a.responseMapping.valueKey}`;

    const cached = this.cache.get(key);
    if (cached) return cached;

    const req = {
      method: a.method,
      url: a.url,
      headers: [], // keep open for future extensions
      queryParams: [], // keep open for future extensions
    };

    const obs = this.api
      .execute(req as any, {
        formValue,
        skipGlobalAuth: true, // IMPORTANT: don't attach token unless explicitly configured below
        bearerAuth: {
          secured: !!a.secured,
          authType: a.authType || "NONE",
          tokenFrom: a.tokenFrom || "LOCAL_STORAGE",
          tokenKey: a.tokenKey || "access_token",
        },
      })
      .pipe(
        map((res: any) => this.mapResponseToOptions(res, a.responseMapping)),
        catchError(() => of([])),
        shareReplay(1)
      );

    this.cache.set(key, obs);
    return obs;
  }

  private mapResponseToOptions(res: any, m: any): FormFieldOption[] {
    const list = m.dataPath ? this.getByPath(res, m.dataPath) : res;
    if (!Array.isArray(list)) return [];

    return list.map((item: any) => ({
      label: String(this.getByPath(item, m.labelKey) ?? ""),
      value: this.getByPath(item, m.valueKey),
    }));
  }

  private getByPath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    return path
      .split(".")
      .reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  }
}
