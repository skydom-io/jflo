var extend      = require('util')._extend,
    split       = require('split'),
    eventstream = require('event-stream'),
    fs          = require('fs'),
    stdout      = require('stdout-stream'),
    Base58      = require('base58'),
    net         = require('net'),
    URL         = require('url'),
    streamUtil  = require('./stream-util');

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

function NDJsonFormat(line_prefix) {
    line_prefix = line_prefix || "";
    return eventstream.through(function(json) {
        this.emit('data', line_prefix + JSON.stringify(json) + '\n')
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

    if (yargs.argv.help) {
        console.log("jflo: streaming ND-JSON processor");
        console.log("---------------------------------");
        console.log("Installed flows:");

        function format(strings, tabs) {
            tabs = tabs || [3, 40];
            var out  = "";
            for (var index in strings) {
                var tab = tabs[index] || 0;
                if (tab > out.length) {
                    out += new Array(tab-out.length).join(" ");
                }
                out += strings[index];
            }
            return out;
        }

        function _list(path, node) {
            if (typeof node=='function' && node._meta) {
                var cmd = path.join(' ');
                var desc = ((node._meta || {}).description || {}).title || "";
                console.log(format([cmd, desc]));
            }
            else if (Object(node) === node) {
                for (var name in node) {
                    _list(path.concat(name), node[name]);
                }
            }
        }

        _list(['jflo'], jflo);

        console.log("Common parameters: ");
        console.log(format(["--stdin <src>", "Binds standard input to a file/pipe/socket"]));
        console.log(format(["--stdout <dest>", "Binds standard output to a file/pipe/socket"]));
        console.log(format(["--stderr <dest>", "Binds standard error to a file/pipe/socket"]));
        console.log(format(["--logger <dest>", "Binds logger output to a file/pipe/socket"]));
        console.log(format(["--metrics <dest>", "Binds instrumentation output to a file/pipe/socket"]));
        console.log(format(["--in.<name> <src>", "Binds the named aux input to a file/pipe/socket"]));
        console.log(format(["--out.<name> <dest>", "Binds the named aux output to a file/pipe/socket"]));
        return;
    }

    var flow_class = plugpath.join('.');
    var Flow = jflo.get(flow_class);

    if (typeof Flow == 'function' && Flow._meta) {

        var flow = Flow({
            template: yargs.argv.template || '$default',
            params: yargs.argv.c || {}
        });

        // TODO: Shortcut declared parameters: --c.{pname} === {pname}

        var input = streamUtil.openStream(yargs.argv.stdin, 'read').in || process.stdin;
        var output = streamUtil.openStream(yargs.argv.stdout, 'write').out || stdout;
        var logger = streamUtil.openStream(yargs.argv.logger, 'write').out || process.stderr;
        var metrics = streamUtil.openStream(yargs.argv.metrics, 'write').out || process.stderr;
        // TODO: Resolve each --in.{name}, --out.{name}, --inout.{name} into streams
        // > config.ins = { n: openStream(v).in }
        // > config.outs = { n: openStream(v).out }

        jflo.metrics.pipe(NDJsonFormat("metrics> ")).pipe(metrics);
        jflo.logger.pipe(NDJsonFormat("log> ")).pipe(logger);

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
        });
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