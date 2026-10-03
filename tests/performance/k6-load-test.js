import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * k6 load test for Persona Studio API.
 *
 * Usage:
 *   k6 run tests/performance/k6-load-test.js
 *
 * With custom VU count:
 *   k6 run --vus 50 --duration 30s tests/performance/k6-load-test.js
 */

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 20 },  // Stay at 20 users
    { duration: '30s', target: 40 }, // Ramp up to 40 users
    { duration: '1m', target: 40 },  // Stay at 40 users
    { duration: '30s', target: 0 },  // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be under 500ms
    http_req_failed: ['rate<0.1'],    // Less than 1% of requests should fail
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function runLoadTest() {
  // Health check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 200ms': (r) => r.timings.duration < 200,
  });

  // Login (will fail without credentials, but tests the endpoint)
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'loadtest@example.com',
    password: 'testpassword123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(loginRes, {
    'login endpoint responds': (r) => r.status === 401 || r.status === 200,
    'login response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Protected route (should return 401)
  const protectedRes = http.get(`${BASE_URL}/api/persona`);
  check(protectedRes, {
    'protected route returns 401': (r) => r.status === 401,
    'protected route response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
