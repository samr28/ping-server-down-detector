var tcpp = require('tcp-ping');
var nodemailer = require('nodemailer');
var request = require('request');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var version = require('./package.json').version;
var m = require('./miner.js');

var debug;
if (process.env.DEBUG == 1) {
  debug = true;
} else {
  debug = false;
}

var servers = [];
var miners = [];

servers[0] = {
  name: 'sam-server-2',
  isMiner: false,
  ip: process.env.SAM_SERVER_2_IP,
  port: process.env.SAM_SERVER_2_PORT,
  isOffline: false
};
servers[1] = {
  name: 'orangepione-2',
  isMiner: false,
  ip: process.env.ORANGEPIONE_2_IP,
  port: process.env.ORANGEPIONE_2_PORT,
  isOffline: false
};
servers[2] = {
  name: 'orangepione-3',
  isMiner: false,
  ip: process.env.ORANGEPIONE_3_IP,
  port: process.env.ORANGEPIONE_3_PORT,
  isOffline: false
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
  isOffline: false
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
      isOffline: server.isOffline
    });
  });
  miners.forEach(function (server) {
    allData.miners.push({
      name: server.name,
      stats: server.stats,
      isOffline: server.isOffline
    });
  });
  return allData;
}

/**
 * Check if all servers are online
 * @return {Boolean} True when all servers are online
 */
function allServersOnline() {
  servers.forEach(function (server) {
    if (server.isOffline) {
      return false
    }
  });
  miners.forEach(function (server) {
    if (server.isOffline) {
      return false
    }
  });
  return true;
}

/**
 * Ping all of the servers
 */
function probeAll() {
  servers.forEach(function (server) {
    probe(server);
  });
  miners.forEach(function (server) {
    probeMiner(server);
    probeMinerHR(server);
  })
}

/**
 * Ping a single server and call sendEmail if offline
 * @param  {Object} server Server to ping
 */
function probe(server) {
  tcpp.probe(server.ip, server.port, function(err, available) {
    if (debug) {
      console.log(`${server.name} (${server.ip}:${server.port}): ${available ? 'online' : 'offline'}`);
    }
    if (!available && !server.isOffline) {
      sendEmailOffline(server);
    }
    if (available && server.isOffline) {
      sendEmailOnline(server);
    }
  });
}

/**
 * Ping a single miner and call sendEmail if offline
 * @param  {Object} server Server to ping
 */
function probeMiner(server) {
  request(server.api, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var data = JSON.parse(body);
      if (debug) {
        console.log(`${server.name} (${server.name}: [Online:${data.workersOnline}] [Offline:${data.workersOffline}]`);
      }
     if (data.workersOffline > 0 && !server.isOffline) {
       sendEmailOffline(server);
     }
     if (data.workersOffline == 0 && server.isOffline) {
       sendEmailOnline(server);
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
    console.log(`${server.name} is not a miner!`);
  }
}

/**
 * Send an email if a miner is having problems
 * @param  {Object} server Server having problems
 */
function sendEmailMiner(server) {
  if (debug) {
    console.log(`[${new Date()}] Sending miner email.`);
  }
  var mailOptions = {
    from: process.env.EMAIL_CLIENT,
    to: process.env.EMAIL_RECIPIENT,
    subject: `${server.name} is having problems!`,
    text: `${server.name} started having problems around: ${new Date()}
    \n\nLong (3h) hashrate is ${server.stats.longHashrate} MH. Should be > ${process.env.LOW_HR}.
    \nCurrent (30m) hashrate is ${server.stats.currentHashrate} MH.
    \nLast beat was ${new Date(server.stats.lastBeat)}.
    \n\nChecking every ${process.env.PROBE_TIME} mins
    \n\nping-server-down-detector v${version} - https://github.com/samr28/ping-server-down-detector`
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(`[${new Date()}] Error sending email: ${error}`);
    } else {
      if (debug) {
        console.log(`[${new Date()}] Email sent: ${info.response}`);
      }
      server.sentHRMail = true;
    }
  });
}

