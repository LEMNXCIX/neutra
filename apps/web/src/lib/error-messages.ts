import { ErrorCodes, type ErrorDetail } from "@neutra/commons";

/**
 * User-facing copy for the backend's error codes.
 *
 * The backend publishes a stable machine-readable contract as `ErrorCodes` in
 * `@neutra/commons` (94 codes across 11 domains), the monorepo's single source
 * of truth for wire contracts. This module is the client half of that: the
 * `code` and `field` are translated here, the `message` is not.
 *
 * `errors[].message` is written for developers and arrives in English, so it is
 * never rendered. Nor is the envelope `message`, which the BFF forwards
 * verbatim and which is not reliably ours. When a code is unknown the caller's
 * Spanish fallback is used instead, so the only way an English string reaches
 * the screen is if a caller puts one there on purpose.
 *
 * `error-codes.test.ts` reads `ErrorCodes` from `@neutra/commons` and fails when
 * a published code resolves to nothing, so adding a code there is a test
 * failure here.
 */

/** Specific codes where the domain fallback would be too vague to act on. */
const CODE_MESSAGES: Record<string, string> = {
    // AUTH
    [ErrorCodes.INVALID_CREDENTIALS]:
        "El correo o la contraseña son incorrectos.",
    [ErrorCodes.MISSING_CREDENTIALS]: "Ingresá tu correo y contraseña.",
    [ErrorCodes.INVALID_TOKEN]:
        "Tu sesión no es válida. Volvé a iniciar sesión.",
    [ErrorCodes.TOKEN_EXPIRED]: "Tu sesión expiró. Volvé a iniciar sesión.",
    [ErrorCodes.SESSION_EXPIRED]: "Tu sesión expiró. Volvé a iniciar sesión.",
    [ErrorCodes.MISSING_TOKEN]: "Tu sesión expiró. Volvé a iniciar sesión.",
    [ErrorCodes.UNAUTHORIZED]: "Necesitás iniciar sesión para continuar.",
    [ErrorCodes.FORBIDDEN]: "No tenés permisos para realizar esta acción.",
    [ErrorCodes.INSUFFICIENT_PERMISSIONS]:
        "No tenés permisos para realizar esta acción.",
    [ErrorCodes.PERMISSION_DENIED]:
        "No tenés permisos para realizar esta acción.",
    [ErrorCodes.ACCOUNT_INACTIVE]:
        "Tu cuenta está desactivada. Contactá a soporte.",
    [ErrorCodes.USER_ALREADY_EXISTS]: "Ya existe una cuenta con ese correo.",
    // The backend distinguishes two multi-tenant registration outcomes that
    // used to share one code, and they have different remedies. Keeping the
    // backend's codes distinct is what lets this map say the right thing.
    // api-neutra-v2/types/error-codes.ts, AuthErrorCodes.
    [ErrorCodes.ALREADY_MEMBER_OF_TENANT]:
        "Ya tenés una cuenta en este negocio. Iniciá sesión en lugar de registrarte.",
    [ErrorCodes.EMAIL_TAKEN_IN_OTHER_TENANT]:
        "Ese correo ya está registrado en otro negocio. Iniciá sesión ahí, o usá la contraseña que creaste allí para unirte a este.",
    // AUTH_FORBIDDEN used to cover all three of these plus two more, so the
    // only copy available was "you do not have permission", which points the
    // user at the wrong remedy.
    [ErrorCodes.RESOURCE_NOT_OWNED]: "Solo podés ver tus propios recursos.",
    [ErrorCodes.SUPER_ADMIN_REQUIRED]:
        "Esta acción es solo para super administradores.",

    // VALIDATION
    [ErrorCodes.MISSING_REQUIRED_FIELDS]: "Completá los campos obligatorios.",
    [ErrorCodes.INVALID_EMAIL]: "Ingresá un correo válido.",
    [ErrorCodes.INVALID_PASSWORD]: "La contraseña no cumple los requisitos.",
    [ErrorCodes.INVALID_FORMAT]: "Revisá el formato del dato ingressado.",
    [ErrorCodes.INVALID_LENGTH]: "Revisá la longitud del valor ingressado.",
    [ErrorCodes.INVALID_ENUM_VALUE]:
        "Ese valor no está entre las opciones válidas.",
    [ErrorCodes.INVALID_DATA_TYPE]:
        "El dato ingressado no tiene el formato esperado.",

    // RESOURCE
    [ErrorCodes.NOT_FOUND]: "No encontramos ese recurso.",
    [ErrorCodes.ROUTE_NOT_FOUND]: "La página que buscás no existe.",
    [ErrorCodes.ALREADY_EXISTS]: "Ese recurso ya existe.",
    [ErrorCodes.CONFLICT]: "Ese recurso tiene un conflicto con otro existente.",
    [ErrorCodes.GONE]: "Ese recurso ya no está disponible.",
    [ErrorCodes.INVALID_STATE]:
        "No se puede realizar esa acción en este estado.",

    // TENANT
    [ErrorCodes.TENANT_REQUIRED]: "Seleccioná una organización para continuar.",
    [ErrorCodes.TENANT_NOT_FOUND]: "No encontramos esa organización.",
    [ErrorCodes.TENANT_INACTIVE]: "Esa organización está inactiva.",
    [ErrorCodes.TENANT_SLUG_EXISTS]:
        "Ese identificador de organización ya está en uso.",
    [ErrorCodes.FEATURE_NOT_ENABLED]:
        "Tu organización no tiene esta funcionalidad habilitada.",
    [ErrorCodes.TYPE_NOT_ALLOWED]: "Tu organización no permite esta operación.",
    [ErrorCodes.MEMBERSHIP_REQUIRED]:
        "Tu cuenta no pertenece a esta organización. Pedí que te agreguen.",

    // BUSINESS
    [ErrorCodes.CART_EMPTY]: "Tu carrito está vacío.",
    [ErrorCodes.INSUFFICIENT_STOCK]:
        "No hay stock suficiente para algunos productos.",
    [ErrorCodes.INVALID_QUANTITY]: "La cantidad indicada no es válida.",
    [ErrorCodes.ORDER_ALREADY_PROCESSED]: "Este pedido ya fue procesado.",
    [ErrorCodes.PAYMENT_FAILED]:
        "No pudimos procesar el pago. Intentá de nuevo.",
    [ErrorCodes.INVALID_STATUS_TRANSITION]:
        "Ese cambio de estado no está permitido.",
    [ErrorCodes.RESOURCE_NOT_FOUND]: "No encontramos ese recurso.",
    [ErrorCodes.RESOURCE_CONFLICT]:
        "Ese recurso tiene un conflicto con otro existente.",
    [ErrorCodes.APPOINTMENT_STATUS_CONFLICT]: "La cita ya cambió de estado.",
    [ErrorCodes.ORDER_STATUS_CONFLICT]: "El pedido ya cambió de estado.",
    [ErrorCodes.INVALID_APPOINTMENT_STATUS]: "Ese estado de cita no es válido.",
    [ErrorCodes.START_TIME_NOT_IN_FUTURE]: "La fecha debe ser futura.",
    [ErrorCodes.HOLIDAY_CLOSED]: "El negocio está cerrado ese día.",
    [ErrorCodes.OUTSIDE_WORKING_HOURS]:
        "Ese horario está fuera del horario de atención.",
    [ErrorCodes.STAFF_HOURS_CONFLICT]:
        "El miembro del equipo no puede tener horarios en un día que el negocio tiene cerrado.",
    [ErrorCodes.INVALID_COUPON]: "El cupón no es válido.",
    [ErrorCodes.COUPON_UNAVAILABLE]: "Ese cupón ya no está disponible.",
    [ErrorCodes.COUPON_NOT_OWNED]: "Ese cupón no está asociado a tu cuenta.",
    [ErrorCodes.REWARD_COUPON_NOT_OWNED]: "Todavía no reclamaste ese premio.",
    [ErrorCodes.COUPONS_FEATURE_REQUIRED]:
        "Tu organización no tiene los cupones habilitados.",
    [ErrorCodes.LOYALTY_FEATURE_REQUIRED]:
        "Tu organización no tiene la fidelización habilitada.",
    [ErrorCodes.LOYALTY_REQUIRES_COUPONS]:
        "La fidelización requiere los cupones habilitados.",
    [ErrorCodes.LOYALTY_OBLIGATIONS_EXIST]:
        "Tenés obligaciones pendientes de Campaigns anteriores.",
    [ErrorCodes.BUSINESS_RULE_VIOLATION]: "No se puede completar la operación.",

    // LOYALTY
    [ErrorCodes.CAMPAIGN_NOT_CLAIMABLE]:
        "Todavía no podés reclamar esta campaña.",
    [ErrorCodes.CAMPAIGN_CLAIM_LIMIT_REACHED]:
        "Alcanzaste el límite de reclamos de esta campaña.",
    [ErrorCodes.CAMPAIGN_NOT_DRAFT]: "Esta campaña ya fue publicada.",
    [ErrorCodes.CAMPAIGN_ARCHIVE_TOO_EARLY]:
        "La campaña no puede archivarse todavía.",
    [ErrorCodes.CAMPAIGN_ALREADY_ACTIVE_PER_TENANT]:
        "Ya hay una campaña activa para esta organización.",
    [ErrorCodes.CAMPAIGN_SOURCE_NOT_COMPATIBLE]:
        "El origen de la campaña no es compatible.",
    [ErrorCodes.CAMPAIGN_TRANSITION_CONFLICT]:
        "Ese cambio de estado de campaña no está permitido.",
    [ErrorCodes.INVALID_CAMPAIGN_TRANSITION]:
        "Ese cambio de estado de campaña no está permitido.",
    [ErrorCodes.TARGET_NOT_REACHED]:
        "Todavía no alcanzaste el objetivo de la campaña.",
    [ErrorCodes.TEMPLATE_NOT_REDEEMABLE]: "Ese premio no se puede canjear.",
    // Kept without the LOYALTY_ prefix, as published. The backend calls this
    // shape out explicitly: renaming it to the prefix order would be a wire
    // change, not a cleanup.
    [ErrorCodes.INVALID_REWARD_TEMPLATE]: "Ese premio no se puede canjear.",

    // SYSTEM, EXTERNAL, DB, RATE_LIMIT, WHATSAPP
    [ErrorCodes.CONNECTION_FAILED]: "No pudimos conectar con la base de datos.",
    [ErrorCodes.TRANSACTION_FAILED]:
        "No pudimos completar la operación. Intentá de nuevo.",
    [ErrorCodes.CONSTRAINT_VIOLATION]:
        "La operación viola una restricción de datos.",
    [ErrorCodes.UNIQUE_VIOLATION]: "Ese registro ya existe.",
    [ErrorCodes.FOREIGN_KEY_VIOLATION]:
        "No se puede completar la operación por datos relacionados.",
    [ErrorCodes.TIMEOUT]: "La operación tardó demasiado. Intentá de nuevo.",
    [ErrorCodes.THIRD_PARTY_UNAVAILABLE]:
        "Un servicio externo no está disponible.",
    [ErrorCodes.THIRD_PARTY_TIMEOUT]: "Un servicio externo tardó demasiado.",
    [ErrorCodes.THIRD_PARTY_ERROR]: "Un servicio externo devolvió un error.",
    [ErrorCodes.PROVIDER_AUTH_FAILED]:
        "No pudimos autenticarnos con el servicio externo.",
    [ErrorCodes.TOO_MANY_REQUESTS]:
        "Demasiados intentos. Esperá un momento e intentá de nuevo.",
    [ErrorCodes.QUOTA_EXCEEDED]: "Alcanzaste el límite de operaciones.",
    [ErrorCodes.WHATSAPP_CONFIG_NOT_FOUND]:
        "No encontramos la configuración de WhatsApp.",
    [ErrorCodes.WHATSAPP_MESSAGE_FAILED]:
        "No pudimos enviar el mensaje por WhatsApp.",
};

