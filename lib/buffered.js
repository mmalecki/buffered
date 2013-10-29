var util = require('util'),
    Stream = require('stream');

module.exports = function () {
  return new BufferedStream;
};

var BufferedStream = module.exports.BufferedStream = function (options) {
  this.ended = false;
  this.piped = false;
  this.chunks = [];
  this.readable = true;
  this.writable = true;

  if(options && options.explicit) { this.explicit = true; }

  Stream.call(this);
};
util.inherits(BufferedStream, Stream);

BufferedStream.prototype.pipe = function (dest, options) {
  var self = this;

  Stream.prototype.pipe.call(self, dest, options);

  if (self.piped && !self.explicit) {
    //
    // Avoid emitting `data` event for all chunks more than once when piping
    // to many streams.
    //
    return dest;
  }

  process.nextTick(function () {
    var chunk, i;
    for(i = 0; i < self.chunks.length; i++) {
      self.emit('data', self.chunks[i]);
    }

    if(!self.explicit) {
      self.free();
    }
  });

  self.piped = true;
  return dest;
};

BufferedStream.prototype.free = function() {
  delete this.chunks;
  
  if(this.ended) {
    this.readable = false;
    this.writable = false;
    this.emit('end');
    this.emit('close');
  }
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
