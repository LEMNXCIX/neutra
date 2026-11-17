/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
export interface AddToCartDTO {
    productId: string;
    amount: number;
}

/**
 * Aligned with the endpoint, not with the old name. `CartController`
 * reads `req.body.id` and hands it to `RemoveFromCartUseCase.execute` as the
 * `productId` argument of `ICartRepository.removeItem`, so `id` is the key a
 * client actually sends. The interface previously declared `productId`, which
 * no route, controller or use case read.
 */
export interface RemoveFromCartDTO {
    id: string;
}

export interface ChangeCartAmountDTO {
    amount: number;
}

/** The body of `POST /api/cart/add`. */
export type AddToCartDto = import("@neutra/commons").AddToCartDto;

/** The body of `PUT /api/cart/remove`. */
export type RemoveFromCartDto = import("@neutra/commons").RemoveFromCartDto;

// `ChangeCartAmountDTO` has no class: `CartController.changeAmount` is not
// mounted on any route, so nothing reads `amount` off a request body today and
// a validator class would constrain nothing. Add one with the route.
