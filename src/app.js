import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { apiReference } from "@scalar/express-api-reference";
import authRoutes from "./routes/auth.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import remindersRoutes from "./routes/reminders.routes.js";
import usersRoutes from "./routes/users.routes.js";
import routes from "./routes/index.js";
import clientErrorsRoutes from "./routes/clientErrors.routes.js";
import navigationRoutes from "./routes/navigation.routes.js";
import staticPagesRoutes from "./routes/staticPages.routes.js";
import { env } from "./config/env.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { uiInteractionLogger } from "./middleware/uiInteractionLogger.js";
import { openApiSpec } from "./docs/openapi.js";

export function createApp() {
  const app = express();

  if (env.isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    })
  );
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(uiInteractionLogger);

  app.get("/openapi.json", (_req, res) => {
    res.json(openApiSpec);
  });
  app.use(
    "/docs",
    apiReference({
      spec: { content: openApiSpec },
    })
  );

  app.use("/api/auth", authRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/reminders", remindersRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/client-errors", clientErrorsRoutes);
  app.use("/api/navigation", navigationRoutes);
  app.use(staticPagesRoutes);
  app.use(routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

