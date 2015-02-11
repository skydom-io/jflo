var extend      = require('util')._extend,
    split       = require('split'),
    eventstream = require('event-stream'),
    stdout      = require('stdout-stream'),
    streamUtil  = require('./stream-util'),
    merge       = require('merge');

const COMMON_CLI_PARAMS = {
    id: {
        params: ['<value>'],
        desc: "User assigned identifier for the flow instance"
    },
    stdin: {
        params: ['<src>'],
        desc: "Binds standard input to a file/pipe/socket"
    },
    stdout: {
        params: ['<dest>'],
        desc: "Binds standard output to a file/pipe/socket"
    },
    stderr: {
        params: ['<dest>'],
        desc: "Binds standard error to a file/pipe/socket"
    },
    logger: {
        params: ['<dest>'],
        desc: "Binds logger output to a file/pipe/socket"
    },
    metrics: {
        params: ['<dest>'],
        desc: "Binds instrumentation output to a file/pipe/socket"
    },
    in: {
        ext: ".<name>",
        params: ['<src>'],
        desc: "Binds the named auxiliary input to a file/pipe/socket"
    },
    out: {
        ext: ".<name>",
        params: ['<dest>'],
        desc: "Binds the named auxiliary output to a file/pipe/socket"
    },
    inout: {
        ext: ".<name>",
        params: ['<dest>'],
        desc: "Duplex binds the named input/output to a pipe or socket"
    },
    profile: {
        params: ['<name>'],
        desc: "Uses initialization parameter values from the named profile"
    },
    c: {
        ext: ".<name>",
        params: ['<value>'],
        desc: "Uses <name>:<value> as a flow-specific initialization parameter"
    },
    formatter: {
        params: ['<name>'],
        desc: 'Custom formatter (serializer) to use for output(s)'
    },
    parser: {
        params: ['<name>'],
        desc: 'Custom parser (deserializer) to use for input(s)'
    }
};

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
    var flow_class = plugpath.join('.');
    var Flow = jflo.get(flow_class);

    if (yargs.argv.help) {
        print_help(jflo, Flow, flow_class);
        return;
    }

    if (typeof Flow == 'function' && Flow._meta) {

        var flow_params = merge.recursive(
            jflo.getConfigParameters(flow_class, yargs.argv.profile || '$default') || {},
            yargs.argv.c);

        // Match any declared parameters from _meta.config; allow shortcuts without 'c.' prefix
        for (var name in (Flow._meta.info || {}).params || {}) {
            if ((name in yargs.argv) && !(name in COMMON_CLI_PARAMS)) {
                var obj = {};
                obj[name] = yargs.argv[name];
                flow_params = merge.recursive(flow_params, obj);
            }
        }
        // TODO: Shortcut declared parameters: --c.{pname} === {pname}

        var flow = Flow({
            id: yargs.argv.id,
            params: flow_params,
            ins: {},
            outs: {}
        });


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

function print_help(jflo, Flow, classname) {
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
            else {
                out += " ";
            }
            out += strings[index];
        }
        return out;
    }

    function _list(path, node) {
        if (typeof node=='function' && node._meta) {
            var cmd = path.join(' ');
            var desc = ((node._meta || {}).info || {}).title || "";
            var desc = ((node._meta || {}).info || {}).title || "";
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
    for (var p in COMMON_CLI_PARAMS) {
        var pd = COMMON_CLI_PARAMS[p];
        console.log(format(['--' + p + (pd.ext || "") + " " + (pd.params || []).join(' '), pd.desc || "" ]));
    }

    if (Flow && classname) {
        console.log("Flow parameters [" + classname + "]:");
        var meta = (Flow._meta || {});
        var default_parameters = jflo.getConfigParameters(classname, '$default');
        for (var p in (meta.info || {}).params) {
            var default_value = default_parameters[p];
            console.log(format([
                '--[c.]' + p + " <value>",
                Flow._meta.info.params[p],
                default_value ? "(default: " + default_value + ")" : ""]));
        }
    }
}

module.exports = {
    run: run,
    initialize: initialize
}