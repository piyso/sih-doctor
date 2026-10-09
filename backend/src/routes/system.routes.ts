/**
 * Demonstration mode: public status for every screen, and the administrator's switch.
 *
 * The switch takes either a signed-in administrator, or an administrator's username and PIN as
 * approval (so a presenter signed in at the doctor desk can switch without signing out). The
 * approval goes through the normal sign-in checks — rate limit, lockout, audit — and the session it
 * opens is closed at once.
 */

import { Router, Request, Response } from 'express';
import { AuthService } from '../security/auth.service';
import { securityConfig } from '../security/config';
import { rateLimit } from '../security/middleware';
import { DemoModeError, getDemoModeState, setDemoMode } from '../services/demoMode.service';

export const systemRouter = Router();

const switchLimiter = rateLimit('demo-mode', 10, 60_000);

/** GET /api/system/mode — whether this server runs with demo data, and whether it can be switched. */
systemRouter.get('/mode', (_req: Request, res: Response): void => {
  res.json({ success: true, data: getDemoModeState() });
});

/** POST /api/system/demo-mode { on: boolean, approver?: { username, pin } } */
systemRouter.post('/demo-mode', switchLimiter, (req: Request, res: Response): void => {
  const on = req.body?.on;
  if (typeof on !== 'boolean') {
    res.status(400).json({ error: 'Say whether demonstration mode should be on or off.', code: 'BAD_REQUEST' });
    return;
  }
  if (!securityConfig.demoToggle) {
    res.status(403).json({ error: 'Demonstration mode cannot be switched on this server.', code: 'TOGGLE_DISABLED' });
    return;
  }

  let actor = req.staff && req.staff.role === 'admin' && !req.staff.mustChangePin ? req.staff : null;
  if (!actor) {
    const { username, pin } = req.body?.approver || {};
    if (!username || !pin) {
      res.status(401).json({ error: 'An administrator must approve this. Enter an administrator username and PIN.', code: 'ADMIN_APPROVAL_REQUIRED' });
      return;
    }
    const result = AuthService.login(String(username), String(pin), { ip: req.ip, userAgent: req.headers['user-agent'] });
    if (!result.ok) {
      const message = result.reason === 'locked'
        ? `Too many wrong attempts. Try again in ${result.retryAfterMinutes} minute(s).`
        : result.reason === 'inactive' ? 'This account has been deactivated.' : 'Username or PIN is not correct.';
      res.status(result.reason === 'locked' ? 423 : 401).json({ error: message, code: result.reason.toUpperCase() });
      return;
    }
    AuthService.logout(result.token); // approval only; no session is kept
    if (result.user.role !== 'admin') {
      res.status(403).json({ error: 'Only an administrator can switch demonstration mode.', code: 'FORBIDDEN' });
      return;
    }
    if (result.user.isDemo && !securityConfig.allowDemo) {
      res.status(403).json({ error: 'Demo accounts cannot approve while demonstration mode is off. Use a real administrator account.', code: 'DEMO_ACCOUNT_OFF' });
      return;
    }
    actor = result.user;
  }

  try {
    const state = setDemoMode(on, { id: actor.id, name: actor.displayName, role: actor.role }, req.ip);
    res.json({ success: true, data: state });
  } catch (err: any) {
    if (err instanceof DemoModeError) {
      res.status(409).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});
