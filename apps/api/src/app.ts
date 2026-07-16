import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { mountSwagger } from './docs/swagger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { requestContext } from './middleware/requestContext.js';
import { createApiRouter } from './routes/index.js';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);

  app.use(express.json());
  app.use(requestContext);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS,
      credentials: true,
    }),
  );
  app.use(rateLimiter);
  mountSwagger(app);
  app.use(createApiRouter());
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
