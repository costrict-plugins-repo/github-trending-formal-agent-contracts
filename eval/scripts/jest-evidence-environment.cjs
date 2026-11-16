'use strict';
const fs = require('node:fs');
const { TestEnvironment } = require('jest-environment-node');

// Jest's aggregate JSON can present hook failures as failed test assertions.
// Record the execution phase separately so setup/teardown errors are never kills.
class EvidenceEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    this.evidencePath = config.projectConfig.testEnvironmentOptions.evidencePath;
    this.testPath = context.testPath;
  }

  handleTestEvent(event) {
    if (['run_start', 'run_finish', 'hook_failure', 'error', 'test_retry'].includes(event.name)) {
      fs.appendFileSync(this.evidencePath, JSON.stringify({
        event: event.name, testPath: this.testPath,
        hook: event.hook?.type || null,
        error: event.error ? String(event.error.stack || event.error) : null,
      }) + '\n');
    }
  }
}
module.exports = EvidenceEnvironment;
