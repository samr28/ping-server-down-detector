var c = require('./const.js');

var debug;
if (process.env.DEBUG == 1) {
  debug = true;
} else {
  debug = false;
}

var COLORS = c.CONSOLE.COLORS;

module.exports = {
  log: function(info, mod) {
    if (debug) {
      var msg = `\x1b[90m[${new Date()}]\x1b[0m `;
      if (mod) {
        if (COLORS[mod.toUpperCase()]) {
          msg += COLORS[mod.toUpperCase()];
        }
        msg += `[${mod}]`;
        msg += COLORS.RESET;
        msg += ` `;
      }
      msg += info;
      console.log(msg);
    }
  }
}
