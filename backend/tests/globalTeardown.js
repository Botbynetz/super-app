/**
 * Jest Global Teardown
 * Runs once after all tests
 */

module.exports = async () => {
  console.log('🧹 Jest Global Teardown: Cleaning up test environment');
  
  // Give time for connections to close
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('✅ Cleanup complete');
};
