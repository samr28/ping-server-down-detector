var tcpp = require('tcp-ping');
var nodemailer = require('nodemailer');

var version = require('./package.json').version;

var debug;
if (process.env.DEBUG == 1) {
  debug = true;
} else {
  debug = false;
}

var servers = [];

servers[0] = {
  name: 'sam-server-2',
  ip: process.env.SAM_SERVER_2_IP,
  port: process.env.SAM_SERVER_2_PORT,
  sentMail: false
};
servers[1] = {
  name: 'orangepione-2',
  ip: process.env.ORANGEPIONE_2_IP,
  port: process.env.ORANGEPIONE_2_PORT,
  sentMail: false
};
servers[2] = {
  name: 'orangepione-3',
  ip: process.env.ORANGEPIONE_3_IP,
  port: process.env.ORANGEPIONE_3_PORT,
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
 * Ping all of the servers
 */
function probeAll() {
  servers.forEach(function (server) {
    probe(server);
  });
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

var minutes = process.env.PROBE_TIME, the_interval = minutes * 60 * 1000;
setInterval(function() {
  if (debug) {
    console.log(`\n[${new Date()}] Checking`);
  }
  probeAll();
}, the_interval);
