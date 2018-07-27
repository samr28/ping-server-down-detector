# ping-server-down-detector

This project assumes that you already have Node.js installed along with npm. If not, please do a google search and install Node.js before following the steps in this readme.

## Installation
1. Clone the repo
2. `npm install` in the ping-server-down-detector dir
3. Create a run script (optional but recommended) - see the section below
4. Make the run script executable (`chmod a+x FILE` on Linux)
5. Check out the next section on customizing

## Customizing
To customize the servers to be monitored, create `servers.js` with the following contents:
```
var servers = [];

module.exports = {
  servers: servers
}

// SERVERS
servers.push({
  name: 'server1',
  isMiner: false,
  sysinfo: {},
  sysinfoPort: SYSINFO_PORT,
  ip: IP_ADDR,
  port: PING_PORT,
  isOffline: false,
  dropdown: false
});

// MINERS
servers.push({
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
  api: NOOBPOOL_API,
  sentHRMail: false,
  isOffline: false,
  dropdown: false
});

```

## Creating a run script
Run scripts make things much easier. You can place all of your environment variables (server IPs, ports, email addresses, etc.) in one place. Simply copy the template below and modify as needed. You will also need to install forever.js if you want your script to start back up if something causes it to crash. To install, type `npm install forever -g`. If you would like to use the script without forever.js, simply change the last line to `node run.js`

## Monitoring the status of other servers
On the other servers, simply clone down the repo and run `servesysinfo` to host a page with the server stats

```
#!/bin/bash

# Probe every PROBE_TIME mins
# Default: 5
export PROBE_TIME=5

# Uncomment to turn on debug mode
#export DEBUG=1

# Comment to turn of emails
export SEND_EMAIL=1

export EMAIL_CLIENT=gmail
export EMAIL_ADDRESS=
export EMAIL_PASSWORD=
export EMAIL_RECIPIENT=

export WEB_PORT=8080

export SAM_SERVER_2_IP=
export SAM_SERVER_2_PORT=

export ORANGEPIONE_2_IP=
export ORANGEPIONE_2_PORT=

export ORANGEPIONE_3_IP=
export ORANGEPIONE_3_PORT=

export MINER1_API=http://noobpool.com/api/accounts/0x000000000000000000000000
# Expect the hashrate to always be above LOW_HR
export LOW_HR=
# 10 mins max
export MAX_BEAT_TIME=600000

cd /home/USER/Documents/ping-server-down-detector/

npm install

forever start -l /home/USER/logs/ping-server-down-detector.log -a run.js

```

## Creating a run script for sysinfo
```
#!/bin/bash

# Uncomment to turn on debug mode
# export DEBUG=1

export WEB_PORT=3001

cd /home/USER/Documents/ping-server-down-detector/

npm install

forever start -l /home/USER/logs/sysinfo.log -a sysinfo.js

```
