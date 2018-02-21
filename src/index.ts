declare var module: any;
declare var require: any;
declare var Object: any;
// Module Imports
import { OptionsInterface } from './types/options';
import { DriverInterface } from './types/driver';
import { DriverFactory } from './drivers/factory';
import { RealTimeLog } from './logger';
/**
 * @module @mean-expert/loopback-component-realtime
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 * 
 * This module is created to implement multiple real-time transportation channels in order
 * to turn the LoopBack Framework into the Most Powerfull NodeJS Real-Time Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 */
class RealTime {

  static driver  : DriverInterface;
  static options : OptionsInterface = {
    driver  : {
      name: 'socket.io',
      options: {
        // Client options
        forceNew: true,
        upgrade: false,
        // Client/Server Options
        transports: ['websocket'] // Enabled by default to fix handshake issues on clustered envs. (No IE9)
        // Server Options
        // ...
      }
    },
    debug   : false,
    auth    : true,
    secure  : false,
    modules : [ /*'PubSub' Deprecated,*/'IO', 'FireLoop' /*, 'WebRTCSignaler'  Not yet implemented */]
  };

  constructor(app: any = undefined, options: OptionsInterface) {
    RealTimeLog.options = options;
    if (!app) {
      RealTimeLog.log('LoopBack Application Instance is Missing');
    } else {
      app.on('started', (server: any) => {
        app.mx = app.mx || {};
        if (options.driver && options.driver.options) {
          Object.assign(options.driver.options, RealTime.options.driver.options);
          Object.assign(RealTime.options.driver, options.driver);
        }
        RealTime.options = Object.assign(RealTime.options, options, {
          app    : app,
          server : server,
          driver : RealTime.options.driver
        });
        RealTime.connect();
        RealTime.setup();
      });
    }
  }

  static connect(): void {
    RealTime.driver = <DriverInterface> DriverFactory.load(RealTime.options.driver.name);
    RealTime.driver.connect(RealTime.options);
  }

  static setup(): void {
    RealTime.options.modules.forEach(
      _module =>
      RealTime.options.app.mx[_module] =
      require(`./modules/${_module}`)[_module](RealTime.driver, RealTime.options)
    );
    RealTime.options.app.emit('realtime-loaded');
  }
}

module.exports = RealTime;
