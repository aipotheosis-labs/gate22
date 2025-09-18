// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { SentryOptions } from "./sentryoptions";

if (
  process.env.NEXT_PUBLIC_ENVIRONMENT &&
  process.env.NEXT_PUBLIC_ENVIRONMENT !== "local"
) {
  Sentry.init({
    dsn: "https://3ba6cc3561f8507550ad48af783ce285@o4508859021459456.ingest.us.sentry.io/4510037096923136",

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate:
      SentryOptions[
        process.env.NEXT_PUBLIC_ENVIRONMENT as "development" | "production"
      ].tracesSampleRate,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  });
}
