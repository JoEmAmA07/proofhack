import {
  classifyError,
  executeWithRetry,
  GeminiServiceError,
} from '../dist/services/geminiService.js';

console.log('--- Testing Gemini Resilience & Retry Engine ---');

async function runResilienceTests() {
  let passed = 0;
  let failed = 0;

  // 1. Test error classification for 503 Capacity Exceeded
  try {
    const err503 = {
      status: 503,
      message: '{"error":{"code":503,"message":"This model is currently experiencing high demand."}}',
    };
    const c503 = classifyError(err503);
    if (c503.category === 'CAPACITY_EXCEEDED' && c503.isRetryable === true) {
      console.log('✅ Test 1 Passed: 503 correctly classified as retryable CAPACITY_EXCEEDED');
      passed++;
    } else {
      console.error('❌ Test 1 Failed:', c503);
      failed++;
    }
  } catch (e) {
    console.error('❌ Test 1 Exception:', e);
    failed++;
  }

  // 2. Test error classification for transient 'fetch failed'
  try {
    const fetchErr = new TypeError('fetch failed');
    fetchErr.cause = { code: 'ECONNRESET', message: 'socket hang up' };
    const cFetch = classifyError(fetchErr);
    if (cFetch.category === 'TRANSIENT_NETWORK' && cFetch.isRetryable === true) {
      console.log('✅ Test 2 Passed: fetch failed correctly classified as retryable TRANSIENT_NETWORK');
      passed++;
    } else {
      console.error('❌ Test 2 Failed:', cFetch);
      failed++;
    }
  } catch (e) {
    console.error('❌ Test 2 Exception:', e);
    failed++;
  }

  // 3. Test error classification for non-retryable 401 Auth error
  try {
    const authErr = { status: 401, message: 'API_KEY_INVALID' };
    const cAuth = classifyError(authErr);
    if (cAuth.category === 'AUTH_ERROR' && cAuth.isRetryable === false) {
      console.log('✅ Test 3 Passed: 401 correctly classified as non-retryable AUTH_ERROR');
      passed++;
    } else {
      console.error('❌ Test 3 Failed:', cAuth);
      failed++;
    }
  } catch (e) {
    console.error('❌ Test 3 Exception:', e);
    failed++;
  }

  // 4. Test retry recovery: fails on attempt 1 with 503, succeeds on attempt 2
  try {
    let attemptsCount = 0;
    const result = await executeWithRetry(
      async (attempt) => {
        attemptsCount = attempt;
        if (attempt === 1) {
          const err = new Error('This model is currently experiencing high demand.');
          (err).status = 503;
          throw err;
        }
        return 'recovered_payload';
      },
      {
        maxAttempts: 3,
        initialBackoffMs: 10, // Fast backoff for unit tests
        backoffFactor: 2,
        jitterMaxMs: 5,
        perAttemptTimeoutMs: 1000,
      }
    );

    if (result === 'recovered_payload' && attemptsCount === 2) {
      console.log('✅ Test 4 Passed: executeWithRetry recovered on attempt 2 after transient 503');
      passed++;
    } else {
      console.error('❌ Test 4 Failed: result:', result, 'attempts:', attemptsCount);
      failed++;
    }
  } catch (e) {
    console.error('❌ Test 4 Exception:', e);
    failed++;
  }

  // 5. Test retry exhaustion on continuous 503: attempts 3 times then throws user-friendly error
  try {
    let attemptsCount = 0;
    let caughtError = null;

    try {
      await executeWithRetry(
        async (attempt) => {
          attemptsCount = attempt;
          const err = new Error('This model is currently experiencing high demand.');
          (err).status = 503;
          throw err;
        },
        {
          maxAttempts: 3,
          initialBackoffMs: 10,
          backoffFactor: 2,
          jitterMaxMs: 5,
          perAttemptTimeoutMs: 1000,
        }
      );
    } catch (e) {
      caughtError = e;
    }

    if (
      caughtError instanceof GeminiServiceError &&
      caughtError.statusCode === 503 &&
      caughtError.category === 'CAPACITY_EXCEEDED' &&
      caughtError.message.includes('capacity spike') &&
      attemptsCount === 3
    ) {
      console.log('✅ Test 5 Passed: executeWithRetry exhausted 3 attempts and threw clean CAPACITY_EXCEEDED error');
      passed++;
    } else {
      console.error('❌ Test 5 Failed:', caughtError, 'attempts:', attemptsCount);
      failed++;
    }
  } catch (e) {
    console.error('❌ Test 5 Exception:', e);
    failed++;
  }

  // 6. Test non-retryable error aborts immediately on attempt 1
  try {
    let attemptsCount = 0;
    let caughtError = null;

    try {
      await executeWithRetry(
        async (attempt) => {
          attemptsCount = attempt;
          const err = new Error('API_KEY_INVALID');
          (err).status = 401;
          throw err;
        },
        {
          maxAttempts: 3,
          initialBackoffMs: 10,
          backoffFactor: 2,
          jitterMaxMs: 5,
          perAttemptTimeoutMs: 1000,
        }
      );
    } catch (e) {
      caughtError = e;
    }

    if (
      caughtError instanceof GeminiServiceError &&
      caughtError.category === 'AUTH_ERROR' &&
      attemptsCount === 1
    ) {
      console.log('✅ Test 6 Passed: Non-retryable 401 error aborted immediately on attempt 1 without retrying');
      passed++;
    } else {
      console.error('❌ Test 6 Failed:', caughtError, 'attempts:', attemptsCount);
      failed++;
    }
  } catch (e) {
    console.error('❌ Test 6 Exception:', e);
    failed++;
  }

  console.log(`\nResilience Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runResilienceTests();

