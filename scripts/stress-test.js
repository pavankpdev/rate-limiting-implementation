#!/usr/bin/env node
//
// stress-test.js - simple test runner to blast the demo server endpoints
// Usage: node scripts/stress-test.js --host=http://localhost:3000 --total=40 --concurrency=8 --auth=true
//
// Options:
//   --host=<url>         e.g. http://localhost:3000
//   --total=<n>          total requests per test (default 40)
//   --concurrency=<n>    parallel requests per batch (default 8)
//   --userId=<id>        use existing userId; if omitted the script will call /auth/guest
//   --auth=true|false    isAuthenticated flag used for /chat/with-rate-limit (default: false)
//
// Requires Node 18+ (global fetch). If using older Node, install node-fetch and update the script.

const DEFAULT_HOST = process.env.HOST || 'http://localhost:3000';
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.split('=');
  return [k.replace(/^--/, ''), v === undefined ? true : v];
}));

const host = args.host || DEFAULT_HOST;
const total = Number(args.total || 40);
const concurrency = Number(args.concurrency || 8);
const providedUserId = args.userId || null;
const authFlag = args.auth === 'true' ? true : (args.auth === 'false' ? false : false);
const REQUEST_TIMEOUT_MS = 15000; // client-level timeout (ms)

function now() { return new Date().toISOString(); }

async function ensureFetch() {
  if (typeof fetch === 'undefined') {
    try {
      // dynamic import for node-fetch (for older node versions)
      const mod = await import('node-fetch');
      global.fetch = mod.default || mod;
    } catch (err) {
      console.error('fetch not available and node-fetch could not be loaded. Use Node 18+ or install node-fetch.');
      process.exit(1);
    }
  }
}

async function getGuestId() {
  try {
    const res = await fetch(`${host}/auth/guest`, { method: 'POST', headers: { 'Content-Type':'application/json' } });
    const json = await res.json();
    return json.userId;
  } catch (err) {
    return null;
  }
}

async function sendRequest(id, endpoint, payload) {
  const started = Date.now();
  console.log(`[${now()}] REQ ${id} START -> ${endpoint}`);
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await res.text();
    const elapsed = Date.now() - started;
    console.log(`[${now()}] REQ ${id} END   <- status=${res.status} time=${elapsed}ms body=${text}`);
    return { status: res.status, ok: res.ok, elapsed, body: text };
  } catch (err) {
    const elapsed = Date.now() - started;
    const reason = err && err.name === 'AbortError' ? 'CLIENT_TIMEOUT' : (err && err.message ? err.message : String(err));
    console.log(`[${now()}] REQ ${id} ERROR <- time=${elapsed}ms err=${reason}`);
    return { status: 0, ok: false, elapsed, error: reason };
  } finally {
    clearTimeout(to);
  }
}

async function runBatchTest({ endpoint, payloadFactory, total, concurrency, label }) {
  console.log(`\n=== START TEST: ${label} ===`);
  console.log(`endpoint=${endpoint} total=${total} concurrency=${concurrency}`);
  let sent = 0;
  const results = [];
  let idCounter = 1;
  while (sent < total) {
    const batchSize = Math.min(concurrency, total - sent);
    const batch = [];
    for (let i = 0; i < batchSize; i++) {
      const id = idCounter++;
      const payload = payloadFactory();
      batch.push(sendRequest(id, endpoint, payload).then(r => results.push({ id, ...r })));
    }
    await Promise.all(batch);
    sent += batchSize;
    // small pause to let server metrics update
    await new Promise(r => setTimeout(r, 50));
  }

  // summary
  const ok = results.filter(r => r.ok).length;
  const statusCounts = results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  const avg = Math.round((results.reduce((s, r) => s + (r.elapsed || 0), 0)) / results.length);
  console.log(`=== END TEST: ${label} ===`);
  console.log(`total=${results.length} ok=${ok} avg_time=${avg}ms statuses=${JSON.stringify(statusCounts)}`);
  return { results, ok, avg, statusCounts };
}

async function main() {
  await ensureFetch();
  const userId = providedUserId || await getGuestId();
  if (!userId) {
    console.error('Failed to obtain userId; ensure server is running at', host);
    process.exit(1);
  }

  console.log('Using userId=', userId);

  // endpoints
  const withEndpoint = `${host}/chat/with-rate-limit`;
  const withoutEndpoint = `${host}/chat/without-rate-limit`;

  const payloadWith = () => ({ userId, isAuthenticated: authFlag, message: 'stress test' });
  const payloadWithout = () => ({ userId, message: 'stress test' });

  // Run with-rate-limit first to observe immediate 429s when over quota
  await runBatchTest({ endpoint: withEndpoint, payloadFactory: payloadWith, total, concurrency, label: 'WITH_RATE_LIMIT' });

  // small pause
  await new Promise(r => setTimeout(r, 1000));

  // Run without-rate-limit to observe queueing/timeouts
  await runBatchTest({ endpoint: withoutEndpoint, payloadFactory: payloadWithout, total, concurrency, label: 'WITHOUT_RATE_LIMIT' });

  console.log('All tests finished.');
}

main().catch(err => {
  console.error('Fatal error in stress tester:', err);
  process.exit(1);
});