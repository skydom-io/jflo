var extend      = require('util')._extend,
    split       = require('split'),
    eventstream = require('event-stream'),
    stdout      = require('stdout-stream'),
    streamUtil  = require('./stream-util'),
    merge       = require('merge'),
    path        = require('path'),

    helper      = require('./helper'),
    std_formatters  = require('./formatters'),
    std_parsers     = require('./parsers');

var IS_INITIALIZED = false,
    _jfloInstance;

function initialize(jflo) {
    if (IS_INITIALIZED) {
        return;
    }
console.log('Running in ' + process.cwd())
    try {
        var localConfig = require(path.resolve('jflofile.js'));
        // This will initialize from the local jflofile
        // var local = loadPlugins('./jflofile.js');
        if (typeof localConfig == 'function') {
            console.log("Registering local jflofile");
            localConfig(jflo);
        }

    }
    catch (err) {
        // No output; jflofile is not mandatory
        console.log(err);
    }

    // Load NPM plugins
    jflo.include([
        'jflo-*',
        './lib/**/jflo-*',
        './node_modules/jflo-*'
    ]);

    // Install built-in formatters
    std_formatters(jflo);
    // Install built-in parsers
    std_parsers(jflo);

    _jfloInstance = jflo;
    IS_INITIALIZED = true;
}

/**
 * CLI executor
 * @param jflo
 */
function run(jflo) {

    var yargs = require('yargs'),
        argv = yargs.argv;

    jflo = jflo || _jfloInstance;
    // Initialize plugins
    initialize(jflo);

    // Run
    var plugpath = argv._;
    var flow_class = plugpath.join('.');

    var Flow = jflo.flow(flow_class);


    if (argv.help) {
        helper.print_help(jflo, Flow, flow_class);
        return;
    }

    if (typeof Flow == 'function' && Flow._meta) {

        var inputs = {},
            outputs = {};

        // First, expand argv.**$ (deserialize JSON values)

        // Read flow defined and user defined configuration defaults {cli,params}
        var config_cli = (jflo.resolveConfig(flow_class, argv.profile || '$default') || {}).cli || {};

        // For each of config.cli.[stdin,stdout,stderr,logger,metrics,ctrl,in.*,out.*,io.*] DO:
        // - Convert url-only strings to {url,parser/formatter,parserArgs/formatterArgs} objects
        // - Next, convert argv.[stdin,stdout,stderr,logger,metrics,ctrl,in.*,out.*,io.*] accordingly
        // - Finally, override config.cli with argv values

        var cli_args = _expandSerializedJSON(argv);

        // Open and bind standard streams.
        // TODO implement jflofile overrides
        // TODO handle object format: { url, parser, parserArgs} { url, formatter, formatterArgs }
        var input = streamUtil.openStream(argv.stdin, 'read') || process.stdin;
        var output = streamUtil.openStream(argv.stdout, 'write') || stdout;
        var logger = streamUtil.openStream(argv.logger, 'write') || process.stderr;
        var metrics = streamUtil.openStream(argv.metrics, 'write') || process.stderr;

        // TODO: Resolve each --in.{name}, --out.{name}, --inout.{name} into streams
        // > config.ins = { n: openStream(v).in }
        // > config.outs = { n: openStream(v).out }
        var aux_ins = argv.in,
            aux_outs = argv.out,
            aux_inouts = argv.io;

        var bind_opts = {
            parser: jflo.parsers.$default,
            formatter: jflo.formatters.$default,
            null: jflo.null
        };

        if (Object(aux_ins) === aux_ins) {
            _bind_aux_streams(aux_ins, inputs, 'read', bind_opts);
        }

        if (Object(aux_outs) === aux_outs) {
            _bind_aux_streams(aux_outs, outputs, 'write', bind_opts);
        }

        if (Object(aux_inouts) === aux_inouts) {
            _bind_aux_streams(aux_inouts, [inputs, outputs], 'duplex', bind_opts);
        }

        jflo.metrics.pipe(jflo.formatters.ndjson("metrics> ")).pipe(metrics);
        jflo.logger.pipe(jflo.formatters.ndjson("log> ")).pipe(logger);



        // Compile flow initialization parameters
        var explicit_parameters = argv.c || {};
        // Add shortcuts; known & non-conflicted --{name} will be accepted instead of --c.{name}
        var known_shortcuts = {};
        for (var name in (Flow._meta.info || {}).params || {}) {
            if ((name in cli_args) && !(name in helper.common_parameters)) {
                known_shortcuts[name] = cli_args[name];
            }
        }
        merge.recursive(explicit_parameters, known_shortcuts);
        // Add nameless parameters
        explicit_parameters._ = argv._.slice(Flow._meta.name.split('.').length);

        // Instantiate flow
        var flow = Flow({
            id: argv.id,
            profile: cli_args.profile, // defaults to $default
            params: explicit_parameters,
            in: inputs,
            out: outputs
        });

        var formatter = (argv.formatter && jflo.formatters[argv.formatter] )
            || jflo.formatters.$default;
        var parser = (argv.parser && jflo.parsers[argv.parser])
            || jflo.parsers.$default;

        // Run it
        input
            .pipe(parser())
            .pipe(flow)
            .pipe(formatter())
            .on('end', function _end() {
                output.end(function() {
                    setTimeout(function() {
                        process.exit(0);
                    }, 1000);
                });
            })
            .pipe(output);
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

/**
 * Tries to open file/pipe/socket streams as requested (forcing quasi-duplex).
 * Binds them to the provided hashes (pools)
 * @param stream_names
 * @param pools
 * @param mode
 * @private
 */
function _bind_aux_streams(stream_names, pools, mode, opts) {
    pools = [].concat(pools);

    for (var name in stream_names) {
        var raw = streamUtil.openStream(stream_names[name], mode);
        var reader, writer;

        if (raw && raw.readable) {
            reader = opts.parser();
            raw.pipe(reader);
        }
        else {
            reader = opts.null();
        }
        if (raw && raw.writable) {
            writer = opts.formatter(),
            writer.pipe(raw);
        }
        else {
            writer = opts.null();
        }

        var duplex = eventstream.duplex(writer, reader);

        pools.forEach(function(pool) {
            pool[name] = eventstream.duplex(writer, reader);
        });
    }
}

module.exports = {
    run: run,
    initialize: initialize
}