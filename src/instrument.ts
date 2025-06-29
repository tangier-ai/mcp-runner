import * as Sentry from "@sentry/nestjs";

const cleanBody = (body: Record<string, any>) => {
  if ("env" in body) {
    body.env = "[ REDACTED ]";
  }

  if ("args" in body) {
    body.args = "[ REDACTED ]";
  }
};

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    sendDefaultPii: false,
    beforeSend: (event) => {
      if (typeof event.request?.data === "string") {
        try {
          const parsed = JSON.parse(event.request.data);
          event.request.data = JSON.stringify(cleanBody(parsed));
        } catch {}
      } else if (
        typeof event.request?.data === "object" &&
        !!event.request.data
      ) {
        event.request.data = cleanBody(event.request.data);
      }

      return event;
    },
  });
}
