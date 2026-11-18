/**
 * Slideshow Type Definitions
 * Based on backend DTOs
 *
 * Front-only projection: the UI reads `tenantId`, which the shared
 * `Slideshow` wire contract in @neutra/commons does not carry. Kept local.
 */

export interface Slideshow {
    id: string;
    tenantId: string;
    title: string;
    img: string;
    desc?: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateSlideshowDTO {
    title: string;
    img: string;
    desc?: string;
    active?: boolean;
}

export interface UpdateSlideshowDTO {
    title?: string;
    img?: string;
    desc?: string;
    active?: boolean;
}

// Aliases for backward compatibility
export type Slide = Slideshow;
export type CreateSlideDTO = CreateSlideshowDTO;
export type UpdateSlideDTO = UpdateSlideshowDTO;
