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
var http = require("http");
var config = require("./config.js");
var registrar = require("./lib/registrar.js");

// Constants
////////////

var SIG_PREFIX = "/sig";
var STATIC_DIR = "static";


// Logger configuration
///////////////////////

var logger = winston;
logger.clear();
logger.add(winston.transports.Console, {level: config.log.level, colorize: 'true'});
logger.setLevels(winston.config.npm.levels); // silly, debug, verbose, info, warn, error


// Setting-up the http server
/////////////////////////////

var app = connect();
app.use(connect.static(STATIC_DIR));
app.use(connect.directory(STATIC_DIR));

var httpServer = http.createServer(app);

var sockjsRegistrar = registrar.createSockjsServer();
sockjsRegistrar.installHandlers(httpServer, {prefix: SIG_PREFIX});

httpServer.listen(config.server.port);
httpServer.on("listening", function() {
	logger.info("WebRTC signalization server started.");
});

