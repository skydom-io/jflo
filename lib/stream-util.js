/**
 @module util
 @author mtarkiai
 @since 2/10/15
 */

var fs          = require('fs'),
    net         = require('net'),
    URL         = require('url'),
    duplexer    = require('duplexer'),
    stream      = require('stream');

function openStream(uri, mode) {
    if (!uri) {
        return null;
    }
    var url = URL.parse(uri);
    if (!url.protocol) {
        try {
            switch(mode) {
                case 'read':
                    return fs.createReadStream(uri);
                case 'write':
                    return fs.createWriteStream(uri);
                case 'duplex':
                    return duplexer(
                        fs.createWriteStream(uri),
                        fs.createReadStream(uri)
                    );
            }
        }
        catch (err) {
            return null;
        }
    }
    else if ((url.protocol == 'tcp:') && url.hostname && url.port ) {

        var client = net.connect(url.port, url.hostname,
            function() {
                // 'connect' listener
                // console.error("Connected to" + url.format());
            });
        return client;
    }
    else {
        return null;
    }
}

module.exports = {
    openStream: openStream
}