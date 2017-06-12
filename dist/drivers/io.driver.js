"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var logger_1 = require("../logger");
var server = require("socket.io");
var client = require("socket.io-client");
var _ = require("underscore");
var IODriver = (function () {
    function IODriver() {
        this.connections = new Array();
    }
    /**
     * @method connect
     * @param {OptionsInterface} options
     * @description Will create a web socket server and then setup either clustering
     * and authentication functionalities.
     **/
    IODriver.prototype.connect = function (options) {
        var _this = this;
        this.options = options;
        this.server = server(options.server, { transports: options.driver.options.transports });
        this.onConnection(function (socket) { return _this.newConnection(socket); });
        this.setupClustering();
        this.setupAuthResolver();
        this.setupAuthentication();
        this.setupClient();
        this.setupInternal();
        this.options.app.emit('fire-connection-started');
    };
    IODriver.prototype.setupAuthResolver = function () {
        var _this = this;
        if (this.options.auth) {
            logger_1.RealTimeLog.log('RTC requesting custom resolvers');
            this.options.app.on('fire-auth-resolver', function (authResolver) {
                if (!authResolver || !authResolver.name || !authResolver.handler) {
                    throw new Error('FireLoop: Custom auth resolver does not provide either name or handler');
                }
                _this.server.on('connection', function (socket) {
                    socket.on(authResolver.name, function (payload) {
                        return authResolver.handler(socket, payload, function (token) {
                            if (token) {
                                _this.restoreNameSpaces(socket);
                                socket.token = token;
                                socket.emit('authenticated');
                            }
                        });
                    });
                });
            });
        }
    };
    /**
     * @method setupClustering
     * @description Will setup socket.io adapters. This module is adapter agnostic, it means
     * it can use any valid socket.io-adapter, can either be redis or mongo. It will be setup
     * according the provided options. 8990021
     **/
    IODriver.prototype.setupClustering = function () {
        if (this.options.driver.options.adapter &&
            this.options.driver.options.adapter.name &&
            this.options.driver.options.adapter.datasource &&
            this.options.app.datasources[this.options.driver.options.adapter.datasource] &&
            this.options.app.datasources[this.options.driver.options.adapter.datasource].settings) {
            var adapter = require(this.options.driver.options.adapter.name);
            var ds = this.options.app.datasources[this.options.driver.options.adapter.datasource];
            if (ds.settings.url) {
                logger_1.RealTimeLog.log('Running in clustering environment');
                this.server.adapter(adapter(ds.settings.url));
            }
            else if (ds.settings.host && ds.settings.port && ds.settings.db) {
                var adapterOptions = {
                    host: ds.settings.host,
                    port: ds.settings.port,
                    db: ds.settings.db
                };
                if (ds.settings.user)
                    adapterOptions.user = ds.settings.user;
                if (ds.settings.password)
                    adapterOptions.password = ds.settings.password;
                logger_1.RealTimeLog.log('Running in clustering environment');
                this.server.adapter(adapter(adapterOptions));
            }
            else {
                throw new Error('loopback-realtime-component: Unexpected datasource options for clustering mode.');
            }
        }
        else {
            logger_1.RealTimeLog.log('Running in a not clustered environment');
        }
    };
    /**
     * @method setupAuthentication
     * @description Will setup an authentication mechanism, for this we are using socketio-auth
     * connected with LoopBack Access Token.
     **/
    IODriver.prototype.setupAuthentication = function () {
        var _this = this;
        if (this.options.auth) {
            logger_1.RealTimeLog.log('RTC authentication mechanism enabled');
            // Remove Unauthenticated sockets from namespaces
            _.each(this.server.nsps, function (nsp) {
                nsp.on('connect', function (socket) {
                    if (!socket.token) {
                        delete nsp.connected[socket.id];
                    }
                });
            });
            this.server.on('connection', function (socket) {
                /**
                 * Register Built in Auth Resolver
                 */
                socket.on('authentication', function (token) {
                    if (!token) {
                        return;
                    }
                    if (token.is === '-*!#fl1nter#!*-') {
                        logger_1.RealTimeLog.log('Internal connection has been established');
                        _this.restoreNameSpaces(socket);
                        socket.token = token;
                        return socket.emit('authenticated');
                    }
                    var AccessToken = _this.options.app.models.AccessToken;
                    //verify credentials sent by the client
                    var token = AccessToken.findOne({
                        where: { id: token.id || 0 }
                    }, function (err, tokenInstance) {
                        if (tokenInstance) {
                            _this.restoreNameSpaces(socket);
                            socket.token = tokenInstance;
                            socket.emit('authenticated');
                        }
                    });
                });
                /**
                 * Wait 1 second for token to be available
                 * Or disconnect
                 **/
                var to = setTimeout(function () {
                    if (!socket.token) {
                        socket.emit('unauthorized');
                        socket.disconnect(1);
                    }
                    clearTimeout(to);
                }, 3000);
            });
        }
    };
    /**
     * @method setupClient
     * @description Will setup a server side client, for server-side notifications.
     * This is mainly created to be called from hooks
     **/
    IODriver.prototype.setupClient = function () {
        var _this = this;
        // Passing transport options if any (Mostly for clustered environments)
        this.client = client("http://127.0.0.1:" + this.options.app.get('port'), {
            transports: ['websocket']
        });
        this.client.on('connect', function () {
            if (_this.options.auth) {
                logger_1.RealTimeLog.log('Server side client is connected, trying to authenticate');
                _this.client.emit('authentication', { is: '-*!#fl1nter#!*-' });
                _this.client.on('authenticated', function () { return logger_1.RealTimeLog.log('Internal server client is authenticated'); });
            }
        });
    };
    /**
     * @method setupInternal
     * @description Will setup an internal client that mainly will keep in sync different
     * server instances, is also used on.
     **/
    IODriver.prototype.setupInternal = function () {
        var _this = this;
        // Passing transport options if any (Mostly for clustered environments)
        this.internal = client("http://127.0.0.1:" + this.options.app.get('port'), {
            transports: ['websocket']
        });
        this.internal.on('connect', function () {
            if (_this.options.auth) {
                logger_1.RealTimeLog.log('Internal client is connected, trying to authenticate');
                _this.internal.emit('authentication', { is: '-*!#fl1nter#!*-' });
                _this.internal.on('authenticated', function () {
                    logger_1.RealTimeLog.log('Internal client is authenticated');
                    _this.internal.emit('fl-reg');
                });
            }
            else {
                _this.internal.emit('fl-reg');
            }
        });
    };
    IODriver.prototype.emit = function (event, message) {
        this.server.emit(event, message);
    };
    IODriver.prototype.on = function (event, callback) {
        this.client.on(event, callback);
    };
    IODriver.prototype.once = function (event, callback) {
        this.client.once(event, callback);
    };
    IODriver.prototype.of = function (event) {
        return this.server.of(event);
    };
    IODriver.prototype.getUserConnection = function (userId) {
        if (!userId || userId === '')
            return null;
        var connection;
        this.forEachConnection(function (_connection) {
            if (_connection.token && _connection.token.userId === userId) {
                connection = _connection;
            }
        });
        return connection;
    };
    IODriver.prototype.forEachConnection = function (handler) {
        this.connections.forEach(function (connection) { return handler(connection); });
    };
    IODriver.prototype.onConnection = function (handler) {
        var _this = this;
        this.server.on('connect', function (socket) { return handler(socket, _this.server); });
    };
    IODriver.prototype.removeListener = function (name, listener) {
        this.server.sockets.removeListener(name, listener);
    };
    IODriver.prototype.newConnection = function (socket) {
        var _this = this;
        this.connections.push(socket);
        socket.setMaxListeners(0);
        socket.on('ME:RT:1://event', function (input) {
            _this.server.emit(input.event, input.data);
        });
        socket.on('disconnect', function () {
            _this.options.app.emit('socket-disconnect', socket);
            socket.removeAllListeners();
        });
        socket.on('lb-ping', function () { return socket.emit('lb-pong', new Date().getTime() / 1000); });
        socket.on('fl-reg', function () { return socket.join('flint'); });
    };
    IODriver.prototype.restoreNameSpaces = function (socket) {
        _.each(this.server.nsps, function (nsp) {
            if (_.findWhere(nsp.sockets, { id: socket.id })) {
                nsp.connected[socket.id] = socket;
            }
        });
    };
    return IODriver;
}());
exports.IODriver = IODriver;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/drivers/io.driver.js.map