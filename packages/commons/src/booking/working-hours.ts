// Shared working-hours types. Ported from the API domain so the tenant entity
// no longer needs the `@/` alias (commons must stay isomorphic).
export interface TimeRange {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export type WorkingHours = { [day: string]: TimeRange | TimeRange[] | null };
