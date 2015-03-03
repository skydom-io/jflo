/**
 @module index.js
 @author mtarkiai
 @since 2/23/15
 */

/**
 * Drills into a data structure with a flattened key ("my.nested.field")
 * @param data
 * @param flat_key
 * @returns {*}
 * @private
 */
function get_flat(data, flat_key) {
    return flat_key ? _get(data, flat_key.split('.')) : undefined;
    function _get(data, key_parts) {
        if (!(key_parts[0] || "").length) {
            return data;
        }
        else if (Object(data) !== data) {
            return undefined; // cannot drill down
        }
        var first = key_parts.shift();
        return _get(data[first], key_parts);
    }
}

function set_flat(data, flat_key, value) {
    return flat_key ? _set(data, flat_key.split('.'), value) : undefined;

    function _set(data, key_parts, value) {
        if (Object(data) !== data) {
            return undefined;
        }
        else if (key_parts.length == 1) {
            data[key_parts[0]] = value;
            return value;
        }
        else {
            var first = key_parts.shift();
            return _set(data, key_parts, value);
        }
    }
}

module.exports = {
    fget: get_flat,
    fset: set_flat
};