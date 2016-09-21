
# LoopBack Component Real-Time

A [LoopBack Framework](http://loopback.io) Component that provides publish events over WebSockets.

This module will supersede the [LoopBack Component PubSib] and will implement multiple Real-Time functionalities like PubSub or IO.

This module will also provide the ability to select a transportation driver like socket.io or kafka.

> IMPORTANT: This module is currently in alpha version and is not stable for production purposes.


# Installation

```sh
$ npm install --save @mean-expert/loopback-component-realtime
```

# Setup Module

Update the  `server/component-config.json` as follows:

```json
{
  "loopback-component-explorer": {
    "mountPath": "/explorer"
  },
  "@mean-expert/loopback-component-realtime": {
    "debug": true,
    "driver": {
      "name": "socket.io-client | kafka"
    },
    "modules": [
      "IO",
      "PubSub"
    ]
  }
}

```

Update the  `server/model-config.json` as follows:

```json
{
    "mixins": [
        "loopback/common/mixins",
        "loopback/server/mixins",
        "../common/mixins",
        "./mixins",
        "../node_modules/loopback-component-realtime/dist/mixins"
    ]
}
``