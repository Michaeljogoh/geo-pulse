import { Router } from 'express';

import { asyncHandler } from '../lib/asyncHandler.js';
import { cacheStatusFromSource } from '../lib/cacheStatus.js';
import { resolveLookupIp } from '../lib/clientIp.js';
import { ok } from '../lib/envelope.js';
import { ipQuerySchema, type IpQuery } from '../lib/querySchemas.js';
import { validateQuery } from '../middleware/validate.js';
import { getGeo } from '../services/geoService.js';

export const geoRouter = Router();

geoRouter.get(
  '/api/geo',
  validateQuery(ipQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as IpQuery;
    const { ip, usedDemo } = resolveLookupIp(req, query.ip);
    const result = await getGeo(ip);

    res.locals.cacheStatus = cacheStatusFromSource(result.source);
    res.locals.provider = usedDemo ? 'demo' : result.provider;
    res.locals.country = result.value.countryCode;

    res.status(200).json(
      ok(result.value, {
        requestId: res.locals.requestId,
        startTime: res.locals.startTime,
        source: result.source,
        cached: result.source === 'cache-l1' || result.source === 'cache-l2',
        provider: usedDemo ? 'demo' : result.provider,
        confidence: result.value.confidence,
      }),
    );
  }),
);
