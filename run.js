var tcpp = require('tcp-ping');
var nodemailer = require('nodemailer');
var request = require('request');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var moment = require('moment');

var version = require('./package.json').version;
var name = require('./package.json').name;
var homepage = require('./package.json').homepage;
var m = require('./miner.js');
var l = require('./log.js');

var debug;
if (process.env.DEBUG == 1) {
  debug = true;
} else {
  debug = false;
}

var SEND_EMAIL;
if (process.env.SEND_EMAIL == 1) {
  SEND_EMAIL = true;
} else {
  SEND_EMAIL = false;
}

var servers = [];
var miners = [];

servers[0] = {
  name: 'sam-server-2',
  isMiner: false,
  sysinfo: {},
  sysinfoPort: process.env.SAM_SERVER_2_SYSINFO_PORT,
  ip: process.env.SAM_SERVER_2_IP,
  port: process.env.SAM_SERVER_2_PORT,
  isOffline: false,
  dropdown: false
};
servers[1] = {
  name: 'orangepione-1',
  isMiner: false,
  sysinfo: {},
  sysinfoPort: process.env.ORANGEPIONE_1_SYSINFO_PORT,
  ip: process.env.ORANGEPIONE_1_IP,
  port: process.env.ORANGEPIONE_1_PORT,
  isOffline: false,
  dropdown: false
};
servers[2] = {
  name: 'orangepione-2',
  isMiner: false,
  sysinfo: {},
  sysinfoPort: process.env.ORANGEPIONE_2_SYSINFO_PORT,
  ip: process.env.ORANGEPIONE_2_IP,
  port: process.env.ORANGEPIONE_2_PORT,
  isOffline: false,
  dropdown: false
};
servers[3] = {
  name: 'orangepione-3',
  isMiner: false,
  sysinfo: {},
  sysinfoPort: process.env.ORANGEPIONE_3_SYSINFO_PORT,
  ip: process.env.ORANGEPIONE_3_IP,
  port: process.env.ORANGEPIONE_3_PORT,
  isOffline: false,
  dropdown: false
};

miners[0] = {
  name: 'miner1',
  isMiner: true,
  status: {
    lowHR: false,
    badBeat: false
  },
  stats: {
    currentHashrate: 0,
    longHashrate: 0,
    lastBeat: 0
  },
  api: process.env.MINER1_API,
  sentHRMail: false,
  isOffline: false,
  dropdown: false
};

var transporter = nodemailer.createTransport({
  service: process.env.EMAIL_CLIENT,
  auth: {
    user: process.env.EMAIL_ADDRESS,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Get data on all servers
 * @return {object} Data
 */
function getAllData() {
  var allData = {
    servers: [],
    miners: []
  };
  servers.forEach(function (server) {
    allData.servers.push({
      name: server.name,
      isOffline: server.isOffline,
      sysinfo: server.sysinfo,
      dropdown: server.dropdown
    });
  });
  miners.forEach(function (server) {
    allData.miners.push({
      name: server.name,
      status: server.status,
      stats: server.stats,
      isOffline: server.isOffline,
      dropdown: server.dropdown
    });
  });
  return allData;
}

/**
 * Check if all servers are online
 * @return {Boolean} True when all servers are online
 */
let allOnline = null;
function allServersOnline() {
  servers.forEach(function (server) {
    if (server.isOffline) {
      allOnline = false;
      return false;
    }
  });
  miners.forEach(function (server) {
    if (server.isOffline) {
      allOnline = false;
      return false;
    }
  });
  allOnline = true;
  return true;
}

/**
 * Update sysinfo for all servers
 * @param  {Function} cb Callback
 */
function updateAllSysinfo(cb) {
  servers.forEach(function (server) {
    if (!server.isOffline) {
      request(`http://${server.ip}:${server.sysinfoPort}/api`, function (error, response, body) {
        if (error) {
          console.log(`${server.name} (http://${server.ip}:${server.sysinfoPort}/api) get sysinfo error: ${error}`);
        } else {
          var data = JSON.parse(body);
          server.sysinfo = data;
          if (cb) {
            cb();
          }
        }
      });
    }
  });
}

/**
 * Ping all of the servers
 * @param {function}  cb  Callback
 */
function probeAll(cb) {
  servers.forEach(function (server) {
    probe(server, cb);
  });
  miners.forEach(function (server) {
    probeMiner(server, cb);
    probeMinerHR(server, cb);
  })
}

/**
 * Ping a single server and call sendEmail if offline
 * @param  {Object} server Server to ping
 * @param  {Function} cb  Callback
 */
function probe(server, cb) {
  tcpp.probe(server.ip, server.port, function(err, available) {
    l.log(`${server.name} (${server.ip}:${server.port}): ${available ? 'online' : 'offline'}`);
    if (!available && !server.isOffline) {
      sendEmailOffline(server, cb);
    }
    if (available && server.isOffline) {
      sendEmailOnline(server, cb);
    }
  });
}

/**
 * Ping a single miner and call sendEmail if offline
 * @param  {Object} server Server to ping
 * @param  {Function} cb  Callback
 */
function probeMiner(server, cb) {
  request(server.api, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var data = JSON.parse(body);
      l.log(`${server.name} (${server.name}: [Online:${data.workersOnline}] [Offline:${data.workersOffline}]`);
     if (data.workersOffline > 0 && !server.isOffline) {
       sendEmailOffline(server, cb);
     }
     if (data.workersOffline == 0 && server.isOffline) {
       sendEmailOnline(server, cb);
     }
    }
  })
}

/**
 * Ping a miner and check that the hashrate is not too low
 * @param  {Object} server Server to check
 */
function probeMinerHR(server) {
  if (server.isMiner) {
    m.getStats(function (data) {
      server.stats = data;
      server.status.lowHR = data.longHashrate < process.env.LOW_HR ? true : false;
      server.status.badBeat = ((new Date).getTime()) - data.lastBeat > process.env.MAX_BEAT_TIME ? true : false;
      if (server.status.lowHR || server.status.badBeat) {
        if (!server.sentHRMail && !server.isOffline) {
          sendEmailMiner(server);
        }
      }
      if (!server.status.lowHR && !server.status.badBeat) {
        server.sentHRMail = false;
      }
    });
  } else {
    console.log(new Error(`${server.name} is not a miner!`));
  }
}

/**
 * Send an email if a miner is having problems
 * @param  {Object} server Server having problems
 * @param {function}  cb  Callback
 */
function sendEmailMiner(server, cb) {
  server.sentHRMail = true;
  l.log(`[${new Date()}] Sending miner email.`);
  var mailOptions = {
    from: process.env.EMAIL_CLIENT,
    to: process.env.EMAIL_RECIPIENT,
    subject: `${server.name} is having problems!`,
    text: `${server.name} started having problems around: ${new Date()}
    \n\nLong (3h) hashrate is ${server.stats.longHashrate} MH. Should be > ${process.env.LOW_HR}.
    \nCurrent (30m) hashrate is ${server.stats.currentHashrate} MH.
    \nLast beat was ${new Date(server.stats.lastBeat)}.
    \n\nChecking every ${process.env.PROBE_TIME} ms
    \n\nping-server-down-detector v${version} - ${homepage}`
  };
  if (SEND_EMAIL) {
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(`Error sending email: ${error}`);
        server.sentHRMail = false;
      } else {
        l.log(`[${new Date()}] Email sent: ${info.response}`);
      }
      if (cb) {
        cb();
      }
    });
  } else if (cb) {
    cb();
  }
}

