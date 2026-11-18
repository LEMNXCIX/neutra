// Wire enum + entity owned by @neutra/commons. Re-export under the existing
// local names so routes/services need no import changes.
import { CategoryType } from "@neutra/commons";
export { CategoryType };
export type { Category } from "@neutra/commons";

// The DTO names below have no exact counterpart in commons (commons uses
// `CreateCategoryDto` / `UpdateCategoryDto`), so they remain front-only.
export interface CreateCategoryDTO {
    name: string;
    description?: string;
    type: CategoryType;
    active?: boolean;
}

export interface UpdateCategoryDTO {
    name?: string;
    description?: string;
    type?: CategoryType;
    active?: boolean;
}
