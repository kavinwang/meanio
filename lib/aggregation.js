'use strict';

var fs = require('fs'),
    _ = require('lodash'),
    uglify = require('uglify-js'),
    crypto = require('crypto'),
    path = require('path');
var aggregated = {
    $_techrich_$: {
        header: {
            js: { data: null, weights: [] },
            css: { data: null, weights: [] }
        },
        footer: {
            js: { data: null, weights: [] },
            css: { data: null, weights: [] }
        }
    },
    manager: {
        header: {
            js: { data: null, weights: [] },
            css: { data: null, weights: [] }
        },
        footer: {
            js: { data: null, weights: [] },
            css: { data: null, weights: [] }
        }
    },
    terminal: {
        header: {
            js: { data: null, weights: [] },
            css: { data: null, weights: [] }
        },
        footer: {
            js: { data: null, weights: [] },
            css: { data: null, weights: [] }
        }
    },
    website: {
        header: {
            js: { data: null, weights: [] },
            css: { data: null, weights: [] }
        },
        footer: {
            js: { data: null, weights: [] },
            css: { data: null, weights: [] }
        }
    }
};

function sortAggregateAssetsByWeight() {
    for (var type in aggregated) {
        for (var region in aggregated[type]) {
            for (var ext in aggregated[type][region]) {
                sortByWeight(type, region, ext);
            }
        }
    }
}

function sortByWeight(type, group, ext) {
    var weights = aggregated[type][group][ext].weights;
    var temp = [];

    for (var file in weights) {
        temp.push({
            data: weights[file].data,
            weight: weights[file].weight
        });
    }
    aggregated[type][group][ext].data = _.map(_.sortBy(temp, 'weight'), function (value) {
        return value.data;
    }).join('\n');
}

function Aggregator(options, module, libs, debug) {
    this.options = options;
    this.module = module;
    this.libs = libs;
    this.debug = debug;
}

Aggregator.prototype.addInlineCode = function (ext, data) {
    var md5 = crypto.createHash('md5');
    md5.update(data);
    var hash = md5.digest('hex');
    this.pushAggregatedData(ext, hash, data);
};

Aggregator.prototype.processFileOfFile = function (ext, filepath, fileErr, data) {
    if (!data) {
        this.readFiles(ext, filepath);
    } else {
        var filename = filepath.split(process.cwd())[1];
        this.pushAggregatedData(ext, filename, data);
    }
};

Aggregator.prototype.processDirOfFile = function (ext, filepath, err, files) {
    if (files) return this.readFiles(ext, filepath);
    if (path.extname(filepath) !== '.' + ext) return;
    fs.readFile(filepath, this.processFileOfFile.bind(this, ext, filepath));
};

Aggregator.prototype.readFile = function (ext, filepath) {
    fs.readdir(filepath, this.processDirOfFile.bind(this, ext, filepath));
};

Aggregator.prototype.processFileOfDirOfFiles = function (ext, filepath, file) {
    if (!this.libs && (file !== 'assets' && file !== 'tests')) {
        this.readFile(ext, path.join(filepath, file));
    }
};

Aggregator.prototype.processDirOfFiles = function (ext, filepath, err, files) {
    if (err) return;
    files.forEach(this.processFileOfDirOfFiles.bind(this, ext, filepath));
};

Aggregator.prototype.readFiles = function (ext, filepath) {
    fs.readdir(filepath, this.processDirOfFiles.bind(this, ext, filepath));
};

Aggregator.prototype.pushAggregatedData = function (ext, filename, data) {
    var group = this.options.group || 'footer',
        weight = this.options.weight || 0;

    if (ext === 'js') {

        var code = this.options.global ? data.toString() + '\n' : '(function(){' + data.toString() + '})();';

        var ugly = uglify.minify(code, {
            fromString: true,
            mangle: false
        });

        aggregated[this.module.usertype][group][ext].weights[filename] = {
            weight: weight,
            data: !this.debug ? ugly.code : code
        };
    } else {
        group = this.options.group || 'header';

        aggregated[this.module.usertype][group][ext].weights[filename] = {
            weight: weight,
            data: data.toString()
        };
    }
};

function supportAggregate(Meanio) {
    Meanio.prototype.getAggregated = function(){return aggregated;};
    Meanio.prototype.aggregated = function (usertype, ext, group, callback) {
        if (!aggregated['$_techrich_$'][group][ext].data) sortAggregateAssetsByWeight();

        if ('manager' !== usertype && 'terminal' != usertype)usertype = 'website';

        // Returning rebuild data. All from memory so no callback required
        callback(aggregated['$_techrich_$'][group][ext].data+'\n'+aggregated[usertype][group][ext].data);
    };

    // Allows redbuilding aggregated data
    Meanio.prototype.rebuildAggregated = function () {
        sortAggregateAssetsByWeight();
    };

    Meanio.prototype.Module.prototype.aggregateAsset = function (type, asset, options) {
        options = options || {};
        //inline代码,绝对路径的代码 和相对路径的代码
        asset = options.inline ? asset : (options.absolute ? asset : path.join(Meanio.modules[this.name].source, this.name, 'public/assets', type, asset));
        Meanio.aggregate(Meanio.modules[this.name.toLowerCase()], type, asset, options, Meanio.Singleton.config.clean.debug);
    };

    Meanio.onModulesFoundAggregate = function (debug) {
//        console.log('option debug:'+debug);
        for (var name in Meanio.modules) {
            var aggregator = new Aggregator({}, Meanio.modules[name], false, !!debug);//Meanio.Singleton.config.clean.debug); //XXX:Aggregator的option部分需要考虑来源
            aggregator.readFiles('js', path.join(process.cwd(), Meanio.modules[name].source, name.toLowerCase(), 'public'));
        }
    };

    Meanio.aggregate = function (module, ext, asset, options, debug) {
        var aggregator;
        options = options || {};
        if (asset) {
            aggregator = new Aggregator(options, module, true, debug);
            return options.inline ? aggregator.addInlineCode(ext, asset) : aggregator.readFile(ext, path.join(process.cwd(), asset));
        }

//    Meanio.events.on('modulesFound', Meanio.onModulesFoundAggregate.bind(null, ext, options, debug));
    };

//  Meanio.prototype.aggregate = Meanio.aggregate;
}

module.exports = supportAggregate;
