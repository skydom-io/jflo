var extend      = require('util')._extend,
    split       = require('split'),
    yargs       = require('yargs'),
    eventstream = require('event-stream'),
    fs          = require('fs');

module.exports = function(jflo) {

    var basedir = process.cwd();

    var util = require('util'),
        loadPlugins = require('load-plugins'),
        yargs = require('yargs');

    // Load NPM plugins
    var plugins = loadPlugins('jflo-*', {string: 'jflo'});
    // Load local plugins
    extend(plugins, loadPlugins('./lib/**/jflo-*', {strip: 'jflo'}));
    // Load jflofile.js

    try {
        // This will initialize
        require('./jflofile.js')(jflo);
    }
    catch (err) {
        // No output; jflofile is not mandatory
    }

    // Initialize modules
    for (var modname in plugins) {
        var jmod = jflo.module(modname);
        plugins[modname](jmod);
    }

    // Run
    var plugname = yargs.argv._[0],
        command = yargs.argv._[1] || '$default';


    var desc_column = 40;
    if (yargs.argv.help) {
        console.log("jflo: streaming JSON processor");
        console.log("------------------------------");
        console.log("Installed modules & flows:");
        for (var pname in jflo) {
            var jmod = jflo[pname];
            if (typeof jmod == 'function') {
                continue;
            }
            console.log("[Module jflo-" + pname + "]");
            for (var fname in jmod) {
                if (typeof jmod[fname] !== 'function') {
                    continue;
                }
                if (fname == 'flow') {
                    continue;
                }
                var cmdname = (fname == '$default') ? "" : fname;
                var flow = jmod.flow(fname);
                var cmd = "  jflo " + pname + " " + cmdname;
                var desc = ((flow._meta || {}).description || {}).title || "";
                console.log(cmd + Array(desc_column - cmd.length).join(' ') + desc)
            }
        }

        /*
        // Flow specific helper (config options)

        console.log("[" + meta.description.title + "] Registering flow " + name);
        console.log("Configuration options: ");
        var conf_options = flatten(meta.description.config);
        for (var opt in conf_options) {
            console.log("  --c." + opt + "=<value> (" + conf_options[opt] + ")");
        }
        */

        return;
    }
    if (plugname in jflo) {
        var flow;
        var plugin = jflo[plugname];
        if (typeof plugin == 'function') {
            flow = plugin;
        }
        else if (typeof plugin[command] == 'function') {
            flow = plugin[command];
        }
        if (flow) {
            var pipeline = flow(yargs.argv);

            var stdinput_stream, stdoutput_stream;
            if (yargs.argv.input) {
                stdinput_stream = fs.createReadStream(yargs.argv.input);
            }
            if (yargs.argv.output) {
                stdoutput_stream = fs.createWriteStream(yargs.argv.output);
            }
            (stdinput_stream || process.stdin)
                .pipe(split())
                .pipe(eventstream.through(function (line) {
                    try {
                        this.emit('data', JSON.parse(line));
                    } catch (err) {
                    }
                }))
                .pipe(pipeline)
                .pipe(eventstream.through(function(json) {
                    this.emit('data', JSON.stringify(json) + '\n')
                }))
                .pipe(stdoutput_stream || process.stdout);
        }
        else {
            console.error("Usage: jflo " + plugname + " [" + Object.keys(plugin).join("|") + "] {options}");
            return;
        }
    }
    else {
        console.error("Usage: jflo [module] [cmd] {options}");
    }
}