"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var io_driver_1 = require("./io.driver");
var DriverFactory = (function () {
    function DriverFactory() {
    }
    DriverFactory.load = function (name) {
        var driver;
        switch (name) {
            case 'socket.io':
                driver = new io_driver_1.IODriver();
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
    };
    return DriverFactory;
}());
exports.DriverFactory = DriverFactory;
//# sourceMappingURL=/Volumes/HD710M/development/www/mean.expert/@mean-expert/loopback-component-realtime/src/drivers/factory.js.map