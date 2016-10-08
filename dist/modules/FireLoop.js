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
    }
    FireLoop.setup = function () {
        // Setup Each Connection
        FireLoop.driver.onConnection(function (socket) {
            // Setup On Set Methods
            Object.keys(FireLoop.options.app.models).forEach(function (modelName) {
                return FireLoop.getReference(modelName, null, function (Model) {
                    var ctx = { modelName: modelName, Model: Model, socket: socket };
                    FireLoop.events.modify.forEach(function (event) {
                        return ctx.socket.on(modelName + "." + event, function (input) { return FireLoop[event](ctx, input); });
                    });
                    // Setup Relations
                    FireLoop.setupScopes(ctx);
                    // Setup Pull Requests
                    FireLoop.setupPullRequests(ctx);
                });
            });
        });
    };
    FireLoop.setupPullRequests = function (ctx) {
        // Configure Pull Request for read type of Events
        FireLoop.events.read.forEach(function (event) { return ctx.socket.on(ctx.modelName + "." + event + ".pull.request", function (filter) {
            var _filter = Object.assign({}, filter);
            logger_1.RealTimeLog.log("FireLoop broadcast request received: " + JSON.stringify(_filter));
            ctx.Model.find(_filter, function (err, data) {
                if (err)
                    logger_1.RealTimeLog.log("FireLoop server error: " + JSON.stringify(err));
                ctx.socket.emit(ctx.modelName + "." + event + ".pull.requested", err ? { error: err } : data);
            });
        }); });
    };
    FireLoop.setupScopes = function (ctx) {
        if (!FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations)
            return;
        Object.keys(FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations).forEach(function (scope) {
            var relation = FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations[scope];
            // Lets copy the context for each Scope, to keep the right references
            var _ctx = Object.assign({}, { modelName: ctx.modelName + "." + scope }, ctx);
            FireLoop.events.modify.forEach(function (event) {
                logger_1.RealTimeLog.log("FireLoop setting relation: " + ctx.modelName + "." + scope + "." + event);
                _ctx.modelName = ctx.modelName + "." + scope;
                ctx.socket.on(_ctx.modelName + "." + event, function (input) {
                    logger_1.RealTimeLog.log("FireLoop relation operation: " + _ctx.modelName + "." + event + ": " + JSON.stringify(input));
                    FireLoop[event](_ctx, input);
                });
            });
        });
    };
    FireLoop.getReference = function (modelName, input, next) {
        var ref;
        if (modelName.match(/\./g)) {
            if (!input || !input.parent)
                return next(null);
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
    // This method is called from Models and from Scoped Models,
    // If the create is for Model, we use context model reference.
    // Else we need to get a custom reference, since its a child
    FireLoop.create = function (ctx, input) {
        logger_1.RealTimeLog.log("FireLoop starting create: " + ctx.modelName + ": " + JSON.stringify(input));
        async.waterfall([
            function (next) {
                if (ctx.modelName.match(/\./g)) {
                    FireLoop.getReference(ctx.modelName, input, function (ref) {
                        if (!ref) {
                            next({ error: ctx.modelName + " Model reference was not found." });
                        }
                        else {
                            next(null, ref);
                        }
                    });
                }
                else {
                    next(null, ctx.Model);
                }
            },
            function (ref, next) { return ref.create(input.data, next); }
        ], function (err, data) { return FireLoop.publish(Object.assign({ err: err, input: input, data: data, created: true }, ctx)); });
    };
    // This method is called from Models and from Scoped Models,
    // If the create is for Model, we use context model reference.
    // Else we need to get a custom reference, since its a child
    FireLoop.upsert = function (ctx, input) {
        var created;
        logger_1.RealTimeLog.log("FireLoop starting upsert: " + ctx.modelName + ": " + JSON.stringify(input));
        // Wont use findOrCreate because only works at level 1, does not work on related references
        async.waterfall([
            function (next) {
                if (ctx.modelName.match(/\./g)) {
                    FireLoop.getReference(ctx.modelName, input, function (ref) {
                        if (!ref) {
                            next({ error: ctx.modelName + " Model reference was not found." });
                        }
                        else {
                            next(null, ref);
                        }
                    });
                }
                else {
                    next(null, ctx.Model);
                }
            },
            function (ref, next) { return ref.findOne({ where: input.data }, function (err, inst) { return next(err, ref, inst); }); },
            function (ref, inst, next) {
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
        ], function (err, data) { return FireLoop.publish(Object.assign({ err: err, input: input, data: data, created: created }, ctx)); });
    };
    // This method is called from Models and from Scoped Models,
    // If the create is for Model, we use context model reference.
    // Else we need to get a custom reference, since its a child
    FireLoop.remove = function (ctx, input) {
        logger_1.RealTimeLog.log("FireLoop starting remove: " + ctx.modelName + ": " + JSON.stringify(input));
        async.waterfall([
            function (next) {
                if (ctx.modelName.match(/\./g)) {
                    FireLoop.getReference(ctx.modelName, input, function (ref) {
                        if (!ref) {
                            next({ error: ctx.modelName + " Model reference was not found." });
                        }
                        else {
                            next(null, ref);
                        }
                    });
                }
                else {
                    next(null, ctx.Model);
                }
            },
            function (ref, next) { return ref.destroy
                ? ref.destroy(input.data.id, next)
                : ref.removeById(input.data.id, next); }
        ], function (err) { return FireLoop.publish(Object.assign({ err: err, input: input, removed: input.data }, ctx)); });
    };
    // Context will be destroyed everytime, make sure the ctx passed is a
    // custom copy for current request or else bad things will happen :P.
    // WARNING: Do not pass the root context.
    FireLoop.publish = function (ctx) {
        // Response to the client that sent the request
        ctx.socket.emit(ctx.modelName + ".value.result." + ctx.input.id, ctx.err ? { error: ctx.err } : ctx.data || ctx.removed);
        if (ctx.data) {
            FireLoop.broadcast('value', ctx);
            if (ctx.created) {
                FireLoop.broadcast('child_added', ctx);
            }
            else {
                FireLoop.broadcast('child_changed', ctx);
            }
        }
        else if (ctx.removed) {
            FireLoop.broadcast('child_removed', ctx);
        }
        // In any of the operations we call the changes event
        FireLoop.broadcast('changes', ctx);
        // Avoiding Memory Leaks
        // setTimeout(() => ctx = null, 5000); TODO: NOT SURE WHEN TO DESTROY THE TEMPORAL OBJECT IT JUST YET
    };
    FireLoop.broadcast = function (event, ctx) {
        function listener(filter) {
            var _filter = Object.assign({}, filter);
            logger_1.RealTimeLog.log("FireLoop " + event + " broadcast request received: " + JSON.stringify(_filter));
            switch (event) {
                case 'value':
                case 'changes':
                case 'child_added':
                    var broadcast_1 = function (err, data) {
                        if (err)
                            logger_1.RealTimeLog.log("FireLoop server error: " + JSON.stringify(err));
                        if (event === 'value' || event === 'changes') {
                            logger_1.RealTimeLog.log("FireLoop " + event + " broadcasting: " + JSON.stringify(data));
                            ctx.socket.emit(ctx.modelName + "." + event + ".broadcast", err ? { error: err } : data);
                        }
                        else {
                            data.forEach(function (d) { return ctx.socket.emit(ctx.modelName + "." + event + ".broadcast", err ? { error: err } : d); });
                        }
                    };
                    if (ctx.modelName.match(/\./g)) {
                        FireLoop.getReference(ctx.modelName, ctx.input, function (ref) {
                            if (!ref) {
                                ctx.socket.emit(ctx.modelName + "." + event + ".broadcast", { error: 'Scope not found' });
                            }
                            else {
                                ref(_filter, broadcast_1);
                            }
                        });
                    }
                    else {
                        ctx.Model.find(_filter, broadcast_1);
                    }
                    break;
                case 'child_changed':
                case 'child_removed':
                    ctx.socket.emit(ctx.modelName + "." + event + ".broadcast", ctx.data || ctx.removed);
                    break;
                default:
                    ctx.socket.emit(ctx.modelName + "." + event + ".broadcast", { error: new Error("Invalid event " + event) });
            }
            FireLoop.driver.removeListener(ctx.modelName + "." + event + ".broadcast.request", listener);
        }
        ctx.socket.once(ctx.modelName + "." + event + ".broadcast.request", listener);
        ctx.socket.emit(ctx.modelName + "." + event + ".broadcast.announce", 1);
    };
    FireLoop.events = {
        read: ['value', 'changes'],
        modify: ['create', 'upsert', 'remove'],
    };
    return FireLoop;
}());
exports.FireLoop = FireLoop;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/modules/FireLoop.js.map