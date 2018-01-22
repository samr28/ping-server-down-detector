var tcpp = require('tcp-ping');
var nodemailer = require('nodemailer');

var version = require('./package.json').version;

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
  probe('sam-server-2', process.env.SAM_SERVER_2_IP, process.env.SAM_SERVER_2_PORT);
  probe('orangepi-2', process.env.ORANGEPIONE_2_IP, process.env.ORANGEPIONE_2_PORT);
  probe('orangepi-3', process.env.ORANGEPIONE_3_IP, process.env.ORANGEPIONE_3_PORT);
}

/**
 * Ping a single server and call sendEmail if offline
 * @param  {String} name Name of the server
 * @param  {String} ip   Server IP address
 * @param  {Number} port Server port
 */
function probe(name, ip, port) {
  tcpp.probe(ip, port, function(err, available) {
    console.log(`${name} (${ip}:${port}): ${available ? 'online' : 'offline'}`);
    if (!available) {
      sendEmail(name);
    }
  });
}

/**
 * Send an email that a server is offline
 * @param  {String} var Name of the server that has gone offline
 */
function sendEmail(name) {
  var mailOptions = {
    from: process.env.EMAIL_CLIENT,
    to: process.env.EMAIL_RECIPIENT,
    subject: `${name} is offline!`,
    text: `${name} went offline around ${new Date()}
    \n\nChecking every ${process.env.PROBE_TIME} mins
    \n\nping-server-down-detector v${version} - https://github.com/samr28/ping-server-down-detector`
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

console.log(`[${new Date()}] Starting`);
probeAll();

var minutes = process.env.PROBE_TIME, the_interval = minutes * 60 * 1000;
setInterval(function() {
  console.log(`\n[${new Date()}] Checking`);
  probeAll();
}, the_interval);
