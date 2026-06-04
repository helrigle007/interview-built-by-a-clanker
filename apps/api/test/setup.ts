// Runs before any test module is imported. auth.ts captures ENFORCE_AUTH at
// module-load time, so it must be set here for the JWT preHandler to populate
// request.user from the Bearer token during tests.
process.env.ENFORCE_AUTH = "true";
