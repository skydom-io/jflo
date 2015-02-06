/**
 @module index.js
 @author mtarkiai
 @since 2/5/15
 */

var jflo = {

    flow: function(name, stream_generator, meta) {
        var yargs = require('yargs');

        if (typeof name == 'function') {
            // Name missing
            meta = stream_generator;
            stream_generator = name;
            name = "$default";
        }
        meta = meta || {};
        console.log("[" + meta.description.title + "] Registering flow " + name);
        console.log("Configuration options: ");
        var conf_options = flatten(meta.description.config);
        for (var opt in conf_options) {
            console.log("  --c." + opt + "=<value> ("+conf_options[opt]+")");
        }

        console.log("Command-line arguments:")
        var fargs = flatten(yargs.argv);
        for (var opt in fargs) {
            console.log("  " + opt + "=" + fargs[opt]);
        }
    }
}

function flatten(obj) {
    var res = {};
    (function recurse(obj, current) {
        for (var key in obj) {
            var value = obj[key];
            var newKey = (current ? current + "." + key : key);  // joined key with dot
            if (value && typeof value === "object") {
                recurse(value, newKey);  // it's a nested object, so do it again
            } else {
                res[newKey] = value;  // it's not an object, so set the property
            }
        }
    })(obj);
    return res;
}

/**
 *
 * JFlo declarative initialization
 */
jflo.flow(
    "$default",
    function(config) {
        console.log("jflo-route initialized all right");
    },
    {
        description: {
            title: "Multiple-path packet router",
            config: {
                predicate: "JS function controlling routing logic",
                expression: "JS expression used to create to routing function",
                out: {
                    "<index_or_alias>": {
                        "<variable>": "State variable for a specific output branch"
                    }
                }
            }
        },
        configs: {
            default: {
            },
            wacky: {
            }
        }
    });

module.exports = function(config) {
    console.log("jflo-route initialized all right");
}


module.exports._description = "Multiple-path packet router"