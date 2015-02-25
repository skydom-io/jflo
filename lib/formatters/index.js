/**
 @module index.js
 @author mtarkiai
 @since 2/25/15
 */

var eventstream = require('event-stream');

function NDJsonFormat(line_prefix) {
    line_prefix = line_prefix || "";
    return eventstream.through(function(json) {
        this.emit('data', line_prefix + JSON.stringify(json) + '\n')
    });
}

module.exports = function(jflo) {
    jflo.formatter('$default', NDJsonFormat, {});
    jflo.formatter('ndjson', NDJsonFormat, {});
}