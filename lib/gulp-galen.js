/* globals process */

var spawn = require("child_process").spawn,
    fs = require("fs"),
    path = require("path"),
    gutil = require('gulp-util'),
    PluginError = require('gulp-util').PluginError,
    through = require('through2');

function replacePlaceholders(obj, placeholders) {
    if (typeof obj === "string") {
        var s = obj;
        Object.keys(placeholders).forEach(function (key) {
            s = s.replace(new RegExp("\{" + key + "\}", "g"), placeholders[key]);
        });
        return s;
    }
    else {
        return obj;
    }
}

function resolveNodePath(module, subpath) {
    var filename = path.resolve(__dirname + '/../node_modules/' + module + '/' + subpath);
    try {
        fs.statSync(filename);
    }
    catch (err) {
        filename = path.resolve(__dirname + '/../../../node_modules/' + module + '/' + subpath);
    }
    return filename;
}


var runGalen = function (stream, cb, galenPath, mode, file, cwd, opt, properties) {
    var callback = cb;
    var fileInfo = {
        relative: file.relative,
        basename: path.basename(file.path),
        path: file.path
    };

    if (!opt.parallel) {
        // Prevent parallel execution
        stream.pause();
    }

    var args = [mode, file.path];
    Object.keys(opt).forEach(function (key) {
        if (opt[key]) {
            args.push("--" + key + "=" + replacePlaceholders(opt[key], fileInfo));
        }
    });
    Object.keys(properties).forEach(function (key) {
        if (properties[key]) {
            args.push("-D" + key + "=" + replacePlaceholders(properties[key], fileInfo));
        }
    });
    args.push('-Dwebdriver.chrome.driver=' + resolveNodePath('chromedriver', 'bin/chromedriver'));
    args.push('-Dwebdriver.gecko.driver=' + resolveNodePath('geckodriver', 'bin/geckodriver'));

    var galenProcess = spawn(galenPath, args, {
        stdio: "inherit", // TODO add silent option,
        env: process.env,
        cwd: cwd
    }).on('exit', function (code) {
        if (galenProcess) {
            galenProcess.kill();
        }
        if (stream) {
            if (code === 0) {
                stream.emit('data', file);
                stream.resume();
            } else {
                stream.emit('error', new PluginError('Galen', 'Test ' + file.path + ' failed!'));
            }
        }
        callback(null, file);
    }).on("error", function (err) {
        stream.emit('error', new PluginError('Galen', 'Could not start galen. Galen (' + galenPath + ') not found?' + err));
        callback(err, file);
    });
    return stream;
};

var GulpEventStream = function (mode, specialOptionKeys) {
    return function (options) {
        if (typeof (options) === 'undefined') {
            options = {};
        }
        var opt = {}; // Clone not to mess up the input object
        var allowedOptionKeys = ['galenPath', 'cwd', 'parallel', 'htmlreport', 'testngreport', 'junitreport', 'jsonreport', 'properties'].concat(specialOptionKeys);
        Object.keys(options).forEach(function (key) {
            if (allowedOptionKeys.indexOf(key) < 0) {
                throw new Error("Unknown option '" + key + "'. Valid options are: " + allowedOptionKeys.join(", "));
            }
            opt[key] = options[key];
        });

        var galenPath, cwd;
        if (opt.galenPath) {
            galenPath = opt.galenPath;
            delete opt.galenPath;
        } else {
            galenPath = path.resolve(__dirname + '/../node_modules/galenframework/bin/galen' + (process.platform === 'win32' ? '.cmd' : ''));
            fs.stat(galenPath, function (err) {
                // resolve for NPM3+
                if (err) {
                    galenPath = path.resolve(__dirname + '/../../galenframework/bin/galen' + (process.platform === 'win32' ? '.cmd' : ''));
                }
                fs.stat(galenPath, function (err) {
                    // resolve for NPM3+
                    if (err) {
                        throw new Error('Cannot find Galenframework at ' + galenPath);
                    }
                });
            });
        }

        var properties = {};
        if (opt.properties) {
            properties = opt.properties;
            delete opt.properties;
        }

        if (opt.cwd) {
            cwd = opt.cwd;
            delete opt.cwd;
        }

        var stream = through.obj(function (file, encoding, callback) {
            if (file.isNull()) {
                return callback(null, file);
            }
            var currentCwd = cwd || path.dirname(file.path);
            runGalen(stream, function (error, file) {
                if (error) {
                    return callback(stream, error, file);
                } else {
                    return callback();
                }
            }, galenPath, mode, file, currentCwd, opt, properties);
        });
        return stream;

    };
};

module.exports = {
    dump: GulpEventStream('dump', ['config', 'url', 'size', 'export', 'max-width', 'max-height']),
    check: GulpEventStream('check', ['config', 'url', 'javascript', 'size', 'include', 'exclude']),
    test: GulpEventStream('test', ['config', 'parallel-tests', 'recursive', 'filter', 'groups', 'excluded-groups'])
};