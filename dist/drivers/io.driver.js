"use strict";
var logger_1 = require('../logger');
var server = require('socket.io');
var client = require('socket.io-client');
var ioAuth = require('socketio-auth');
var IODriver = (function () {
    function IODriver() {
        this.connections = new Array();
    }
    IODriver.prototype.connect = function (options) {
        var _this = this;
        this.server = server(options.server);
        this.onConnection(function (socket) { return _this.newConnection(socket); });
        this.client = client("http://127.0.0.1:" + options.app.get('port'));
        this.authenticate(options);
    };
    IODriver.prototype.authenticate = function (options) {
        var _this = this;
        if (options.auth) {
            logger_1.RealTimeLog.log('RTC authentication mechanism enabled');
            ioAuth(this.server, {
                authenticate: function (socket, token, next) {
                    var AccessToken = options.app.models.AccessToken;
                    //verify credentials sent by the client
                    var token = AccessToken.findOne({
                        where: { id: token.id || 0, userId: token.userId || 0 }
                    }, function (err, tokenInstance) {
                        if (tokenInstance) {
                            socket.token = tokenInstance;
                            next(err, true);
                        }
                        else {
                            next(err, false);
                        }
                    });
                },
                postAuthenticate: function () {
                    _this.server.on('authentication', function (value) {
                        logger_1.RealTimeLog.log("A user " + value + " has been authenticated over web sockets");
                    });
                }
            });
        }
    };
    IODriver.prototype.emit = function (event, message) {
        this.server.emit(event, message);
    };
    IODriver.prototype.on = function (event, callback) {
        this.client.on(event, callback);
    };
    IODriver.prototype.once = function (event, callback) {
        this.client.once(event, callback);
    };
    IODriver.prototype.of = function (event) {
        return this.server.of(event);
    };
    IODriver.prototype.forEachConnection = function (handler) {
        this.connections.forEach(function (connection) { return handler(connection); });
    };
    IODriver.prototype.onConnection = function (handler) {
        var _this = this;
        this.server.on('connection', function (socket) { return handler(socket, _this.server); });
    };
    IODriver.prototype.removeListener = function (name, listener) {
        this.server.sockets.removeListener(name, listener);
    };
    IODriver.prototype.newConnection = function (socket) {
        var _this = this;
        this.connections.push(socket);
        socket.setMaxListeners(0);
        socket.on('ME:RT:1://event', function (input) {
            _this.server.emit(input.event, input.data);
        });
        socket.on('disconnect', function () { return socket.removeAllListeners(); });
        socket.on('lb-ping', function () { return socket.emit('lb-pong', new Date().getTime() / 1000); });
    };
    return IODriver;
}());
exports.IODriver = IODriver;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/drivers/io.driver.js.map