import { IODriver } from './io.driver';
import { DriverInterface } from '../types/driver';
import { OptionsInterface } from '../types/options';

export class DriverFactory {

  static load(name: string): DriverInterface {

    let driver: DriverInterface;

    switch (name) {
      case 'socket.io':
       driver = <DriverInterface> new IODriver();
      break;
      /*
      case 'kafka':
       driver = <DriverInterface> new KafkaDriver();
      break;
      */
      default:
      break;
    }

    return driver;
  }
}
