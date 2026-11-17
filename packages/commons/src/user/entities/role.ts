import type { Permission } from "./permission.js";

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  level: number;
  active: boolean;
  permissions?: Permission[];
  createdAt: Date;
  updatedAt: Date;
}
