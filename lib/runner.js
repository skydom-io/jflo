module.exports = function() {
    var basedir = process.cwd();

    var util = require('util'),
        loadPlugins = require('load-plugins'),
        yargs = require('yargs');

    var plugins = loadPlugins('./lib/**/jflo-*', {strip: 'jflo'});
    var npm_plugins = loadPlugins('jflo-*', {strip: 'jflo'});
    for (p in npm_plugins) {
        plugins[p] = npm_plugins[p];
    }

    var plugname = yargs.argv._[0],
        command = yargs.argv._[1] || 'default';

    var desc_column = 40;
    switch(plugname) {
        case 'help':
            console.log("jflo: streaming JSON processor");
            console.log("------------------------------");
            console.log("Installed modules & commands:");
            for (var pname in plugins) {
                if (typeof plugins[pname] == 'function') {
                    var cmd = "  jflo " + pname;
                    var desc = plugins[pname]._description || ""
                    console.log(cmd + Array(desc_column-cmd.length).join(' ') + desc);
                }
                else {
                    for (var cname in plugins[pname]) {
                        cmd = "  jflo " + pname + " " + cname;
                        desc = plugins[pname][cname]._description || "";
                        console.log(cmd + Array(desc_column - cmd.length).join(' ') + desc);
                    }
                }
            }
            return;
        default:
            break;
    }
    if (plugname in plugins) {
        var plugin = plugins[plugname];
        if (typeof plugin == 'function') {
            plugin();
        }
        else if (typeof plugin[command] == 'function') {
            plugin[command]();
        }
        else {
            console.error("Usage: jflo " + plugname + " [" + Object.keys(plugin).join("|") + "] {options}");
        }
    }
    else {
        console.error("Usage: jflo [module] [cmd] {options}");
    }
}