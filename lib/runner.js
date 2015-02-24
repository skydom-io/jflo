var extend      = require('util')._extend,
    split       = require('split'),
    eventstream = require('event-stream'),
    stdout      = require('stdout-stream'),
    streamUtil  = require('./stream-util'),
    merge       = require('merge'),
    flatten     = require('flat');

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
    ctrl: {
        params: ['<src>'],
        desc: "Binds runtime flow control input to to file/pipe/socket"
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
    c: [{
            ext: ".<my.prop.name>",
            params: ['<value>'],
            desc: "Initializes a flow state parameter; e.g. --c.color Red => {color:\"Red\",..}"
        },
        {
            ext: "[.<my.prop.name>]$",
            params: ['<json_str>'],
            desc: "Initializes flow state from JSON; e.g. --c$ '{\"color\": \"Red\"}' => {color:\"Red\",..}"
        }
    ],
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

        // Open and bind streams
        var input = streamUtil.openStream(yargs.argv.stdin, 'read').in || process.stdin;
        var output = streamUtil.openStream(yargs.argv.stdout, 'write').out || stdout;
        var logger = streamUtil.openStream(yargs.argv.logger, 'write').out || process.stderr;
        var metrics = streamUtil.openStream(yargs.argv.metrics, 'write').out || process.stderr;

        // TODO: Resolve each --in.{name}, --out.{name}, --inout.{name} into streams
        // > config.ins = { n: openStream(v).in }
        // > config.outs = { n: openStream(v).out }

        jflo.metrics.pipe(NDJsonFormat("metrics> ")).pipe(metrics);
        jflo.logger.pipe(NDJsonFormat("log> ")).pipe(logger);

        // Parse flow instance configuration parameters
        var conf = {};

        var flow_params = merge.recursive(
            jflo.getConfigParameters(flow_class, yargs.argv.profile || '$default') || {},
            conf,
            yargs.argv.c);


        // Match any declared parameters from _meta.config; allow shortcuts without 'c.' prefix
        for (var name in (Flow._meta.info || {}).params || {}) {
            if ((name in yargs.argv) && !(name in COMMON_CLI_PARAMS)) {
                var obj = {};
                obj[name] = yargs.argv[name];
                flow_params = merge.recursive(flow_params, obj);
            }
        }

        // Expand serialized JSON parameters (from c$ and argv.c.**$)
        try {
            flow_params = _expandSerializedJSON({c: flow_params, c$: yargs.argv.c$}).c;
        } catch (err) {
            console.error(err);
            process.exit();
        }

        // Instantiate flow
        var flow = Flow({
            id: yargs.argv.id,
            params: flow_params,
            ins: {},
            outs: {}
        });

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

    else if (Flow === Object(Flow)) {
        console.error("Usage: " + ['jflo'].concat(plugpath).join(' ') + ' '
        + Object.keys(Flow).join('|') + ' [options]');
    }
    else {
        console.error("Usage: jflo [flow]|[module flow] [options]");
        return;
    }
}

function print_help(jflo, Flow, classname) {

    console.log("jflo: streaming ND-JSON processor");
    console.log("---------------------------------");

    if (!Flow) {
        console.log("Installed flows:");

        function format(strings, tabs) {
            tabs = tabs || [3, 40];
            var out = "";
            for (var index in strings) {
                var tab = tabs[index] || 0;
                if (tab > out.length) {
                    out += new Array(tab - out.length).join(" ");
                }
                else {
                    out += " ";
                }
                out += strings[index];
            }
            return out;
        }

        function _list(path, node) {
            if (typeof node == 'function' && node._meta) {
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
        console.log("For flow specific help, use jflo <flow> --help");
    }
    else {
        console.log("Flow parameters for [jflo " + classname + "]:");
        var meta = (Flow._meta || {});
        var default_parameters = jflo.getConfigParameters(classname, '$default');
        var default_parameters_flat = flatten(default_parameters);
        var params_flat = flatten((meta.info || {}).params || {});
        for (var p in params_flat) {
            var default_value = default_parameters_flat[p];
            console.log(format([
                '--[c.]' + p + " <value>",
                params_flat[p],
                default_value ? "(default: " + default_value + ")" : ""]));
        }

        console.log("Common parameters: ");
        for (var p in COMMON_CLI_PARAMS) {
            var pda = COMMON_CLI_PARAMS[p];
            [].concat(pda).forEach(function(pd) {
                console.log(format(['--' + p + (pd.ext || "") + " " + (pd.params || []).join(' '), pd.desc || ""]));
            });
        }
    }
}

// Utility for recursively parsing <name>$: "json_string" into a <name>: <object>
function _expandSerializedJSON(obj) {

    if (Object(obj) !== obj) {
        return obj;
    }
    var expanded = Array.isArray(obj) ? [] : {};
    Object.keys(obj).forEach(function(key) {
        if (obj.hasOwnProperty(key) && (key.indexOf('$') == key.length-1)) {
            try {
                var stdkey = key.slice(0, key.length - 1);
                expanded[stdkey] = merge.recursive(
                    _expandSerializedJSON(obj[stdkey]),
                    obj.key ? JSON.parse(obj[key]) : {});

            } catch (err) {
                throw new Error("Parse error: could not parse JSON in " + obj[key]);
            }
        }
        else {
            expanded[key] = _expandSerializedJSON(obj[key]);
        }
    });
    return expanded;
}

module.exports = {
    run: run,
    initialize: initialize
}