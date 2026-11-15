import { startMockOpenAI } from './Backend/tests/helpers/mockOpenAI.js';
import generate from './Backend/utils/openai.js';
const mock = await startMockOpenAI({ delayMs: 20 });
const base = { openai: { apiKey: 'test-key', baseURL: mock.url, timeoutMs: 1500, maxRetries: 0, model: 'mock-model' }, context: { maxMessages: 20, maxChars: 24000 } };
const results = [];
for (const message of ['latency sample 1','latency sample 2','latency sample 3','__RATE429__']) {
  const t0 = performance.now();
  try { await generate([{ role:'user',content:message }],base); results.push({case:message, status:200, ms:+(performance.now()-t0).toFixed(1)}); }
  catch (e) { results.push({case:message, status:e.status, code:e.code, ms:+(performance.now()-t0).toFixed(1)}); }
}
const invalid = { ...base, openai: { ...base.openai, apiKey:'bad-key' } };
try { await generate([{role:'user',content:'invalid credential check'}],invalid); results.push({case:'invalid key',status:200}); }
catch(e) { results.push({case:'invalid key',status:e.status,code:e.code,message:e.message}); }
await mock.close();
console.log(JSON.stringify(results));
