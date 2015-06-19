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
function get_flat(data, flat_key, options) {
    options = options || {};
    return flat_key ? _get(data, flat_key.split('.')) : undefined;
    function _get(data, key_parts) {
        if (typeof options.match == 'function') {
            // options.match defines an early detection gate; positive match will stop path traversal
            if (options.match(data)) {
                return data;
            }
        }
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
    flat_key && _set(data, flat_key.split('.'), value);

    return data;

    function _set(data, key_parts, value) {
        if (Object(data) === data) {
            var branch = key_parts.shift();
            if (key_parts.length) {
                data[branch] = data[branch] || {};
                _set(data[branch], key_parts, value);
            }
            else
                data[branch] = value;
        }
    }
}

/**
 * Computes a specificity index for a path
 * Splits a path into components
 * For each component, a non-wildcard token earns a 9 and a '*' earns a 1
 * First part has a weight of 0.1, then *0.1 for each consecutive part
 * @param path
 */
function specificityIndex(path) {
    if (!path) {
        return 0;
    }

    var parts = (path || "").split('.');
    var score = 0;
    for (var i=0; i<parts.length; i++) {
        var part = parts[i];
        var part_score;
        if (part.indexOf('*') == 0) {
            part_score = part.length == 1 ? 1 : 2;
        }
        else if (part.indexOf('*') > 0) {
            part_score = 3;
        }
        else if (part.indexOf('?') >= 0) {
            part_score = 4;
        }
        else {
            part_score = 9;
        }
        score += part_score * Math.pow(0.1, i+1);
    }
    return score;
}

module.exports = {
    fget: get_flat,
    fset: set_flat,
    computeSpecificityIndex: specificityIndex
};