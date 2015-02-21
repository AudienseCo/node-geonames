var argv = require('optimist')
  .usage('Usage: $0 -f [geonamesFile] -d [mongodb://localhost/database] -r false')
  .demand(['f', 'd', 'r'])
  .alias('f', 'file')
  .describe('f', 'Path to a Geonames data, e.g. /tmp/AllCountries.txt')
  .alias('d', 'database')
  .describe('d', 'Mongo DB URI, e.g. mongodb://localhost/database')
  .alias('r', 'reset')
  .describe('r', 'Where to clean the database before importing, use true to clean it')
  .argv;

var
	mongoose = require('mongoose'),
	async = require('async'),
	Geoname = require('../models/Geoname')(argv.database);

function doImport(err) {
	if (err) {
		console.log(err);
		process.exit();
	}

	console.log('Creating indexes...');
	var indexes = [
		 {collection: Geoname, index: {"alternatenames":1, "offset_raw": 1, "population":1}}
		,{collection: Geoname, index: {"alternatenames":1, "population":1}}
	];
	async.forEachSeries(indexes, function(index, next) {
		var options = index.options || {};
		index.collection.collection.ensureIndex(index.index, options, function(err, name) {
			if (err) next(err);
			console.log('Index created: ', name);
			next();
		});

	}, function(err) {
		if (err) throw err;
		console.log('All done!');

	});


	Geoname.doImport(argv.file, function(err, count, imported) {
		if (err) console.log(err);
		console.log('Number of names imported: ' + count);
		process.exit();
	});
}

if (argv.reset === 'true') { Geoname.remove().exec(doImport); } else doImport();
