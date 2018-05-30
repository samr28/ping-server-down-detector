var tcpp = require('tcp-ping');
var nodemailer = require('nodemailer');
var request = require('request');
var http = require('http');

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
  sentMail: false
};
servers[1] = {
  name: 'orangepione-2',
  isMiner: false,
  ip: process.env.ORANGEPIONE_2_IP,
  port: process.env.ORANGEPIONE_2_PORT,
  sentMail: false
};
servers[2] = {
  name: 'orangepione-3',
  isMiner: false,
  ip: process.env.ORANGEPIONE_3_IP,
  port: process.env.ORANGEPIONE_3_PORT,
  sentMail: false
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
  sentMail: false
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
  var allData = {};
  allData.servers = servers;
  allData.miners = miners;
  return allData;
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
    if (!available && !server.sentMail) {
      sendEmailOffline(server);
    }
    if (available && server.sentMail) {
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
     if (data.workersOffline > 0 && !server.sentMail) {
       sendEmailOffline(server);
     }
     if (data.workersOffline == 0 && server.sentMail) {
       sendEmailOnline(server);
     }
    }
  })
}

function probeMinerHR(server) {
  if (server.isMiner) {
    m.getStats(function (data) {
      server.stats = data;
      server.status.lowHR = data.currentHashrate < process.env.LOW_HR ? true : false;
      server.status.badBeat = ((new Date).getTime()) - data.lastBeat > process.env.MAX_BEAT_TIME ? true : false;
      if (server.status.lowHR || server.status.badBeat) {
        if (!server.sentHRMail && !server.sentMail) {
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

function sendEmailMiner(server) {
  if (debug) {
    console.log(`[${new Date()}] Sending miner email.`);
  }
  var mailOptions = {
    from: process.env.EMAIL_CLIENT,
    to: process.env.EMAIL_RECIPIENT,
    subject: `${server.name} is having problems!`,
    text: `${server.name} started having problems around: ${new Date()}
    \n\nCurrent (30m) hashrate is ${server.stats.currentHashrate} MH. Should be > ${process.env.LOW_HR}.
    \nLong (3h) hashrate is ${server.stats.longHashrate} MH.
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
      server.sentMail = false;
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
      server.sentMail = true;
    }
  });
}

console.log(`[${new Date()}] Starting`);
probeAll();
http.createServer(function (req, res) {
  res.write(JSON.stringify(getAllData()));
  res.end();
}).listen(process.env.WEB_PORT);

var minutes = process.env.PROBE_TIME, the_interval = minutes * 60 * 1000;
setInterval(function() {
  if (debug) {
    console.log(`\n[${new Date()}] Checking`);
  }
  probeAll();
}, the_interval);
