"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var logger_1 = require("../logger");
var async = require("async");
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
    /**
    * @method constructor
    * @param driver: DriverInterface
    * @param options: OptionsInterface
    * @description
    * Initializes FireLoop module by storing a static reference for the driver and
    * options that will be used. Then it will call the setup method.
    **/
    function FireLoop(driver, options) {
        logger_1.RealTimeLog.log("FireLoop server enabled using " + options.driver.name + " driver.");
        FireLoop.driver = driver;
        FireLoop.options = options;
        FireLoop.setup();
    }
    /**
    * @method setup
    * @description
    * Listen for new connections in order to configure each new client connected
    * by iterating the LoopBack models and configuring the necessary events
    **/
    FireLoop.setup = function () {
        // Setup Hook Handlers
        FireLoop.setupHooks();
        // Setup Server Side Broadcasts
        Object.keys(FireLoop.options.app.models).forEach(function (modelName) {
            // TODO: verify why this is not working -> FireLoop.options.app.models[modelName].mixin('FireLoop');
            // Answer: There is a bug from LoopBack, it requires the mixin to be configured through json at least
            // for 1 time, if the mixing is lodaded 1 time, then the mixin() would work, but is not the best solution.
            // For now dev-users need to define the FireLoop mixin within the model.json file, for those models 
            // The Real-Time functionality is needed.
            FireLoop.events.readings.forEach(function (event) {
                FireLoop.setupServerBroadcast({ modelName: modelName }, event);
                if (!FireLoop.options.app.models[modelName].sharedClass.ctor.relations)
                    return;
                Object.keys(FireLoop.options.app.models[modelName].sharedClass.ctor.relations).forEach(function (scope) {
                    FireLoop.setupServerBroadcast({ modelName: modelName + "." + scope }, event);
                });
            });
        });
        // Setup Client Side Connection
        FireLoop.driver.onConnection(function (socket) {
            socket.connContextId = FireLoop.buildId();
            FireLoop.contexts[socket.connContextId] = {};
            // Setup On Set Methods
            Object.keys(FireLoop.options.app.models).forEach(function (modelName) {
                return FireLoop.getReference(modelName, null, function (Model) {
                    // Setup reference subscriptions
                    socket.on("Subscribe." + modelName, function (subscription) {
                        FireLoop.contexts[socket.connContextId][subscription.id] = {
                            id: subscription.id, modelName: modelName, Model: Model, socket: socket, subscription: subscription
                        };
                        // Register remote method events
                        FireLoop.setupRemoteMethods(FireLoop.contexts[socket.connContextId][subscription.id]);
                        // Iterate for writting events
                        FireLoop.events.writings.forEach(function (event) {
                            FireLoop.setupModelWritings(FireLoop.contexts[socket.connContextId][subscription.id], event);
                            FireLoop.setupScopeWritings(FireLoop.contexts[socket.connContextId][subscription.id], event);
                        });
                        // Iterate for reading events
                        FireLoop.events.readings.forEach(function (event) {
                            FireLoop.setupModelReadings(FireLoop.contexts[socket.connContextId][subscription.id], event);
                            FireLoop.setupScopeReadings(FireLoop.contexts[socket.connContextId][subscription.id], event);
                        });
                        // Register dispose method to removeAllListeners
                        FireLoop.setupDisposeReference(FireLoop.contexts[socket.connContextId][subscription.id]);
                    });
                });
            });
            // Clean client contexts from the server memory when client disconnects :D
            socket.on('disconnect', function () {
                logger_1.RealTimeLog.log("FireLoop is releasing context tree with id " + socket.connContextId + " from memory");
                delete FireLoop.contexts[socket.connContextId];
            });
        });
    };
    /**
    * @method setupDisposeReference
    * @description
    * will remove all the listeners for this reference subscription
     */
    FireLoop.setupDisposeReference = function (ctx) {
        ctx.socket.on(ctx.modelName + ".dispose." + ctx.subscription.id, function (input) {
            // Notify we are releasing memory
            logger_1.RealTimeLog.log("FireLoop is releasing model subscription tree with id " + ctx.subscription.id + " from memory");
            // Dispose Remote Methods
            ctx.socket.removeAllListeners(ctx.modelName + ".remote." + ctx.subscription.id);
            // Dispose Model Writings
            FireLoop.disposeModelWritings(ctx);
            // Dispose Scope Writings
            FireLoop.disposeScopeWritings(ctx);
            // Dispose Model Readings
            FireLoop.disposeModelReadings(ctx);
            // Dispose Scope Readings
            FireLoop.disposeScopeReadings(ctx);
        });
    };
    /**
    * @method getUserConnection
    * @description
    * will return a user connection from the given user Id
     */
    FireLoop.getUserConnection = function (userId) {
        FireLoop.driver.getUserConnection(userId);
    };
    /**
    * @method setupHooks
    * @description
    * setup opeation hooks
    **/
    FireLoop.setupHooks = function () {
        FireLoop.driver.internal.on('create-hook', function (event) {
            FireLoop.publish({ modelName: event.modelName, err: null, input: null, data: event.data, created: event.created });
        });
        FireLoop.driver.internal.on('delete-hook', function (event) {
            FireLoop.publish({ modelName: event.modelName, err: null, input: null, removed: event.data });
        });
    };
    /**
    * @method setupRemoteMethods
    * @description
    * setup writting events for root models
     */
    FireLoop.setupRemoteMethods = function (ctx) {
        ctx.socket.on(ctx.modelName + ".remote." + ctx.subscription.id, function (input) { return FireLoop.remote(ctx, input); });
    };
    /**
    * @method setupModelWritings
    * @description
    * setup writting events for root models
     */
    FireLoop.setupModelWritings = function (ctx, event) {
        ctx.socket.on(ctx.modelName + "." + event + "." + ctx.subscription.id, function (input) { return FireLoop[event](ctx, input); });
    };
    /**
    * @method disposeModelWritings
    * @description
    * setup writting events for root models
     */
    FireLoop.disposeModelWritings = function (ctx) {
        FireLoop.events.writings.forEach(function (event) {
            ctx.socket.removeAllListeners(ctx.modelName + "." + event + "." + ctx.subscription.id);
        });
    };
    /**
    * @method setupModelReading
    * @description
    * Listen for connections that requests to pull data without waiting until the next
    * public broadcast announce.
    **/
    FireLoop.setupModelReadings = function (ctx, event) {
        // Pull Request Listener
        ctx.socket.on(ctx.modelName + "." + event + ".pull.request." + ctx.subscription.id, function (request) {
            var _request = Object.assign({}, request);
            logger_1.RealTimeLog.log("FireLoop model pull request received: " + JSON.stringify(_request.filter));
            var emit = function (err, data) {
                if (err)
                    logger_1.RealTimeLog.log("FireLoop server error: " + JSON.stringify(err));
                ctx.socket.emit(ctx.modelName + "." + event + ".pull.requested." + ctx.subscription.id, err ? { error: err } : data);
            };
            // This works only for Root Models, related models are configured in setupScopes method
            // Define the name of the method
            var remoteEvent;
            if (event.match('stats')) {
                remoteEvent = 'stats';
            }
            else {
                remoteEvent = 'find';
            }
            // Check for Access
            FireLoop.checkAccess(ctx, ctx.Model, remoteEvent, ctx.input, function (err, hasAccess) {
                if (err) {
                    emit(err);
                }
                else if (!hasAccess) {
                    emit(FireLoop.UNAUTHORIZED);
                }
                else {
                    switch (remoteEvent) {
                        case 'find':
                            ctx.Model.find(_request.filter, { accessToken: ctx.socket.token }, emit);
                            break;
                        case 'stats':
                            ctx.Model.stats(_request.filter.range || 'monthly', _request.filter.custom, _request.filter.where || {}, _request.filter.groupBy, emit);
                            break;
                    }
                }
            });
        });
        FireLoop.setupClientBroadcast(ctx, event);
    };
    /**
    * @method disposeModelReadings
    * @description
    * setup writting events for root models
    **/
    FireLoop.disposeModelReadings = function (ctx) {
        FireLoop.events.readings.forEach(function (event) {
            ctx.socket.removeAllListeners(ctx.modelName + "." + event + ".pull.request." + ctx.subscription.id);
        });
    };
    /**
    * @method setupScopeWritings
    * @description
    * setup writting events for root models
     */
    FireLoop.setupScopeWritings = function (ctx, event) {
        if (!FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations)
            return;
        Object.keys(FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations).forEach(function (scope) {
            var relation = FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations[scope];
            // Lets copy the context for each Scope, to keep the right references
            var _ctx = Object.assign({}, { modelName: ctx.modelName + "." + scope }, ctx);
            _ctx.modelName = ctx.modelName + "." + scope;
            // Setup writting events for scope/related models
            logger_1.RealTimeLog.log("FireLoop setting write relation: " + ctx.modelName + "." + scope + "." + event + "." + ctx.subscription.id);
            ctx.socket.on(_ctx.modelName + "." + event + "." + ctx.subscription.id, function (input) {
                _ctx.input = input;
                logger_1.RealTimeLog.log("FireLoop relation operation: " + _ctx.modelName + "." + event + "." + ctx.subscription.id + ": " + JSON.stringify(input));
                FireLoop[event](_ctx, input);
            });
        });
    };
    /**
    * @method disposeScopeWritings
    * @description
    * setup writting events for root models
     */
    FireLoop.disposeScopeWritings = function (ctx) {
        if (!FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations)
            return;
        FireLoop.events.writings.forEach(function (event) {
            Object.keys(FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations).forEach(function (scope) {
                ctx.socket.removeAllListeners(ctx.modelName + "." + scope + "." + event + "." + ctx.subscription.id);
            });
        });
    };
    /**
    * @method setupScopeReading
    * @description
    * Listen for connections that requests to pull data without waiting until the next
    * public broadcast announce.
    **/
    FireLoop.setupScopeReadings = function (ctx, event) {
        if (!FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations)
            return;
        Object.keys(FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations).forEach(function (scope) {
            var relation = FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations[scope];
            // Lets copy the context for each Scope, to keep the right references
            // TODO: Make sure _ctx is deleted when client is out, not seeing where it is removed (JC)
            var _ctx = Object.assign({}, { modelName: ctx.modelName + "." + scope }, ctx);
            _ctx.modelName = ctx.modelName + "." + scope;
            logger_1.RealTimeLog.log("FireLoop setting read relation: " + _ctx.modelName + "." + event + ".pull.request." + ctx.subscription.id);
            ctx.socket.on(_ctx.modelName + "." + event + ".pull.request." + ctx.subscription.id, function (request) {
                _ctx.input = request; // Needs to be inside because we need scope params from request
                FireLoop.setupClientBroadcast(_ctx, event);
                var _filter = Object.assign({}, request.filter);
                logger_1.RealTimeLog.log("FireLoop scope pull request received: " + JSON.stringify(_filter));
                var emit = function (err, data) {
                    if (err)
                        logger_1.RealTimeLog.log("FireLoop server error: " + JSON.stringify(err));
                    ctx.socket.emit(_ctx.modelName + "." + event + ".pull.requested." + ctx.subscription.id, err ? { error: err } : data);
                };
                // TODO: Verify if this works with child references?
                switch (event) {
                    case 'value':
                    case 'change':
                        FireLoop.getReference(_ctx.modelName, request, function (ref) { return ref(_filter, emit); });
                        break;
                    case 'stats':
                        logger_1.RealTimeLog.log('Stats are currently only for root models');
                        // ctx.Model.stats(_filter.range ||  'monthly', _filter.custom, _filter.where ||  {}, _filter.groupBy, emit);
                        break;
                }
            });
        });
    };
    /**
    * @method disposeScopeReadings
    * @description
    * setup writting events for root models
     */
    FireLoop.disposeScopeReadings = function (ctx) {
        if (!FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations)
            return;
        FireLoop.events.readings.forEach(function (event) {
            Object.keys(FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations).forEach(function (scope) {
                ctx.socket.removeAllListeners(ctx.modelName + "." + scope + "." + event + ".pull.request." + ctx.subscription.id);
            });
        });
    };
    /**
    /**
    * @method getReference
    * @description
    * Returns a model reference, this can be either a Regular Model or a Scoped Model.
    * For regular models we just return the model as it is, but for scope models (childs)
    * we return a child model reference by correctly finding it.
    **/
    FireLoop.getReference = function (modelName, input, next) {
        var ref;
        if (modelName.match(/\./g)) {
            if (!input || !input.parent)
                return next(null);
            var segments_1 = modelName.split('.');
            var parent_1 = FireLoop.options.app.models[segments_1[0]] || null;
            if (!parent_1)
                return null;
            var idName = parent_1.getIdName();
            var filter = { where: {} };
            filter.where[idName] = input.parent[idName];
            return parent_1.findOne(filter, function (err, instance) {
                ref = instance[segments_1[1]] || null;
                next(ref);
            });
        }
        else {
            ref = FireLoop.options.app.models[modelName] || null;
        }
        next(ref);
    };
    /**
    * @method remote
    * @description
    * Enables an interface for calling remote methods from FireLoop clients.
    **/
    FireLoop.remote = function (ctx, input) {
        logger_1.RealTimeLog.log("FireLoop starting remote: " + ctx.modelName + ": " + JSON.stringify(input));
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
            function (ref, next) { return FireLoop.checkAccess(ctx, ref, input.data.method, input, next); },
            function (ref, next) {
                var method = ref[input.data.method];
                if (!method) {
                    return next("ERROR: Remote method " + input.data.method + " was not found");
                }
                if (Array.isArray(input.data.params) && input.data.params.length > 0) {
                    input.data.params.push(next);
                    method.apply(method, input.data.params);
                }
                else {
                    method(next);
                }
            }
        ], function (err, data) { return FireLoop.publish(Object.assign({ err: err, input: input, data: data, created: true }, ctx)); });
    };
    /**
    * @method create
    * @description
    * Creates a new instance for either a model or scope model.
    *
    * This method is called from Models and from Scoped Models,
    * If the create is for Model, we use context model reference.
    * Else we need to get a custom reference, since its a child
    **/
    FireLoop.create = function (ctx, input) {
        logger_1.RealTimeLog.log("FireLoop starting create: " + ctx.modelName + ": " + JSON.stringify(input));
        var isScoped = ctx.modelName.match(/\./g);
        async.waterfall([
            function (next) {
                if (isScoped) {
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
            function (ref, next) { return FireLoop.checkAccess(ctx, ref, 'create', input, next); },
            function (ref, next) { return ref.create(input.data, { accessToken: ctx.socket.token }, next); }
        ], function (err, data) {
            var resultContext = Object.assign({ err: err, input: input, data: data, created: true }, ctx);
            FireLoop.response(resultContext);
            if (isScoped) {
                FireLoop.publish(resultContext);
            }
        });
    };
    /**
    * @method upsert
    * @description
    * Creates a new instance from either a model or scope model.
    *
    * This method is called from Models and from Scoped Models,
    * If the create is for Model, we use context model reference.
    * Else we need to get a custom reference, since its a child
    **/
    FireLoop.upsert = function (ctx, input) {
        var created;
        logger_1.RealTimeLog.log("FireLoop starting upsert: " + ctx.modelName + ": " + JSON.stringify(input));
        var isScoped = ctx.modelName.match(/\./g);
        // Wont use findOrCreate because only works at level 1, does not work on related references
        async.waterfall([
            function (next) {
                if (isScoped) {
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
            function (ref, next) { return FireLoop.checkAccess(ctx, ref, 'create', input, next); },
            function (ref, next) {
                if (input.data.id) {
                    ref.findById(input.data.id, function (err, inst) { return next(err, ref, inst); });
                }
                else {
                    next(null, ref, null);
                }
            },
            function (ref, inst, next) {
                if (inst) {
                    created = false;
                    Object.keys(input.data).forEach(function (key) { return inst[key] = input.data[key]; });
                    inst.save({ accessToken: ctx.socket.token }, next);
                }
                else {
                    created = true;
                    ref.create(input.data, { accessToken: ctx.socket.token }, next);
                }
            }
        ], function (err, data) {
            var resultContext = Object.assign({ err: err, input: input, data: data, created: true }, ctx);
            FireLoop.response(resultContext);
            if (isScoped) {
                FireLoop.publish(resultContext);
            }
        });
    };
    /**
    * @method remove
    * @description
    * Removes instances from either a model or scope model.
    *
    * This method is called from Models and from Scoped Models,
    * If the create is for Model, we use context model reference.
    * Else we need to get a custom reference, since its a child
    **/
    FireLoop.remove = function (ctx, input) {
        logger_1.RealTimeLog.log("FireLoop starting remove: " + ctx.modelName + ": " + JSON.stringify(input));
        var isScoped = ctx.modelName.match(/\./g);
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
            function (ref, next) { return FireLoop.checkAccess(ctx, ref, ref.destroy ? 'destroy' : 'removeById', input, next); },
            function (ref, next) { return ref.destroy
                ? ref.destroy(input.data.id, { accessToken: ctx.socket.token }, next)
                : ref.removeById(input.data.id, { accessToken: ctx.socket.token }, next); }
        ], function (err) {
            var resultContext = Object.assign({ err: err, input: input, removed: input.data }, ctx);
            FireLoop.response(resultContext);
            if (isScoped) {
                FireLoop.publish(resultContext);
            }
        });
    };
    /**
    * @method response
    * @description
    * Response to client who started this process
    **/
    FireLoop.response = function (ctx) {
        // Response to the client that sent the request
        if (ctx.subscription && ctx.subscription.id) {
            ctx.socket.emit(ctx.modelName + ".value.result." + ctx.subscription.id, ctx.err ? { error: ctx.err } : ctx.data || ctx.removed);
        }
    };
    /**
    * @method publish
    * @description
    * Publish gateway that will broadcast according the specific case.
    *
    * Context will be destroyed everytime, make sure the ctx passed is a
    * custom copy for current request or else bad things will happen :P.
    * WARNING: Do not pass the root context.
    *
    * Optional ctx properties:
    * ctx.subscription.id
    * ctx.input
    * Required ctx properties
    * ctx.modelName
    * ctx.data or ctx.removed
    **/
    FireLoop.publish = function (ctx) {
        // We don't broadcast to others if there is an error
        if (ctx.err) {
            return;
        }
        // We only broadcast remote methods if the request is public since are unknown events
        if (ctx.input && ctx.input.data && ctx.input.data.method) {
            if (ctx.input && ctx.input.data && ctx.input.data.method && ctx.input.data.broadcast) {
                FireLoop.broadcast(ctx, 'remote');
            }
            return;
        }
        // FireLoop events will be public by default since are known events
        if (ctx.data) {
            FireLoop.broadcast(ctx, 'value');
            if (ctx.created) {
                FireLoop.broadcast(ctx, 'child_added');
            }
            else {
                FireLoop.broadcast(ctx, 'child_changed');
            }
        }
        else if (ctx.removed) {
            FireLoop.broadcast(ctx, 'child_removed');
        }
        // In any write operations we call the following events
        // except by custom remote methods.
        FireLoop.broadcast(ctx, 'change');
        FireLoop.broadcast(ctx, 'stats');
    };
    /**
    * @method broadcast
    * @description
    * Notifies other server instances to start a broadcasting process, this
    * allows each server to notify their own clients upon their specific requests,
    * then it will clean the context from the user that started the process.
    *
    * Context will be destroyed everytime, make sure the ctx passed is a
    * custom copy for current request or else bad things will happen :P.
    * WARNING: Do not pass the root context.
    *
    * There are 2 different type context used in this method
    * 1.- ctx = user executing an operation (Publisher)
    * 2.- context = users subscribed to specific operations (Subscribers)
    **/
    FireLoop.broadcast = function (ctx, event) {
        logger_1.RealTimeLog.log("FireLoop " + event + " broadcasting");
        FireLoop.driver.server.to('flint').emit(ctx.modelName + "." + event + ".broadcast", ctx.data || ctx.removed);
        ctx = null;
    };
    /**
    * @method setupServerBroadcast
    * @description
    * Setup the broadcast process to notify other server instances that an event needs
    * to be propagated between their own clients.
    **/
    FireLoop.setupServerBroadcast = function (ctx, event) {
        FireLoop.driver.internal.on(ctx.modelName + "." + event + ".broadcast", function (payload) {
            Object.keys(FireLoop.contexts).forEach(function (connContextId) {
                Object.keys(FireLoop.contexts[connContextId]).forEach(function (contextId) {
                    var context = FireLoop.contexts[connContextId][contextId];
                    var scopeModelName = context.modelName.match(/\./g) ? context.modelName.split('.').shift() : context.modelName;
                    if (context.modelName === ctx.modelName || ctx.modelName.match(new RegExp("\\b" + scopeModelName + "." + context.subscription.relationship + "\\b", 'g'))) {
                        if (event.match(/(child_changed|child_removed|remote)/)) {
                            context.socket.emit(ctx.modelName + "." + event + ".broadcast." + context.subscription.id, payload);
                        }
                        if (event !== 'remote') {
                            context.socket.emit(ctx.modelName + "." + event + ".broadcast.announce." + context.subscription.id, 1);
                        }
                    }
                });
            });
        });
    };
    /**
    * @method setupClientBroadcast
    * @description
    * Setup the actual broadcast process, once it is announced by the broadcast method.
    *
    * Anyway, this setup needs to be done once and prior any broadcast, so it is
    * configured when the connection is made, before any broadcast announce.
    **/
    FireLoop.setupClientBroadcast = function (ctx, event) {
        if (!event.match(/(value|change|stats|child_added)/)) {
            return;
        }
        logger_1.RealTimeLog.log("FireLoop setting up: " + ctx.modelName + "." + event + ".broadcast.request." + ctx.subscription.id);
        ctx.socket.on(ctx.modelName + "." + event + ".broadcast.request." + ctx.subscription.id, function (request) {
            var _request = Object.assign({}, request);
            logger_1.RealTimeLog.log("FireLoop " + event + " broadcast request received: " + JSON.stringify(_request.filter));
            // Standard Broadcast Function (Will be used in any of the cases).
            var broadcast = function (err, data) {
                if (err)
                    logger_1.RealTimeLog.log("FireLoop server error: " + JSON.stringify(err));
                if (event.match(/(value|change|stats)/)) {
                    logger_1.RealTimeLog.log("FireLoop " + event + " broadcasting: " + JSON.stringify(data));
                    ctx.socket.emit(ctx.modelName + "." + event + ".broadcast." + ctx.subscription.id, err ? { error: err } : data);
                }
                else {
                    data.forEach(function (d) { return ctx.socket.emit(ctx.modelName + "." + event + ".broadcast." + ctx.subscription.id, err ? { error: err } : d); });
                }
            };
            // Define the name of the method
            var remoteEvent;
            if (event.match('stats')) {
                remoteEvent = 'stats';
            }
            else {
                remoteEvent = 'find';
            }
            // Progress of fetching and broadcasting the data
            async.waterfall([
                // Get Reference
                function (next) {
                    if (ctx.modelName.match(/\./g)) {
                        FireLoop.getReference(ctx.modelName, ctx.input, function (ref) { return next(null, ref); });
                    }
                    else {
                        next(null, ctx.Model);
                    }
                },
                // Check for Access
                function (ref, next) { return FireLoop.checkAccess(ctx, ref, remoteEvent, ctx.input, function (err, hasAccess) { return next(err, hasAccess, ref); }); },
                // Make the right call if accessed
                function (hasAccess, ref, next) {
                    if (!hasAccess) {
                        broadcast(FireLoop.UNAUTHORIZED);
                        next();
                    }
                    else {
                        switch (remoteEvent) {
                            case 'find':
                                if (ctx.modelName.match(/\./g)) {
                                    ref(_request.filter, broadcast);
                                }
                                else {
                                    ref.find(_request.filter, { accessToken: ctx.socket.token }, broadcast);
                                }
                                break;
                            case 'stats':
                                ref.stats(_request.filter.range || 'monthly', _request.filter.custom, _request.filter.where || {}, _request.filter.groupBy, broadcast);
                                break;
                        }
                    }
                }
            ]);
        });
    };
    /**
    * @method checkAccess
    * @param ctx (current client context)
    * @param ref (model reference)
    * @param event (event to be executed)
    * @param input (input request from client)
    * @param next callback function
    * @description
    * This will verify if the current client has access to specific remotes.
    **/
    FireLoop.checkAccess = function (ctx, ref, event, input, next) {
        if (ref.checkAccess) {
            ref.checkAccess(ctx.socket.token, input && input.parent ? input.parent.id : null, {
                name: event, aliases: []
            }, {}, function (err, access) {
                if (access) {
                    next(null, ref);
                }
                else {
                    next(FireLoop.UNAUTHORIZED, ref);
                }
            });
        }
        else if (ctx.subscription && FireLoop.options.app.models[ctx.subscription.scope].checkAccess) {
            var relationName = ctx.modelName.split('.').pop();
            var methodName = '';
            switch (event) {
                case 'create':
                case 'upsert':
                    methodName = "__create__" + relationName;
                    break;
                case 'remove':
                    methodName = "__delete__" + relationName;
                    break;
                default:
                    methodName = "__get__" + relationName;
            }
            ctx.Model.checkAccess(ctx.socket.token, input && input.parent ? input.parent.id : null, {
                name: methodName, aliases: []
            }, {}, function (err, access) {
                if (access) {
                    next(null, ref);
                }
                else {
                    next(FireLoop.UNAUTHORIZED, ref);
                }
            });
        }
        else {
            logger_1.RealTimeLog.log("Reference not found for: " + ctx.subscription.scope);
            next(FireLoop.UNAUTHORIZED, ref);
        }
    };
    /**
    * @method buildId
    * @description
    * This will create unique numeric ids for each conenction context.
    **/
    FireLoop.buildId = function () {
        var id = Date.now() + Math.floor(Math.random() * 100800) *
            Math.floor(Math.random() * 100700) *
            Math.floor(Math.random() * 198500);
        if (FireLoop.contexts[id]) {
            return FireLoop.buildId();
        }
        else {
            return id;
        }
    };
    return FireLoop;
}());
/**
 * @property UNAUTHORIZED: string
 * Constant for UNAUTHORIZED Events
 **/
FireLoop.UNAUTHORIZED = '401 Unauthorized Event';
/**
 * @property events: OptionsInterface
 * The options object that are injected from the main module
 **/
FireLoop.events = {
    readings: ['value', 'change', 'child_added', 'child_updated', 'child_removed', 'stats'],
    writings: ['create', 'upsert', 'remove'],
};
/**
 * @property context {[ id: number ]: {[ id: number ]: Object }}
 * Context container, it will temporally store contexts. These
 * are automatically deleted when client disconnects.
 **/
FireLoop.contexts = {};
exports.FireLoop = FireLoop;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/modules/FireLoop.js.map