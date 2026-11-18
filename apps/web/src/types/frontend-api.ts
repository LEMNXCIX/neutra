// Wire contract. @neutra/commons is the single source of truth: the envelope,
// schemas, error codes and enums are re-exported so existing
// `@/types/frontend-api` consumers keep their imports unchanged.
export {
    AppointmentStatus,
    CategoryType,
    ErrorCodes,
    OrderStatus,
    TenantType,
    errorDetailSchema,
    responsePaginationSchema,
    standardResponseSchema,
} from "@neutra/commons";
export type {
    ErrorCode,
    ErrorDetail,
    ResponsePagination as Pagination,
    StandardResponse,
} from "@neutra/commons";

// Entity/DTO names that exist verbatim in commons are re-exported too. These
// are currently unused inside the web app but are part of the public surface
// of this module, so their names are preserved.
export type {
    AddToCartDto,
    Cart,
    CartItem,
    Category,
    CreateOrderDto,
    Order,
    OrderItem,
    Permission,
    Product,
    Slideshow,
} from "@neutra/commons";

// ---------------------------------------------------------------------------
// Front-only shapes. The API wire contract has no equivalent for these, so
// they remain local rather than being mapped to a different commons type.
// ---------------------------------------------------------------------------

export interface Role {
    id: string;
    name: string;
    description?: string | null;
    level: number;
    createdAt: string;
    updatedAt: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    roleId: string;
    role?: Role;
    profilePic?: string | null;
    googleId?: string | null;
    facebookId?: string | null;
    twitterId?: string | null;
    githubId?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateUserDto {
    name: string;
    email: string;
    password: string;
    provider?: string;
    profilePic?: string;
}

export interface LoginDto {
    email: string;
    password: string;
}

export interface ProductCreateDto {
    name: string;
    description?: string;
    categories?: string[];
    price?: number;
    image?: string[]; // Note: Backend DTO says string[], schema says String? (single). Check controller.
    stock?: number;
}
