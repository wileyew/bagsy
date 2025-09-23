/**
 * Test script to verify OpenAI retry mechanism works correctly
 * This script simulates network failures and verifies retry behavior
 */

// Import the request manager (we'll need to adapt this for Node.js testing)
const { OpenAIRequestManager } = require('./src/lib/openai-request-manager.ts');

async function testRetryMechanism() {
  console.log('🧪 Testing OpenAI Request Manager Retry Mechanism\n');
  
  const manager = OpenAIRequestManager.getInstance();
  
  // Test 1: Successful request on first attempt
  console.log('Test 1: Successful request on first attempt');
  try {
    const result = await manager.executeWithRetry(async () => {
      console.log('  ✅ First attempt succeeded');
      return 'success';
    }, 'Test 1');
    console.log(`  Result: ${result}\n`);
  } catch (error) {
    console.log(`  ❌ Test 1 failed: ${error.message}\n`);
  }
  
  // Test 2: Request fails first time, succeeds on retry
  console.log('Test 2: Request fails first time, succeeds on retry');
  let attemptCount = 0;
  try {
    const result = await manager.executeWithRetry(async () => {
      attemptCount++;
      if (attemptCount === 1) {
        console.log('  ❌ First attempt failed');
        throw new Error('Simulated network failure');
      }
      console.log('  ✅ Second attempt succeeded');
      return 'success after retry';
    }, 'Test 2');
    console.log(`  Result: ${result}\n`);
  } catch (error) {
    console.log(`  ❌ Test 2 failed: ${error.message}\n`);
  }
  
  // Test 3: Request fails both times (max retries exceeded)
  console.log('Test 3: Request fails both times (max retries exceeded)');
  attemptCount = 0;
  try {
    const result = await manager.executeWithRetry(async () => {
      attemptCount++;
      console.log(`  ❌ Attempt ${attemptCount} failed`);
      throw new Error(`Simulated failure ${attemptCount}`);
    }, 'Test 3');
    console.log(`  Result: ${result}\n`);
  } catch (error) {
    console.log(`  ❌ Test 3 failed as expected: ${error.message}\n`);
  }
  
  // Test 4: Verify request limit enforcement
  console.log('Test 4: Verify request limit enforcement');
  console.log('  Initial status:', manager.getRequestStatus());
  
  // Try to reserve requests up to the limit
  for (let i = 1; i <= 3; i++) {
    const reserved = manager.reserveRequest();
    console.log(`  Request ${i}: ${reserved ? '✅ Reserved' : '❌ Blocked'}`);
  }
  
  console.log('  Final status:', manager.getRequestStatus());
  
  // Test 5: Reset and verify
  console.log('\nTest 5: Reset and verify');
  manager.reset();
  console.log('  Status after reset:', manager.getRequestStatus());
  
  console.log('\n🎉 Retry mechanism testing completed!');
}

// Run the test
testRetryMechanism().catch(console.error);
