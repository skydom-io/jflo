/**
 @module util
 @author mtarkiai
 @since 2/10/15
 */

function openStream(uri, mode) {
    if (!uri) {
        return {in: null, out: null};
    }
    var url = URL.parse(uri);
    if (!url.protocol) {
        try {
            switch (mode) {
                case 'read':
                    return {in: fs.createReadStream(uri) };
                case 'write':
                    return {out: fs.createWriteStream(uri) };
                case 'duplex':
                    return {
                        in: fs.createReadStream(uri),
                        out: fs.createWriteStream(uri)
                    }
            }
        }
        catch (err) {
            return {in: null, out: null};
        }
    }
    else if ((url.protocol == 'tcp:') && url.hostname && url.port ) {

        var client = net.connect(url.port, url.hostname,
            function() { //'connect' listener
                console.error("Connected to" + url.format());
            });
        return {
            in: client,
            out: client
        }
    }
    else {
        return { in: null, out: null};
    }
}

module.exports = {
    openStream: openStream
}