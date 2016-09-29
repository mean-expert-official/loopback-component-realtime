export interface DriverInterface {
  client?: any;
  server?: any;
  connect(options?: any): any;
  emit(event:string, message: any): void;
  on(event:string, callback: Function): any;
  onReady?(callback: Function): void;
  newConnection(socket: any): void
  onConnection?(callback: Function): void;
  removeListener(name: string, listener: Function): void;
  forEachConnection(handler: Function): void;
}
