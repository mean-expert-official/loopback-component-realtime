"use strict";
var server = require('socket.io');
var client = require('socket.io-client');
var IODriver = (function () {
    function IODriver() {
    }
    IODriver.prototype.connect = function (options) {
        var _this = this;
        this.server = server(options.server);
        this.server.on('connection', function (socket) { return _this.onConnection(socket); });
        this.client = client("http://127.0.0.1:" + options.app.get('port'));
    };
    IODriver.prototype.emit = function (event, message) {
        this.server.emit(event, message);
    };
    IODriver.prototype.on = function (event, callback) {
        this.client.on(event, callback);
    };
    IODriver.prototype.onConnection = function (socket) {
        var _this = this;
        socket.on('ME:RT:1://event', function (input) {
            _this.server.emit(input.event, input.data);
        });
    };
    return IODriver;
}());
exports.IODriver = IODriver;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/drivers/io.driver.js.map