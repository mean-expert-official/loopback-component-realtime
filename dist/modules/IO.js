"use strict";
var chalk = require('chalk');
var IO = (function () {
    function IO(driver, options) {
        console.log(chalk.yellow("MX-RealTime: IO server enabled using " + options.driver.name + " driver."));
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