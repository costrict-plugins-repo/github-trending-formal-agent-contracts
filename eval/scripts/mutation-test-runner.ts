/** Compatibility entry point; the JS implementation is the single source of truth.
 * Run with Node >=22.18, or use the .js entry point on older Node 22.
 * Historical scores are never overwritten by this runner.
 */
const { main } = require('./mutation-test-runner.js');
process.exitCode = main();
