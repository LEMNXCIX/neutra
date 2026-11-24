import { holdKey } from "@neutra/commons";
import type { IProductResponse } from "@/core/application/dtos/responses/product/product.response";
import { ProductResponse } from "@/core/application/dtos/responses/product/product.response";
import type { IHoldProvider } from "@/core/providers/hold-provider.interface";
import type { IProductRepository } from "@/core/repositories/product.repository.interface";
import { Success, type UseCaseResult } from "@/core/utils/use-case-result";

export class GetAllProductsUseCase {
    constructor(
        private productRepository: IProductRepository,
        private holdProvider: IHoldProvider,
    ) {}

    async execute(
        tenantId: string | undefined,
    ): Promise<UseCaseResult<IProductResponse[]>> {
        const products = await this.productRepository.findAll(tenantId);
        // One bulk read keeps list endpoints O(1) provider round-trips. The
        // tenant for each key comes from the product record, never the caller.
        const keys = products.map((product) =>
            holdKey("product", product.tenantId, product.id),
        );
        const counts = await this.holdProvider.countActive(keys);
        const data = products.map((product, index) => {
            const held = counts[keys[index]] ?? 0;
            return ProductResponse.fromEntity(
                product,
                held,
                Math.max(0, product.stock - held),
            );
        });

        return Success(data, "Products listed successfully");
    }
}
