"use strict";
var chalk = require('chalk');
/**
 * @module FireLoop
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 *
 * This module is created to implement IO Functionality into the LoopBack Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 **/
var FireLoop = (function () {
    function FireLoop(driver, options) {
        console.log(chalk.yellow("MEAN Expert: FireLoop server enabled using " + options.driver.name + " driver."));
        FireLoop.driver = driver;
        FireLoop.options = options;
        FireLoop.setup();
        return FireLoop;
    }
    FireLoop.setup = function () {
        // Setup On Set Methods
        Object.keys(FireLoop.options.app.models).forEach(function (modelName) {
            //console.log(FireLoop.options.app.models[modelName].settings)
            FireLoop.driver.on(modelName + ".set", function (input) { return FireLoop.set(modelName, input); });
        });
        // Setup Pull Request Methods for each connection
        FireLoop.driver.onConnection(function (socket) {
            Object.keys(FireLoop.options.app.models).forEach(function (modelName) {
                var ref = FireLoop.getReference(modelName);
                socket.on(modelName + ".set.broadcast.pull.request", function (filter) {
                    var _filter = JSON.stringify(Object.assign({}, filter));
                    console.log(chalk.yellow("MEAN Expert: FireLoop broadcast request received: " + _filter));
                    ref.find(_filter, function (err, data) {
                        if (err)
                            console.log(chalk.red("MEAN Expert: FireLoop server error: " + JSON.stringify(err)));
                        socket.emit(modelName + ".set.broadcast.pull.requested", err ? { error: err } : data);
                    });
                });
            });
        });
    };
    FireLoop.getReference = function (modelName) {
        var ref;
        if (modelName.match(/\./g)) {
            var segments = modelName.split('.');
            ref = FireLoop.options.app.models[segments[0]][segments[1]] || null;
        }
        else {
            ref = FireLoop.options.app.models[modelName] || null;
        }
        return ref;
    };
    FireLoop.set = function (modelName, input) {
        var ref = FireLoop.getReference(modelName);
        if (!ref) {
            return FireLoop.driver.emit(modelName + ".set.result." + input.id, { error: modelName + " Model is not defined." });
        }
        ref.upsert(input.data, function (err, data) {
            // for the creator
            FireLoop.driver.emit(modelName + ".set.result." + input.id, err ? { error: err } : data);
            // for subscribers
            FireLoop.driver.forEachConnection(function (socket) {
                socket.once(modelName + ".set.broadcast.request", function (filter) {
                    var _filter = JSON.stringify(Object.assign({}, filter));
                    console.log(chalk.yellow("MEAN Expert: FireLoop broadcast request received: " + _filter));
                    ref.find(_filter, function (err, data) {
                        if (err)
                            console.log(chalk.red("MEAN Expert: FireLoop server error: " + JSON.stringify(err)));
                        socket.emit(modelName + ".set.broadcast", err ? { error: err } : data);
                    });
                });
                socket.emit(modelName + ".set.broadcast.announce", 1);
            });
        });
    };
    return FireLoop;
}());
exports.FireLoop = FireLoop;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/modules/FireLoop.js.map