import { holdKey } from "@neutra/commons";
import type { IProductResponse } from "@/core/application/dtos/responses/product/product.response";
import { ProductResponse } from "@/core/application/dtos/responses/product/product.response";
import { EntityNotFoundError } from "@/core/domain/errors/domain-errors";
import type { IHoldProvider } from "@/core/providers/hold-provider.interface";
import type { ILogger } from "@/core/providers/logger.interface";
import type { IProductRepository } from "@/core/repositories/product.repository.interface";
import { Success, type UseCaseResult } from "@/core/utils/use-case-result";

export class GetProductUseCase {
    constructor(
        private productRepository: IProductRepository,
        private holdProvider: IHoldProvider,
        private readonly logger?: ILogger,
    ) {}

    async execute(
        tenantId: string | undefined,
        id: string,
    ): Promise<UseCaseResult<IProductResponse>> {
        const product = await this.productRepository.findById(tenantId, id);
        if (!product) {
            throw new EntityNotFoundError("Product", id);
        }
        // Key scope comes from the persisted product's tenant relationship.
        const key = holdKey("product", product.tenantId, product.id);
        let counts: Record<string, number> = {};
        try {
            counts = await this.holdProvider.countActive([key]);
        } catch (error: unknown) {
            // Holds are UX-only: report the fault but still serve the product.
            this.logger?.warn("Could not count active product holds", {
                error,
                tenantId,
                key,
            });
        }
        const held = counts[key] ?? 0;

        return Success(
            ProductResponse.fromEntity(
                product,
                held,
                Math.max(0, product.stock - held),
            ),
        );
    }
}
