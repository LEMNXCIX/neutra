import type { ErrorDetail } from "@neutra/commons";

/**
 * Application-level error carrying an HTTP status and a machine-readable code.
 * Moved here verbatim from `types/api-response.ts`; the wire contracts it uses
 * (`ErrorDetail`) now come from `@neutra/commons`.
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly details?: ErrorDetail[];

    constructor(
        message: string,
        statusCode: number = 500,
        code: string = "SYSTEM_INTERNAL_ERROR",
        details?: ErrorDetail[],
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
