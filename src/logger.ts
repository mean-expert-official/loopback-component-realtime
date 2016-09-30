import * as chalk from 'chalk';
import { OptionsInterface } from './types/options';
/**
* @author Jonathan Casarrubias <twitter:@johncasarrubias> <github:@johncasarrubias>
* @module RealTimeLog
* @license MTI
* @description
* Console Log wrapper that can be disabled in production mode
**/
export class RealTimeLog {
  static namespace: string = '@mean-expert/loopback-component-realtime';
  static options: OptionsInterface;
  static log(input: any) {
    if (RealTimeLog.options.debug)
    console.log(chalk.yellow(`${this.namespace}: ${input}`));
  }
}
