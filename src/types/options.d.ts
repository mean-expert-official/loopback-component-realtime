/**
 * @module OptionsInterface
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @description
 * 
 * This interface defines the contract to be used while passing options from end App and
 * throughout the entire @mean-expert/loopback-component-realtime module.
 */
export interface OptionsInterface {
  app    ?: any,
  server ?: any,
  debug   : boolean,
  auth   ?: boolean,
  secure  : boolean, 
  driver  : {
    url     ?: string,
    name     : string,
    options ?: {
      transports ?: string[],
      forceNew   ?: boolean,
      upgrade    ?: boolean,
      adapter    ?: {
        name: string,
        datasource: string
      }
    }
  };
  modules : Array<string>
}