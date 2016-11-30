/**
 * @module SubscriptionInterface
 * @author Jonathan Casarrubias <t:@johncasarrubias, gh:github.com/mean-expert-official>
 * @description
 * 
 * This interface defines the contract to be used while passing subscriptions from end App and
 * throughout the entire @mean-expert/loopback-component-realtime module.
 */
export interface SubscriptionInterface {
  id    : number,
  scope : string,
  relationship: string
}