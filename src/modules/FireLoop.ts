declare var module: any;
declare var require: any;
declare var Object: any;
import { DriverInterface } from '../types/driver';
import { OptionsInterface } from '../types/options';
import { EventsInterface } from '../types/events';
import { FireLoopData } from '../types/fireloop-data';
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
  /**
   * @property UNAUTHORIZED: string
   * Constant for UNAUTHORIZED Events
   **/
  static UNAUTHORIZED: string = '401 Unauthorized Event';
  /**
   * @property driver: DriverInterface
   * The transportation driver that will be used by this module
   **/
  static driver: DriverInterface;
  /**
   * @property options: OptionsInterface
   * The options object that are injected from the main module
   **/
  static options: OptionsInterface;
  /**
   * @property events: OptionsInterface
   * The options object that are injected from the main module
   **/
  static events: EventsInterface = {
    read: ['value', 'changes'],
    modify: ['create', 'upsert', 'remove'],
  };
  /**
  * @method constructor
  * @param driver: DriverInterface
  * @param options: OptionsInterface
  * @description
  * Initializes FireLoop module by storing a static reference for the driver and
  * options that will be used. Then it will call the setup method.
  **/
  constructor(driver: DriverInterface, options: OptionsInterface) {
    RealTimeLog.log(`FireLoop server enabled using ${options.driver.name} driver.`);
    FireLoop.driver = driver;
    FireLoop.options = options;
    FireLoop.setup();
  }
  /**
  * @method setup
  * @description
  * Listen for new connections in order to configure each new client connected
  * by iterating the LoopBack models and configuring the necessary events
  **/
  static setup(): void {
    // Setup Each Connection
    FireLoop.driver.onConnection((socket: any) => {
      // Setup On Set Methods
      Object.keys(FireLoop.options.app.models).forEach((modelName: string) =>
        FireLoop.getReference(modelName, null, (Model: any) => {
          let ctx: any = { modelName: modelName, Model: Model, socket: socket };
          FireLoop.events.modify.forEach((event: string) =>
            ctx.socket.on(
              `${ctx.modelName}.${event}`,
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
  /**
  * @method setupPullRequest
  * @description
  * Listen for connections that requests to pull data without waiting until the next
  * public broadcast announce.
  **/
  static setupPullRequests(ctx: any): void {
    // Configure Pull Request for read type of Events
    FireLoop.events.read.forEach((event: string) => {
      ctx.socket.on(
        `${ctx.modelName}.${event}.pull.request`,
        (filter: any) => {
          let _filter: any = Object.assign({}, filter);
          RealTimeLog.log(`FireLoop broadcast request received: ${JSON.stringify(_filter)}`);
          ctx.Model.find(_filter, (err: any, data: any) => {
            if (err) RealTimeLog.log(`FireLoop server error: ${JSON.stringify(err)}`);
            ctx.socket.emit(`${ctx.modelName}.${event}.pull.requested`, err ? { error: err } : data);
          });
        });
      FireLoop.setupBroadcast(event, ctx);
    });
  }
  /**
  * @method setupScopes
  * @description
  * Listen for connections working with child references, in LoopBack these are called scopes
  * Basically is setting up the methods for a related method. e.g. Room.messages.upsert()
  **/
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
  /**
  * @method getReference
  * @description
  * Returns a model reference, this can be either a Regular Model or a Scoped Model.
  * For regular models we just return the model as it is, but for scope models (childs)
  * we return a child model reference by correctly finding it.
  **/
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
  /**
  * @method create
  * @description
  * Creates a new instance for either a model or scope model.
  *
  * This method is called from Models and from Scoped Models,
  * If the create is for Model, we use context model reference.
  * Else we need to get a custom reference, since its a child
  **/
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
      (ref: any, next: Function) => {
        if (ref.checkAccess) {
          ref.checkAccess(ctx.socket.token, input.parent ? input.parent.id : null, {
            name: 'create',
            aliases: []
          }, {}, function (err: any, access: boolean) {
            if (access) {
              next(null, ref);
            } else {
              next(FireLoop.UNAUTHORIZED, ref);
            }
          });
        } else {
          RealTimeLog.log(ref);
          next(FireLoop.UNAUTHORIZED, ref);
        }
      },
      (ref: any, next: Function) => ref.create(input.data, next)
    ], (err: any, data: any) => FireLoop.publish(
      Object.assign({ err, input, data, created: true }, ctx))
    );
  }
  /**
  * @method upsert
  * @description
  * Creates a new instance from either a model or scope model.
  *
  * This method is called from Models and from Scoped Models,
  * If the create is for Model, we use context model reference.
  * Else we need to get a custom reference, since its a child
  **/
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
      (ref: any, next: Function) => {
        if (ref.checkAccess) {
          ref.checkAccess(ctx.socket.token, input.parent ? input.parent.id : null, {
            name: 'create',
            aliases: []
          }, {}, function (err: any, access: boolean) {
            if (access) {
              next(null, ref);
            } else {
              next(FireLoop.UNAUTHORIZED, ref);
            }
          });
        } else {
          RealTimeLog.log(ref);
          next(FireLoop.UNAUTHORIZED, ref);
        }
      },
      (ref: any, next: Function) => ref.findOne({ where: { id: input.data.id } }, (err: any, inst: any) => next(err, ref, inst)),
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
  /**
  * @method remove
  * @description
  * Removes instances from either a model or scope model.
  *
  * This method is called from Models and from Scoped Models,
  * If the create is for Model, we use context model reference.
  * Else we need to get a custom reference, since its a child
  **/
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
      (ref: any, next: Function) => {
        if (ref.checkAccess) {
          ref.checkAccess(ctx.socket.token, input.parent ? input.parent.id : null, {
            name: ref.destroy ? 'destroy' : 'removeById',
            aliases: []
          }, {}, function (err: any, access: boolean) {
            if (access) {
              next(null, ref);
            } else {
              next(FireLoop.UNAUTHORIZED, ref);
            }
          });
        } else {
          RealTimeLog.log(ref);
          next(FireLoop.UNAUTHORIZED, ref);
        }
      },
      (ref: any, next: Function) => ref.destroy
        ? ref.destroy(input.data.id, next)
        : ref.removeById(input.data.id, next)
    ], (err: any) => FireLoop.publish(
      Object.assign({ err, input, removed: input.data }, ctx))
    );
  }
  /**
  * @method remove
  * @description
  * Publish gateway that will broadcast according the specific case.
  *
  * Context will be destroyed everytime, make sure the ctx passed is a
  * custom copy for current request or else bad things will happen :P.
  * WARNING: Do not pass the root context.
  **/
  static publish(ctx: any): void {
    // Response to the client that sent the request
    ctx.socket.emit(
      `${ctx.modelName}.value.result.${ctx.input.id}`,
      ctx.err ? { error: ctx.err } : ctx.data || ctx.removed
    );
    if (ctx.err) { return; }
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
  }
  /**
  * @method broadcast
  * @description
  * Announces a broadcast, emit data from changed or removed childs,
  * then it will clean the context.
  *
  * Context will be destroyed everytime, make sure the ctx passed is a
  * custom copy for current request or else bad things will happen :P.
  * WARNING: Do not pass the root context.
  **/
  static broadcast(event: string, ctx: any): void {
    RealTimeLog.log(`FireLoop ${event} broadcasting`);
    if (event.match(/(child_changed|child_removed)/)) {
      FireLoop.driver.emit(`${ctx.modelName}.${event}.broadcast`, ctx.data || ctx.removed);
    }
    FireLoop.driver.emit(`${ctx.modelName}.${event}.broadcast.announce`, 1);
    ctx = null;
  }
  /**
  * @method setupBroadcast
  * @description
  * Setup the actual broadcast process, once it is announced byt the broadcast method.
  *
  * Anyway, this setup needs to be done once and prior any broadcast, so it is
  * configured when the connection is made, before any broadcast announce.
  **/
  static setupBroadcast(event: string, ctx: any): void {
    if (!event.match(/(value|changes|child_added)/)) { return; }
    RealTimeLog.log(`FireLoop setting up: ${ctx.modelName}.${event}.broadcast.request`);
    ctx.socket.on(`${ctx.modelName}.${event}.broadcast.request`, (filter: any) => {
      let _filter: any = Object.assign({}, filter);
      RealTimeLog.log(`FireLoop ${event} broadcast request received: ${JSON.stringify(_filter)}`);
      let broadcast: Function = (err: any, data: any) => {
        if (err) RealTimeLog.log(`FireLoop server error: ${JSON.stringify(err)}`);
        if (event === 'value' || event === 'changes') {
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

      let remoteMethod: { name: string, aliases: string[] } = { name: 'find', aliases: [] };

      if (ctx.modelName.match(/\./g)) {
        FireLoop.getReference(ctx.modelName, ctx.input, (ref: any) => {
          if (!ref) {
            ctx.socket.emit(`${ctx.modelName}.${event}.broadcast`, { error: 'Scope not found' });
          } else {
            ref.checkAccess(
              ctx.socket.token,
              null,
              remoteMethod,
              {},
              function (err: any, access: boolean) {
                if (access) {
                  ref(_filter, broadcast);
                } else {
                  broadcast(FireLoop.UNAUTHORIZED);
                }
            });
          }
        });
      } else {
        ctx.Model.checkAccess(
          ctx.socket.token,
          null,
          remoteMethod,
          {},
          function (err: any, access: boolean) {
            if (access) {
              ctx.Model.find(_filter, broadcast);
            } else {
              broadcast(FireLoop.UNAUTHORIZED);
            }
         });
      }
    });
  }
}
