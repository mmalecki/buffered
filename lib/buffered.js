var util = require('util'),
    Stream = require('stream');

module.exports = function () {
  return new BufferedStream;
};

var BufferedStream = module.exports.BufferedStream = function () {
  this.ended = false;
  this.piped = false;
  this.chunks = [];
  this.readable = true;
  this.writable = true;

  Stream.call(this);
};
util.inherits(BufferedStream, Stream);

BufferedStream.prototype.pipe = function (dest, options) {
  var self = this;

  Stream.prototype.pipe.call(self, dest, options);

  if (self.piped) {
    //
    // Avoid emitting `data` event for all chunks more than once when piping
    // to many streams.
    //
    return dest;
  }

  process.nextTick(function () {
    var chunk;
    while (chunk = self.chunks.shift()) {
      self.emit('data', chunk);
    }
    delete self.chunks;

    if (self.ended) {
      self.readable = false;
      self.writable = false;
      self.emit('end');
      self.emit('close');
    }
  });

  self.piped = true;
  return dest;
};

BufferedStream.prototype.write = function (data) {
  if (this.chunks) {
    //
    // If we're still buffering, append chunk to the buffer.
    //
    this.chunks.push(data);
    return;
  }

  //
  // Otherwise behave like a pass thru stream and emit whatever gets written.
  //
  this.emit('data', data);
};

BufferedStream.prototype.end = function (data) {
  if (data) {
    this.write(data);
  }

  if (!this.chunks) {
    //
    // If there are no chunks left (we're not buffering anymore) close the
    // stream now...
    //
    this.readable = false;
    this.writable = false;
    this.emit('end');
    return this.emit('close');
  }
  //
  // ...otherwise delay `end` event until we finish piping.
  //
  this.ended = true;
};

BufferedStream.prototype.destroy = function () {
  this.writable = false;
  this.readable = false;

  delete this.chunks;
  this.emit('close');
};
