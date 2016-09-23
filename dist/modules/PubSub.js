"use strict";
var chalk = require('chalk');
/**
 * @module PubSub
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 *
 * This module is created to implement PubSub Functionality into the LoopBack Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 */
var PubSub = (function () {
    function PubSub(driver, options) {
        console.log(chalk.yellow("MEAN Expert: PubSub server enabled using " + options.driver.name + " driver."));
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
                console.log(chalk.yellow("MEAN Expert: Sending message to " + event_1));
                console.log(chalk.yellow("MEAN Expert: Message: " + (typeof options.data === 'object' ? JSON.stringify(options.data) : options.data)));
            }
            PubSub.driver.emit(event_1, options.data);
            next();
        }
        else {
            if (PubSub.options.debug) {
                console.log(chalk.red('MEAN Expert: Option must be an instance of type { method: string, data: object }'));
                console.log(chalk.red("MEAN Expert: " + options));
            }
            next();
        }
    };
    return PubSub;
}());
exports.PubSub = PubSub;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/modules/PubSub.js.map