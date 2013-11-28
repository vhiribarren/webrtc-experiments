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

var assert = require("assert");
var sockjs = require("sockjs-client");
var http = require("http");
var registrar = require("../lib/registrar.js");
var winston = require("winston");


describe("Signalization", function() {

	winston.clear();
	//winston.add(winston.transports.Console, {level: "silly", colorize: 'true'});

	var server = http.createServer();
	var serverPort = 8085;
	var serverUrl = "http://127.0.0.1:"+serverPort+"/sig";


	before(function(done) {
		var sockjsRegistrar = registrar.createSockjsServer();
		sockjsRegistrar.installHandlers(server, {prefix: "/sig"});
		server.once("listening", done);
		server.listen(serverPort);
	});	

	after(function() {
		server.close(function() {done();});
	});


	describe("Bad formatted messages", function() {
		var client;
		beforeEach(function(done) {
			client = sockjs.create(serverUrl);
			client.once('connection', done);
		});
		afterEach(function(done) {
			client.once('close', function(){done();});
			client.close();
		});
		it("should return a json error if no JSON message is sent", function(done) {
			client.once('data', function(msg) {
				var parsedMsg = JSON.parse(msg);
				assert.equal(parsedMsg.type, 'error');
				assert.equal(parsedMsg.code, 'json');
				done();
			});
			client.write("hello world");
		});
		it("should return error if no 'type' field exist", function(done) {
			client.once('data', function(msg) {
				var parsedMsg = JSON.parse(msg);
				assert.equal(parsedMsg.type, 'error');
				assert.equal(parsedMsg.code, 'no-type');
				done();
			});
			client.write(JSON.stringify({hello: 'world'}));
		});
	});


	describe("Registration", function() {
		var client;
		beforeEach(function(done) {
			client = sockjs.create(serverUrl);
			client.once('connection', done);
		});
		afterEach(function(done) {
			client.once('close', function() {done();});
			client.close();
		});
		it("should refuse any message if not registered", function(done) {
			client.once('data', function(msg) {
				var parsedMsg = JSON.parse(msg);
				assert.equal(parsedMsg.type, 'error');
				assert.equal(parsedMsg.code, 'not-registered');
				done();
			});
			client.write(JSON.stringify({type: 'sdpOffer', desc:'sample', from: 'myId'}));
		});
		it("should refuse a registration with no from field", function(done) {
			client.once('data', function(msg) {
				var parsedMsg = JSON.parse(msg);
				assert.equal(parsedMsg.type, 'error');
				assert.equal(parsedMsg.code, 'no-from');
				done();
			});
			client.write(JSON.stringify({type: 'register'}));
		});
		it("should answer 'ok' when registration succeed", function(done) {
			client.once('data', function(msg) {
				var parsedMsg = JSON.parse(msg);
				assert.equal(parsedMsg.type, 'ok');
				assert.equal(parsedMsg.what, 'register');
				done();
			});
			client.write(JSON.stringify({type: 'register', from: "myId"}));
		});
		it("should refuse registration if another client is already registered with same id", function(done) {
			var otherClient = sockjs.create(serverUrl);
			otherClient.once('connection', function() {
	            client.write(JSON.stringify({type: 'register', from: 'myId'}));
			});
			client.once('data', function(msg) {
				var parsedMsg = JSON.parse(msg);
				assert.equal(parsedMsg.type, 'ok');
				otherClient.write(JSON.stringify({type: 'register', from: 'myId'}));
			});
			otherClient.once('data', function(msg) {
				var parsedMsg = JSON.parse(msg);
				assert.equal(parsedMsg.type, 'error');
				assert.equal(parsedMsg.code, 'duplicate-id');
				done();
			});
		});
		it("should refuse messages if destination peer is not connected", function(done) {
			client.once('data', function(msg) {
				var parsedMsg = JSON.parse(msg);
				assert.equal(parsedMsg.type, 'ok');
				client.once('data', function(msg) {
	                var parsedMsg = JSON.parse(msg);
		            assert.equal(parsedMsg.type, 'error');
					assert.equal(parsedMsg.code, 'peer-unavailable');
					done();
				});
				client.write(JSON.stringify({type: "sdpOffer", from: "myId", to: "otherId", desc: "sample"}));
			});
			client.write(JSON.stringify({type: 'register', from: "myId"}));
		});
		it("should refuse messages sent to oneself", function(done) {
			client.once('data', function(msg) {
				var parsedMsg = JSON.parse(msg);
				assert.equal(parsedMsg.type, 'ok');
				client.once('data', function(msg) {
					var parsedMsg = JSON.parse(msg);
					assert.equal(parsedMsg.type, 'error');
					assert.equal(parsedMsg.code, 'oneself-forbidden');
					done();
				});
				client.write(JSON.stringify({type: "sdpOffer", from: "myId", to: "myId", desc: "sample"}));
			});
			client.write(JSON.stringify({type: 'register', from: "myId"}));
		});
		it("should refuse another register from the same client after a first one", function(done) {
			client.once('data', function(msg) {
				var parsedMsg = JSON.parse(msg);
				assert.equal(parsedMsg.type, 'ok');
				client.once('data', function(msg) {
					var parsedMsg = JSON.parse(msg);
					assert.equal(parsedMsg.type, 'error');
					assert.equal(parsedMsg.code, 'already-registered');
					done();
				});
				client.write(JSON.stringify({type: "register", from: "myId"}));
			});
			client.write(JSON.stringify({type: 'register', from: "myId"}));
		});
	});


	describe("Message exchange", function() {
		var client;
		var otherClient;
		beforeEach(function(done) {
			client = sockjs.create(serverUrl);
			client.once('connection', function() {
				connectOtherClient();
			});
			function connectOtherClient() {
				otherClient = sockjs.create(serverUrl);
				otherClient.once('connection', registerClient);	
			}
			function registerClient() {
				client.write(JSON.stringify({type: 'register', from: "myId"}));
				client.once('data', registerOtherClient);
			}
			function registerOtherClient() {
				otherClient.write(JSON.stringify({type: 'register', from: "otherId"}));
				otherClient.once('data', function() {done();});
			}
		});
		afterEach(function(done) {
			client.once('close', function() {otherClient.close();});
			otherClient.once('close', function() {done();});
			client.close();
		});
		it("should refuse a message with a 'to' and no 'from'", function(done) {
			client.write(JSON.stringify({type: 'sdpOffer', to: 'otherId', desc: 'sample'}));
			client.once('data', function(message) {
				var parsedMsg = JSON.parse(message);
				assert.strictEqual(parsedMsg.code, 'no-from');
				done();
			});
		});
		it("should refuse a message with a 'from' different from the one registered", function(done) {
			client.write(JSON.stringify({type: 'sdpOffer', to: 'otherId', from: "fakeId", desc: 'sample'}));
			client.once('data', function(message) {
				var parsedMsg = JSON.parse(message);
				assert.strictEqual(parsedMsg.code, 'bad-from');
				done();
			});
		});
		it("should transparently pass to another peer any message with a 'to' and a 'from'", function(done) {
			var data = {type: 'blablablabla', to: 'otherId', from: "myId", data: ["hello"]};
			client.write(JSON.stringify(data));
			otherClient.once('data', function(message) {
				var parsedMsg = JSON.parse(message);
				assert.deepEqual(parsedMsg, data);
				done();
			});
		});
	});


	describe("Broadcast", function() {
		var client;
		beforeEach(function(done) {
			client = sockjs.create(serverUrl);
			client.once('connection', function() {
				client.write(JSON.stringify({type: 'register', from: "myId"}));
				client.once('data', function() {
					done();
				});
			});
		});
		afterEach(function(done) {
			client.once('close', function() {done();});
			client.close();
		});
		it("should receive a broadcasted 'closed' message when a user disconnect", function(done) {
			client.once('data', function(message) {
				var parsedMsg = JSON.parse(message);
				assert.equal(parsedMsg.type, 'broadcast');
				assert.equal(parsedMsg.what, 'closed');
				assert.equal(parsedMsg.from, 'otherId');
				done();
			});
			var otherClient = sockjs.create(serverUrl);
			otherClient.once('connection', function() {
				otherClient.write(JSON.stringify({type: 'register', from: "otherId"}));
				otherClient.once('data', function() { otherClient.close(); });
			});
		});
	});

});

