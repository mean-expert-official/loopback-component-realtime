"use strict";
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
var FireLoopMixin = (function () {
    function FireLoopMixin(Model, options) {
        options = Object.assign({ filters: {} }, options);
        Model.observe('after save', function (err, instance, next) {
            if (err) {
                return next(err);
            }
            else {
                Model.app.emit('create-hook', instance);
                next();
            }
        });
    }
    ;
    return FireLoopMixin;
}());
module.exports = FireLoopMixin;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/mixins/fireloop.js.map