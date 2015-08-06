#!/usr/bin/env node
'use strict'

var domain      = require('domain');
var jflo        = module.exports
                = require('../lib/jflo');

if (!module.parent) {
    domain.create()
        .on('error', function (err) {
            console.error("error> " + err);
            console.error(err.stack);
            setTimeout(process.exit);
        })
        .run(function () {
            process.title = 'jflo';
            require('../lib/runner').run(jflo);
        });
}
else {
    var jfloRuntime = require('../lib/runner');
    jfloRuntime.initialize(jflo);
    require('../lib/runner').initialize(jflo);
    jflo.run = jfloRuntime.run.bind(null, jflo);
    module.exports = jflo;
}
