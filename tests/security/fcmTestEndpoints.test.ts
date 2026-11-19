import { describe, expect, it } from 'vitest';
import fcmRoutes from '../../src/routes/fcm.routes';
import { GoalService } from '../../src/services/goal.service';
import { JobScheduler } from '../../src/services/JobScheduler';

describe('FCM test endpoint removal', () => {
  it('exposes only the authenticated FCM token route', () => {
    const routeLayers = fcmRoutes.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => layer.route);

    expect(routeLayers).toHaveLength(1);
    expect(routeLayers[0].path).toBe('/token');
    expect(routeLayers[0].methods.put).toBe(true);

    const middlewareNames = routeLayers[0].stack.map((layer: any) => layer.handle.name);
    expect(middlewareNames).toContain('authenticateJWT');
    expect(middlewareNames).toContain('authorizeRoleMiddleware');
  });

  it('does not expose generic test-job controls or GoalService cron test methods', () => {
    expect(JobScheduler).not.toHaveProperty('addJob');
    expect(JobScheduler).not.toHaveProperty('removeAllJobs');
    expect(JobScheduler).not.toHaveProperty('getActiveJobIds');
    expect(GoalService.prototype).not.toHaveProperty('testJobScheduler');
    expect(GoalService.prototype).not.toHaveProperty('scheduleJob');
    expect(GoalService.prototype).not.toHaveProperty('removeScheduledJob');
  });
});