/**
 * Send an email that a server has come back online
 * @param  {Object} server Server that is now online
 * @param {function}  cb  Callback
 */
function sendEmailOnline(server, cb) {
  l.log(`[${new Date()}] Sending online email`);
  var mailOptions = {
    from: process.env.EMAIL_CLIENT,
    to: process.env.EMAIL_RECIPIENT,
    subject: `${server.name} is back online!`,
    text: `${server.name} came back around ${new Date()}
    \n\nChecking every ${process.env.PROBE_TIME} ms
    \n\nping-server-down-detector v${version} - ${homepage}`
  };
  if (SEND_EMAIL) {
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(`Error sending email: ${error}`);
      } else {
        l.log(`[${new Date()}] Email sent: ${info.response}`);
        server.isOffline = false;
      }
      if (cb) {
        cb();
      }
    });
  } else if (cb) {
    cb();
  }
}

/**
 * Send an email that a server is offline
 * @param  {Object} server Server that has gone offline
 * @param {function}  cb  Callback
 */
function sendEmailOffline(server, cb) {
  l.log(`[${new Date()}] Sending offline email`);
  var mailOptions = {
    from: process.env.EMAIL_CLIENT,
    to: process.env.EMAIL_RECIPIENT,
    subject: `${server.name} is offline!`,
    text: `${server.name} went offline around ${new Date()}
    \n\nChecking every ${process.env.PROBE_TIME} ms
    \n\nping-server-down-detector v${version} - ${homepage}`
  };
  if (SEND_EMAIL) {
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(`Error sending email: ${error}`);
      } else {
        l.log(`[${new Date()}] Email sent: ${info.response}`);
        server.isOffline = true;
      }
      if (cb) {
        cb();
      }
    });
  } else if (cb) {
    cb();
  }
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
        <div class="card-header ${server.isOffline ? 'danger' : 'success'}-color white-text">
          <div class="row">
            <div class="col">
              ${server.name}
            </div>
            <div class="col" style="text-align: right">
              <i class="grabbing fas fa-chevron-${server.dropdown ? 'up' : 'down'}"></i>
            </div>
          </div>
        </div>`;
      if (Object.keys(server.sysinfo).length !== 0) {
        var cpu = server.sysinfo.cpu;
        cpu.temp = server.sysinfo.cpuTemp.main;
        var cpuLoad = server.sysinfo.cpuLoad;
        var mem = server.sysinfo.mem;
        var storage = server.sysinfo.storage[0];
        html += `
        <div class="collapse card-body ${server.dropdown ? 'show' : ''}" id="collapse${server.name}">
          <ul class="list-group list-group-flush">
            <li class="list-group-item">
              <div class="row">
                <div class="col">
                  ${cpu.manufacturer} ${cpu.brand}
                </div>
                <div class="col">
                  ${cpu.cores} Cores @ ${cpu.speed} GHz
                </div>
                <div class="col">
                  <i class="fas fa-thermometer-half"></i> ${cpu.temp} C
                </div>
              </div>
            </li>
            <li class="list-group-item">
              <div class="row">
                <div class="col">
                  CPU load: ${Number((cpuLoad.currentload).toFixed(2))}%
                  <div class="progress" style="height: 30px;">
                    <div class="progress-bar" role="progressbar" style="width: ${Number((cpuLoad.currentload).toFixed(2))}%;" aria-valuenow="${Number((cpuLoad.currentload).toFixed(2))}" aria-valuemin="0" aria-valuemax="100"></div>
                  </div>
                </div>
                <div class="col">
                  <i class="fas fa-memory"></i> (${Number((mem.active / 1000000).toFixed(2))} / ${Number((mem.total / 1000000).toFixed(2))} MB)
                  <br>
                  <div class="progress" style="height: 30px;">
                    <div class="progress-bar" role="progressbar" style="width: ${Number(((mem.active/mem.total) * 100).toFixed(2))}%;" aria-valuenow="${Number(((mem.active/mem.total) * 100).toFixed(2))}" aria-valuemin="0" aria-valuemax="100">${Number(((mem.active/mem.total) * 100).toFixed(0))}%</div>
                  </div>
                </div>
                <div class="col">
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
  data.miners.forEach(function (server) {
    html += `
      <div class="card waves-effect toggleServerInfo" data-server="${server.name}">
        <div class="card-header ${server.isOffline ? 'danger' : (server.status.lowHR || server.status.badBeat ? 'warning' : 'success')}-color white-text">
          <div class="row">
            <div class="col-sm">
              ${server.name}
            </div>
            <div class="col-sm" style="text-align: right">
              <i class="grabbing fas fa-chevron-${server.dropdown ? 'up' : 'down'}"></i>
            </div>
          </div>
        </div>
        <div class="collapse card-body ${server.dropdown ? 'show' : ''}" id="collapse${server.name}">
          <ul class="list-group list-group-flush">
            <li class="list-group-item" id="mydiv">Current hashrate (30m): ${Number((server.stats.currentHashrate).toFixed(2))} MH</li>
            <li class="list-group-item">Long hashrate (3h): ${Number((server.stats.longHashrate).toFixed(2))} MH</li>
            <li class="list-group-item">Last beat: ${moment(new Date(server.stats.lastBeat)).fromNow()} (${new Date(server.stats.lastBeat)})</li>
          </ul>
        </div>
      </div>`;
  });
  return html;
}

