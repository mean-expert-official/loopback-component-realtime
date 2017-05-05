"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var logger_1 = require("../logger");
/**
 * @module IO
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 *
 * This module is created to implement IO Functionality into the LoopBack Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 **/
var IO = (function () {
    function IO(driver, options) {
        logger_1.RealTimeLog.log("IO server enabled using " + options.driver.name + " driver.");
        IO.driver = driver;
        IO.options = options;
        return IO;
    }
    IO.emit = function (event, message) {
        IO.driver.emit(event, typeof message === 'object' ? JSON.stringify(message) : message);
    };
    IO.on = function (event, next) {
        IO.driver.on(event, next);
    };
    return IO;
}());
exports.IO = IO;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/modules/IO.js.map