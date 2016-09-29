declare var module: any;
declare var require: any;
declare var Object: any;
interface FireLoopData { id: any, data: any, parent: any }
import { DriverInterface } from '../types/driver';
import { OptionsInterface } from '../types/options';
import * as chalk from 'chalk';
import * as async from 'async';
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
      FireLoop.driver.on(`${modelName}.upsert`, (input: FireLoopData) => FireLoop.upsert(modelName, input));
      FireLoop.driver.on(`${modelName}.remove`, (input: FireLoopData) => FireLoop.remove(modelName, input));
      // Setup Relations
      FireLoop.setupRelations(modelName);
    });
    // Setup Pull Request Methods for each connection
    FireLoop.driver.onConnection((socket: any, io: any) => {
      // let handlers: Array<{ name: string, listener: Function }> = new Array();
      Object.keys(FireLoop.options.app.models).forEach((modelName: string) => {
        FireLoop.getReference(modelName, null, (ref: any) => {
          let handler: any = {
            name: `${modelName}.value.pull.request`,
            listener: function listener(filter: any) {
              let _filter: any = Object.assign({}, filter);
              console.log(chalk.yellow(`MEAN Expert: FireLoop broadcast request received: ${JSON.stringify(_filter)}`));
              ref.find(_filter, (err: any, data: any) => {
                if (err) console.log(chalk.red(`MEAN Expert: FireLoop server error: ${JSON.stringify(err)}`));
                socket.emit(`${modelName}.value.pull.requested`, err ? { error: err } : data);
              });
            }
          };
          // Configure Pull Request for Valued type of Event
          socket.on(`${modelName}.value.pull.request`, handler.listener);
          // handlers.push(handler);
        })
      });
    });
  }

  static setupRelations(modelName: string): void {
    if (!FireLoop.options.app.models[modelName].sharedClass.ctor.relations) return;
    Object.keys(FireLoop.options.app.models[modelName].sharedClass.ctor.relations).forEach((scope: string) => {
      let relation: any = FireLoop.options.app.models[modelName].sharedClass.ctor.relations[scope];
      FireLoop.driver.on(`${modelName}.${scope}.upsert`, (input: FireLoopData) => FireLoop.upsert(`${modelName}.${scope}`, input));
      FireLoop.driver.on(`${modelName}.${scope}.remove`, (input: FireLoopData) => FireLoop.remove(`${modelName}.${scope}`, input));
    });
  }

  static getReference(modelName: string, input: FireLoopData, next: Function): any {
    let ref: any;
    if (modelName.match(/\./g)) {
      if (!input || !input.parent) return null;
      let segments: string[] = modelName.split('.');
      let parent: any = FireLoop.options.app.models[segments[0]] || null;
      if (!parent) return null;
      return parent.findOne({ where: input.parent }, (err: any, instance: any) => {
        ref = instance[segments[1]] || null;
        next(ref);
      });
    } else {
      ref = FireLoop.options.app.models[modelName] || null;
    }
    next(ref);
  }

  static upsert(modelName: string, input: FireLoopData): void {
    FireLoop.getReference(modelName, input, (ref: any) => {
      if (!ref) {
        return FireLoop.driver.emit(
          `${modelName}.value.result.${input.id}`,
          { error: `${modelName} Model reference was not found.` }
        );
      }
      let created: boolean;
      // Wont use findOrCreate because only works at level 1, does not work on related references
      async.waterfall([
        (next: Function) => ref.findOne({ where: input.data }, next),
        (inst: any, next: Function) => {
          if (inst) {
            created = false;
            Object.keys(input.data).forEach((key: string) => inst[key] = input.data[key]);
            inst.save(next);
          } else {
            created = true;
            ref.create(input.data, next);
          }
        }
      ], (err: any, data: any) => FireLoop.publish({
        err,
        ref,
        modelName,
        input,
        data,
        created
      }));
    });
  }

  static remove(modelName: string, input: FireLoopData): void {
    FireLoop.getReference(modelName, null, (ref: any) => {
      if (!ref) {
        return FireLoop.driver.emit(
          `${modelName}.value.result.${input.id}`,
          { error: `${modelName} Model is not defined.` }
        );
      }
      ref.findById(input.data, (err: any, data: any) => {
        ref.removeById(data.id, (err: any) => FireLoop.publish({
          err,
          ref,
          modelName,
          input,
          removed: data
        }));
      });
    });
  }

  static publish(options: any): void {
    // Response to the client that sent the request
    FireLoop.driver.emit(
      `${options.modelName}.value.result.${options.input.id}`,
      options.err ? { error: options.err } : options.data
    );
    // Response for subscribers
    FireLoop.driver.forEachConnection((socket: any) => {
      options.socket = socket;
      if (options.data) {
        FireLoop.broadcast('value', options);
        if (options.created) {
          FireLoop.broadcast('child_added', options);
        } else {
          FireLoop.broadcast('child_changed', options);
        }
      } else if (options.removed) {
        FireLoop.broadcast('child_removed', options);
      }
    });
  }

  static broadcast(event: string, options: any): void {
    function listener(filter: any) {
      let _filter: any = Object.assign({}, filter);
      console.log(chalk.yellow(`MEAN Expert: FireLoop ${event} broadcast request received: ${JSON.stringify(_filter)}`));
      switch (event) {
        case 'value':
        case 'child_added':
          let broadcast: Function = (err: any, data: any) => {
            if (err) console.log(chalk.red(`MEAN Expert: FireLoop server error: ${JSON.stringify(err)}`));
            if (event === 'value') {
              options.socket.emit(`${options.modelName}.${event}.broadcast`, err ? { error: err } : data);
            } else {
              data.forEach(
                (d: any) => options.socket.emit(
                  `${options.modelName}.${event}.broadcast`,
                  err ? { error: err } : d
                )
              );
            }
          };
          if (options.ref.find) {
            options.ref.find(_filter, broadcast);
          } else {
            options.ref(_filter, broadcast);
          }
          break;
        case 'child_changed':
        case 'child_removed':
          options.socket.emit(`${options.modelName}.${event}.broadcast`, options.data || options.removed);
          break;
        default:
          options.socket.emit(
            `${options.modelName}.${event}.broadcast`,
            { error: new Error(`Invalid event ${event}`) }
          );
      }
      FireLoop.driver.removeListener(`${options.modelName}.${event}.broadcast.request`, listener);
    }
    options.socket.once(`${options.modelName}.${event}.broadcast.request`, listener);
    options.socket.emit(`${options.modelName}.${event}.broadcast.announce`, 1);
  }
}
