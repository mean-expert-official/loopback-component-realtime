import { DriverInterface } from '../types/driver';
import { OptionsInterface } from '../types/options';
import * as chalk from 'chalk';
/**
 * @module PubSub
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 * 
 * This module is created to implement PubSub Functionality into the LoopBack Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 */
export class PubSub {

  static driver: DriverInterface;
  static options: OptionsInterface;

  constructor(driver: DriverInterface, options: OptionsInterface) {
    console.log(chalk.yellow(`MEAN Expert: PubSub server enabled using ${options.driver.name} driver.`));
    PubSub.driver  = driver;
    PubSub.options = options;
    return PubSub;
  }
  
  static publish(options: any, next: any): void {
    if (options && options.method && options.endpoint && options.data) {
      if (options.endpoint.match(/\?/))
        options.endpoint = options.endpoint.split('?').shift();
      let event = `[${options.method}]${options.endpoint}`;
      if (PubSub.options.debug) {
        console.log(chalk.yellow(`MEAN Expert: Sending message to ${event}`));
        console.log(chalk.yellow(`MEAN Expert: Message: ${typeof options.data === 'object' ? JSON.stringify(options.data) : options.data}`));
      }
      PubSub.driver.emit(event, options.data);
      next();
    } else {
      if (PubSub.options.debug) {
        console.log(chalk.red('MEAN Expert: Option must be an instance of type { method: string, data: object }'));
        console.log(chalk.red(`MEAN Expert: ${options}`));
      }
      next();
    }
  }
}