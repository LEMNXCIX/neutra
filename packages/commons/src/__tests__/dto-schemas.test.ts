import { describe, expect, it } from "bun:test";
import * as commons from "../index";
import { requestSchemaModules } from "../requests/index.js";
import { responseTypeModules } from "../responses/index.js";

/** All 59 validated request DTO classes found in the API source. */
const EXPECTED_REQUEST_SCHEMAS = [
  // appointment.query.ts
  "ListAppointmentsQueryDtoSchema",
  "AttentionAppointmentsQueryDtoSchema",
  "AvailabilityQueryDtoSchema",
  // appointment.request.ts
  "CreateAppointmentDtoSchema",
  "CancelAppointmentDtoSchema",
  "UpdateAppointmentStatusDtoSchema",
  // auth.request.ts
  "ForgotPasswordDtoSchema",
  "ResetPasswordDtoSchema",
  // banner.request.ts
  "CreateBannerDtoSchema",
  "UpdateBannerDtoSchema",
  // cart.request.ts
  "AddToCartDtoSchema",
  "RemoveFromCartDtoSchema",
  // category.request.ts
  "CreateCategoryDtoSchema",
  "UpdateCategoryDtoSchema",
  // coupon.request.ts
  "CreateCouponDtoSchema",
  "UpdateCouponDtoSchema",
  "ValidateCouponDtoSchema",
  // feature.request.ts
  "CreateFeatureDtoSchema",
  "UpdateFeatureDtoSchema",
  // list-query.dto.ts
  "PagedQueryDtoSchema",
  "PagedSearchQueryDtoSchema",
  "CategoryListQueryDtoSchema",
  "CouponListQueryDtoSchema",
  "DatedQueryDtoSchema",
  "OrderListQueryDtoSchema",
  "OrderStatusQueryDtoSchema",
  "LogListQueryDtoSchema",
  "SimpleQueryDtoSchema",
  "ActiveOnlyQueryDtoSchema",
  // loyalty.request.ts
  "LoyaltyRewardDefinitionDtoSchema",
  "CreateLoyaltyCampaignDtoSchema",
  "UpdateLoyaltyCampaignDtoSchema",
  "LoyaltyCampaignLifecycleDtoSchema",
  // order.request.ts
  "CreateOrderDtoSchema",
  "UpdateOrderDtoSchema",
  "ChangeOrderStatusDtoSchema",
  // permission.request.ts
  "CreatePermissionDtoSchema",
  "UpdatePermissionDtoSchema",
  // product.request.ts
  "CreateProductDtoSchema",
  "UpdateProductDtoSchema",
  "SearchProductDtoSchema",
  // role.request.ts
  "CreateRoleDtoSchema",
  "UpdateRoleDtoSchema",
  // service.request.ts
  "CreateServiceDtoSchema",
  "UpdateServiceDtoSchema",
  // slide.request.ts
  "CreateSlideshowDtoSchema",
  "UpdateSlideshowDtoSchema",
  // staff.request.ts
  "CreateStaffDtoSchema",
  "UpdateStaffDtoSchema",
  "AssignStaffServiceDtoSchema",
  "SyncStaffServicesDtoSchema",
  // tenant.dto.ts
  "CreateTenantDtoSchema",
  "UpdateTenantDtoSchema",
  "UpdateTenantFeaturesDtoSchema",
  // user.request.ts
  "UpdateUserDtoSchema",
  "AssignRoleDtoSchema",
  // whatsapp.request.ts
  "ConfigureWhatsAppDtoSchema",
  "WhatsAppComponentDtoSchema",
  "SendNotificationDtoSchema",
] as const;

/** One primary response interface per response source file (24 files). */
const EXPECTED_RESPONSE_SCHEMAS = [
  "IAppointmentListResponseSchema",
  "IAppointmentResponseSchema",
  "IBannerResponseSchema",
  "ICartResponseSchema",
  "ICategoryResponseSchema",
  "CouponValidationResultSchema",
  "ICouponResponseSchema",
  "IFeatureResponseSchema",
  "ILoyaltyCampaignResponseSchema",
  "IOrderResponseSchema",
  "IPermissionResponseSchema",
  "IProductResponseSchema",
  "IRoleResponseSchema",
  "IServiceResponseSchema",
  "IServiceMinimalResponseSchema",
  "IStaffMinimalResponseSchema",
  "ITenantMinimalResponseSchema",
  "IUserMinimalResponseSchema",
  "ISlideResponseSchema",
  "IStaffResponseSchema",
  "ITenantResponseSchema",
  "IUserPublicResponseSchema",
  "IUserResponseSchema",
  "IWhatsAppConfigResponseSchema",
] as const;

const asRecord = (value: unknown) => value as Record<string, unknown>;

