import { z } from "zod";

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginDto:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 */
export const LoginDtoSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});
export type LoginDto = z.infer<typeof LoginDtoSchema>;

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateUserDto:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         name:
 *           type: string
 *           minLength: 3
 *           maxLength: 100
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 8
 *         provider:
 *           type: string
 *         profilePic:
 *           type: string
 */
export const CreateUserDtoSchema = z.object({
    name: z.string().trim().min(3).max(100),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8),
    provider: z.string().optional(),
    profilePic: z.string().optional(),
});
export type CreateUserDto = z.infer<typeof CreateUserDtoSchema>;
