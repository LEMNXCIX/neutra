/**
 * Records the canonical `{status, errors}` response for every representative
 * validation case, using the CURRENT legacy decorator-based validation stack.
 *
 * Task 8 must reproduce this snapshot byte-for-byte after swapping the
 * validation middleware for Zod. Run with:
 *
 *   bun run --cwd apps/api scripts/record-validation-golden.ts
 *
 * The recorder doubles as the shared harness for `test/validation-golden.test.ts`
 * (the recording only runs when this file is the process entry point), so the
 * snapshot and the assertions always exercise the exact same request matrix.
 *
 * MIGRATION NOTE (Task 8): the legacy DTO-class imports that used to live
 * here are now the equivalent Zod schemas from `@neutra/commons`. GOLDEN_CASES,
 * the case ids/inputs and the snapshot format are unchanged, so
 * `validation-golden.test.ts` needs no edits and the snapshot stays byte-identical.
 */
import fs from "node:fs";
import path from "node:path";
import {
    ActiveOnlyQueryDtoSchema,
    AddToCartDtoSchema,
    AssignRoleDtoSchema,
    AttentionAppointmentsQueryDtoSchema,
    AvailabilityQueryDtoSchema,
    CategoryListQueryDtoSchema,
    ChangeOrderStatusDtoSchema,
    ConfigureWhatsAppDtoSchema,
    CouponListQueryDtoSchema,
    CreateAppointmentDtoSchema,
    CreateBannerDtoSchema,
    CreateCategoryDtoSchema,
    CreateCouponDtoSchema,
    CreateFeatureDtoSchema,
    CreatePermissionDtoSchema,
    CreateProductDtoSchema,
    CreateRoleDtoSchema,
    CreateServiceDtoSchema,
    CreateSlideshowDtoSchema,
    CreateStaffDtoSchema,
    CreateTenantDtoSchema,
    DatedQueryDtoSchema,
    ForgotPasswordDtoSchema,
    ListAppointmentsQueryDtoSchema,
    LogListQueryDtoSchema,
    LoyaltyRewardDefinitionDtoSchema,
    OrderListQueryDtoSchema,
    OrderStatusQueryDtoSchema,
    PagedSearchQueryDtoSchema,
    SimpleQueryDtoSchema,
} from "@neutra/commons";
import express from "express";
import type { Response } from "supertest";
import supertest from "supertest";
import type { ZodType } from "zod";
import type { ILogger } from "@/core/providers/logger.interface";
import createResponseMiddleware from "@/middleware/response.middleware";
import {
    validateDto,
    validateQueryDto,
} from "@/middleware/validation.middleware";

export const SNAPSHOT_PATH = path.resolve(
    __dirname,
    "..",
    "test",
    "golden",
    "validation.snapshot.json",
);

type DtoSchema = ZodType;

export type GoldenCase = {
    /** Stable key used in the snapshot object. */
    id: string;
    kind: "query" | "body";
    /** Route mounted on the harness app (unique per case). */
    path: string;
    dto: DtoSchema;
    /**
     * Invalid query string / request body that must trigger a 400. A string is
     * used for repeated query params, which Express's simple parser turns into
     * arrays (needed to violate `@IsString()` on an otherwise string-only DTO).
     */
    input: Record<string, unknown> | string;
};

/**
 * 16 query call sites (appointment 3, category, coupon, log 2, order 4,
 * permission, role, service, slide, staff) + one invalid case per request-DTO
 * family that carries validation decorators (20 families).
 */
