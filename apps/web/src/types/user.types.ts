// Front-only projection: the UI reads `tenantId`, optional provider ids and
// optional timestamps that the shared `User` wire contract does not carry.
// `CreateUserDTO` also has no exact commons counterpart. Kept local.
import type { Role } from "./role.types";

export interface User {
    id: string;
    name: string;
    email: string;
    password?: string;
    roleId: string;
    role?: Role; // Optional, populated when needed
    profilePic?: string;
    active: boolean;
    googleId?: string;
    facebookId?: string;
    githubId?: string;
    twitterId?: string;
    tenantId: string;
    createdAt?: Date;
    updatedAt?: Date;
    tenant?: {
        id: string;
        name: string;
        slug: string;
    };
}

export interface CreateUserDTO {
    name: string;
    email: string;
    password?: string;
    roleId?: string; // Optional, defaults to USER role if not provided
    profilePic?: string;
    active?: boolean;
    googleId?: string;
    facebookId?: string;
    githubId?: string;
    twitterId?: string;
}
