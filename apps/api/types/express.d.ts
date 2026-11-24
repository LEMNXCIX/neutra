import { AuthenticatedUser } from "./rbac";

declare global {
    namespace Express {
        interface User extends AuthenticatedUser {}

        interface Request {
            tenantId?: string;
            tenant?: {
                id: string;
                name: string;
                slug: string;
                type: string;
                active: boolean;
            };
            traceId?: string;
            /** Anonymous UX identity from the `hold_owner` cookie. */
            holdOwnerId?: string;
            validatedBody?: unknown;
            validatedQuery?: unknown;
        }

        interface Response {
            apiSuccess: (
                data?: unknown,
                message?: string,
                statusCode?: number,
            ) => Response;
            apiError: (
                err: unknown,
                message?: string,
                statusCode?: number,
            ) => Response;
        }
    }
}
