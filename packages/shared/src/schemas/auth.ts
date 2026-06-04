import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email(),
});

export type User = z.infer<typeof userSchema>;

export interface AuthResponse {
  token: string;
  user: User;
}
