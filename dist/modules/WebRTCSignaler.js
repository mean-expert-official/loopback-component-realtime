"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var logger_1 = require("../logger");
/**
 * @module IO
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 *
 * This module is created to implement WebRTC Functionality into the LoopBack Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 **/
var WebRTCSignaler = (function () {
    function WebRTCSignaler(driver, options) {
        logger_1.RealTimeLog.log("WebRTCSignaler server enabled using " + options.driver.name + " driver.");
        WebRTCSignaler.driver = driver;
        WebRTCSignaler.options = options;
        WebRTCSignaler.driver.onConnection(function (socket) {
            var initiatorChannel = '';
            socket.on('new-channel', function (data) {
                if (!WebRTCSignaler.channels[data.channel]) {
                    initiatorChannel = data.channel;
                }
                WebRTCSignaler.channels[data.channel] = data.channel;
                WebRTCSignaler.onNewNamespace(data.channel, data.sender);
            });
            socket.on('presence', function (channel) {
                var isChannelPresent = !!WebRTCSignaler.channels[channel];
                socket.emit('presence', isChannelPresent);
            });
            socket.on('disconnect', function (channel) {
                if (initiatorChannel) {
                    delete WebRTCSignaler.channels[initiatorChannel];
                }
            });
        });
        return WebRTCSignaler;
    }
    WebRTCSignaler.onNewNamespace = function (channel, sender) {
        WebRTCSignaler.driver.of('/' + channel).on('connection', function (socket) {
            var username;
            if (WebRTCSignaler.driver.isConnected) {
                WebRTCSignaler.driver.isConnected = false;
                socket.emit('connect', true);
            }
            socket.on('message', function (data) {
                if (data.sender == sender) {
                    if (!username)
                        username = data.data.sender;
                    socket.broadcast.emit('message', data.data);
                }
            });
            socket.on('disconnect', function () {
                if (username) {
                    socket.broadcast.emit('user-left', username);
                    username = null;
                }
            });
        });
    };
    return WebRTCSignaler;
}());
WebRTCSignaler.channels = {};
exports.WebRTCSignaler = WebRTCSignaler;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/modules/WebRTCSignaler.js.map