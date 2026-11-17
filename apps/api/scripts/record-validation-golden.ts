/**
 * Records the canonical `{status, errors}` response for every representative
 * validation case, using the CURRENT class-validator/class-transformer stack.
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
 * MIGRATION NOTE (Task 8): the `*.request` / `*.query` / `*.dto` class imports
 * below are the only class-validator-dependent lines in this file. When those
 * DTO files are deleted, swap these imports for the equivalent schemas from
 * `@neutra/commons`; GOLDEN_CASES, the case ids/inputs and the snapshot format
 * stay unchanged, so `validation-golden.test.ts` needs no edits.
 */
import fs from "node:fs";
import path from "node:path";
import express from "express";
import type { Response } from "supertest";
import supertest from "supertest";
import {
    AttentionAppointmentsQueryDto,
    AvailabilityQueryDto,
    ListAppointmentsQueryDto,
} from "@/core/application/dtos/requests/appointment.query";
import { CreateAppointmentDto } from "@/core/application/dtos/requests/appointment.request";
import { ForgotPasswordDto } from "@/core/application/dtos/requests/auth.request";
import { CreateBannerDto } from "@/core/application/dtos/requests/banner.request";
import { AddToCartDto } from "@/core/application/dtos/requests/cart.request";
import { CreateCategoryDto } from "@/core/application/dtos/requests/category.request";
import { CreateCouponDto } from "@/core/application/dtos/requests/coupon.request";
import { CreateFeatureDto } from "@/core/application/dtos/requests/feature.request";
import {
    ActiveOnlyQueryDto,
    CategoryListQueryDto,
    CouponListQueryDto,
    DatedQueryDto,
    LogListQueryDto,
    OrderListQueryDto,
    OrderStatusQueryDto,
    PagedSearchQueryDto,
    SimpleQueryDto,
} from "@/core/application/dtos/requests/list-query.dto";
import { LoyaltyRewardDefinitionDto } from "@/core/application/dtos/requests/loyalty.request";
import { ChangeOrderStatusDto } from "@/core/application/dtos/requests/order.request";
import { CreatePermissionDto } from "@/core/application/dtos/requests/permission.request";
import { CreateProductDto } from "@/core/application/dtos/requests/product.request";
import { CreateRoleDto } from "@/core/application/dtos/requests/role.request";
import { CreateServiceDto } from "@/core/application/dtos/requests/service.request";
import { CreateSlideshowDto } from "@/core/application/dtos/requests/slide.request";
import { CreateStaffDto } from "@/core/application/dtos/requests/staff.request";
import { CreateTenantDto } from "@/core/application/dtos/requests/tenant.dto";
import { AssignRoleDto } from "@/core/application/dtos/requests/user.request";
import { ConfigureWhatsAppDto } from "@/core/application/dtos/requests/whatsapp.request";
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

type DtoCtor = new () => object;

