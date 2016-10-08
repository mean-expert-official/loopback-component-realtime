declare var module: any;
declare var require: any;
declare var Object: any;
interface FireLoopData { id: any, data: any, parent: any }
import { DriverInterface } from '../types/driver';
import { OptionsInterface } from '../types/options';
import { RealTimeLog } from '../logger';
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
  static events: { read: string[], modify: string[] } = {
    read: ['value', 'changes'],
    modify: ['create', 'upsert', 'remove'],
  };

  constructor(driver: DriverInterface, options: OptionsInterface) {
    RealTimeLog.log(`FireLoop server enabled using ${options.driver.name} driver.`);
    FireLoop.driver = driver;
    FireLoop.options = options;
    FireLoop.setup();
  }

  static setup(): void {
    // Setup Each Connection
    FireLoop.driver.onConnection((socket: any) => {
      // Setup On Set Methods
      Object.keys(FireLoop.options.app.models).forEach((modelName: string) =>
        FireLoop.getReference(modelName, null, (Model: any) => {
          let ctx: any = { modelName: modelName, Model: Model, socket: socket };
          FireLoop.events.modify.forEach((event: string) =>
            ctx.socket.on(
              `${modelName}.${event}`,
              (input: FireLoopData) => (<any>FireLoop)[event](ctx, input)
            )
          );
          // Setup Relations
          FireLoop.setupScopes(ctx);
          // Setup Pull Requests
          FireLoop.setupPullRequests(ctx);
        })
      );
    });
  }

  static setupPullRequests(ctx: any): void {
    // Configure Pull Request for read type of Events
    FireLoop.events.read.forEach((event: string) => ctx.socket.on(
      `${ctx.modelName}.${event}.pull.request`,
      (filter: any) => {
        let _filter: any = Object.assign({}, filter);
        RealTimeLog.log(`FireLoop broadcast request received: ${JSON.stringify(_filter)}`);
        ctx.Model.find(_filter, (err: any, data: any) => {
          if (err) RealTimeLog.log(`FireLoop server error: ${JSON.stringify(err)}`);
          ctx.socket.emit(`${ctx.modelName}.${event}.pull.requested`, err ? { error: err } : data);
        });
      })
    );
  }

  static setupScopes(ctx: any): void {
    if (!FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations) return;
    Object.keys(FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations).forEach((scope: string) => {
      let relation: any = FireLoop.options.app.models[ctx.modelName].sharedClass.ctor.relations[scope];
      // Lets copy the context for each Scope, to keep the right references
      let _ctx = Object.assign({}, { modelName: `${ctx.modelName}.${scope}` }, ctx);
      FireLoop.events.modify.forEach((event: string) => {
        RealTimeLog.log(`FireLoop setting relation: ${ctx.modelName}.${scope}.${event}`);
        _ctx.modelName = `${ctx.modelName}.${scope}`;
        ctx.socket.on(
          `${_ctx.modelName}.${event}`,
          (input: FireLoopData) => {
            RealTimeLog.log(`FireLoop relation operation: ${_ctx.modelName}.${event}: ${JSON.stringify(input)}`);
            (<any>FireLoop)[event](_ctx, input);
          }
        )
      });
    });
  }

  static getReference(modelName: string, input: FireLoopData, next: Function): any {
    let ref: any;
    if (modelName.match(/\./g)) {
      if (!input || !input.parent) return next(null);
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
  // This method is called from Models and from Scoped Models,
  // If the create is for Model, we use context model reference.
  // Else we need to get a custom reference, since its a child
  static create(ctx: any, input: FireLoopData): void {
    RealTimeLog.log(`FireLoop starting create: ${ctx.modelName}: ${JSON.stringify(input)}`);
    async.waterfall([
      (next: Function) => {
        if (ctx.modelName.match(/\./g)) {
          FireLoop.getReference(ctx.modelName, input, (ref: any) => {
            if (!ref) {
              next({ error: `${ctx.modelName} Model reference was not found.` });
            } else {
              next(null, ref);
            }
          });
        } else {
          next(null, ctx.Model);
        }
      },
      (ref: any, next: Function) => ref.create(input.data, next)
    ], (err: any, data: any) => FireLoop.publish(
      Object.assign({ err, input, data, created: true }, ctx))
    );
  }
  // This method is called from Models and from Scoped Models,
  // If the create is for Model, we use context model reference.
  // Else we need to get a custom reference, since its a child
  static upsert(ctx: any, input: FireLoopData): void {
    let created: boolean;
    RealTimeLog.log(`FireLoop starting upsert: ${ctx.modelName}: ${JSON.stringify(input)}`);
    // Wont use findOrCreate because only works at level 1, does not work on related references
    async.waterfall([
      (next: Function) => {
        if (ctx.modelName.match(/\./g)) {
          FireLoop.getReference(ctx.modelName, input, (ref: any) => {
            if (!ref) {
              next({ error: `${ctx.modelName} Model reference was not found.` });
            } else {
              next(null, ref);
            }
          });
        } else {
          next(null, ctx.Model);
        }
      },
      (ref: any, next: Function) => ref.findOne({ where: input.data }, (err: any, inst: any) => next(err, ref, inst)),
      (ref: any, inst: any, next: Function) => {
        if (inst) {
          created = false;
          Object.keys(input.data).forEach((key: string) => inst[key] = input.data[key]);
          inst.save(next);
        } else {
          created = true;
          ref.create(input.data, next);
        }
      }
    ], (err: any, data: any) => FireLoop.publish(
      Object.assign({ err, input, data, created }, ctx))
    );
  }
  // This method is called from Models and from Scoped Models,
  // If the create is for Model, we use context model reference.
  // Else we need to get a custom reference, since its a child
  static remove(ctx: any, input: FireLoopData): void {
    RealTimeLog.log(`FireLoop starting remove: ${ctx.modelName}: ${JSON.stringify(input)}`);
    async.waterfall([
      (next: Function) => {
        if (ctx.modelName.match(/\./g)) {
          FireLoop.getReference(ctx.modelName, input, (ref: any) => {
            if (!ref) {
              next({ error: `${ctx.modelName} Model reference was not found.` });
            } else {
              next(null, ref);
            }
          });
        } else {
          next(null, ctx.Model);
        }
      },
      (ref: any, next: Function) => ref.destroy
        ? ref.destroy(input.data.id, next)
        : ref.removeById(input.data.id, next)
    ], (err: any) => FireLoop.publish(
      Object.assign({ err, input, removed: input.data }, ctx))
    );
  }
  // Context will be destroyed everytime, make sure the ctx passed is a
  // custom copy for current request or else bad things will happen :P.
  // WARNING: Do not pass the root context.
  static publish(ctx: any): void {
    // Response to the client that sent the request
    ctx.socket.emit(
      `${ctx.modelName}.value.result.${ctx.input.id}`,
      ctx.err ? { error: ctx.err } : ctx.data ||  ctx.removed
    );
    if (ctx.data) {
      FireLoop.broadcast('value', ctx);
      if (ctx.created) {
        FireLoop.broadcast('child_added', ctx);
      } else {
        FireLoop.broadcast('child_changed', ctx);
      }
    } else if (ctx.removed) {
      FireLoop.broadcast('child_removed', ctx);
    }
    // In any of the operations we call the changes event
    FireLoop.broadcast('changes', ctx);
    // Avoiding Memory Leaks
    // setTimeout(() => ctx = null, 5000); TODO: NOT SURE WHEN TO DESTROY THE TEMPORAL OBJECT IT JUST YET
  }

  static broadcast(event: string, ctx: any): void {
    function listener(filter: any) {
      let _filter: any = Object.assign({}, filter);
      RealTimeLog.log(`FireLoop ${event} broadcast request received: ${JSON.stringify(_filter)}`);
      switch (event) {
        case 'value':
        case 'changes':
        case 'child_added':
          let broadcast: Function = (err: any, data: any) => {
            if (err) RealTimeLog.log(`FireLoop server error: ${JSON.stringify(err)}`);
            if (event === 'value' ||  event === 'changes') {
              RealTimeLog.log(`FireLoop ${event} broadcasting: ${JSON.stringify(data)}`);
              ctx.socket.emit(`${ctx.modelName}.${event}.broadcast`, err ? { error: err } : data);
            } else {
              data.forEach(
                (d: any) => ctx.socket.emit(
                  `${ctx.modelName}.${event}.broadcast`,
                  err ? { error: err } : d
                )
              );
            }
          };
          if (ctx.modelName.match(/\./g)) {
            FireLoop.getReference(ctx.modelName, ctx.input, (ref: any) => {
              if (!ref) {
                ctx.socket.emit(`${ctx.modelName}.${event}.broadcast`, { error: 'Scope not found' });
              } else {
                ref(_filter, broadcast)
              }
            });
          } else {
            ctx.Model.find(_filter, broadcast);
          }
          break;
        case 'child_changed':
        case 'child_removed':
          ctx.socket.emit(`${ctx.modelName}.${event}.broadcast`, ctx.data || ctx.removed);
          break;
        default:
          ctx.socket.emit(
            `${ctx.modelName}.${event}.broadcast`,
            { error: new Error(`Invalid event ${event}`) }
          );
      }
      FireLoop.driver.removeListener(`${ctx.modelName}.${event}.broadcast.request`, listener);
    }
    ctx.socket.once(`${ctx.modelName}.${event}.broadcast.request`, listener);
    ctx.socket.emit(`${ctx.modelName}.${event}.broadcast.announce`, 1);
  }
}
