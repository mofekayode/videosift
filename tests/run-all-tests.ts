#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestSuite {
  name: string;
  command: string;
  critical: boolean;
}

const testSuites: TestSuite[] = [
  {
    name: 'Unit Tests - Transcript',
    command: 'npx playwright test tests/unit/transcript.test.ts',
    critical: true,
  },
  {
    name: 'API Tests',
    command: 'npx playwright test tests/api/',
    critical: true,
  },
  {
    name: 'E2E - Video Chat',
    command: 'npx playwright test tests/e2e/video-chat.spec.ts',
    critical: true,
  },
  {
    name: 'E2E - Authentication',
    command: 'npx playwright test tests/e2e/authentication.spec.ts',
    critical: false, // Requires auth setup
  },
  {
    name: 'E2E - Critical Flows',
    command: 'npx playwright test tests/e2e/critical-flows.spec.ts',
    critical: true,
  },
];

async function runTests() {
  console.log('🧪 Running MindSift Test Suite\n');
  
  const results: { suite: string; passed: boolean; error?: string }[] = [];
  
  for (const suite of testSuites) {
    console.log(`\n📋 Running: ${suite.name}`);
    console.log('─'.repeat(50));
    
    try {
      const { stdout, stderr } = await execAsync(suite.command);
      console.log(stdout);
      if (stderr) console.error(stderr);
      
      results.push({ suite: suite.name, passed: true });
      console.log(`✅ ${suite.name} - PASSED`);
    } catch (error: any) {
      results.push({ 
        suite: suite.name, 
        passed: false, 
        error: error.message 
      });
      console.error(`❌ ${suite.name} - FAILED`);
      if (suite.critical) {
        console.error('Critical test failed! Stopping test run.');
        break;
      }
    }
  }
  
  // Summary
  console.log('\n\n📊 Test Summary');
  console.log('═'.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.suite}`);
      if (r.error) console.log(`    Error: ${r.error.split('\n')[0]}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
  }
}

// Run tests
runTests().catch(console.error);