var nodemailer = require('nodemailer');
var c = require('./const.js');
var l = require('./log.js');

var SEND_EMAIL = c.EMAIL.ENABLED;

var transporter = nodemailer.createTransport({
  service: c.EMAIL.FROM,
  auth: {
    user: c.EMAIL.AUTH.USER,
    pass: c.EMAIL.AUTH.PASS,
  }
});

module.exports = {
  notify: notify,
}

function notify(server, cb) {
  l.log(`${server.name} is now ${server.online ? 'online' : 'offline'}`, 'notify');
  var mailOptions = {
    from: c.EMAIL.FROM,
    to: c.EMAIL.TO,
    subject: `${server.name} is ${server.online ? 'back online' : 'offline'}`,
    text:
      `${server.name} ${server.online ? 'came online' : 'went offline'}
      around ${new Date()}`,
  };
  if (server.type === 'miner') {
    mailOptions.subject = `${server.name} is having problems`;
    mailOptions.text =
      `${server.name} started having problems around: ${new Date()}
      \n\nLong (3h) hashrate is ${server.stats.longHashrate} MH. Should be > ${process.env.LOW_HR}.
      \nCurrent (30m) hashrate is ${server.stats.currentHashrate} MH.
      \nLast beat was ${new Date(server.stats.lastBeat)}.`;
  }
  mailOptions.text +=
  `\n\nChecking every ${c.PROBE_TIME} ms
  \n\nping-server-down-detector v${c.APP_INFO.version} - ${c.APP_INFO.homepage}`
  if (SEND_EMAIL) {
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        l.log(`Error sending email: ${error}`, 'notify');
      } else {
        l.log(`Email sent: ${info.response}`, 'notify');
      }
      if (cb) {
        cb();
      }
    });
  } else if (cb) {
    cb();
  }
}
