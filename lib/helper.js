/**
 @module helper.js
 @author mtarkiai
 @since 2/25/15
 */

var flatten     = require('flat');

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
    io: {
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

function print_help(jflo, Flow, classname, config) {

    config = config || {};
    var flow_prefix = (config.flow_path || "").split('.').join(' '),
        exeName = config.binary_name || 'jflo';

    if (!config.binary_name) {
        console.log("jflo: streaming ND-JSON processor");
    }
    else {
        console.log(config.binary_name + ':' + config.app_description || "");
    }
    console.log("---------------------------------");

    if (!Flow) {
        console.log("Installed commands:");

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

        function _list(path, node, commands) {
            if (typeof node == 'function' && node._meta) {
                var cmd = path.join(' ');
                if (cmd.indexOf(flow_prefix) == 0) {
                    cmd = cmd.slice(flow_prefix.length + 1);
                    var info = (node._meta || {}).info || {};
                    var desc = (info.project? info.project + ": ": "") + (info.title || "");
                    commands.push({text: format([cmd, desc]), project: info.project});
                }
            }
            else if (Object(node) === node) {
                for (var name in node) {
                    _list(path.concat(name), node[name], commands);
                }
            }
        }

        var commands = [];
        _list([exeName], jflo.flows, commands);
        commands.sort(function(a,b) { return a.project < b.project ? -1 : 1});
        commands.forEach(function(cmd) { console.log(cmd.text); });
        console.log("For command specific help, use " + exeName + " <flow> --help");
    }
    else {
        console.log("Command parameters for [" + [exeName, classname].join(' ') + "]:");
        var meta = (Flow._meta || {});
        var default_parameters = jflo.resolveConfig(classname, '$default').params || {};
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

module.exports = {
    print_help: print_help,
    common_parameters: COMMON_CLI_PARAMS
};