/** Last resort for any code a newer backend may add: resolve by domain prefix. */
const DOMAIN_MESSAGES: Record<string, string> = {
    AUTH: "Tu sesión no es válida. Volvé a iniciar sesión.",
    VALIDATION: "Revisá los datos que ingresaste.",
    RESOURCE: "No pudimos completar la operación con ese recurso.",
    TENANT: "Revisá la configuración de tu organización.",
    BUSINESS: "No pudimos completar la operación.",
    LOYALTY: "Revisá los datos de la campaña de fidelización.",
    DB: "No pudimos completar la operación. Intentá de nuevo.",
    EXTERNAL: "Un servicio externo no respondió correctamente.",
    SYSTEM: "Ocurrió un error en el sistema. Intentá de nuevo.",
    RATE_LIMIT: "Demasiados intentos. Esperá un momento.",
    WHATSAPP: "No pudimos completar la operación con WhatsApp.",
};

/** Field names are technical; users know these words. */
const FIELD_LABELS: Record<string, string> = {
    password: "la contraseña",
    email: "el correo",
    name: "el nombre",
    phone: "el teléfono",
    address: "la dirección",
    slug: "el identificador",
    quantity: "la cantidad",
    coupon: "el cupón",
    code: "el código",
    title: "el título",
    description: "la descripción",
    price: "el precio",
    role: "el rol",
};

