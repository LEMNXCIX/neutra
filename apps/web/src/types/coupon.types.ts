// Wire enum owned by @neutra/commons.
import { CouponType } from "@neutra/commons";
export { CouponType };

// The Coupon entity below is a front-only projection: the UI reads `tenant`
// and `tenantId`, which the shared wire contract does not carry.
export interface Coupon {
    id: string;
    code: string;
    type: CouponType;
    value: number;
    description?: string;
    isReward?: boolean;
    ownerId?: string | null;
    sourceCouponId?: string;
    minPurchaseAmount?: number;
    maxDiscountAmount?: number;
    usageLimit?: number;
    usageCount: number;
    active: boolean;
    expiresAt: Date;
    applicableProducts: string[];
    applicableCategories: string[];
    applicableServices: string[];
    tenantId?: string;
    tenant?: { id: string; name: string; slug: string };
    createdAt: Date;
    updatedAt: Date;
}

// DTO names have no exact commons counterpart (commons uses
// `CreateCouponDto` / `UpdateCouponDto` / `ValidateCouponDto`).
export interface CreateCouponDTO {
    code: string;
    type: CouponType;
    value: number;
    description?: string;
    minPurchaseAmount?: number;
    maxDiscountAmount?: number;
    usageLimit?: number;
    active?: boolean;
    expiresAt: Date | string;
    applicableProducts?: string[];
    applicableCategories?: string[];
    applicableServices?: string[];
}

export interface UpdateCouponDTO {
    code?: string;
    type?: CouponType;
    value?: number;
    description?: string;
    minPurchaseAmount?: number;
    maxDiscountAmount?: number;
    usageLimit?: number;
    active?: boolean;
    expiresAt?: Date | string;
    applicableProducts?: string[];
    applicableCategories?: string[];
    applicableServices?: string[];
}

export interface ValidateCouponDTO {
    code: string;
    orderTotal: number;
    productIds?: string[];
    categoryIds?: string[];
    serviceIds?: string[];
}

// Front-only result shape: its `coupon` is the front `Coupon` above, while
// commons' `CouponValidationResult` carries the API response shape
// (`description: string | null`), which is not assignable to it.
export interface CouponValidationResult {
    valid: boolean;
    coupon?: Coupon;
    discountAmount?: number;
    message?: string;
}
