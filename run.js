var tcpp = require('tcp-ping');
var nodemailer = require('nodemailer');
var request = require('request');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var moment = require('moment');
var async = require('async');

var c = require('./const.js');
var m = require('./miner.js');
var l = require('./log.js');
var n = require('./notify.js');

var version = c.APP_INFO.VERSION;
var name = c.APP_INFO.NAME;
var homepage = c.APP_INFO.HOMEPAGE;
var servers = require('./servers.js').servers;

var debug = false;
if (process.env.DEBUG == 1) {
  debug = true;
}

/**
 * Get public data on all servers
 * @return {Object} Data
 */
function getAllData() {
  var allData = {
    servers: [],
  };
  servers.forEach(function (server) {
    var currentServer = {
      name: server.name,
      online: server.online,
      hasSysinfo: server.hasSysinfo,
      sysinfo: server.sysinfo,
      dropdown: server.dropdown,
    };
    if (server.type === 'miner') {
      currentServer.status = server.status;
      currentServer.stats = server.stats;
    }
    allData.servers.push(currentServer);
  });
  return allData;
}

/**
 * Check if all servers are online
 * @return {Boolean} True when all servers are online
 */
function allServersOnline() {
  servers.forEach(function (server) {
    if (!server.online) {
      return false;
    }
  });
  return true;
}

/**
 * Update sysinfo for all servers
 * @param  {Function} cb Callback
 */
function updateAllSysinfo(cb) {
  async.map(servers, updateSysInfo, cb);
}

/**
 * Update sysinfo for the specified server
 * @param  {Object}   server Server object
 * @param  {Function} cb     Callback
 */
function updateSysInfo(server, cb) {
  // Check if has sysinfo
  if (!server.hasSysinfo) {
    if (debug) {
      l.log(`${server.name} hasSysinfo false`, 'sysinfo');
    }
    if (cb) {
      cb();
    }
    return;
  }
  // Check if online
  if (!server.online) {
    if (cb) {
      cb();
    }
    return;
  }
  var url = constructSysinfoRequest(server);
  request(url, function (error, response, body) {
    if (error) {
      l.log(`${server.name} (${url}) get sysinfo error: ${error}`, 'sysinfo');
    } else {
      var data = JSON.parse(body);
      server.sysinfo = data;
    }
    if (cb) {
      cb();
    }
  });
}

/**
 * Construct URL for sysinfo request
 * @param  {Object} server Server
 * @return {String}        URL
 */
function constructSysinfoRequest(server) {
  return `http://${server.ip}:${server.sysinfoPort}/api`;
}

/**
 * Ping all of the servers
 * @param {function}  cb  Callback
 */
function probeAll(cb) {
  async.map(servers, probe, cb);
}

/**
 * Ping a single server and call sendEmail if offline
 * @param  {Object} server Server to ping
 * @param  {Function} cb  Callback
 */
function probe(server, cb) {
  tcpp.probe(server.ip, server.port, function(err, available) {
    l.log(`${server.name} (${server.ip}:${server.port}): ${available ? 'online' : 'offline'}`, 'probe');
    server.online = available;
    // if (!available && server.online) {
    //   n.notify(server, cb);
    //   return;
    // }
    // if (available && server.online) {
    //   n.notify(server, cb);
    //   return;
    // }
    if (server.type === 'miner') {
      probeMinerHR(server, cb);
      return;
    }
    if (cb) {
      cb();
      return;
    }
  });
}

/**
 * Ping a miner and check that the hashrate is not too low
 * @param  {Object} server Server to check
 */
function probeMinerHR(server, cb) {
  if (server.type === 'miner') {
    m.updateStats(server, function () {
      if (server.status.lowHR || server.status.badBeat) {
        n.notify(server);
      }
      if (!server.status.lowHR && !server.status.badBeat) {
        server.sentHRMail = false;
      }
      if (cb) {
        cb();
        return;
      }
    });
  } else {
    l.log(new Error(`${server.name} is not a miner!`), 'probe');
  }
}