describe("DTO schemas are ported from the API into @neutra/commons", () => {
  it("(a) registers exactly 20 request schema modules and 24 response type modules", () => {
    expect(requestSchemaModules).toHaveLength(20);
    expect(responseTypeModules).toHaveLength(24);
    for (const mod of requestSchemaModules) {
      expect(Object.keys(mod).some((key) => key.endsWith("Schema"))).toBe(true);
    }
    for (const mod of responseTypeModules) {
      expect(
        Object.values(mod).some(
          (value) =>
            typeof (value as { safeParse?: unknown })?.safeParse === "function",
        ),
      ).toBe(true);
    }
  });

  it("(a) exports a <DtoClass>Schema for every request DTO and response type", () => {
    for (const name of EXPECTED_REQUEST_SCHEMAS) {
      expect(asRecord(commons)[name], `missing ${name}`).toBeDefined();
    }
    for (const name of EXPECTED_RESPONSE_SCHEMAS) {
      expect(asRecord(commons)[name], `missing ${name}`).toBeDefined();
    }
    // Inferred types share the original DTO / response name (compile-time check).
    const dto: commons.UpdateAppointmentDto = { status: "CONFIRMED" };
    const response: commons.IAppointmentResponse = {
      id: "a1",
      userId: "u1",
      startTime: new Date(),
      endTime: new Date(),
      status: "CONFIRMED",
      discountAmount: 0,
      subtotal: 0,
      total: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(dto.status).toBe("CONFIRMED");
    expect(response.status).toBe("CONFIRMED");
  });

  it("(b) coerces numeric query strings to numbers", () => {
    const paged = commons.PagedQueryDtoSchema.parse({
      page: "2",
      limit: "10",
    });
    expect(paged).toEqual({ page: 2, limit: 10 });

    const logged = commons.LogListQueryDtoSchema.parse({
      skip: "5",
      take: "20",
    });
    expect(logged).toMatchObject({ skip: 5, take: 20 });

    expect(
      commons.PagedQueryDtoSchema.safeParse({ page: "0" }).success,
    ).toBe(false);
  });

  it("(c) parses a textual boolean flag into a real boolean", () => {
    expect(commons.ActiveOnlyQueryDtoSchema.parse({ activeOnly: "true" })).toEqual(
      { activeOnly: true },
    );
    expect(commons.ActiveOnlyQueryDtoSchema.parse({ activeOnly: "false" })).toEqual(
      { activeOnly: false },
    );
    expect(
      commons.ActiveOnlyQueryDtoSchema.safeParse({ activeOnly: "yes" }).success,
    ).toBe(false);
    expect(
      commons.CreateCategoryDtoSchema.parse({ name: "x", active: "false" })
        .active,
    ).toBe(false);
  });

  it("(d) keeps @IsDateString values as ISO strings and coerces nested DTOs", () => {
    const appointment = commons.CreateAppointmentDtoSchema.parse({
      serviceId: "svc",
      staffId: "staff",
      startTime: "2026-01-01T09:00:00.000Z",
    });
    expect(appointment.startTime).toBe("2026-01-01T09:00:00.000Z");

    const campaign = commons.CreateLoyaltyCampaignDtoSchema.parse({
      name: "Verano",
      source: "BOOKING",
      metric: "COUNT",
      targetValue: "3",
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-02-01T00:00:00.000Z",
      claimUntil: "2026-03-01T00:00:00.000Z",
      reward: {
        type: "PERCENT",
        value: 10,
        applicableProducts: [],
        applicableCategories: [],
        applicableServices: [],
      },
      rewardValidDays: "7",
    });
    expect(campaign.reward.type).toBe("PERCENT");
    expect(campaign.rewardValidDays).toBe(7);

    const notification = commons.SendNotificationDtoSchema.parse({
      to: "5491112345678",
      templateName: "hello",
      components: [{ type: "body", parameters: [{ key: "value" }] }],
    });
    expect(notification.components?.[0]?.type).toBe("body");
  });

  it("uses the enum schemas from Task 3 for @IsEnum / @IsIn", () => {
    expect(
      commons.UpdateAppointmentStatusDtoSchema.parse({ status: "CONFIRMED" })
        .status,
    ).toBe("CONFIRMED");
    expect(
      commons.UpdateAppointmentStatusDtoSchema.safeParse({ status: "BOGUS" })
        .success,
    ).toBe(false);
    expect(
      commons.ChangeOrderStatusDtoSchema.parse({
        idOrder: "o1",
        status: "PAGADO",
      }).status,
    ).toBe("PAGADO");
    expect(
      commons.ForgotPasswordDtoSchema.safeParse({ email: "not-an-email" })
        .success,
    ).toBe(false);
  });

  it("infers response types whose date fields are Date objects", () => {
    const parsed = commons.IAppointmentResponseSchema.parse({
      id: "a1",
      userId: "u1",
      startTime: "2026-01-01T09:00:00.000Z",
      endTime: "2026-01-01T10:00:00.000Z",
      status: "CONFIRMED",
      discountAmount: 0,
      subtotal: 10,
      total: 10,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(parsed.startTime).toBeInstanceOf(Date);
    expect(parsed.status).toBe("CONFIRMED");
  });
});
