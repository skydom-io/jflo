/**
 @module index.js
 @author mtarkiai
 @since 2/25/15
 */

var eventstream = require('event-stream');
var yaml        = require('js-yaml');

function NDJsonFormat(line_prefix) {
    line_prefix = line_prefix || "";
    return eventstream.through(function(json) {
        this.emit('data', line_prefix + JSON.stringify(json) + '\n')
    });
}

function JsonPrettyPrinter(object_delimiter) {
    object_delimiter = object_delimiter || "";
    return eventstream.through(function(json) {
        this.emit('data', JSON.stringify(json,null,3) + '\n' + object_delimiter);
    })
}

function YamlFormatter() {
    return eventstream.through(function(json) {
        this.emit('data', yaml.dump(json));
    })
}

module.exports = function(jflo) {
    jflo.formatter('$default', NDJsonFormat, {});
    jflo.formatter('ndjson', NDJsonFormat, {});
    jflo.formatter('jsonpp', JsonPrettyPrinter, {});
    jflo.formatter('yaml', YamlFormatter, {});
}