/**
 * Returns true if the server currently has sysinfo
 * @param  {Object} server Server info
 */
function currentlyHasSysinfo(server) {
  return server.hasSysinfo && server.sysinfo && Object.keys(server.sysinfo).length !== 0;
}

/**
 * Generate new HTML for the status page
 * @return {String} HTML
 */
function generateHTML() {
  var data = getAllData();
  var displayServers = [];
  var html = ``;
  data.servers.forEach(function (server) {
    html += `
      <div class="card waves-effect toggleServerInfo" data-server="${server.name}">
        <div class="card-header ${server.online ? 'success' : 'danger'}-color white-text">
          <div class="row">
            <div class="col">
              ${server.name} (${moment(server.sysinfo.timestamp).format("h:mm:ss")})
            </div>
            <div class="col" style="text-align: right">
              ${
                // Show chevron if has serverinfo
                currentlyHasSysinfo(server) ?
                  "<i class='fas fa-chevron-" + (server.dropdown ? 'up' : 'down') + "'></i>"
                  : ""
                }
            </div>
          </div>
        </div>`;
      if (currentlyHasSysinfo(server)) {
        var cpu = server.sysinfo.cpu;
        cpu.temp = server.sysinfo.cpuTemp.main;
        var cpuLoad = server.sysinfo.cpuLoad;
        var mem = server.sysinfo.mem;
        var storage = server.sysinfo.storage[0];
        var uptime = server.sysinfo.uptime;
        html += `
        <div class="collapse card-body ${server.dropdown ? 'show' : ''}" id="collapse${server.name}">
          <ul class="list-group list-group-flush">
            <li class="list-group-item">
              <div class="row">
                <div class="col">
                  <span id="${server.name}-cpu-manufacturer">${cpu.manufacturer}</span>
                  <span id="${server.name}-cpu-brand">${cpu.brand}</span>
                </div>
                <div class="col" id="${server.name}-cpu-speed">
                  ${cpu.cores} Cores @ ${cpu.speed} GHz
                </div>
                <div class="col" id="${server.name}-cpu-temp">
                  <i class="fas fa-thermometer-half"></i> ${cpu.temp} C
                </div>
                <div class="col" id="${server.name}-uptime">
                  <i class="fas fa-clock"></i> ${uptime}
                </div>
              </div>
            </li>
            <li class="list-group-item">
              <div class="row">
                <div class="col" id="${server.name}-cpu-load">
                  CPU load: ${Number((cpuLoad.currentload).toFixed(2))}%
                  <div class="progress" style="height: 30px;">
                    <div class="progress-bar" role="progressbar" style="width: ${Number((cpuLoad.currentload).toFixed(2))}%;" aria-valuenow="${Number((cpuLoad.currentload).toFixed(2))}" aria-valuemin="0" aria-valuemax="100"></div>
                  </div>
                </div>
                <div class="col" id="${server.name}-mem">
                  <i class="fas fa-memory"></i> (${Number((mem.active / 1000000).toFixed(2))} / ${Number((mem.total / 1000000).toFixed(2))} MB)
                  <br>
                  <div class="progress" style="height: 30px;">
                    <div class="progress-bar" role="progressbar" style="width: ${Number(((mem.active/mem.total) * 100).toFixed(2))}%;" aria-valuenow="${Number(((mem.active/mem.total) * 100).toFixed(2))}" aria-valuemin="0" aria-valuemax="100">${Number(((mem.active/mem.total) * 100).toFixed(0))}%</div>
                  </div>
                </div>
                <div class="col" id="${server.name}-storage">
                  <i class="fas fa-hdd"></i> (${Number((storage.used / 1000000000).toFixed(2))} / ${Number((storage.size / 1000000000).toFixed(2))} GB)
                  <br>
                  <div class="progress" style="height: 30px;">
                    <div class="progress-bar" role="progressbar" style="width: ${Number(((storage.used/storage.size) * 100).toFixed(2))}%;" aria-valuenow="${Number(((storage.used/storage.size) * 100).toFixed(2))}" aria-valuemin="0" aria-valuemax="100">${Number(((storage.used/storage.size) * 100).toFixed(0))}%</div>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>`;
      }
      html += `</div><br>`;
  });
  // data.miners.forEach(function (server) {
  //   html += `
  //     <div class="card waves-effect toggleServerInfo" data-server="${server.name}">
  //       <div class="card-header ${!server.online ? 'danger' : (server.status.lowHR || server.status.badBeat ? 'warning' : 'success')}-color white-text">
  //         <div class="row">
  //           <div class="col-sm">
  //             ${server.name}
  //           </div>
  //           <div class="col-sm" style="text-align: right">
  //             <i class="grabbing fas fa-chevron-${server.dropdown ? 'up' : 'down'}"></i>
  //           </div>
  //         </div>
  //       </div>
  //       <div class="collapse card-body ${server.dropdown ? 'show' : ''}" id="collapse${server.name}">
  //         <ul class="list-group list-group-flush">
  //           <li class="list-group-item" id="mydiv">Current hashrate (30m): ${Number((server.stats.currentHashrate).toFixed(2))} MH</li>
  //           <li class="list-group-item">Long hashrate (3h): ${Number((server.stats.longHashrate).toFixed(2))} MH</li>
  //           <li class="list-group-item">Last beat: ${moment(new Date(server.stats.lastBeat)).fromNow()} (${new Date(server.stats.lastBeat)})</li>
  //         </ul>
  //       </div>
  //     </div>`;
  // });
  return html;
}

