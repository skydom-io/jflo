/**
 @module index.js
 @author mtarkiai
 @since 2/25/15
 */

var eventstream = require('event-stream'),
    split       = require('split');

function NDJsonParse() {
    return eventstream.pipeline(
        split(),
        eventstream.through(function (line) {
            try {
                this.emit('data', JSON.parse(line));
            } catch (err) {
            }
        })
    )
}

module.exports = {
    $default: NDJsonParse,
    ndjson: NDJsonParse
}