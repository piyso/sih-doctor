/**
 * Staff sign-in, PIN management and kiosk device check.
 */

import { Router, Request, Response } from 'express';
import { AuthService, issueStreamTicket, pinPolicyError } from '../security/auth.service';
import { rateLimit, requireStaff } from '../security/middleware';
import { securityConfig } from '../security/config';
import { audit } from '../security/audit';

export const authRouter = Router();

// Per-IP cap; targeted PIN guessing is stopped separately by the per-account lockout.
const loginLimiter = rateLimit('login', 30, 60_000);

/** What the sign-in screen needs to know before anyone is signed in. */
authRouter.get('/status', (_req: Request, res: Response): void => {
  const users = AuthService.listUsers();
  res.json({
    needsSetup: users.length === 0,
    setupNeedsCode: securityConfig.isProduction,
    demoMode: securityConfig.allowDemo,
    // Usernames only (never PINs), so testers know which demo accounts exist.
    demoAccounts: securityConfig.allowDemo
      ? users.filter(u => u.isDemo && u.active).map(u => ({ username: u.username, displayName: u.displayName, role: u.role }))
      : [],
    kioskOpen: securityConfig.kioskOpen
  });
});

/** First-run: create the first administrator. Only works while there are no staff accounts. */
authRouter.post('/setup', loginLimiter, (req: Request, res: Response): void => {
  if (AuthService.countUsers() > 0) {
    res.status(409).json({ error: 'Setup has already been completed.' });
    return;
  }
  const { username, displayName, pin, setupCode } = req.body || {};
  if (securityConfig.isProduction && (!process.env.SETUP_CODE || setupCode !== process.env.SETUP_CODE)) {
    audit(req, 'auth.setup', null, {}, 'denied');
    res.status(403).json({ error: 'The setup code is not correct. It is set by the server administrator (SETUP_CODE).' });
    return;
  }
  try {
    const user = AuthService.createUser({ username, displayName, role: 'admin', pin });
    audit(req, 'auth.setup', user.id, { username: user.username });
    res.json({ success: true, user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

authRouter.post('/login', loginLimiter, (req: Request, res: Response): void => {
  const { username, pin } = req.body || {};
  if (!username || !pin) {
    res.status(400).json({ error: 'Enter your username and PIN.' });
    return;
  }
  const result = AuthService.login(String(username), String(pin), { ip: req.ip, userAgent: req.headers['user-agent'] });
  if (!result.ok) {
    const message = result.reason === 'locked'
      ? `Too many wrong attempts. Try again in ${result.retryAfterMinutes} minute(s) or ask an administrator.`
      : result.reason === 'inactive'
      ? 'This account has been deactivated. Contact the administrator.'
      : 'Username or PIN is not correct.';
    res.status(result.reason === 'locked' ? 423 : 401).json({ error: message, code: result.reason.toUpperCase() });
    return;
  }
  res.json({ success: true, token: result.token, expiresAt: result.expiresAt, user: result.user, idleMinutes: securityConfig.idleMinutes });
});

authRouter.post('/logout', (req: Request, res: Response): void => {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    AuthService.logout(h.slice(7).trim());
    if (req.staff) audit(req, 'auth.logout', req.staff.id);
  }
  res.json({ success: true });
});

authRouter.get('/me', (req: Request, res: Response): void => {
  if (!req.staff) {
    res.status(401).json({ error: 'Not signed in.', code: 'AUTH_REQUIRED' });
    return;
  }
  res.json({ success: true, user: req.staff, idleMinutes: securityConfig.idleMinutes });
});

authRouter.post('/change-pin', loginLimiter, (req: Request, res: Response): void => {
  if (!req.staff) {
    res.status(401).json({ error: 'Not signed in.', code: 'AUTH_REQUIRED' });
    return;
  }
  const { currentPin, newPin } = req.body || {};
  if (!AuthService.verifyPin(req.staff.id, String(currentPin || ''))) {
    audit(req, 'auth.change_pin', req.staff.id, {}, 'denied');
    res.status(400).json({ error: 'Your current PIN is not correct.' });
    return;
  }
  if (String(currentPin) === String(newPin)) {
    res.status(400).json({ error: 'The new PIN must be different from the current one.' });
    return;
  }
  const err = pinPolicyError(newPin);
  if (err) {
    res.status(400).json({ error: err });
    return;
  }
  AuthService.setPin(req.staff.id, String(newPin), false);
  audit(req, 'auth.change_pin', req.staff.id);
  res.json({ success: true, user: AuthService.getUser(req.staff.id) });
});

/** One-time, 60-second ticket so EventSource / WebSocket connections can authenticate. */
authRouter.post('/stream-ticket', requireStaff(), (req: Request, res: Response): void => {
  res.json({ ticket: issueStreamTicket(req.staff!.id) });
});

/** Lets a kiosk check that its stored device token is still valid. */
authRouter.get('/kiosk-device', (req: Request, res: Response): void => {
  res.json({
    enrolled: !!req.kioskDevice,
    device: req.kioskDevice || null,
    kioskOpen: securityConfig.kioskOpen
  });
});