export type GoldenCase = {
    /** Stable key used in the snapshot object. */
    id: string;
    kind: "query" | "body";
    /** Route mounted on the harness app (unique per case). */
    path: string;
    dto: DtoCtor;
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
 * family that carries class-validator decorators (20 families).
 */
export const GOLDEN_CASES: GoldenCase[] = [
    // ---- 16 validateQueryDto call sites ----
    {
        id: "query.appointment.availability",
        kind: "query",
        path: "/golden/query/appointment-availability",
        dto: AvailabilityQueryDto,
        input: {},
    },
    {
        id: "query.appointment.list",
        kind: "query",
        path: "/golden/query/appointment-list",
        dto: ListAppointmentsQueryDto,
        input: { page: "abc", limit: "0", startDate: "yesterday" },
    },
    {
        id: "query.appointment.attention",
        kind: "query",
        path: "/golden/query/appointment-attention",
        dto: AttentionAppointmentsQueryDto,
        input: { page: "0", limit: "-5" },
    },
    {
        id: "query.category.list",
        kind: "query",
        path: "/golden/query/category-list",
        dto: CategoryListQueryDto,
        input: { page: "abc" },
    },
    {
        id: "query.coupon.list",
        kind: "query",
        path: "/golden/query/coupon-list",
        dto: CouponListQueryDto,
        input: { limit: "abc" },
    },
    {
        id: "query.log.list",
        kind: "query",
        path: "/golden/query/log-list",
        dto: LogListQueryDto,
        input: { skip: "abc", startDate: "bad", take: "0" },
    },
    {
        id: "query.log.stats",
        kind: "query",
        path: "/golden/query/log-stats",
        dto: SimpleQueryDto,
        input: "timeframe=a&timeframe=b",
    },
    {
        id: "query.order.getOrderByUser",
        kind: "query",
        path: "/golden/query/order-get-order-by-user",
        dto: OrderStatusQueryDto,
        input: "status=a&status=b",
    },
    {
        id: "query.order.stats",
        kind: "query",
        path: "/golden/query/order-stats",
        dto: DatedQueryDto,
        input: { startDate: "not-a-date", endDate: "also-bad" },
    },
    {
        id: "query.order.list",
        kind: "query",
        path: "/golden/query/order-list",
        dto: OrderListQueryDto,
        input: "page=abc&status=a&status=b&startDate=bad",
    },
    {
        id: "query.order.all",
        kind: "query",
        path: "/golden/query/order-all",
        dto: OrderListQueryDto,
        input: { limit: "0" },
    },
    {
        id: "query.permission.list",
        kind: "query",
        path: "/golden/query/permission-list",
        dto: PagedSearchQueryDto,
        input: "page=abc&search=a&search=b",
    },
    {
        id: "query.role.list",
        kind: "query",
        path: "/golden/query/role-list",
        dto: PagedSearchQueryDto,
        input: { limit: "-1" },
    },
    {
        id: "query.service.list",
        kind: "query",
        path: "/golden/query/service-list",
        dto: ActiveOnlyQueryDto,
        input: { activeOnly: "yes" },
    },
    {
        id: "query.slide.list",
        kind: "query",
        path: "/golden/query/slide-list",
        dto: ActiveOnlyQueryDto,
        input: { activeOnly: "TRUE" },
    },
    {
        id: "query.staff.list",
        kind: "query",
        path: "/golden/query/staff-list",
        dto: ActiveOnlyQueryDto,
        input: { activeOnly: "1" },
    },

    // ---- one invalid case per decorated request-DTO family (20) ----
    {
        id: "body.appointment",
        kind: "body",
        path: "/golden/body/appointment",
        dto: CreateAppointmentDto,
        input: {},
    },
    {
        id: "body.auth",
        kind: "body",
        path: "/golden/body/auth",
        dto: ForgotPasswordDto,
        input: { email: "bad" },
    },
    {
        id: "body.banner",
        kind: "body",
        path: "/golden/body/banner",
        dto: CreateBannerDto,
        input: {},
    },
    {
        id: "body.cart",
        kind: "body",
        path: "/golden/body/cart",
        dto: AddToCartDto,
        input: { productId: "", amount: 0 },
    },
    {
        id: "body.category",
        kind: "body",
        path: "/golden/body/category",
        dto: CreateCategoryDto,
        input: {},
    },
    {
        id: "body.coupon",
        kind: "body",
        path: "/golden/body/coupon",
        dto: CreateCouponDto,
        input: {},
    },
    {
        id: "body.feature",
        kind: "body",
        path: "/golden/body/feature",
        dto: CreateFeatureDto,
        input: {},
    },
    {
        id: "body.loyalty",
        kind: "body",
        path: "/golden/body/loyalty",
        dto: LoyaltyRewardDefinitionDto,
        input: {},
    },
    {
        id: "body.order",
        kind: "body",
        path: "/golden/body/order",
        dto: ChangeOrderStatusDto,
        input: { idOrder: "", status: "BOGUS" },
    },
    {
        id: "body.permission",
        kind: "body",
        path: "/golden/body/permission",
        dto: CreatePermissionDto,
        input: {},
    },
    {
        id: "body.product",
        kind: "body",
        path: "/golden/body/product",
        dto: CreateProductDto,
        input: {},
    },
    {
        id: "body.role",
        kind: "body",
        path: "/golden/body/role",
        dto: CreateRoleDto,
        input: {},
    },
    {
        id: "body.service",
        kind: "body",
        path: "/golden/body/service",
        dto: CreateServiceDto,
        input: {},
    },
    {
        id: "body.slide",
        kind: "body",
        path: "/golden/body/slide",
        dto: CreateSlideshowDto,
        input: {},
    },
    {
        id: "body.staff",
        kind: "body",
        path: "/golden/body/staff",
        dto: CreateStaffDto,
        input: { email: "bad" },
    },
    {
        id: "body.tenant",
        kind: "body",
        path: "/golden/body/tenant",
        dto: CreateTenantDto,
        input: {},
    },
    {
        id: "body.user",
        kind: "body",
        path: "/golden/body/user",
        dto: AssignRoleDto,
        input: {},
    },
    {
        id: "body.whatsapp",
        kind: "body",
        path: "/golden/body/whatsapp",
        dto: ConfigureWhatsAppDto,
        input: {},
    },
    {
        id: "body.appointment-query",
        kind: "body",
        path: "/golden/body/appointment-query",
        dto: AvailabilityQueryDto,
        input: {},
    },
    {
        id: "body.list-query",
        kind: "body",
        path: "/golden/body/list-query",
        dto: ActiveOnlyQueryDto,
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
