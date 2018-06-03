var si = require('systeminformation');
var app = require('express')();
var http = require('http').Server(app);
var async = require("async");

var debug;
if (process.env.DEBUG == 1) {
  debug = true;
} else {
  debug = false;
}

var data = {
  cpu: {},
  cpuTemp: {},
  cpuLoad: {},
  mem: {},
  storage: {},
  net: {},
  latency: {}
};

/**
 * Update all data
 * @return {object} Data
 */
function updateData(callback) {
  async.parallel([
    function (cb) {
      si.cpu(function (info) {
        data.cpu = info;
        cb();
      });
    },
    function (cb) {
      si.cpuTemperature(function (info) {
        if (parseFloat(info.main) < 1) {
          data.cpuTemp.main = info.main * 1000;
        } else {
          data.cpuTemp = info;
        }
        cb();
      });
    },
    function (cb) {
      si.currentLoad(function (info) {
        data.cpuLoad = info;
        cb();
      });
    },
    function (cb) {
      si.mem(function (info) {
        data.mem = info;
        cb();
      });
    },
    function (cb) {
      si.fsSize(function (info) {
        data.storage = info;
        cb();
      });
    },
    function (cb) {
      si.networkStats(function (info) {
        data.net = info;
        cb();
      });
    },
    function (cb) {
      si.inetLatency('8.8.8.8', function (info) {
        data.latency = info;
        cb();
      });
    }
  ], function (err, results) {
    if (callback) {
      callback();
    }
  });
}

app.get('/api', function(req, res){
  updateData(function () {
    res.write(JSON.stringify(data));
    res.end();
  });
});

// Listen for connections on WEB_PORT
http.listen(process.env.WEB_PORT, function(){
  console.log(`listening on *:${process.env.WEB_PORT}`);
});

var minutes = process.env.UPDATE_TIME, the_interval = minutes * 60 * 1000;
setInterval(function() {
  if (debug) {
    console.log(`\n[${new Date()}] Update info`);
  }
  updateData();
}, the_interval);
