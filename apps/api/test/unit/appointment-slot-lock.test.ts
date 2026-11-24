import type { CreateAppointmentDTO } from "@/core/application/dtos/requests/appointment.request";
import type {
    AppointmentCreateData,
    IAppointmentRepository,
} from "@/core/repositories/appointment.repository.interface";
import { AppointmentStatus } from "@/core/entities/appointment.entity";
import { ResourceErrorCodes } from "@neutra/commons";

// The suite normally runs without DATABASE_URL (all other unit tests stub the
// database). This test needs a real concurrent session pair, so point it at the
// local test database when the caller did not provide one.
process.env.DATABASE_URL ||=
    "postgresql://postgres:postgres@localhost:6432/role_test?schema=public";

type LockCapableRepository = {
    withSlotLock<T>(
        tenantId: string,
        staffId: string,
        startTime: Date,
        fn: (tx: object) => Promise<T>,
    ): Promise<T>;
};

const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const tenantId = `slot-lock-${unique}`;
const staffId = `slot-lock-staff-${unique}`;
const serviceId = `slot-lock-service-${unique}`;
const userId = `slot-lock-user-${unique}`;
const startTime = new Date("2099-06-15T10:00:00.000Z");

let prisma: typeof import("@/config/db.config").prisma;
let createUseCase: typeof import("@/core/application/booking/create-appointment.use-case").CreateAppointmentUseCase;
let PrismaAppointmentRepository: typeof import("@/infrastructure/database/prisma/appointment.prisma-repository").PrismaAppointmentRepository;

describe("appointment slot lock (concurrent booking)", () => {
    beforeAll(async () => {
        ({ prisma } = require("@/config/db.config"));
        ({
            CreateAppointmentUseCase: createUseCase,
        } = require("@/core/application/booking/create-appointment.use-case"));
        ({
            PrismaAppointmentRepository,
        } = require("@/infrastructure/database/prisma/appointment.prisma-repository"));

        await prisma.tenant.create({
            data: { id: tenantId, name: "Slot lock test", slug: tenantId },
        });
        await prisma.user.create({
            data: {
                id: userId,
                name: "Slot lock customer",
                email: `${userId}@example.test`,
                password: "not-used",
            },
        });
        await prisma.service.create({
            data: {
                id: serviceId,
                name: "Slot lock service",
                duration: 30,
                price: 100,
                tenantId,
            },
        });
        await prisma.staff.create({
            data: { id: staffId, name: "Slot lock staff", tenantId },
        });
        await prisma.staffService.create({
            data: { staffId, serviceId, tenantId },
        });
    });

    afterAll(async () => {
        if (!prisma) return;
        await prisma.appointment.deleteMany({ where: { tenantId } });
        await prisma.staffService.deleteMany({ where: { tenantId } });
        await prisma.staff.deleteMany({ where: { tenantId } });
        await prisma.service.deleteMany({ where: { tenantId } });
        await prisma.user.deleteMany({ where: { id: userId } });
        await prisma.tenant.deleteMany({ where: { id: tenantId } });
        await prisma.$disconnect();
        // The pg pool is created by db.config, so $disconnect alone leaves its
        // idle timer alive and keeps Jest's worker from exiting.
        const adapter = (
            prisma as unknown as {
                _engineConfig: {
                    adapter: { externalPool?: { end(): Promise<void> } };
                };
            }
        )._engineConfig.adapter;
        await adapter.externalPool?.end();
    });

    test("two concurrent bookings for the same slot produce exactly one appointment", async () => {
        const repository = new PrismaAppointmentRepository();
        const withLock = repository as unknown as LockCapableRepository;

        // Deterministic TOCTOU: hold the first create until the second create
        // has been reached (or 1s elapses if the second call is correctly
        // blocked on the advisory lock). Without a lock both calls read "free"
        // before either writes; with the lock the second call re-checks after
        // the first one commits and loses with RESOURCE_INVALID_STATE.
        let createCalls = 0;
        let createReceivedTx = false;
        let secondCreateStarted!: () => void;
        const secondCreate = new Promise<void>((resolve) => {
            secondCreateStarted = resolve;
        });
        let fallbackTimer!: NodeJS.Timeout;
        const lockFallback = new Promise<void>((resolve) => {
            fallbackTimer = setTimeout(resolve, 1000);
        });
        const instrumented = {
            checkAvailability: (
                ...args: Parameters<IAppointmentRepository["checkAvailability"]>
            ) => repository.checkAvailability(...args),
            withSlotLock: <T>(
                lockTenantId: string,
                lockStaffId: string,
                lockStartTime: Date,
                fn: (tx: object) => Promise<T>,
            ) =>
                withLock.withSlotLock(
                    lockTenantId,
                    lockStaffId,
                    lockStartTime,
                    fn,
                ),
            create: async (
                createTenantId: string,
                data: AppointmentCreateData,
                tx?: object,
            ) => {
                createCalls += 1;
                createReceivedTx ||= tx !== undefined;
                if (createCalls === 1) {
                    await Promise.race([secondCreate, lockFallback]);
                    clearTimeout(fallbackTimer);
                } else {
                    secondCreateStarted();
                }
                return (
                    repository.create as (...args: unknown[]) => Promise<never>
                )(createTenantId, data, tx);
            },
        } as unknown as IAppointmentRepository;

        const useCase = new createUseCase(
            instrumented,
            {
                findById: async () => ({ id: staffId, active: true }),
                getServices: async () => [serviceId],
            } as never,
            {
                findById: async () => ({
                    id: serviceId,
                    active: true,
                    duration: 30,
                    price: 100,
                }),
            } as never,
            {} as never,
            { execute: jest.fn() } as never,
            { enqueue: jest.fn() } as never,
            { getTenantFeatureStatus: async () => ({}) } as never,
        );

        const dto: CreateAppointmentDTO = {
            userId,
            serviceId,
            staffId,
            startTime,
        };
        const settled = await Promise.allSettled([
            useCase.execute(tenantId, dto),
            useCase.execute(tenantId, dto),
        ]);

        const fulfilled = settled.filter(
            (result) => result.status === "fulfilled",
        );
        const rejected = settled.filter(
            (result): result is PromiseRejectedResult =>
                result.status === "rejected",
        );
        expect(createReceivedTx).toBe(true);
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(rejected[0].reason).toMatchObject({
            name: "InvalidStateError",
            code: ResourceErrorCodes.INVALID_STATE,
            message: "The selected time slot is already booked",
        });

        const active = await repository.findAll(tenantId, {
            staffId,
            status: AppointmentStatus.PENDING,
        });
        expect(active).toHaveLength(1);
    });
});
