import { DriverInterface } from '../types/driver';
import { OptionsInterface } from '../types/options';
import { ChannelInterface } from '../types/channel';
import { RealTimeLog } from '../logger';
/**
 * @module IO
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 * 
 * This module is created to implement WebRTC Functionality into the LoopBack Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 **/
export class WebRTCSignaler {

  static driver: DriverInterface;
  static options: OptionsInterface;
  static channels: ChannelInterface = {};

  constructor(driver: DriverInterface, options: OptionsInterface) {
    RealTimeLog.log(`WebRTCSignaler server enabled using ${options.driver.name} driver.`);
    WebRTCSignaler.driver = driver;
    WebRTCSignaler.options = options;
    WebRTCSignaler.driver.onConnection((socket: any) => {
      let initiatorChannel: string = '';
      socket.on('new-channel', (data: any) => {
        if (!WebRTCSignaler.channels[data.channel]) {
          initiatorChannel = data.channel;
        }

        WebRTCSignaler.channels[data.channel] = data.channel;
        WebRTCSignaler.onNewNamespace(data.channel, data.sender);
      });

      socket.on('presence', (channel: any) => {
        var isChannelPresent = !!WebRTCSignaler.channels[channel];
        socket.emit('presence', isChannelPresent);
      });

      socket.on('disconnect', (channel: any) => {
        if (initiatorChannel) {
          delete WebRTCSignaler.channels[initiatorChannel];
        }
      });
    });
    return WebRTCSignaler;
  }

  static onNewNamespace(channel: string, sender: string): void {
    WebRTCSignaler.driver.of('/' + channel).on('connection', (socket: any) => {
      let username: string;
      if (WebRTCSignaler.driver.isConnected) {
        WebRTCSignaler.driver.isConnected = false;
        socket.emit('connect', true);
      }

      socket.on('message', (data: any) => {
        if (data.sender == sender) {
          if (!username) username = data.data.sender;

          socket.broadcast.emit('message', data.data);
        }
      });

      socket.on('disconnect', () => {
        if (username) {
          socket.broadcast.emit('user-left', username);
          username = null;
        }
      });
    });
  }
}