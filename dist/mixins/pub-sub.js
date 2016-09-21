"use strict";
var async = require('async');
var LoopBackContext = require('loopback-context');
/**
 * @module LoopBack Component PubSub - Mixin -
 * @author Jonathan Casarrubias <@johncasarrubias>
 * @description
 *
 * The following algorithm will send messages to subscribed clients
 * for specific endpoints.
 *
 * If the request is in order to create a relationship between 2
 * entities, then the messages will be sent forwards and backwards
 *
 * Which means, that if you link an Account <-> Room 2 messages will
 * be sent:
 *
 *  1.- account.onRoomLink(account.id).subscribe(newRooms => {})
 *  2.- room.onAccountLink(room.id).subscribe(newAccount => {})
 *
 * Otherwise will send a direct message.
 *
 * Also it accepts filters defined within the model config, so you can
 * include data to messages sent, example:
 *
 *  When sending a message, we may want to include the owner account.
 */
var PubSubMixin = (function () {
    function PubSubMixin(Model, options) {
        options = Object.assign({ filters: {} }, options);
        Model.afterRemote('**', function (ctx, remoteMethodOutput, next) {
            if (ctx.req.method === 'GET' || ctx.req.method === 'HEAD' ||
                ctx.req.originalUrl.match(/resetPassword/g) ||
                ctx.req.originalUrl.match(/log(in|out)/g))
                return next();
            // If the message event is due link relationships
            if (ctx.methodString.match(/__(link|unlink)__/g)) {
                var segments = ctx.methodString.replace(/__[a-zA-Z]+__/g, '').split('.');
                var original_1 = ctx.req.originalUrl.split('/');
                original_1.pop();
                original_1 = original_1.join('/');
                var current_1 = segments.shift();
                var related_1 = segments.pop().split('');
                related_1[0] = related_1[0].toUpperCase();
                related_1.pop();
                related_1 = related_1.join('');
                var inverse_1 = ctx.req.originalUrl.split('/');
                inverse_1.shift();
                // Send Forward and Backward Messages in Parallel
                async.parallel([
                    // Send Forward Message
                    function (next) { return Model.app.models[related_1].findOne(Object.assign({
                        where: (_a = {}, _a[Model.app.models[related_1].getIdName()] = ctx.req.params.fk, _a)
                    }, (options.filters[ctx.method.name] && options.filters[ctx.method.name].forFK) ?
                        options.filters[ctx.method.name].forFK : {}), function (err, res) {
                        if (err)
                            return next(err);
                        Model.app.mx.PubSub.publish({
                            method: ctx.req.method,
                            endpoint: original_1,
                            data: res
                        }, next);
                    }); var _a; },
                    // Send Backward Message
                    function (next) { return Model.app.models[current_1].findOne(Object.assign({
                        where: (_a = {}, _a[Model.app.models[current_1].getIdName()] = ctx.req.params[Model.app.models[current_1].getIdName()], _a)
                    }, (options.filters[ctx.method.name] && options.filters[ctx.method.name].forPK) ?
                        options.filters[ctx.method.name].forPK : {}), function (err, res) {
                        if (err)
                            return next(err);
                        Model.app.mx.PubSub.publish({
                            method: ctx.req.method,
                            endpoint: '/' + [inverse_1[0], inverse_1[3], ctx.req.params.fk, inverse_1[1], inverse_1[4]].join('/'),
                            data: res
                        }, next);
                    }); var _a; }
                ], next);
            }
            else if (ctx.methodString.match(/__(create)__/g)) {
                var segments = ctx.methodString.replace(/__[a-zA-Z]+__/g, '').split('.');
                var current = segments.shift();
                if (options.filters[ctx.method.name]) {
                    var method = Array.isArray(remoteMethodOutput) ? 'find' : 'findOne';
                    var related = segments.pop().split('');
                    related[0] = related[0].toUpperCase();
                    related.pop();
                    related = related.join('');
                    var query = Object.assign({
                        where: (_a = {},
                            _a[Model.app.models[related].getIdName()] = remoteMethodOutput[Model.app.models[related].getIdName()],
                            _a
                        )
                    }, options.filters[ctx.method.name]);
                    Model.app.models[related][method](query, function (err, instance) {
                        if (err)
                            return next(err);
                        if (!instance) {
                            next();
                            return console.error('PUBSUB ERROR: Invalid Model Filters', options.filters[ctx.method.name]);
                        }
                        Model.app.mx.PubSub.publish({
                            method: ctx.req.method,
                            endpoint: ctx.req.originalUrl,
                            data: instance
                        }, next);
                    });
                }
                else {
                    // Send Direct Message without filters
                    Model.app.mx.PubSub.publish({
                        method: ctx.req.method,
                        endpoint: ctx.req.originalUrl,
                        data: remoteMethodOutput
                    }, next);
                }
            }
            else {
                if (options.filters[ctx.method.name]) {
                    // Send Direct Message with filters
                    var method = Array.isArray(remoteMethodOutput) ? 'find' : 'findOne';
                    Model[method](Object.assign({ where: remoteMethodOutput }, options.filters[ctx.method.name]), function (err, instance) {
                        if (err)
                            return next(err);
                        if (!instance) {
                            next();
                            return console.error('PUBSUB ERROR: Invalid Model Filters', options.filters[ctx.method.name]);
                        }
                        Model.app.mx.PubSub.publish({
                            method: ctx.req.method,
                            endpoint: ctx.req.originalUrl,
                            data: instance
                        }, next);
                    });
                }
                else {
                    // Send Direct Message without filters
                    Model.app.mx.PubSub.publish({
                        method: ctx.req.method,
                        endpoint: ctx.req.originalUrl,
                        data: remoteMethodOutput
                    }, next);
                }
            }
            var _a;
        });
    }
    ;
    return PubSubMixin;
}());
module.exports = PubSubMixin;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/mixins/pub-sub.js.map