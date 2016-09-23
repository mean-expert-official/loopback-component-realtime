import { DriverInterface } from '../types/driver';
import * as server from 'socket.io';
import * as client from 'socket.io-client';

export class IODriver implements DriverInterface {

  client: any;
  server: any;
  connections: Array<any> = new Array();

  connect(options?: any): any {
    this.server = server(options.server);
    this.onConnection((socket: any) => this.newConnection(socket));
    this.client = client(`http://127.0.0.1:${options.app.get('port')}`);
  }

  emit(event:string, message: any): void {
    this.server.emit(event, message);
  }

  on(event:string, callback: Function): void {
    this.client.on(event, callback);
  }

  forEachConnection(handler: Function): void {
    this.connections.forEach((connection: any) => handler(connection));
  }

  onConnection(handler: Function): void {
    this.server.on('connection', handler);
  }

  newConnection(socket: any): void {
    this.connections.push(socket);
    socket.on('ME:RT:1://event', (input: { event: string, data: any }) => {
      this.server.emit(input.event, input.data);
    });
  }
}