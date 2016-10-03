"use strict";
var factory_1 = require('./drivers/factory');
var logger_1 = require('./logger');
/**
 * @module @mean-expert/loopback-component-realtime
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 *
 * This module is created to implement multiple real-time transportation channels in order
 * to turn the LoopBack Framework into the Most Powerfull NodeJS Real-Time Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 */
var RealTime = (function () {
    function RealTime(app, options) {
        if (app === void 0) { app = undefined; }
        logger_1.RealTimeLog.options = options;
        if (!app) {
            logger_1.RealTimeLog.log('LoopBack Application Instance is Missing');
        }
        else {
            app.on('started', function (server) {
                app.mx = app.mx || {};
                RealTime.options = Object.assign(RealTime.options, options, {
                    app: app,
                    server: server
                });
                RealTime.connect();
                RealTime.setup();
            });
        }
    }
    RealTime.connect = function () {
        RealTime.driver = factory_1.DriverFactory.load(RealTime.options.driver.name);
        RealTime.driver.connect(RealTime.options);
    };
    RealTime.setup = function () {
        RealTime.options.modules.forEach(function (_module) {
            return RealTime.options.app.mx[_module] =
                require("./modules/" + _module)[_module](RealTime.driver, RealTime.options);
        });
    };
    RealTime.options = {
        driver: { name: 'socket.io' },
        debug: false,
        auth: true,
        modules: ['PubSub', 'IO', 'FireLoop', 'WebRTCSignaler']
    };
    return RealTime;
}());
module.exports = RealTime;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/index.js.map