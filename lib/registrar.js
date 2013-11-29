/*
The MIT License (MIT)

Copyright (c) 2013 Vincent Hiribarren

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var winston = require("winston");
var connect = require("connect");
var sockjs = require("sockjs");


// Logger configuration
///////////////////////

var logger = winston;
function sockjsLogHandler(severity, message) {
	switch(severity) {
		case "debug": logger.debug(message); break;
		case "info": logger.verbose(message); break;
		case "error": logger.error(message); break;
		default: logger.info(message);
	}
}


// SockJS / signal
//////////////////

exports.createSockjsServer = function() {


var registrar = Object.create(null);
var sockjsServer = sockjs.createServer({log: sockjsLogHandler});

sockjsServer.on('connection', function(conn) {
	logger.verbose("New client connected from %s:%s", conn.remoteAddress, conn.remotePort);
	conn.isWho = null;
	conn.on('data', function(data) {
		logger.silly("Message received from %s:%s: %s", conn.remoteAddress, conn.remotePort, data);
		messageHandler(data, conn);
	});
	conn.on('close', function() {
		logger.verbose("Connection closed from %s:%s.", conn.remoteAddress, conn.remotePort);
		if (conn.isWho !== null) {
			broadcastMessage("closed", conn.isWho);
			delete registrar[conn.isWho];
		}
	});
});

function messageHandler(data, conn) {
	var message = null;
	try {
		message = JSON.parse(data);
	}
	catch(e) {
		logger.warn("JSON parsing error: " + e);
		sendErrorMessage("json", conn);
		return;
	}
	if (! ("type" in message) ) {
		logger.warn("Bad message received: " + message);
		sendErrorMessage("no-type", conn);
		return;
	}
	switch(message.type) {
		case "register":
			if (conn.isWho !== null) {
				sendErrorMessage('already-registered', conn);
				return;
			}
			if(! ("from" in message)) {
				sendErrorMessage("no-from", conn);
				return;
			}
			if (message.from in registrar) {
				sendErrorMessage('duplicate-id', conn);
				return;
			}
			registrar[message.from] = conn;
			conn.isWho = message.from;
			logger.verbose("%s:%s registered as %s.", conn.remoteAddress, conn.remotePort, conn.isWho);
			conn.write(JSON.stringify({type: 'ok', what: 'register'}));
			break;
		default:
			if (conn.isWho === null) {
				sendErrorMessage('not-registered', conn);
				return;
			}
			if ( ('to' in message) && !('from' in message)) {
				sendErrorMessage('no-from', conn);
				return;
			}
			if ( ('to' in message) && (message.from != conn.isWho)) {
				sendErrorMessage('bad-from', conn);
				return;
			}
			if (message.to === conn.isWho) {
				sendErrorMessage("oneself-forbidden", conn);
				return;
			}
			if (message.to in registrar) {
				registrar[message.to].write(data);
			}
			else {
				sendErrorMessage("peer-unavailable", conn);
			}
	}
}


function sendErrorMessage(code, conn) {
	var errMsg = {
		type: "error",
		code: code 
	};
	conn.write(JSON.stringify(errMsg));
}


function broadcastMessage(what, closedPeerId) {
	var closeMsg = {
		type: "broadcast",
		what: what,
		from: closedPeerId
	};
	for(var peerId in registrar) {
		if (peerId === closedPeerId) continue;
		registrar[peerId].write(JSON.stringify(closeMsg));
	}
}


return sockjsServer;

}; // exports
