// Which database this process talks to.
//
// Locally it is DATABASE_URL, the file of the dev database. On Vercel the environment decides, with the same names
// the .env file uses for the remote databases: production reads PROD_*, a preview reads STAGING_*.
// A plain DATABASE_URL still works as a fallback, so a setup that already defines it keeps running.
// scripts/vercel-build.mjs repeats these rules for the build commands that run outside the app.
export const resolveDatabase = (env: NodeJS.ProcessEnv = process.env) => {
  const prefix = env.VERCEL_ENV === 'production' ? 'PROD' : env.VERCEL_ENV === 'preview' ? 'STAGING' : null

  return {
    url: (prefix && env[`${prefix}_DATABASE_URL`]) || env.DATABASE_URL,
    authToken: (prefix && env[`${prefix}_DATABASE_AUTH_TOKEN`]) || env.DATABASE_AUTH_TOKEN || undefined,
  }
}
