var request = require('request');
var c = require('./const.js');
var l = require('./log.js');

module.exports = {
  getStats: function(server, cb) {
    if (server.type === 'miner') {
      request(server.api, function (error, response, body) {
        if (error) {
          console.log('[Miner] Error: ' + error);
        }
        var data = JSON.parse(body);
        var ret = {};
        if (data) {
          ret.currentHashrate = data.currentHashrate/1000000;
          ret.longHashrate = data.hashrate/1000000;
          // ret.pendingBalance = data.stats.balance/1000000000;
          // ret.paid = data.stats.paid/1000000000;
          if (data.workers && data.workers.m1 && data.workers.m1.lastBeat) {
            ret.lastBeat = parseInt(data.workers.m1.lastBeat) * 1000;
          }
          if (ret.longHashrate < c.LOW_HR) {
            server.lowHR = true;
          }
        } else {
          l.log(new Error(`No data for ${server.name}`));
        }
        cb(ret);
      });
    } else {
      l.log(new Error(`${server.name} is not a miner!`));
    }
  },
  updateStats: function(server, cb) {
    if (server.type === 'miner') {
      request(server.api, function (error, response, body) {
        if (error) {
          l.log(error);
          cb(error);
        }
        var data = JSON.parse(body);
        var ret = {};
        if (data) {
          server.stats.currentHashrate = data.currentHashrate/1000000;
          server.stats.longHashrate = data.hashrate/1000000;
          if (data.workers && data.workers[server.workerName]) {
            server.stats.lastBeat = parseInt(data.workers.m1.lastBeat) * 1000;
          } else {
            server.stats.lastBeat = 0;
          }
          server.status.badBeat =
            ((new Date).getTime()) - server.stats.lastBeat > c.MAX_BEAT_TIME ? true : false;
          if (ret.longHashrate < c.LOW_HR) {
            server.status.lowHR = true;
          }
        } else {
          l.log(new Error(`No data for ${server.name}`));
        }
        cb(ret);
      });
    } else {
      l.log(new Error(`${server.name} is not a miner!`));
    }
  }
}
