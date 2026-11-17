/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
import type { CouponType } from "@/core/entities/coupon.entity";

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
}

export interface ValidateCouponDTO {
    code: string;
    orderTotal: number;
    productIds?: string[];
    categoryIds?: string[];
    serviceIds?: string[];
}

/**
 * The twelve fields of `CreateCouponData`, which is what
 * `PrismaCouponRepository.create` actually copies. The three applicability
 * lists are the coupon's own reach: a coupon created with an
 * `applicableServices` list is how the booking flow gets a service discount,
 * so they are part of this body rather than an afterthought.
 */
export type CreateCouponDto = import("@neutra/commons").CreateCouponDto;

/**
 * Eleven fields, not twelve: `PrismaCouponRepository.update` has no
 * `applicableServices` branch, so a create-only list must not look writable
 * here. Mirroring the repository rather than `CreateCouponDTO` is the point.
 */
export type UpdateCouponDto = import("@neutra/commons").UpdateCouponDto;

/** The body of `POST /api/coupons/validate`, read by `ValidateCouponUseCase`. */
export type ValidateCouponDto = import("@neutra/commons").ValidateCouponDto;
