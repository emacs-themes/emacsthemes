import * as Sentry from "@sentry/cloudflare";

interface Env {
  ENVIRONMENT?: string;
  SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
}

export const onRequest = Sentry.sentryPagesPlugin<Env>((context) => {
  const tracesSampleRate = Number(context.env.SENTRY_TRACES_SAMPLE_RATE ?? "0");
  const rate =
    Number.isFinite(tracesSampleRate) && tracesSampleRate >= 0 && tracesSampleRate <= 1
      ? tracesSampleRate
      : 0;

  return {
    dsn: context.env.SENTRY_DSN,
    enabled: Boolean(context.env.SENTRY_DSN),
    environment: context.env.ENVIRONMENT ?? "production",
    tracesSampleRate: rate,
  };
});
