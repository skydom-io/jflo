var extend      = require('util')._extend,
    split       = require('split'),
    eventstream = require('event-stream'),
    stdout      = require('stdout-stream'),
    streamUtil  = require('./stream-util'),
    merge       = require('merge'),

    helper      = require('./helper'),
    std_formatters  = require('./formatters'),
    std_parsers     = require('./parsers');

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

    // Install built-in formatters
    std_formatters(jflo);
    // Install built-in parsers
    std_parsers(jflo);
}

/**
 * CLI executor
 * @param jflo
 */
function run(jflo) {

    var yargs = require('yargs');

    // Initialize plugins
    initialize(jflo);

    // Run
    var plugpath = yargs.argv._;
    var flow_class = plugpath.join('.');
    var Flow = jflo.get(flow_class);

    if (yargs.argv.help) {
        helper.print_help(jflo, Flow, flow_class);
        return;
    }

    if (typeof Flow == 'function' && Flow._meta) {

        var conf = {},
            inputs = {},
            outputs = {};

        // Open and bind standard streams.
        // TODO implement jflofile overrides
        var input = streamUtil.openStream(yargs.argv.stdin, 'read') || process.stdin;
        var output = streamUtil.openStream(yargs.argv.stdout, 'write') || stdout;
        var logger = streamUtil.openStream(yargs.argv.logger, 'write') || process.stderr;
        var metrics = streamUtil.openStream(yargs.argv.metrics, 'write') || process.stderr;

        // TODO: Resolve each --in.{name}, --out.{name}, --inout.{name} into streams
        // > config.ins = { n: openStream(v).in }
        // > config.outs = { n: openStream(v).out }
        var aux_ins = yargs.argv.in,
            aux_outs = yargs.argv.out,
            aux_inouts = yargs.argv.io;

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

        // Parse flow instance configuration parameters
        // TODO expose this so that API clients can access parameter cascading equally

        var flow_params = merge.recursive(
            jflo.getConfigParameters(flow_class, yargs.argv.profile || '$default') || {},
            conf,
            yargs.argv.c);


        // Match any declared parameters from _meta.config; allow shortcuts without 'c.' prefix
        for (var name in (Flow._meta.info || {}).params || {}) {
            if ((name in yargs.argv) && !(name in helper.common_parameters)) {
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
            in: inputs,
            out: outputs
        });

        var formatter = (yargs.argv.formatter && jflo.formatters[yargs.argv.formatter] )
            || jflo.formatters.$default;
        var parser = (yargs.argv.parser && jflo.parsers[yargs.argv.parser])
            || jflo.parsers.$default;

        // Run it
        input
            .pipe(parser())
            .pipe(flow)
            .pipe(formatter())
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