export const GOLDEN_CASES: GoldenCase[] = [
    // ---- 16 validateQueryDto call sites ----
    {
        id: "query.appointment.availability",
        kind: "query",
        path: "/golden/query/appointment-availability",
        dto: AvailabilityQueryDtoSchema,
        input: {},
    },
    {
        id: "query.appointment.list",
        kind: "query",
        path: "/golden/query/appointment-list",
        dto: ListAppointmentsQueryDtoSchema,
        input: { page: "abc", limit: "0", startDate: "yesterday" },
    },
    {
        id: "query.appointment.attention",
        kind: "query",
        path: "/golden/query/appointment-attention",
        dto: AttentionAppointmentsQueryDtoSchema,
        input: { page: "0", limit: "-5" },
    },
    {
        id: "query.category.list",
        kind: "query",
        path: "/golden/query/category-list",
        dto: CategoryListQueryDtoSchema,
        input: { page: "abc" },
    },
    {
        id: "query.coupon.list",
        kind: "query",
        path: "/golden/query/coupon-list",
        dto: CouponListQueryDtoSchema,
        input: { limit: "abc" },
    },
    {
        id: "query.log.list",
        kind: "query",
        path: "/golden/query/log-list",
        dto: LogListQueryDtoSchema,
        input: { skip: "abc", startDate: "bad", take: "0" },
    },
    {
        id: "query.log.stats",
        kind: "query",
        path: "/golden/query/log-stats",
        dto: SimpleQueryDtoSchema,
        input: "timeframe=a&timeframe=b",
    },
    {
        id: "query.order.getOrderByUser",
        kind: "query",
        path: "/golden/query/order-get-order-by-user",
        dto: OrderStatusQueryDtoSchema,
        input: "status=a&status=b",
    },
    {
        id: "query.order.stats",
        kind: "query",
        path: "/golden/query/order-stats",
        dto: DatedQueryDtoSchema,
        input: { startDate: "not-a-date", endDate: "also-bad" },
    },
    {
        id: "query.order.list",
        kind: "query",
        path: "/golden/query/order-list",
        dto: OrderListQueryDtoSchema,
        input: "page=abc&status=a&status=b&startDate=bad",
    },
    {
        id: "query.order.all",
        kind: "query",
        path: "/golden/query/order-all",
        dto: OrderListQueryDtoSchema,
        input: { limit: "0" },
    },
    {
        id: "query.permission.list",
        kind: "query",
        path: "/golden/query/permission-list",
        dto: PagedSearchQueryDtoSchema,
        input: "page=abc&search=a&search=b",
    },
    {
        id: "query.role.list",
        kind: "query",
        path: "/golden/query/role-list",
        dto: PagedSearchQueryDtoSchema,
        input: { limit: "-1" },
    },
    {
        id: "query.service.list",
        kind: "query",
        path: "/golden/query/service-list",
        dto: ActiveOnlyQueryDtoSchema,
        input: { activeOnly: "yes" },
    },
    {
        id: "query.slide.list",
        kind: "query",
        path: "/golden/query/slide-list",
        dto: ActiveOnlyQueryDtoSchema,
        input: { activeOnly: "TRUE" },
    },
    {
        id: "query.staff.list",
        kind: "query",
        path: "/golden/query/staff-list",
        dto: ActiveOnlyQueryDtoSchema,
        input: { activeOnly: "1" },
    },

    // ---- one invalid case per decorated request-DTO family (20) ----
    {
        id: "body.appointment",
        kind: "body",
        path: "/golden/body/appointment",
        dto: CreateAppointmentDtoSchema,
        input: {},
    },
    {
        id: "body.auth",
        kind: "body",
        path: "/golden/body/auth",
        dto: ForgotPasswordDtoSchema,
        input: { email: "bad" },
    },
    {
        id: "body.banner",
        kind: "body",
        path: "/golden/body/banner",
        dto: CreateBannerDtoSchema,
        input: {},
    },
    {
        id: "body.cart",
        kind: "body",
        path: "/golden/body/cart",
        dto: AddToCartDtoSchema,
        input: { productId: "", amount: 0 },
    },
    {
        id: "body.category",
        kind: "body",
        path: "/golden/body/category",
        dto: CreateCategoryDtoSchema,
        input: {},
    },
    {
        id: "body.coupon",
        kind: "body",
        path: "/golden/body/coupon",
        dto: CreateCouponDtoSchema,
        input: {},
    },
    {
        id: "body.feature",
        kind: "body",
        path: "/golden/body/feature",
        dto: CreateFeatureDtoSchema,
        input: {},
    },
    {
        id: "body.loyalty",
        kind: "body",
        path: "/golden/body/loyalty",
        dto: LoyaltyRewardDefinitionDtoSchema,
        input: {},
    },
    {
        id: "body.order",
        kind: "body",
        path: "/golden/body/order",
        dto: ChangeOrderStatusDtoSchema,
        input: { idOrder: "", status: "BOGUS" },
    },
    {
        id: "body.permission",
        kind: "body",
        path: "/golden/body/permission",
        dto: CreatePermissionDtoSchema,
        input: {},
    },
    {
        id: "body.product",
        kind: "body",
        path: "/golden/body/product",
        dto: CreateProductDtoSchema,
        input: {},
    },
    {
        id: "body.role",
        kind: "body",
        path: "/golden/body/role",
        dto: CreateRoleDtoSchema,
        input: {},
    },
    {
        id: "body.service",
        kind: "body",
        path: "/golden/body/service",
        dto: CreateServiceDtoSchema,
        input: {},
    },
    {
        id: "body.slide",
        kind: "body",
        path: "/golden/body/slide",
        dto: CreateSlideshowDtoSchema,
        input: {},
    },
    {
        id: "body.staff",
        kind: "body",
        path: "/golden/body/staff",
        dto: CreateStaffDtoSchema,
        input: { email: "bad" },
    },
    {
        id: "body.tenant",
        kind: "body",
        path: "/golden/body/tenant",
        dto: CreateTenantDtoSchema,
        input: {},
    },
    {
        id: "body.user",
        kind: "body",
        path: "/golden/body/user",
        dto: AssignRoleDtoSchema,
        input: {},
    },
    {
        id: "body.whatsapp",
        kind: "body",
        path: "/golden/body/whatsapp",
        dto: ConfigureWhatsAppDtoSchema,
        input: {},
    },
    {
        id: "body.appointment-query",
        kind: "body",
        path: "/golden/body/appointment-query",
        dto: AvailabilityQueryDtoSchema,
        input: {},
    },
    {
        id: "body.list-query",
        kind: "body",
        path: "/golden/body/list-query",
        dto: ActiveOnlyQueryDtoSchema,
        input: { activeOnly: "maybe" },
    },
];