const labelFor = (field?: string): string | undefined => {
    if (!field) return undefined;
    const key = field.split(".").pop() ?? field;
    return FIELD_LABELS[key.toLowerCase()];
};

const CATCH_ALL = "No pudimos completar la operación.";

/**
 * Match the longest known domain prefix, not just the first underscore token.
 * `RATE_LIMIT_*` is a published domain whose name contains an underscore, so
 * `code.split("_")[0]` ("RATE") would miss its fallback and leak the catch-all
 * for any code added to that domain later.
 */
const domainOf = (code: string): string | undefined => {
    let match: string | undefined;
    for (const domain of Object.keys(DOMAIN_MESSAGES)) {
        if (
            (code === domain || code.startsWith(`${domain}_`)) &&
            (!match || domain.length > match.length)
        ) {
            match = domain;
        }
    }
    return match;
};

const domainMessage = (code: string): string => {
    const domain = domainOf(code);
    return domain ? DOMAIN_MESSAGES[domain] : CATCH_ALL;
};

/** How a code was resolved. 'none' means the catch-all, i.e. untranslated. */
export type Resolution = "specific" | "domain" | "none";

export const resolutionFor = (code: string): Resolution => {
    if (typeof code !== "string" || !code) return "none";
    if (Object.hasOwn(CODE_MESSAGES, code)) return "specific";
    return domainOf(code) ? "domain" : "none";
};

