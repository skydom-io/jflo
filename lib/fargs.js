/**
 @module fargs.js
 @author mtarkiai
 @since 2/8/15
 */

module.exports = function(a) {
    var args = Array.prototype.slice(a);

    args.first = function(predicate) {
        return args.filter(predicate).shift();
    }

    args.last = function(predicate) {
        return args.filter(predicate).pop();
    }

    var writableStreams = [];
    var readableStreams = [];
    var allStreams = [];
    var functions = [];
    var objects = [];

    args.forEach(function(a) {
        if (typeof a.pipe == 'function') {
            if (a.writable == true) {
                writableStreams.push(a);
            }
            if (a.readable == true) {
                readableStreams.push(a);
            }
        }
        else if (typeof a == 'function') {
            functions.push(a);
        }
        else if (Object(a) === a) {
            objects.push(a);
        }
    });

    return args;
}