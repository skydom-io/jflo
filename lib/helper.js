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

module.exports = {
    print_help: print_help,
    common_parameters: COMMON_CLI_PARAMS
};