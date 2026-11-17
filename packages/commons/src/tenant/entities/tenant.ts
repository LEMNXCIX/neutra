import type { TenantType } from "../../enums/tenant.js";
import type { WorkingHours } from "../../booking/working-hours.js";

export interface TenantConfig {
  branding?: {
    primaryColor?: string;
    tenantLogo?: string;
    favicon?: string;
  };
  settings?: {
    supportEmail?: string;
    websiteUrl?: string;
    currency?: string;
    language?: string;
    timezone?: string;
    businessHours?: WorkingHours;
    holidays?: string[]; // "YYYY-MM-DD"
  };
  features?: Record<string, boolean>;
}

/**
 * Tenant behaviour lives in the API's tenant policy; an entity module holds
 * types only. Read a tenant's type with `isBookingType` / `isStoreType` there.
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  type: TenantType;
  config?: TenantConfig;
  active: boolean;
  createdById?: string | null; // null = creator unknown
  createdAt: Date;
  updatedAt: Date;
}
