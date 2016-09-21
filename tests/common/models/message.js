module.exports = function(Message) {
  Message.observe('after save', (ctx, next) => {
    Message.app.mx.IO.emit('new-message', ctx.instance);
    next();
  });
};
