var version = require('./package.json').version;
var name = require('./package.json').name;
var homepage = require('./package.json').homepage;

module.exports = {
  EMAIL: {
    ENABLED: false,
    AUTH: {
      USER: process.env.EMAIL_ADDRESS,
      PASS: process.env.EMAIL_PASSWORD,
    },
    FROM: process.env.EMAIL_CLIENT,
    TO: process.env.EMAIL_RECIPIENT,
  },
  PROBE_TIME: 500000,
  WEB_UPDATE_TIME: 500000, // 5000
  PORT: {
    WEB: 3000,
    SYSINFO: 3001,
  },
  LOW_HR: 130,
  MAX_BEAT_TIME: 600000,
  APP_INFO: {
    NAME: name,
    VERSION: version,
    HOMEPAGE: homepage,
  },
  CONSOLE: {
    COLORS: {
      RESET: '\x1b[0m',
      NOTIFY: '\x1b[36m',
      MINER: '\x1b[92m',
      SYSINFO: '\x1b[33m',
      WEB: '\x1b[32m',
      PROBE: '\x1b[35m',
    },
  },
}
