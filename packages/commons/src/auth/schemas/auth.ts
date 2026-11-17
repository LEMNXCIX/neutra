import { z } from "zod";
import { emailSchema } from "../../_common/dto-primitives.js";

/** Ported from `requests/auth.request.ts`. */

export const ForgotPasswordDtoSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDtoSchema>;

export const ResetPasswordDtoSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordDtoSchema>;
