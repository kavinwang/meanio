'use strict';

var express = require('express'),
    Grid = require('gridfs-stream'),
    errorHandler = require('errorhandler'),
    config = require('meanio').loadConfig(),
    fs = require('fs'),
    appPath = process.cwd();

var mean = require('meanio');

module.exports = function (options, db) {

    // Register app dependency;
    mean.register('app', function (access, database) {
        require(appPath + '/server/express')(app, access.passport, database.connection);
        return app;
    });


    // Express settings
    var app = express();

    var gfs = new Grid(db.connection.db, db.mongo);

    mean.register('gridfs',function(){
        return gfs;
    });

    function themeHandler(req, res) {
        res.setHeader('content-type', 'text/css');
        gfs.files.findOne({
            filename: 'theme.css'
        }, function (err, file) {

            if (!file) {
                fs.createReadStream(config.root + '/bower_components/bootstrap/dist/css/bootstrap.css').pipe(res);
            } else {
                // streaming to gridfs
                var readstream = gfs.createReadStream({
                    filename: 'theme.css'
                });

                //error handling, e.g. file does not exist
                readstream.on('error', function (err) {
                    console.log('An error occurred!', err.message);
                    throw err;
                });

                readstream.pipe(res);
            }
        });
    }
    app.get('/bower_components/bootstrap/dist/css/bootstrap.css', themeHandler);


    app.use('/bower_components', express.static(config.root + '/bower_components'));

    mean.events.on('modulesEnabled', function () {
        for (var name in mean.modules) {
            app.use('/' + name, express.static(config.root + '/' + mean.modules[name].source + '/' + name.toLowerCase() + '/public'));
        }

        // We are going to catch everything else here
        app.route('*').get(function (req, res, next) {
            if (!mean.template) return next();
            mean.template(req, res, next);
        });

        // Assume "not found" in the error msgs is a 404. this is somewhat
        // silly, but valid, you can do whatever you like, set properties,
        // use instanceof etc.
        app.use(function (err, req, res, next) {
            // Treat as 404
            if (~err.message.indexOf('not found')) return next();

            // Log it
            console.error(err.stack);

            // Error page
            res.status(500).render('500', {
                error: err.stack
            });
        });

        // Assume 404 since no middleware responded
        app.use(function (req, res) {
            res.status(404).render('404', {
                url: req.originalUrl,
                error: 'Not found'
            });
        });

        // Error handler - has to be last
        if (process.env.NODE_ENV === 'development') {
            app.use(errorHandler());
        }
    });

    return app;
};
