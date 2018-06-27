var debug;
if (process.env.DEBUG == 1) {
  debug = true;
} else {
  debug = false;
}
module.exports = {
  log: function(info) {
    if (debug) {
      console.log(`\n[${new Date()}] ${info}`);
    }
  }
}
