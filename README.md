
# LoopBack Component Real-Time

A [LoopBack Framework](http://loopback.io) Component that provides publish events over WebSockets.

This module will supersedes the [LoopBack Component PubSub](https://github.com/mean-expert-official/loopback-component-pubsub) and implements the new [FireLoop Module](http://fireloop.io).

# Installation

````sh
$ npm install --save @mean-expert/{loopback-sdk-builder,loopback-component-realtime}
````

# Setup Back End Module

Update the  `server/component-config.json` as follows:

````json
{
  "loopback-component-explorer": {
    "mountPath": "/explorer"
  },
  "@mean-expert/loopback-component-realtime": {
    "debug": true,
    "auth": true,
    "driver": {
      "name": "socket.io"
    }
  }
}

````

Update the  `server/model-config.json` as follows:

````json
{
    "mixins": [
        "loopback/common/mixins",
        "loopback/server/mixins",
        "../common/mixins",
        "./mixins",
        "../node_modules/@mean-expert/loopback-component-realtime/dist/mixins"
    ]
}
````

# Enable Model to use FireLoop API

From version `1.0.0-rc.8` you need to specify in which models you want to enable FireLoop events to be sent.

>Explanation: In an attempt to enable server and rest triggered events a new mixin has been introduced, this will trigger events either from REST calls or from the NodeJS Api e.g. Model.create().

`NOTE: Due a LoopBack limitation the server triggered events are only available for root model methods (Model.create()), but it won't work for relationship methods, these will continue being executed only from FireLoop Child References in the Front-End`

````json
{
  "mixins": {
    "FireLoop": true
  }
}
````

# Update Server
To propagate the App from LoopBack to FireLoop, so to finalize just update the file `server/server.js` by editing the `app.start` method as follow:

````js
app.start = function() {
  // start the web server
  var server = app.listen(function() {
    app.emit('started', server);
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
  return server;
};
````


# PRESENTING FIRELOOP.IO (NEW)
[![FireLoop.io](https://storage.googleapis.com/mean-expert-images/fireloop-logo.png)](https://github.com/mean-expert-official/fireloop.io/wiki)

# Generate FireLoop Angular 2 Client
FireLoop Client for Angular 2 Applications are built in when generating your LoopBack SDK. Read the [Following Instructions](https://github.com/mean-expert-official/loopback-sdk-builder/wiki/1.-Install-Builder-&-Build-SDK) in order to automatically generate your software development kit.