/**
 * Generate new HTML and update the title
 */
function refreshAll() {
  io.sockets.emit('update server', generateHTML());
  // Check if all servers online has changed since last check
  if (allServersOnline() != allOnline) {
    io.sockets.emit('update title', allServersOnline());
    io.sockets.emit('update favicon', allServersOnline());
  }
}

/**
 * Generate new HTML for servers
 */
function refreshServers() {
  io.sockets.emit('update server', generateHTML());
}


console.log(`Starting v${version}`);

// Initial probe
probeAll(updateAllSysinfo);

// Serve index
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.get('/api', function(req, res){
  res.write(JSON.stringify(getAllData()));
  res.end();
});

let intervalObj;

// Update inner html and refresh when buttons are clicked
io.on('connection', function(socket){
  let globalToggle = true;
  intervalObj = setInterval(() => {
    probeAll(updateAllSysinfo(refreshAll));
  }, process.env.WEB_UPDATE_TIME);
  refreshAll();
  io.sockets.emit('update footer', `<a href="${homepage}" target="_blank">${name}</a> v${version}`, `Refreshing every ${process.env.WEB_UPDATE_TIME} ms`);
  io.sockets.emit('update favicon', allServersOnline());
  io.sockets.emit('update title', allServersOnline());
  socket.on('refresh', function(){
    probeAll(updateAllSysinfo(refreshAll));
  });
  socket.on('disconnect', function() {
    clearInterval(intervalObj);
  });
  socket.on('toggleAll', function(){
    servers.forEach(function (server) {
      server.dropdown = globalToggle;
    });
    miners.forEach(function (server) {
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
    miners.forEach(function (server) {
      if (server.name === s) {
        server.dropdown = !server.dropdown;
      }
    });
    refreshServers();
  });
});

// Listen for connections on WEB_PORT
http.listen(process.env.WEB_PORT, function(){
  console.log(`web listening on *:${process.env.WEB_PORT}`);
});

setInterval(function() {
  l.log(`Checking`);
  probeAll(updateAllSysinfo);
}, process.env.PROBE_TIME);
