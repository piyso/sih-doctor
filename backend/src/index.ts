/**
 * Hospital OS backend entry point: listens on PORT and starts the background schedules.
 * The application itself is built in app.ts so tests can run it on an ephemeral port.
 */

import 'dotenv/config'; // must run before any module reads process.env
import { createServer, startSchedules, APP_VERSION } from './app';
import { PiyGraphService } from './services/piygraph.service';
import { securityConfig } from './security/config';
import { SCHEMA_VERSION } from './db/migrations';

const PORT = process.env.PORT || 8001;
const { server } = createServer();

server.listen(PORT, () => {
  startSchedules();
  const graphStats = PiyGraphService.getGraphStats();
  console.log(`
Hospital OS backend v${APP_VERSION} listening on http://localhost:${PORT}  (ws: /ws/ambient)
  Mode:            ${securityConfig.isProduction ? 'PRODUCTION' : 'development'}
  Schema:          v${SCHEMA_VERSION}
  Demo data:       ${securityConfig.allowDemo ? 'ON (do not use with real patients)' : 'off'}${securityConfig.demoToggle ? ' · switchable by an administrator' : ''}
  Kiosk enrolment: ${securityConfig.kioskOpen ? 'not required (open)' : 'required'}
  CORS origins:    ${securityConfig.corsAllowAll ? '* (development)' : securityConfig.corsOrigins.join(', ') || 'same-origin only'}
  Knowledge graph: ${graphStats.nodeCount} nodes, ${graphStats.edgeCount} edges
`);
  if (securityConfig.isProduction && securityConfig.allowDemo) {
    console.warn('[Security] WARNING: demo data is enabled in production. Only acceptable on a public demonstration server; set ALLOW_DEMO_DATA=false and DEMO_TOGGLE=false for a hospital.');
  }
});
