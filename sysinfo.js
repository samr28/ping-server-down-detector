var si = require('systeminformation');
var app = require('express')();
var http = require('http').Server(app);
var async = require("async");
const { exec } = require("child_process");

var l = require('./log.js');
var c = require('./const.js');

var debug;
if (process.env.DEBUG == 1) {
  debug = true;
} else {
  debug = false;
}

var data = {
  timestamp: "",
  cpu: {},
  cpuTemp: {},
  cpuLoad: {},
  mem: {},
  storage: {},
  net: {},
  latency: {},
  uptime: ""
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
      let uptimeCmd = `./scripts/uptime`;
      var script = exec(uptimeCmd,
        (error, stdout, stderr) => {
          if (!error && !stderr) {
            data.uptime = stdout;
            cb();
          } else {
            console.log("Get uptime error: ", error);
            console.log(stderr);
            cb()
          }
        });
    }
  ], function (err, results) {
    data.timestamp = new Date();
    if (callback) {
      callback();
    }
  });
}

/**
 * Update dynamic data
 * @return {object} Data
 */
function updateDynamicData(callback) {
  async.parallel([
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
      let uptimeCmd = `./scripts/uptime`;
      var script = exec(uptimeCmd,
        (error, stdout, stderr) => {
          if (!error && !stderr) {
            data.uptime = stdout;
            cb();
          } else {
            console.log("Get uptime error: ", error);
            console.log(stderr);
            cb()
          }
        });
    },
    function (cb) {
      let uptimeCmd = `./scripts/uptime`;
      var yourscript = exec(uptimeCmd,
        (error, stdout, stderr) => {
          if (!error && !stderr) {
            data.uptime = stdout;
            cb();
          } else {
            console.log("Get uptime error: ", error);
            console.log(stderr);
            cb()
          }
        });
    }
  ], function (err, results) {
    data.timestamp = new Date();
    if (callback) {
      callback();
    }
  });
}

updateData();

app.get('/api', function(req, res){
  updateDynamicData(function () {
    res.write(JSON.stringify(data));
    res.end();
  });
});

// Listen for connections on WEB_PORT
http.listen(c.PORT.SYSINFO, function(){
  l.log(`listening on *:${c.PORT.SYSINFO}`, 'sysinfo');
});
