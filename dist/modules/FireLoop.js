"use strict";
var logger_1 = require('../logger');
var async = require('async');
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
        logger_1.RealTimeLog.log("FireLoop server enabled using " + options.driver.name + " driver.");
        FireLoop.driver = driver;
        FireLoop.options = options;
        FireLoop.setup();
        return FireLoop;
    }
    FireLoop.setup = function () {
        // Setup On Set Methods
        Object.keys(FireLoop.options.app.models).forEach(function (modelName) {
            //console.log(FireLoop.options.app.models[modelName].settings)
            FireLoop.driver.on(modelName + ".upsert", function (input) { return FireLoop.upsert(modelName, input); });
            FireLoop.driver.on(modelName + ".remove", function (input) { return FireLoop.remove(modelName, input); });
            // Setup Relations
            FireLoop.setupRelations(modelName);
        });
        // Setup Pull Request Methods for each connection
        FireLoop.driver.onConnection(function (socket, io) {
            // let handlers: Array<{ name: string, listener: Function }> = new Array();
            Object.keys(FireLoop.options.app.models).forEach(function (modelName) {
                FireLoop.getReference(modelName, null, function (ref) {
                    var handler = {
                        name: modelName + ".value.pull.request",
                        listener: function listener(filter) {
                            var _filter = Object.assign({}, filter);
                            logger_1.RealTimeLog.log("FireLoop broadcast request received: " + JSON.stringify(_filter));
                            ref.find(_filter, function (err, data) {
                                if (err)
                                    logger_1.RealTimeLog.log("FireLoop server error: " + JSON.stringify(err));
                                socket.emit(modelName + ".value.pull.requested", err ? { error: err } : data);
                            });
                        }
                    };
                    // Configure Pull Request for Valued type of Event
                    socket.on(modelName + ".value.pull.request", handler.listener);
                    // handlers.push(handler);
                });
            });
        });
    };
    FireLoop.setupRelations = function (modelName) {
        if (!FireLoop.options.app.models[modelName].sharedClass.ctor.relations)
            return;
        Object.keys(FireLoop.options.app.models[modelName].sharedClass.ctor.relations).forEach(function (scope) {
            var relation = FireLoop.options.app.models[modelName].sharedClass.ctor.relations[scope];
            FireLoop.driver.on(modelName + "." + scope + ".upsert", function (input) { return FireLoop.upsert(modelName + "." + scope, input); });
            FireLoop.driver.on(modelName + "." + scope + ".remove", function (input) { return FireLoop.remove(modelName + "." + scope, input); });
        });
    };
    FireLoop.getReference = function (modelName, input, next) {
        var ref;
        if (modelName.match(/\./g)) {
            if (!input || !input.parent)
                return null;
            var segments_1 = modelName.split('.');
            var parent_1 = FireLoop.options.app.models[segments_1[0]] || null;
            if (!parent_1)
                return null;
            return parent_1.findOne({ where: input.parent }, function (err, instance) {
                ref = instance[segments_1[1]] || null;
                next(ref);
            });
        }
        else {
            ref = FireLoop.options.app.models[modelName] || null;
        }
        next(ref);
    };
    FireLoop.upsert = function (modelName, input) {
        FireLoop.getReference(modelName, input, function (ref) {
            if (!ref) {
                return FireLoop.driver.emit(modelName + ".value.result." + input.id, { error: modelName + " Model reference was not found." });
            }
            var created;
            // Wont use findOrCreate because only works at level 1, does not work on related references
            async.waterfall([
                function (next) { return ref.findOne({ where: input.data }, next); },
                function (inst, next) {
                    if (inst) {
                        created = false;
                        Object.keys(input.data).forEach(function (key) { return inst[key] = input.data[key]; });
                        inst.save(next);
                    }
                    else {
                        created = true;
                        ref.create(input.data, next);
                    }
                }
            ], function (err, data) { return FireLoop.publish({
                err: err,
                ref: ref,
                modelName: modelName,
                input: input,
                data: data,
                created: created
            }); });
        });
    };
    FireLoop.remove = function (modelName, input) {
        FireLoop.getReference(modelName, null, function (ref) {
            if (!ref) {
                return FireLoop.driver.emit(modelName + ".value.result." + input.id, { error: modelName + " Model is not defined." });
            }
            ref.findById(input.data, function (err, data) {
                ref.removeById(data.id, function (err) { return FireLoop.publish({
                    err: err,
                    ref: ref,
                    modelName: modelName,
                    input: input,
                    removed: data
                }); });
            });
        });
    };
    FireLoop.publish = function (options) {
        // Response to the client that sent the request
        FireLoop.driver.emit(options.modelName + ".value.result." + options.input.id, options.err ? { error: options.err } : options.data);
        // Response for subscribers
        FireLoop.driver.forEachConnection(function (socket) {
            options.socket = socket;
            if (options.data) {
                FireLoop.broadcast('value', options);
                if (options.created) {
                    FireLoop.broadcast('child_added', options);
                }
                else {
                    FireLoop.broadcast('child_changed', options);
                }
            }
            else if (options.removed) {
                FireLoop.broadcast('child_removed', options);
            }
        });
    };
    FireLoop.broadcast = function (event, options) {
        function listener(filter) {
            var _filter = Object.assign({}, filter);
            logger_1.RealTimeLog.log("FireLoop " + event + " broadcast request received: " + JSON.stringify(_filter));
            switch (event) {
                case 'value':
                case 'child_added':
                    var broadcast = function (err, data) {
                        if (err)
                            logger_1.RealTimeLog.log("FireLoop server error: " + JSON.stringify(err));
                        if (event === 'value') {
                            options.socket.emit(options.modelName + "." + event + ".broadcast", err ? { error: err } : data);
                        }
                        else {
                            data.forEach(function (d) { return options.socket.emit(options.modelName + "." + event + ".broadcast", err ? { error: err } : d); });
                        }
                    };
                    if (options.ref.find) {
                        options.ref.find(_filter, broadcast);
                    }
                    else {
                        options.ref(_filter, broadcast);
                    }
                    break;
                case 'child_changed':
                case 'child_removed':
                    options.socket.emit(options.modelName + "." + event + ".broadcast", options.data || options.removed);
                    break;
                default:
                    options.socket.emit(options.modelName + "." + event + ".broadcast", { error: new Error("Invalid event " + event) });
            }
            FireLoop.driver.removeListener(options.modelName + "." + event + ".broadcast.request", listener);
        }
        options.socket.once(options.modelName + "." + event + ".broadcast.request", listener);
        options.socket.emit(options.modelName + "." + event + ".broadcast.announce", 1);
    };
    return FireLoop;
}());
exports.FireLoop = FireLoop;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/modules/FireLoop.js.map