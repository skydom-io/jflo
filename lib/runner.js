var extend      = require('util')._extend,
    split       = require('split'),
    eventstream = require('event-stream'),
    fs          = require('fs'),
    stdout      = require('stdout-stream'),
    Base58      = require('base58');

function generate_id() {
    var large_number = parseInt(Math.random() * 100000000);
    return Base58.encode(large_number);
}

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

function NDJsonFormat() {
    return eventstream.through(function(json) {
        this.emit('data', JSON.stringify(json) + '\n')
    });
}

function initialize(jflo) {
    var loadPlugins = require('load-plugins'),
        yargs = require('yargs');

    try {
        // This will initialize from the local jflofile
        var local = loadPlugins('./jflofile.js');
        if (typeof local.jflofile == 'function') {
            local.jflofile(jflo);
        }
    }
    catch (err) {
        // No output; jflofile is not mandatory
        console.log(err);
    }
    // Load NPM plugins
    jflo.include([
        'jflo-*',
        './lib/**/jflo-*'
    ]);
}

/**
 * CLI executor
 * @param jflo
 */
function run(jflo) {
    var basedir = process.cwd();
    var yargs = require('yargs');

    // Initialize plugins
    initialize(jflo);

    // Run
    var plugpath = yargs.argv._;

    var desc_column = 40;

    if (yargs.argv.help) {
        console.log("jflo: streaming JSON processor");
        console.log("------------------------------");
        console.log("Installed flows:");

        function _list(path, node) {
            if (typeof node=='function' && node._meta) {
                var cmd = "  " + path.join(' ');
                var desc = ((node._meta || {}).description || {}).title || "";
                console.log(cmd + Array(desc_column - cmd.length).join(' ') + desc);
            }
            else if (Object(node) === node) {
                for (var name in node) {
                    _list(path.concat(name), node[name]);
                }
            }
        }

        _list(['jflo'], jflo);

        return;
    }

    var flow_class = plugpath.join('.');
    var Flow = jflo.get(flow_class);

    if (typeof Flow == 'function' && Flow._meta) {

        var flow = Flow.create({
            template: yargs.argv.template || '$default',
            params: yargs.argv.c || {}
        });

        // TODO: Resolve each --i(nput).{name} and --o{output}.{name} into streams
        // > config.ins = { n: fs.createReadStream(v) }
        // > config.outs = { n: fs.createWriteStream(v) }

        // TODO: Shortcut declared parameters: --c.{pname} === {pname}

        var input = yargs.argv.input ? fs.createReadStream(yargs.argv.input) : process.stdin;
        var output = yargs.argv.output ? fs.createWriteStream(yargs.argv.output) : stdout;

        input
            .pipe(NDJsonParse())
            .pipe(flow)
            .pipe(NDJsonFormat())
            .on('end', function _end() {
                output.end();
            })
            .pipe(output);

            output.on('finish', function() {
                setTimeout(process.exit, 100);
            })

        // Route metrics sink to stderr
        jflo.metrics.pipe(eventstream.through(function(data) {
            console.error("METRICS> " + JSON.stringify(data));
        }));

        // Route log sink to stderr
        jflo.logger.pipe(eventstream.through(function(data) {
            console.error("LOG> " + JSON.stringify(data));
        }))
    }

    else if (flow === Object(flow)) {
        console.error("Usage: " + ['jflo'].concat(plugpath).join(' ') + ' '
        + Object.keys(flow).join('|') + ' [options]');
    }
    else {
        console.error("Usage: jflo [flow]|[module flow] [options]");
        return;
    }

}

module.exports = {
    run: run,
    initialize: initialize
}