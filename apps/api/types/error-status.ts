/**
 * Domain-error → HTTP-status resolvers.
 * Moved verbatim from `types/error-codes.ts`; the error-code catalog now lives
 * in `@neutra/commons`, while these API-specific resolvers stay here.
 */
import {
    AuthErrorCodes,
    type ErrorCode,
    ResourceErrorCodes,
    TenantErrorCodes,
    WhatsAppErrorCodes,
} from "@neutra/commons";

/**
 * Prefer class hierarchy so custom codes on BusinessRuleViolationError /
 * InvalidStateError / etc. keep the correct HTTP status (422, 409, …).
 *
 * Resolution is by error class, never by the code. Every DomainError subclass
 * appears in the switch below, so a custom code on a known class still resolves
 * correctly. An earlier version fell through to a code-keyed map for
 * unrecognised classes, but every production caller guards on
 * `instanceof DomainError`, so that path was unreachable and the map's
 * unprefixed keys were dead weight a reader could mistake for live behaviour.
 */
export function httpStatusFromDomainError(error: {
    code: string;
    name?: string;
}): number {
    switch (error.name) {
        case "EntityNotFoundError":
            return 404;
        case "BusinessRuleViolationError":
            return 422;
        case "InvalidStateError":
        case "DuplicateEntityError":
            return 409;
        case "UnauthorizedError":
            return 401;
        case "ForbiddenError":
            return 403;
        case "ValidationError":
            return 400;
        default:
            // Unreachable from production: every caller guards on
            // `instanceof DomainError` and all seven subclasses are listed
            // above. An unrecognised class name is a server-side surprise, so
            // it is reported as such rather than as a client error.
            return 500;
    }
}

/**
 * Helper to get HTTP status code from error code
 */
export function getHttpStatusFromErrorCode(errorCode: ErrorCode): number {
    // Auth errors -> 401
    if (errorCode.startsWith("AUTH_")) {
        if (errorCode === AuthErrorCodes.FORBIDDEN) return 403;
        if (errorCode === AuthErrorCodes.RESOURCE_NOT_OWNED) return 403;
        if (errorCode === AuthErrorCodes.SUPER_ADMIN_REQUIRED) return 403;
        // Thrown as ForbiddenError, so the class resolver already answers 403.
        // It was declared but never emitted, so the two resolvers had never been
        // compared for it.
        if (errorCode === AuthErrorCodes.ACCOUNT_INACTIVE) return 403;
        return 401;
    }

    // Validation errors -> 400
    if (errorCode.startsWith("VALIDATION_")) {
        return 400;
    }

    // Resource errors
    if (errorCode.startsWith("RESOURCE_")) {
        if (errorCode === ResourceErrorCodes.NOT_FOUND) return 404;
        if (errorCode === ResourceErrorCodes.ROUTE_NOT_FOUND) return 404;
        if (errorCode === ResourceErrorCodes.ALREADY_EXISTS) return 409;
        if (errorCode === ResourceErrorCodes.CONFLICT) return 409;
        if (errorCode === ResourceErrorCodes.GONE) return 410;
        return 400;
    }

    // Tenant errors
    if (errorCode.startsWith("TENANT_")) {
        if (errorCode === "TENANT_NOT_FOUND") return 404;
        if (errorCode === "TENANT_INACTIVE") return 403;
        // Authenticated but not a member: ForbiddenError already yields 403
        // through httpStatusFromDomainError, and this keeps the two resolvers
        // from disagreeing for the same code.
        if (errorCode === TenantErrorCodes.MEMBERSHIP_REQUIRED) return 403;
        return 400;
    }

    // Business logic errors -> 422
    if (errorCode.startsWith("BUSINESS_")) {
        return 422;
    }

    // Database errors -> 500
    if (errorCode.startsWith("DB_")) {
        return 500;
    }

    // External service errors -> 502 or 503
    if (errorCode.startsWith("EXTERNAL_")) {
        return 502;
    }

    // Rate limiting -> 429
    if (errorCode.startsWith("RATE_LIMIT_")) {
        return 429;
    }

    // WhatsApp errors
    if (errorCode.startsWith("WHATSAPP_")) {
        if (errorCode === WhatsAppErrorCodes.WHATSAPP_CONFIG_NOT_FOUND)
            return 404;
        return 502;
    }

    // Default to 500 for unknown/system errors
    return 500;
}
