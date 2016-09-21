"use strict";
var chalk = require('chalk');
var PubSub = (function () {
    function PubSub(driver, options) {
        console.log(chalk.yellow("MX-RealTime: PubSub server enabled using " + options.driver.name + " driver."));
        PubSub.driver = driver;
        PubSub.options = options;
        return PubSub;
    }
    PubSub.publish = function (options, next) {
        if (options && options.method && options.endpoint && options.data) {
            if (options.endpoint.match(/\?/))
                options.endpoint = options.endpoint.split('?').shift();
            var event_1 = "[" + options.method + "]" + options.endpoint;
            if (PubSub.options.debug) {
                console.log(chalk.yellow("MX-RealTime: Sending message to " + event_1));
                console.log(chalk.yellow("MX-RealTime: Message: " + (typeof options.data === 'object' ? JSON.stringify(options.data) : options.data)));
            }
            PubSub.driver.emit(event_1, options.data);
            next();
        }
        else {
            if (PubSub.options.debug) {
                console.log(chalk.red('MX-RealTime: Option must be an instance of type { method: string, data: object }'));
                console.log(chalk.red("MX-RealTime: " + options));
            }
            next();
        }
    };
    return PubSub;
}());
exports.PubSub = PubSub;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/modules/PubSub.js.map