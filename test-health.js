// Simple test to verify health check functionality
import { performSystemHealthCheck } from './src/shared/utils/health.js';

async function testHealthCheck() {
  try {
    console.log('Testing health check...');
    const health = await performSystemHealthCheck();
    console.log('Health check result:', JSON.stringify(health, null, 2));
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

testHealthCheck();