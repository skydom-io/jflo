/**
 @module jflo
 @author mtarkiai
 @since 2/6/15
 */

module.exports = (function() {

    function JFlo() {

    }

    JFlo.prototype.module = function(name) {
        this[name] = this[name] || new JfloModule(name);
        return this[name];
    }

    function JfloModule(name) {
        this._name = name;
    }

    JfloModule.prototype.flow = function (name, stream_generator, meta) {

        if (typeof name == 'string' && !stream_generator) {
            return this[name];
        }

        if (typeof name == 'function') {
            // Name missing
            meta = stream_generator;
            stream_generator = name;
            name = "$default";
        }
        meta = meta || {};

        this[name] = stream_generator;
        this[name]._meta = meta;
        return this; // for .flow() chaining
    };


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

    return new JFlo();

})()