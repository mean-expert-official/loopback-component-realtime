"use strict";
var server = require('socket.io');
var client = require('socket.io-client');
var IODriver = (function () {
    function IODriver() {
        this.connections = new Array();
    }
    IODriver.prototype.connect = function (options) {
        var _this = this;
        this.server = server(options.server);
        this.onConnection(function (socket) { return _this.newConnection(socket); });
        this.client = client("http://127.0.0.1:" + options.app.get('port'));
    };
    IODriver.prototype.emit = function (event, message) {
        this.server.emit(event, message);
    };
    IODriver.prototype.on = function (event, callback) {
        this.client.on(event, callback);
    };
    IODriver.prototype.forEachConnection = function (handler) {
        this.connections.forEach(function (connection) { return handler(connection); });
    };
    IODriver.prototype.onConnection = function (handler) {
        this.server.on('connection', handler);
    };
    IODriver.prototype.newConnection = function (socket) {
        var _this = this;
        this.connections.push(socket);
        socket.on('ME:RT:1://event', function (input) {
            _this.server.emit(input.event, input.data);
        });
    };
    return IODriver;
}());
exports.IODriver = IODriver;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/drivers/io.driver.js.map