export interface HealthResponse {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
}

export const HEALTH_RESPONSE_DEFAULT: HealthResponse = {
  status: 'ok',
  uptimeSeconds: 0,
  timestamp: new Date(0).toISOString(),
};