/** Silent logger: the harness only asserts on the serialized response body. */
const silentLogger: ILogger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
    logRequest: () => undefined,
    logResponse: () => undefined,
};

/** Minimal Express app that mounts the real validation middleware + envelope. */
export function buildGoldenApp() {
    const app = express();
    app.use(express.json());
    app.use(createResponseMiddleware(silentLogger));

    for (const testCase of GOLDEN_CASES) {
        const handler =
            testCase.kind === "query"
                ? validateQueryDto(testCase.dto)
                : validateDto(testCase.dto);
        const success = (_req: express.Request, res: express.Response) => {
            res.status(200).json({ ok: true });
        };
        if (testCase.kind === "query") {
            app.get(testCase.path, handler, success);
        } else {
            app.post(testCase.path, handler, success);
        }
    }
    return app;
}

/** Reduce a supertest response to the contract-only `{status, errors}` pair. */
export function extractGolden(response: Response): {
    status: number;
    errors: unknown;
} {
    return {
        status: response.status,
        errors: response.body.errors,
    };
}

/** Drive one case through supertest and return its `{status, errors}` pair. */
export async function runCase(testCase: GoldenCase): Promise<{
    status: number;
    errors: unknown;
}> {
    const request = supertest(buildGoldenApp());
    const response =
        testCase.kind === "query"
            ? await request.get(testCase.path).query(testCase.input)
            : await request.post(testCase.path).send(testCase.input);
    return extractGolden(response);
}

async function recordGolden(): Promise<void> {
    const snapshot: Record<string, { status: number; errors: unknown }> = {};

    for (const testCase of GOLDEN_CASES) {
        const golden = await runCase(testCase);
        if (golden.status !== 400) {
            throw new Error(
                `Expected 400 for ${testCase.id}, got ${golden.status}`,
            );
        }
        snapshot[testCase.id] = golden;
    }

    fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(
        `Recorded ${GOLDEN_CASES.length} golden validation responses to ${SNAPSHOT_PATH}`,
    );
}

if (require.main === module) {
    recordGolden().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
