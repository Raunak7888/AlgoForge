import cors from "cors";
import { JSON_BODY_LIMIT_BYTES } from "@algoforge/contracts";
import express from "express";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import { requestId } from "./middleware/request-id";
import { securityHeaders } from "./middleware/security-headers";
import { generalRateLimiter } from "./middleware/rate-limit";

import adminRouter              from "./routes/admin";
import algorithmRouter          from "./routes/algorithm";
import analysisRouter           from "./routes/analysis";
import authRouter               from "./routes/auth";
import categoryRouter           from "./routes/category";
import healthRouter             from "./routes/health";
import metaRouter               from "./routes/meta";
import openapiRouter            from "./routes/openapi";
import shareRouter              from "./routes/share";
import userRouter               from "./routes/users";
import explanationRouter        from "./routes/explanation";
import explanationSessionRouter from "./routes/explanation-session";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(requestId);
app.use(securityHeaders);
app.use(
  cors({
    origin:         env.webAppUrl,
    credentials:    true,
    methods:        ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    exposedHeaders: ["X-Request-Id"],
  }),
);
app.use(express.json({ limit: JSON_BODY_LIMIT_BYTES }));

// Liveness (/health) and readiness (/ready)
app.use(healthRouter);

// OpenAPI document generated from @algoforge/contracts (development only).
if (!env.isProduction) app.use(openapiRouter);

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/meta", metaRouter);
app.use("/api/algorithms", generalRateLimiter(), algorithmRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/analysis",  generalRateLimiter(), analysisRouter);

// Sessions mounted at a path that cannot be prefix-matched by the explain router.
app.use("/api/explain-sessions", explanationSessionRouter);
app.use("/api/explain",          explanationRouter);

app.use("/api/share", shareRouter);
app.use("/api/admin", adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
