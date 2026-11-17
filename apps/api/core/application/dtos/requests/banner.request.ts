/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
export interface CreateBannerDTO {
    title: string;
    subtitle?: string;
    description?: string;
    imageUrl?: string;
    backgroundColor?: string;
    textColor?: string;
    cta?: string;
    ctaUrl?: string;
    priority?: number;
    active?: boolean;
    startsAt: Date | string;
    endsAt: Date | string;
}

export interface UpdateBannerDTO {
    title?: string;
    subtitle?: string;
    description?: string;
    imageUrl?: string;
    backgroundColor?: string;
    textColor?: string;
    cta?: string;
    ctaUrl?: string;
    priority?: number;
    active?: boolean;
    startsAt?: Date | string;
    endsAt?: Date | string;
}

/**
 * The twelve columns `PrismaBannerRepository.create` copies, in the same order
 * as `BannerCreateData`. `tenantId` is not among them: the repository takes the
 * tenant from its first argument, so a `tenantId` in the body is not what scopes
 * a banner.
 */
export type CreateBannerDto = import("@neutra/commons").CreateBannerDto;

/** The same twelve, all optional: the repository's update allowlist. */
export type UpdateBannerDto = import("@neutra/commons").UpdateBannerDto;
