# ping-server-down-detector

This project assumes that you already have Node.js installed along with npm. If not, please do a google search and install Node.js before following the steps in this readme.

## Installation
1. Clone the repo
2. `npm install` in the ping-server-down-detector dir
3. Create a run script (optional but recommended) - see the section below
4. Make the run script executable (`chmod a+x FILE` on Linux)
5. Check out the next section on customizing

## Customizing
You probably have different servers than I do. If you would like to remove the ones that I have and add some of yours, simply open `run.js` in your favorite text editor and modify the `probeAll()` function. In this function, just make a list of all of the servers that you want to monitor. Add a server with the following format: `probe('SOME SERVER NAME', process.env.SOME_SERVER_IP, process.env.SOME_SERVER_PORT);`. After making modifications in `run.js`, open up your run script and add the environment variables for `SOME_SERVER_IP` and `SOME_SERVER_PORT` in the following format: `export SOME_SERVER_IP=192.168.0.0` and `export SOME_SERVER_PORT=00`.

## Creating a run script
Run scripts make things much easier. You can place all of your environment variables (server IPs, ports, email addresses, etc.) in one place. Simply copy the template below and modify as needed. You will also need to install forever.js if you want your script to start back up if something causes it to crash. To install, type `npm install forever -g`. If you would like to use the script without forever.js, simply change the last line to `node run.js`

```
#!/bin/bash

# Probe every PROBE_TIME mins
# Default: 5
export PROBE_TIME=5

# Uncomment to turn on debug mode
#export DEBUG=1

export EMAIL_CLIENT=gmail
export EMAIL_ADDRESS=
export EMAIL_PASSWORD=
export EMAIL_RECIPIENT=

export SAM_SERVER_2_IP=
export SAM_SERVER_2_PORT=

export ORANGEPIONE_2_IP=
export ORANGEPIONE_2_PORT=

export ORANGEPIONE_3_IP=
export ORANGEPIONE_3_PORT=

npm install

forever start -l /home/USER/logs/ping-server-down-detector.log -a run.js

```
