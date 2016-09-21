import { DriverInterface } from '../types/driver';
import { OptionsInterface } from '../types/options';
import * as chalk from 'chalk';

export class IO {

  static driver: DriverInterface;
  static options: OptionsInterface;

  constructor(driver: DriverInterface, options: OptionsInterface) {
    console.log(chalk.yellow(`MX-RealTime: IO server enabled using ${options.driver.name} driver.`));
    IO.driver  = driver;
    IO.options = options;
    return IO;
  }

  static emit(event: string, message: any): void {
    IO.driver.emit(event, typeof message === 'object' ? JSON.stringify(message) : message);
  }

  static on(event: string, next: Function): void {
    IO.driver.on(event, next);
  }
}