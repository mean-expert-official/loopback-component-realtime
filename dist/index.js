"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var factory_1 = require("./drivers/factory");
var logger_1 = require("./logger");
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
                if (options.driver && !options.driver.options) {
                    options.driver.options = RealTime.options.driver.options;
                }
                RealTime.options = Object.assign(RealTime.options, options, {
                    app: app,
                    server: server,
                    driver: RealTime.options.driver
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
    return RealTime;
}());
RealTime.options = {
    driver: {
        name: 'socket.io',
        options: {
            // Client options
            forceNew: true,
            upgrade: false,
            // Client/Server Options
            transports: ['websocket'] // Enabled by default to fix handshake issues on clustered envs. (No IE9)
            // Server Options
            // ...
        }
    },
    debug: false,
    auth: true,
    modules: [/*'PubSub' Deprecated,*/ 'IO', 'FireLoop' /*, 'WebRTCSignaler'  Not yet implemented */]
};
module.exports = RealTime;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/index.js.map