declare var require: any;
import { DriverInterface } from '../types/driver';
import { OptionsInterface } from '../types/options';
import { RealTimeLog } from '../logger';
import * as server from 'socket.io';
import * as client from 'socket.io-client';
let ioAuth = require('socketio-auth');

export class IODriver implements DriverInterface {

  client: any;
  server: any;
  connections: Array<any> = new Array();

  connect(options?: OptionsInterface): any {
    this.server = server(options.server);
    this.onConnection((socket: any) => this.newConnection(socket));
    this.client = client(`http://127.0.0.1:${options.app.get('port')}`);
    this.authenticate(options);
  }

  authenticate(options: OptionsInterface): void {
    if (options.auth) {
      RealTimeLog.log('RTC authentication mechanism enabled');
      ioAuth(this.server, {
        authenticate: (ctx: any, token: any, next: Function) => {
          var AccessToken = options.app.models.AccessToken;
          //verify credentials sent by the client
          var token = AccessToken.find({
            where: { id: token.id || 0, userId: token.userId || 0 }
          }, (err: any, tokenInstance: any) => next(err, tokenInstance.length > 0 ? true : false));
        },
        postAuthenticate: () => {
          this.server.on('authentication', (value: any) => {
            RealTimeLog.log(`A user ${value} has been authenticated over web sockets`);
          });
        }
      });
    }
  }

  emit(event: string, message: any): void {
    this.server.emit(event, message);
  }

  on(event: string, callback: Function): void {
    this.client.on(event, callback);
  }

  of(event: string): void {
    return this.server.of(event);
  }

  forEachConnection(handler: Function): void {
    this.connections.forEach((connection: any) => handler(connection));
  }

  onConnection(handler: Function): void {
    this.server.on('connection', (socket: any) => handler(socket, this.server));
  }

  removeListener(name: string, listener: Function): void {
    this.server.sockets.removeListener(name, listener);
  }

  newConnection(socket: any): void {
    this.connections.push(socket);
    socket.setMaxListeners(0);
    socket.on('ME:RT:1://event', (input: { event: string, data: any }) => {
      this.server.emit(input.event, input.data);
    });
    socket.on('disconnect', () => socket.removeAllListeners());
    socket.on('lb-ping', () => socket.emit('lb-pong', new Date().getTime() / 1000));
  }
}