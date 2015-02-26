/**
 @module jflo
 @author mtarkiai
 @since 2/6/15
 */

var eventstream = require('event-stream'),
    Base58      = require('base58'),
    loadPlugins = require('load-plugins'),
    minimatch   = require('minimatch'),
    merge       = require('merge');

function generate_id() {
    var large_number = parseInt(Math.random() * 100000000);
    return Base58.encode(large_number);
}

module.exports = (function() {

    function JFlo() {
        this._configs = [];
        this.metrics = eventstream.through();
        this.logger = eventstream.through();
        this.parsers = {};
        this.formatters = {};
    }

    JFlo.prototype.get = function(name) {
        var parts = name.split('.'),
            container = this;
        while (parts.length > 1) {
            container = container[parts.shift()] || {};
            if (typeof container == 'function' && container._meta) {
                return container;
            }
        }
        return container[parts.shift()];
    }

    /**
     * Flow registration function
     * @param name
     * @param stream_generator
     * @param meta
     * @returns {*}
     */

    JFlo.prototype.flow = function (name, stream_generator, meta) {

        var jflo = this;

        if (typeof name == 'string' && !stream_generator) {
            return this.get(name);
        }

        meta = meta || {};

        var parts = name.split('.'),
            container = this;
        while(parts.length > 1) {
            var part = parts.shift();
            container[part] = container[part] || {};
            container = container[part];
        }

        part = parts.shift();
        // container[part] = stream_generator;

        // Flow instance factory
        container[part] = function create(config_template) {
            config_template = config_template || {};

            var config = {
                id: config_template.id || generate_id(),
                in: config_template.in || {},
                out: config_template.out || {},
                params: config_template.params || {}
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
        container[part]._meta = meta;
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
        ['info', 'warn', 'log','error','debug'].forEach(function(level) {
            logger[level] = eventstream.through(function(data) {
                logger.write(
                    merge(true, // Creates a clone
                        Object(data) === data ? data : { message: data },
                        {
                            level: level
                        })
                );
            })
        })

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
        patterns = [].concat(patterns);
        patterns.forEach(function(pattern) {
            var plugins = loadPlugins(pattern, {strip: 'jflo'});
            // Initialize modules
            for (var modname in plugins) {
                plugins[modname](self);
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
    JFlo.prototype.config = function(flowNamePattern, profile, params) {
        this._configs.push({pattern: flowNamePattern, profile: profile, params: params});
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

    /**
     * Merges together all the parameters for the given flowname and profile
     * @param flowname
     * @param profile
     */
    JFlo.prototype.getConfigParameters = function(flowname, profile) {
        var Flow = this.get(flowname);
        if (!Flow) {
            return null;
        }
        var params = ((Flow._meta || {}).configs || {})[profile] || {};
        this._configs.forEach(function(cd) {
            if (minimatch(flowname, cd.pattern) && minimatch(profile, cd.profile)) {
                params = merge.recursive(params, cd.params);
            }
        });
        return params;
    }
    return new JFlo();

})()