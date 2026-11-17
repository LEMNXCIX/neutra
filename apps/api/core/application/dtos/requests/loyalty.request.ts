/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
import { MAX_LOYALTY_PRISMA_INT } from "@/core/domain/loyalty/loyalty.policy";
import type { CouponType } from "@/core/entities/coupon.entity";
import {
    LoyaltyCampaignAction,
    type LoyaltyCampaignMetric,
    type LoyaltyCampaignSource,
} from "@/core/entities/loyalty.entity";

export interface LoyaltyRewardDefinitionDTO {
    type: CouponType;
    value: number;
    description?: string | null;
    minPurchaseAmount?: number | null;
    maxDiscountAmount?: number | null;
    applicableProducts?: string[];
    applicableCategories?: string[];
    applicableServices?: string[];
}

export type LoyaltyRewardDefinitionDto =
    import("@neutra/commons").LoyaltyRewardDefinitionDto;

export interface CreateLoyaltyCampaignDTO {
    name: string;
    description?: string | null;
    source: LoyaltyCampaignSource;
    metric: LoyaltyCampaignMetric;
    targetValue: string;
    startsAt: Date | string;
    endsAt: Date | string;
    claimUntil: Date | string;
    reward: LoyaltyRewardDefinitionDTO;
    rewardValidDays: number;
    maxClaims?: number | null;
}

export type CreateLoyaltyCampaignDto =
    import("@neutra/commons").CreateLoyaltyCampaignDto;

export interface UpdateLoyaltyCampaignDTO {
    name?: string;
    description?: string | null;
    source?: LoyaltyCampaignSource;
    metric?: LoyaltyCampaignMetric;
    targetValue?: string;
    startsAt?: Date | string;
    endsAt?: Date | string;
    claimUntil?: Date | string;
    reward?: LoyaltyRewardDefinitionDTO;
    rewardValidDays?: number;
    maxClaims?: number | null;
}

export type UpdateLoyaltyCampaignDto =
    import("@neutra/commons").UpdateLoyaltyCampaignDto;

export const LoyaltyCampaignLifecycleAction = LoyaltyCampaignAction;
export type LoyaltyCampaignLifecycleAction = LoyaltyCampaignAction;

export interface LoyaltyCampaignLifecycleDTO {
    action:
        | LoyaltyCampaignLifecycleAction
        | "activate"
        | "end"
        | "archive"
        | "delete";
}

export type LoyaltyCampaignLifecycleDto =
    import("@neutra/commons").LoyaltyCampaignLifecycleDto;

export type CreateLoyaltyCampaignRequest = CreateLoyaltyCampaignDTO;
export type UpdateLoyaltyCampaignRequest = UpdateLoyaltyCampaignDTO;
export type LoyaltyCampaignRewardDefinition = LoyaltyRewardDefinitionDTO;
export type LoyaltyCampaignRewardDTO = LoyaltyRewardDefinitionDTO;
export type CreateCampaignDTO = CreateLoyaltyCampaignDTO;
export type UpdateCampaignDTO = UpdateLoyaltyCampaignDTO;
