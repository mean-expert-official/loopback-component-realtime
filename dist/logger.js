"use strict";
var chalk = require('chalk');
/**
* @author Jonathan Casarrubias <twitter:@johncasarrubias> <github:@johncasarrubias>
* @module RealTimeLog
* @license MTI
* @description
* Console Log wrapper that can be disabled in production mode
**/
var RealTimeLog = (function () {
    function RealTimeLog() {
    }
    RealTimeLog.log = function (input) {
        if (RealTimeLog.options.debug)
            console.log(chalk.yellow(this.namespace + ": " + input));
    };
    RealTimeLog.namespace = '@mean-expert/loopback-component-realtime';
    return RealTimeLog;
}());
exports.RealTimeLog = RealTimeLog;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/logger.js.map