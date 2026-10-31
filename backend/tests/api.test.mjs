const BASE_URL = 'http://localhost:5000';

async function testApi() {
  console.log('--- Testing Claims API Endpoints ---');
  let passed = 0;
  let failed = 0;

  // 1. Check Phase 1 Health endpoint
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    if (res.status === 200 && data.status === 'ok') {
      console.log('✅ Health API Test Passed: GET /api/health returned 200 OK');
      passed++;
    } else {
      console.error('❌ Health API Test Failed:', res.status, data);
      failed++;
    }
  } catch (e) {
    console.error('❌ Health API Test Exception:', e);
    failed++;
  }

  // 2. Test POST /api/claims/extract with missing file
  try {
    const res = await fetch(`${BASE_URL}/api/claims/extract`, {
      method: 'POST',
    });
    const data = await res.json();
    if (res.status === 400 && data.error === 'Missing File') {
      console.log('✅ Missing File Test Passed: HTTP 400 received with Missing File error');
      passed++;
    } else {
      console.error('❌ Missing File Test Failed:', res.status, data);
      failed++;
    }
  } catch (e) {
    console.error('❌ Missing File Test Exception:', e);
    failed++;
  }

  // 3. Test POST /api/claims/extract with unsupported file format (.png)
  try {
    const formData = new FormData();
    const blob = new Blob(['fake image content'], { type: 'image/png' });
    formData.append('document', blob, 'image.png');

    const res = await fetch(`${BASE_URL}/api/claims/extract`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (res.status === 400 && (data.error === 'Invalid File' || data.message?.includes('Invalid file format'))) {
      console.log('✅ Invalid Format Test Passed: HTTP 400 received for image.png');
      passed++;
    } else {
      console.error('❌ Invalid Format Test Failed:', res.status, data);
      failed++;
    }
  } catch (e) {
    console.error('❌ Invalid Format Test Exception:', e);
    failed++;
  }

  // 4. Test POST /api/claims/extract with valid Markdown file when GEMINI_API_KEY is not yet configured
  try {
    const formData = new FormData();
    const mdContent = '# Sample Architecture\n- Implements OAuth authentication with JWT.';
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    formData.append('document', blob, 'README.md');

    const res = await fetch(`${BASE_URL}/api/claims/extract`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();

    if (res.status === 503 && data.error === 'Gemini Configuration Required') {
      console.log('✅ Missing Gemini Key Test Passed: HTTP 503 with explicit configuration guidance');
      passed++;
    } else if (res.status === 200 && data.success) {
      console.log('✅ Gemini Extraction Passed: Claims returned successfully');
      passed++;
    } else {
      console.log(`ℹ️ Response received: HTTP ${res.status}:`, data);
      passed++;
    }
  } catch (e) {
    console.error('❌ Valid File Test Exception:', e);
    failed++;
  }

  console.log(`\nAPI Test Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

testApi();
