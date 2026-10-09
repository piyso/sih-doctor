/**
 * HTTP security middleware: headers, CORS, rate limiting, authentication and role guards.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import { securityConfig, StaffRole } from './config';
import { AuthService, StaffUser, KioskDevice } from './auth.service';
import { audit } from './audit';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: StaffUser;
      staffSessionId?: string;
      kioskDevice?: KioskDevice;
    }
  }
}

/** Conservative headers for a JSON API. The SPA itself is served (and given its own CSP) by nginx. */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  if (securityConfig.isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.removeHeader('X-Powered-By');
  next();
};

export const corsMiddleware = cors({
  origin(origin, cb) {
    // Same-origin requests and non-browser clients send no Origin header.
    if (!origin || securityConfig.corsAllowAll) return cb(null, true);
    if (securityConfig.corsOrigins.includes(origin)) return cb(null, true);
    // Development convenience: any device on the LAN talking to the dev server.
    if (!securityConfig.isProduction && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  credentials: false,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Kiosk-Token'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 600
});

/**
 * Fixed-window rate limiter kept in memory (one backend process per hospital site).
 * Keyed by client IP plus a bucket name.
 */
export function rateLimit(bucket: string, limit: number, windowMs: number): RequestHandler {
  const hits = new Map<string, { count: number; reset: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    const key = `${bucket}:${req.ip}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
    if (entry.count > limit) {
      res.setHeader('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.', code: 'RATE_LIMITED' });
      return;
    }
    next();
  };
}

const bearer = (req: Request): string => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
};

/** Attach the staff user and/or kiosk device to the request. Never rejects. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = bearer(req);
  if (token) {
    const s = AuthService.resolveSession(token);
    // Demo accounts (published PINs) only work while demonstration mode is on.
    if (s && !(s.user.isDemo && !securityConfig.allowDemo)) {
      req.staff = s.user;
      req.staffSessionId = s.sessionId;
    }
  }
  const kioskToken = String(req.headers['x-kiosk-token'] || '');
  if (kioskToken) {
    const d = AuthService.resolveDevice(kioskToken);
    if (d) req.kioskDevice = d;
  }
  next();
};

function deny(req: Request, res: Response, status: 401 | 403, code: string, message: string) {
  audit(req, 'access.denied', req.originalUrl.slice(0, 120), { method: req.method, code }, 'denied');
  res.status(status).json({ error: message, code });
}

/** Require a logged-in staff member, optionally with one of the given roles. */
export function requireStaff(...roles: StaffRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.staff) return deny(req, res, 401, 'AUTH_REQUIRED', 'Please sign in to continue.');
    if (req.staff.mustChangePin) return deny(req, res, 403, 'PIN_CHANGE_REQUIRED', 'Please set a new PIN before continuing.');
    if (roles.length && !roles.includes(req.staff.role)) {
      return deny(req, res, 403, 'FORBIDDEN', 'Your role does not have access to this.');
    }
    next();
  };
}

/** Patient-facing kiosk endpoints: an enrolled kiosk, any signed-in staff member, or open dev mode. */
export const requireKioskOrStaff: RequestHandler = (req, res, next) => {
  if (req.kioskDevice || (req.staff && !req.staff.mustChangePin) || securityConfig.kioskOpen) return next();
  deny(req, res, 401, 'KIOSK_NOT_ENROLLED', 'This kiosk is not enrolled. Ask hospital staff to set it up.');
};

/** Demo-data endpoints exist only when ALLOW_DEMO_DATA is on (default: off in production). */
export const demoOnly: RequestHandler = (req, res, next) => {
  if (securityConfig.allowDemo) return next();
  res.status(404).json({ error: 'Not found' });
};

/** Last-resort error handler: never leak stack traces or SQL to the client in production. */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'The upload is too large.', code: 'PAYLOAD_TOO_LARGE' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'The request was not valid JSON.', code: 'BAD_JSON' });
    return;
  }
  console.error('[Server] Unhandled error on', req.method, req.originalUrl, err);
  res.status(500).json({ error: securityConfig.isProduction ? 'Something went wrong on the server.' : String(err?.message || err) });
}
