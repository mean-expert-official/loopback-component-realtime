import { DriverInterface } from '../types/driver';
import { OptionsInterface } from '../types/options';
import * as chalk from 'chalk';
/**
 * @module IO
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 * 
 * This module is created to implement IO Functionality into the LoopBack Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 **/
export class IO {

  static driver: DriverInterface;
  static options: OptionsInterface;

  constructor(driver: DriverInterface, options: OptionsInterface) {
    console.log(chalk.yellow(`MEAN Expert: IO server enabled using ${options.driver.name} driver.`));
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