/**
 @module jflo
 @author mtarkiai
 @since 2/6/15
 */

var eventstream = require('event-stream'),
    Base62      = require('base62'),
    path        = require('path'),
    globby      = require('globby'),
    minimatch   = require('minimatch'),
    merge       = require('merge'),
    jfutil      = require('./util');

function generate_id() {
    var large_number = parseInt(Math.random() * 100000000);
    return Base62.encode(large_number);
}

module.exports = (function() {

    function JFlo() {
        this._configs = [];
        this.flows = {};
        this.metrics = eventstream.through();
        this.logger = eventstream.through();
        this.parsers = {};
        this.formatters = {};
    }

    /**
     * Flow registration function
     * @param name
     * @param stream_generator
     * @param meta
     * @returns {*}
     */

    JFlo.prototype.flow = function (name, stream_generator, meta) {

        var fget = this.util.fget,
            fset = this.util.fset;

        if (!stream_generator) {
            // Return an existing flow
            return fget(this.flows, name, { match: function(x) { return typeof x == 'function'; }});
        }

        var jflo = this;

        // Flow instance factory
        var creator = function create(config_template) {

            config_template = config_template || {};

            var flow_params = merge.recursive(
                // NOW ResolveConfig contains {cli: {cli_defaults}, params: { param_defaults }}

                (jflo.resolveConfig(name, config_template.profile || '$default') || {}).params,
                config_template.params || {});

            var config = {
                id: config_template.id || generate_id(),
                in: config_template.in || {},
                out: config_template.out || {},
                params: flow_params
            };

            /*
            // Copy named standard configuration parameters
            if (config_template.profile && meta.configs[config_template.profile]) {
                extend(config.params, meta.configs[config_template.profile]);
            }
            // Copy specific configuration parameters
            extend(config.params, config_template.params || {});
            */

            // Create logger and metrics streams
            var flow_id = {
                class: name,
                id: config.id
            }

            // Instantiate logger & metrics streams
            config.logger = jflo.getLogger(flow_id);
            config.metrics = jflo.getInstrumentor(flow_id);

            // Go time!
            var flow_instance = stream_generator(config);
            flow_instance._config = config;
            // TODO wrap the stream inside a common $jflo control protocol handler
            // Handler responsibilities:
            // - Execute/dispatch @jflo control commands
            // - Execute @jflo routing functionalities (flow trace etc)
            // - Ensure inbound packets have @jflo headers
            // - Ensure outbound packets have @jflo headers

            return flow_instance;
        }
        // Attach Flow class metadata
        creator._meta = merge(true, meta || {}, { name: name});

        // Now store in this.flows
        fset(this.flows, name, creator);
        return this; // for .flow() chaining
    };

    JFlo.prototype.getLogger = function(source) {
        var jflo = this;
        var logger =  eventstream.through(function(data) {

            jflo.logger.write(
                merge(true, // Creates a clone
                    Object(data)===data ? data : { message: data },
                    {
                        sender: source,
                        date: new Date()
                    })
            );
        });

        // Create helpers for logging levels
        ['info', 'warn', 'log','error','debug'].forEach(
            function(level) {
                logger[level] = eventstream.through(function (data) {
                    logger.write(
                        merge(true, // Creates a clone
                            Object(data) === data ? data : {message: data},
                            {
                                level: level
                            })
                    );
                })
            });

        return logger;
    }

    JFlo.prototype.getInstrumentor = function(source) {
        var jflo = this;
        return eventstream.through(function(data) {
            data.dimensions = data.dimensions || {};
            data.dimensions.sender = source;
            jflo.metrics.write(data);
        });
    }

    JFlo.prototype.include = function(patterns) {
        var self = this;
        // Ensure it's an array (of string patterns)
        patterns = [].concat(patterns)
        var paths = globby.sync(patterns);
        paths.forEach(function(name) {
            try {
                var plugin = require(path.resolve(name));
                if (typeof plugin == 'function') {
                    plugin(self);
                }
            }
            catch (err) {
                console.error(err);
            }
        });

        return this; // for chaining
    }

    /**
     * Instructs JFlo to recursively apply the specified init param values to
     * all flows matching the name pattern and profile
     * @param flowNamePattern
     * @param profile
     * @param params
     */
    JFlo.prototype.config = function(flowNamePattern, profile, config) {
        this._configs.push({
            pattern: flowNamePattern,
            profile: profile,
            config: config
        });
    }

    /**
     * Declares a formatter/serializer for outputs
     * @param name
     * @param format_func
     * @param meta
     */
    JFlo.prototype.formatter = function(name, format_func, meta) {
        this.formatters[name] = format_func;
        this.formatters[name]._meta = meta;
    };

    /**
     * Declares a parser/deserializer for inputs
     * @param name
     * @param format_func
     * @param meta
     */
    JFlo.prototype.parser = function(name, parse_func, meta) {
        this.parsers[name] = parse_func;
        this.parsers[name]._meta = meta;
    };

    // Create a specificity comparison for configs
    // Flow name pattern specificity trumps profile name pattern specificity
    var COMPARE_SPECIFICITY = function(a,b) {
        var a_score = jfutil.computeSpecificityIndex(a.pattern) * 1000
            + jfutil.computeSpecificityIndex(a.profile);
        var b_score = jfutil.computeSpecificityIndex(b.pattern) * 1000
            + jfutil.computeSpecificityIndex(b.profile);
        return a_score - b_score;
    }

    /**
     * Merges together all the parameters for the given flowname and profile
     * @param flowname
     * @param profile
     */
    JFlo.prototype.resolveConfig = function(flowname, profile) {
        var Flow = this.flow(flowname);
        if (!Flow) {
            return null;
        }
        // Baseline on the built-in configurations
        var config = { params: ((Flow._meta || {}).configs || {})[profile] || {} };
        // Sort _configs in order of increasing specificity

        var sorted_configs = merge.clone(this._configs).sort(COMPARE_SPECIFICITY);

        sorted_configs.forEach(function(cd) {
            if (minimatch(flowname, cd.pattern) && minimatch(profile, cd.profile)) {
                config = merge.recursive(config, cd.config || {});
            }
        });
        return config;
    }


    // Re-export utility functions
    JFlo.prototype.util = require('./util');

    return new JFlo();

})()