declare var module: any;
declare var require: any;
declare var Object: any;
interface FireLoopData { id: any, data: any }
import { DriverInterface } from '../types/driver';
import { OptionsInterface } from '../types/options';
import * as chalk from 'chalk';
/**
 * @module FireLoop
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @license MIT <MEAN Expert - Jonathan Casarrubias>
 * @description
 * 
 * This module is created to implement IO Functionality into the LoopBack Framework.
 * This works with the SDK Builder and as a module of the FireLoop.io Framework
 **/
export class FireLoop {

  static driver: DriverInterface;
  static options: OptionsInterface;

  constructor(driver: DriverInterface, options: OptionsInterface) {
    console.log(chalk.yellow(`MEAN Expert: FireLoop server enabled using ${options.driver.name} driver.`));
    FireLoop.driver = driver;
    FireLoop.options = options;
    FireLoop.setup();
    return FireLoop;
  }

  static setup(): void {
    // Setup On Set Methods
    Object.keys(FireLoop.options.app.models).forEach((modelName: string) => {
      //console.log(FireLoop.options.app.models[modelName].settings)
      FireLoop.driver.on(`${modelName}.set`, (input: FireLoopData) => FireLoop.set(modelName, input));
    });
    // Setup Pull Request Methods for each connection
    FireLoop.driver.onConnection((socket: any) => {
      Object.keys(FireLoop.options.app.models).forEach((modelName: string) => {
        let ref: any = FireLoop.getReference(modelName);
        socket.on(`${ modelName }.set.broadcast.pull.request`, (filter: any) => {
          let _filter: any = JSON.stringify(Object.assign({}, filter));
          console.log(chalk.yellow(`MEAN Expert: FireLoop broadcast request received: ${ _filter }`));
          ref.find(_filter, (err: any, data: any) => {
            if (err) console.log(chalk.red(`MEAN Expert: FireLoop server error: ${ JSON.stringify(err) }`));
            socket.emit(`${ modelName }.set.broadcast.pull.requested`, err ? { error: err } : data);
          });
        });
      });
    });
  }

  static getReference(modelName: string): void {
    let ref: any;
    if (modelName.match(/\./g)) {
      let segments: string[] = modelName.split('.');
      ref = FireLoop.options.app.models[segments[0]][segments[1]] || null;
    } else {
      ref = FireLoop.options.app.models[modelName] || null;
    }
    return ref;
  }

  static set(modelName: string, input: FireLoopData): void {
    let ref: any = FireLoop.getReference(modelName);
    if (!ref) {
      return FireLoop.driver.emit(
        `${ modelName }.set.result.${ input.id }`,
        { error: `${ modelName } Model is not defined.` }
      );
    }
    ref.upsert(input.data, (err: any, data: any) => {
      // for the creator
      FireLoop.driver.emit(`${ modelName }.set.result.${ input.id }`, err ? { error: err } : data);
      // for subscribers
      FireLoop.driver.forEachConnection((socket: any) => {
        socket.once(`${ modelName }.set.broadcast.request`, (filter: any) => {
          let _filter: any = JSON.stringify(Object.assign({}, filter));
          console.log(chalk.yellow(`MEAN Expert: FireLoop broadcast request received: ${ _filter }`));
          ref.find(_filter, (err: any, data: any) => {
            if (err) console.log(chalk.red(`MEAN Expert: FireLoop server error: ${ JSON.stringify(err) }`));
            socket.emit(`${ modelName }.set.broadcast`, err ? { error: err } : data);
          });
        });
        socket.emit(`${ modelName }.set.broadcast.announce`, 1);
      });
    });
  }
}