/**
 * Translate one backend error detail. Never returns the detail's own `message`,
 * which is written for developers and arrives in English.
 */
export function translateErrorDetail(detail: ErrorDetail): string {
    const code = typeof detail.code === "string" ? detail.code : "";
    const label = labelFor(detail.field);
    const base = CODE_MESSAGES[code] ?? domainMessage(code);
    return label ? `${base} Revisá ${label}.` : base;
}

/** The first detail that carries a usable code, or undefined if none does. */
const firstDetail = (errors: unknown): ErrorDetail | undefined => {
    if (!Array.isArray(errors)) return undefined;
    for (const entry of errors) {
        if (!entry || typeof entry !== "object") continue;
        const detail = entry as ErrorDetail;
        if (typeof detail.code !== "string" || !detail.code) continue;
        return detail;
    }
    return undefined;
};

/** The most specific translated message available, or undefined if there is none. */
export const firstTranslatedError = (errors: unknown): string | undefined => {
    const detail = firstDetail(errors);
    return detail ? translateErrorDetail(detail) : undefined;
};

/** A translated backend detail, optionally scoped to the field it names. */
export interface TranslatedFieldError {
    field?: string;
    message: string;
}

/**
 * Every usable detail of a thrown backend error, translated and paired with the
 * field it names. Forms use this to attach a server rejection to the individual
 * input instead of only showing a single banner. Like every other helper here,
 * it reads `code` and `field` only — the developer-facing English `message` is
 * never returned.
 */
export function translatedFieldErrors(error: unknown): TranslatedFieldError[] {
    if (!error || typeof error !== "object") return [];
    const errors = (error as ErrorLike).errors;
    if (!Array.isArray(errors)) return [];

    const result: TranslatedFieldError[] = [];
    for (const entry of errors) {
        if (!entry || typeof entry !== "object") continue;
        const detail = entry as ErrorDetail;
        if (typeof detail.code !== "string" || !detail.code) continue;
        result.push({
            ...(typeof detail.field === "string" && detail.field
                ? { field: detail.field }
                : {}),
            message: translateErrorDetail(detail),
        });
    }
    return result;
}

type ErrorLike = {
    errors?: unknown;
    statusCode?: number;
    name?: string;
};

/**
 * The first machine-readable `code` of a thrown error, from its `errors` array.
 *
 * The code is the stable half of the backend contract — `CODE_MESSAGES` keys
 * its Spanish copy off it — and it is the only thing a caller may branch on:
 * the translated text is copy that can change, and the raw `message` is
 * developer-facing English that is never rendered.
 */
export const firstErrorCode = (error: unknown): string | undefined => {
    if (!error || typeof error !== "object") return undefined;
    return firstDetail((error as ErrorLike).errors)?.code;
};

/**
 * Human-readable text for anything a BFF call can reject with. `fallback` is the
 * caller's Spanish copy and is what an unrecognised shape resolves to, so no
 * backend string is ever surfaced by accident.
 */
export function errorMessageFrom(error: unknown, fallback: string): string {
    if (error && typeof error === "object") {
        const translated = firstTranslatedError((error as ErrorLike).errors);
        if (translated) return translated;
    }
    return fallback;
}