/**
 * Generate new HTML and update the title
 */
function refreshAll() {
  io.sockets.emit('update server', generateHTML());
  io.sockets.emit('update title', allServersOnline());
  io.sockets.emit('update favicon', allServersOnline());
}

function updateWeb() {
  io.sockets.emit('update server info', getAllData());
}

/**
 * Generate new HTML for servers
 */
function refreshServers() {
  io.sockets.emit('update server', generateHTML());
  // io.sockets.emit('update server info', );
}

l.log(`Starting v${version}`);

// Initial probe
probeAll(updateAllSysinfo);
// probe(servers[1], function() {
//   console.log(servers[1].online);
// });
// updateAllSysinfo(function(){
//   console.log(servers);
// });

// Serve index
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

// API route
app.get('/api', function(req, res){
  res.write(JSON.stringify(getAllData()));
  res.end();
});

let intervalObj;

// Update inner html and refresh when buttons are clicked
io.on('connection', function(socket){
  l.log(`Client connected`, 'web');
  let globalToggle = true;
  intervalObj = setInterval(() => {
    refreshAll();
  }, c.WEB_UPDATE_TIME);
  refreshAll();
  io.sockets.emit('update footer', `<a href="${homepage}" target="_blank">${name}</a> v${version}`, `Refreshing every ${c.WEB_UPDATE_TIME} ms`);
  socket.on('refresh', function(){
    l.log(`Client refresh all`, 'web');
    probeAll(function() {
      updateAllSysinfo(function() {
        io.sockets.emit('refresh-done');
        refreshAll();
      });
    });
  });
  socket.on('disconnect', function() {
    l.log(`Client disconnected`, 'web');
    clearInterval(intervalObj);
  });
  socket.on('toggleAll', function(){
    l.log(`Client toggleAll`, 'web');
    servers.forEach(function (server) {
      server.dropdown = globalToggle;
    });
    globalToggle = !globalToggle;
    refreshServers();
  });
  socket.on('toggle', function(s) {
    servers.forEach(function (server) {
      if (server.name === s) {
        server.dropdown = !server.dropdown;
      }
    });
    refreshServers();
  });
});

// Listen for connections on WEB_PORT
http.listen(c.PORT.WEB, function(){
  l.log(`listening on *:${c.PORT.WEB}`, 'web');
});

setInterval(function() {
  l.log(`Checking`);
  probeAll(function() {
    updateAllSysinfo(function() {
      io.sockets.emit('refresh-finish');
    });
  });
}, c.PROBE_TIME);
