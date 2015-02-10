/**
 @module jflo
 @author mtarkiai
 @since 2/6/15
 */

var eventstream = require('event-stream'),
    extend      = require('util')._extend,
    Base58      = require('base58'),
    loadPlugins = require('load-plugins');

function generate_id() {
    var large_number = parseInt(Math.random() * 100000000);
    return Base58.encode(large_number);
}

module.exports = (function() {

    function JFlo() {
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
        container[part] = stream_generator;
        container[part]._meta = meta;

        // Flow instance factory
        container[part].create = function create(config_template) {
            var example_config = {
                id: 'instance_id',
                ins: {}, // named input streams
                outs: {}, // named output streams
                profile: '$default', // named default config
                params: {
                    // Flow specific state parameters; will override config
                }
            }

            var config = {
                id: config_template.id || generate_id(),
                ins: config_template.ins || {},
                outs: config_template.outs || {},
                params: {}
            };

            // Copy named standard configuration parameters
            if (config_template.profile && meta.configs[config_template.profile]) {
                extend(config.params, meta.config[config_template.profile]);
            }
            // Copy specific configuration parameters
            extend(config.params, config_template.params || {});

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
            return flow_instance;
        }
        return this; // for .flow() chaining
    };


    JFlo.prototype.log = function(/* sender */ msg) {
        this.logger.write(msg);
    }

    JFlo.prototype.metrics = eventstream.through();
    JFlo.prototype.logger = eventstream.through();

    JFlo.prototype.getLogger = function(source) {
        var jflo = this;
        var logger =  eventstream.through(function(data) {
           if (Object(data) !== data) {
               data = { message: data };
           };
            data.sender = source;
            data.date = new Date();
            jflo.logger.write(data);
        });

        // Create helpers for logging levels
        ['info', 'warn', 'log','error','debug'].forEach(function(level) {
            logger[level] = eventstream.through(function(data) {
                if (Object(data)!== data) {
                    data = { message: data };
                }
                data.level = level;
                logger.write(data);
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

    return new JFlo();

})()