import AdmZip from 'adm-zip';
import { parseDocument, DocumentParseError } from '../dist/services/documentParser.js';

console.log('--- Testing Document Parser ---');

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: Markdown parsing
  try {
    const mdBuffer = Buffer.from(`# ProofStack Sample
## Features
- Implements JWT authentication via /api/auth/login.
- Stores project reports in PostgreSQL with Prisma.
`);
    const mdResult = await parseDocument(mdBuffer, 'README.md');
    if (mdResult.documentType === 'markdown' && mdResult.text.includes('JWT authentication')) {
      console.log('✅ Test 1 Passed: Markdown parsed successfully');
      passed++;
    } else {
      console.error('❌ Test 1 Failed: Unexpected markdown result', mdResult);
      failed++;
    }
  } catch (e) {
    console.error('❌ Test 1 Failed with exception:', e);
    failed++;
  }

  // Test 2: Plain Text parsing
  try {
    const txtBuffer = Buffer.from('Dockerized deployment using multi-stage build and GitHub Actions.');
    const txtResult = await parseDocument(txtBuffer, 'spec.txt');
    if (txtResult.documentType === 'text' && txtResult.text.includes('Dockerized deployment')) {
      console.log('✅ Test 2 Passed: Plain text parsed successfully');
      passed++;
    } else {
      console.error('❌ Test 2 Failed:', txtResult);
      failed++;
    }
  } catch (e) {
    console.error('❌ Test 2 Failed with exception:', e);
    failed++;
  }

  // Test 3: PPTX parsing with slide numbers
  try {
    const zip = new AdmZip();
    zip.addFile(
      'ppt/slides/slide1.xml',
      Buffer.from('<p:sp><a:p><a:r><a:t>Slide 1: ProofStack Pitch</a:t></a:r></a:p></p:sp>')
    );
    zip.addFile(
      'ppt/slides/slide2.xml',
      Buffer.from(
        '<p:sp><a:p><a:r><a:t>Slide 2: Implements Redis caching and Playwright runtime tests</a:t></a:r></a:p></p:sp>'
      )
    );
    const pptxBuffer = zip.toBuffer();

    const pptxResult = await parseDocument(pptxBuffer, 'pitch.pptx');
    if (
      pptxResult.documentType === 'pptx' &&
      pptxResult.pageOrSlideCount === 2 &&
      pptxResult.text.includes('[Slide 1]') &&
      pptxResult.text.includes('[Slide 2]')
    ) {
      console.log('✅ Test 3 Passed: PPTX slide extraction preserved slide markers');
      passed++;
    } else {
      console.error('❌ Test 3 Failed:', pptxResult);
      failed++;
    }
  } catch (e) {
    console.error('❌ Test 3 Failed with exception:', e);
    failed++;
  }

  // Test 4: Unsupported format rejection
  try {
    const fakeExe = Buffer.from('MZ fake binary executable');
    await parseDocument(fakeExe, 'malware.exe');
    console.error('❌ Test 4 Failed: Should have rejected unsupported format');
    failed++;
  } catch (e) {
    if (e instanceof DocumentParseError && e.message.includes('Unsupported document format')) {
      console.log('✅ Test 4 Passed: Unsupported format rejected correctly');
      passed++;
    } else {
      console.error('❌ Test 4 Failed with unexpected error:', e);
      failed++;
    }
  }

  // Test 5: Empty document rejection
  try {
    const emptyBuf = Buffer.from('   \n  ');
    await parseDocument(emptyBuf, 'empty.txt');
    console.error('❌ Test 5 Failed: Should have rejected empty document');
    failed++;
  } catch (e) {
    if (e instanceof DocumentParseError && e.message.includes('empty')) {
      console.log('✅ Test 5 Passed: Empty document rejected correctly');
      passed++;
    } else {
      console.error('❌ Test 5 Failed with unexpected error:', e);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
