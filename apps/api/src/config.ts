export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is required. Set it before starting the API, e.g.: JWT_SECRET=your-secret pnpm dev (see .env.example)"
    );
  }
  return secret;
}