/**
 * Send an email that a server has come back online
 * @param  {Object} server Server that is now online
 */
function sendEmailOnline(server) {
  if (debug) {
    console.log(`[${new Date()}] Sending online email`);
  }
  var mailOptions = {
    from: process.env.EMAIL_CLIENT,
    to: process.env.EMAIL_RECIPIENT,
    subject: `${server.name} is back online!`,
    text: `${server.name} came back around ${new Date()}
    \n\nChecking every ${process.env.PROBE_TIME} mins
    \n\nping-server-down-detector v${version} - https://github.com/samr28/ping-server-down-detector`
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(`[${new Date()}] Error sending email: ${error}`);
    } else {
      if (debug) {
        console.log(`[${new Date()}] Email sent: ${info.response}`);
      }
      server.isOffline = false;
    }
  });
}

/**
 * Send an email that a server is offline
 * @param  {Object} server Server that has gone offline
 */
function sendEmailOffline(server) {
  if (debug) {
    console.log(`[${new Date()}] Sending offline email`);
  }
  var mailOptions = {
    from: process.env.EMAIL_CLIENT,
    to: process.env.EMAIL_RECIPIENT,
    subject: `${server.name} is offline!`,
    text: `${server.name} went offline around ${new Date()}
    \n\nChecking every ${process.env.PROBE_TIME} mins
    \n\nping-server-down-detector v${version} - https://github.com/samr28/ping-server-down-detector`
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(`[${new Date()}] Error sending email: ${error}`);
    } else {
      if (debug) {
        console.log(`[${new Date()}] Email sent: ${info.response}`);
      }
      server.isOffline = true;
    }
  });
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
      <div class="card">
        <h5 class="card-header"><span class="badge badge-pill badge-${server.isOffline ? 'danger' : 'success'}">${server.isOffline ? 'Offline' : 'Online'}</span> ${server.name}</h5>
      </div>`;
  });
  data.miners.forEach(function (server) {
    html += `
      <div class="card">
        <h5 class="card-header"><span class="badge badge-pill badge-${server.isOffline ? 'danger' : 'success'}">${server.isOffline ? 'Offline' : 'Online'}</span> ${server.name}</h5>
        <ul class="list-group list-group-flush">
          <li class="list-group-item" id="mydiv">Current hashrate (30m): ${server.stats.currentHashrate} MH</li>
          <li class="list-group-item">Long hashrate (3h): ${server.stats.longHashrate} MH</li>
          <li class="list-group-item">Last beat: ${new Date(server.stats.lastBeat)}</li>
        </ul>
      </div>`;
  });
  return html;
}

/**
 * Generate new HTML and update the title
 */
function refreshAll() {
  io.sockets.emit('update server', generateHTML());
  io.sockets.emit('update title', allServersOnline());
}


console.log(`[${new Date()}] Starting v${version}`);

// Initial probe
probeAll();

// Serve index
app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

// Update inner html and refresh when buttons are clicked
io.on('connection', function(socket){
  refreshAll();
  io.sockets.emit('update footer', `<a href="https://github.com/samr28/ping-server-down-detector" target="_blank">ping-server-down-detector</a> v${version}`, `Refreshing every ${process.env.PROBE_TIME} mins`);
  socket.on('refresh', function(){
    refreshAll();
  });
  socket.on('probe', function(){
    probeAll();
  });
});

// Listen for connections on WEB_PORT
http.listen(process.env.WEB_PORT, function(){
  console.log(`listening on *:${process.env.WEB_PORT}`);
});

var minutes = process.env.PROBE_TIME, the_interval = minutes * 60 * 1000;
setInterval(function() {
  if (debug) {
    console.log(`\n[${new Date()}] Checking`);
  }
  probeAll();
}, the_interval);
