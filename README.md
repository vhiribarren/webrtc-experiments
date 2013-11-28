WebRTC Experiments
==================

This project contains a tiny signalling server to associate different
WebRTC clients, as well as some web pages with some experimentations
about WebRTC.

It is a `nodejs` project, so you must have `node` installed on your system.

Install & Usage
---------------

Download the project, and then:

    $ npm install
    $ node server.js

The server port can be configured in the `config.js` file. By default, the port
used is 8080 so you can then open your web browser to http://127.0.0.1:8080

`npm` can also be used to start the server or some mocha tests:

    $ npm start
    $ npm test

The registrar server
--------------------

A tiny registrar / signalling server is at address http://127.0.0.1:8080/sig
It uses the SockJS library and use JSON elements to exchange messages.

The protocol is described in the mocha test file (code style!).

Using SockJS, each client must send a register packet with its own id:

    {'type': 'register', 'from': 'myId'}

In case of success, an ok is sent back:

    {'type': 'ok', 'what': 'register'}

In case of error, an error is sent back:

    {'type': 'error', 'code': 'duplicate-id'}

Once registered, clients can send data one to the other, using custom type
messages and custom fields. However, each message MUST have a `to`, `from`
and `type` fields:

    {'type': 'sdpOffer', 'from': 'myId', 'to': 'otherId', 'desc': 'SDP stuff'}

It is up to the clients to understand the message and its content.

For now, if a client disconnect, a broadcast message is sent to every registered
client. If the client with `myId` disconnect, other will receive:

    {'type': 'broadcast', 'from': 'myId', 'what': 'closed'}

The client is automatically unregistered if it closes its SockJS connection.

Multisink test
--------------

The multisink test has 2 web pages:

* sink at `/multisink/index.html`
* source at `/multisink/source.html`

The idea is to open one sink page, and several source page on devices with
a camera. Each time a stream is published, it appears on the sink page, which
can display all the streams at the same time.

Tested with chrome 31.
