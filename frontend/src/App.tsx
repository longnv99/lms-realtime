import { useState } from 'react';
import { checkHealth } from './api/client';
import type { HealthResponse } from '@lms/shared';

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCheck() {
    setLoading(true);
    setError(null);
    try {
      const data = await checkHealth();
      setHealth(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 640 }}>
      <h1>LMS Realtime</h1>
      <p>Scaffold P1 — đang chờ phase 2+</p>
      <button onClick={onCheck} disabled={loading} data-testid="check-health">
        {loading ? 'Đang kiểm tra...' : 'Kiểm tra backend /health'}
      </button>
      {health && <pre data-testid="health-result">{JSON.stringify(health, null, 2)}</pre>}
      {error && <p style={{ color: 'crimson' }}>Lỗi: {error}</p>}
    </main>
  );
}
