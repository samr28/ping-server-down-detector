var request = require('request');

module.exports = {
  getStats: function(cb) {
    request(process.env.MINER1_API, function (error, response, body) {
      if (error) {
        console.log('[Miner] Error: ' + error);
      }
      var data = JSON.parse(body);
      var ret = {};
      ret.currentHashrate = data.currentHashrate/1000000;
      ret.longHashrate = data.hashrate/1000000;
      // ret.pendingBalance = data.stats.balance/1000000000;
      // ret.paid = data.stats.paid/1000000000;
      ret.lastBeat = parseInt(data.workers.m1.lastBeat) * 1000;
      cb(ret);
    });
  }
}
