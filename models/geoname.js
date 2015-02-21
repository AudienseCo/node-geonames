var mongoose = require('mongoose'),
	csv = require('csv'),
	timezones = require('../lib/timezones'),
	Schema = mongoose.Schema;

var GeonameSchema = new Schema({
	_id 			  : Number, //geonameid, integer id of record in geonames database
	name              : String, //name of geographical point (utf8) varchar(200)
	//asciiname         : String, //name of geographical point in plain ascii characters, varchar(200)
	alternatenames    : [String], //alternatenames, comma separated varchar(5000)
					  //latitude in decimal degrees (wgs84)
					  //longitude in decimal degrees (wgs84)
	loc 			  : {type: [Number], index: '2d'},
	feature_class     : String, //see http://www.geonames.org/export/codes.html, char(1)
	feature_code      : String, //see http://www.geonames.org/export/codes.html, varchar(10)
	country_code      : String, //ISO-3166 2-letter country code, 2 characters
	//cc2               : String, //alternate country codes, comma separated, ISO-3166 2-letter country code, 60 characters
	//admin1_code       : String, //fipscode (subject to change to iso code), see exceptions below, see file admin1Codes.txt for display names of this code; varchar(20)
	//admin2_code       : String, //code for the second administrative division, a county in the US, see file admin2Codes.txt; varchar(80)
	//admin3_code       : String, //code for third level administrative division, varchar(20)
	//admin4_code       : String, //code for fourth level administrative division, varchar(20)
	population        : Number, //bigint (8 byte int)
	//elevation         : Number, //in meters, integer
	//dem               : Number, //digital elevation model, srtm3 or gtopo30, average elevation of 3''x3'' (ca 90mx90m) or 30''x30'' (ca 900mx900m) area in meters, integer. srtm processed by cgiar/ciat.
	timezone          : String,  //the timezone id (see file timeZone.txt) varchar(40)
	offset_gmt		  : Number, //GMT offset 1. Jan 2013
	offset_dst		  : Number, //DST offset 1. Jul 2013
	offset_raw		  : Number  //rawOffset (independant of DST)
	//modification_date : Date    //date of last modification in yyyy-MM-dd format
});

GeonameSchema.statics.findByName = function(name, limit, cb) {
	this
		.find()
		//.select('name', 'alternatenames', 'country_code', 'feature_class', 'feature_code', 'population')
		.where('alternatenames', name.toLowerCase())
		//.sort('feature_class', 'ascending')
		.sort('population', 'descending')
		.limit(limit)
		.slaveOk()
		.exec(cb)
}

GeonameSchema.statics.findByNameAndUTCOffset = function(name, UTCOffset, limit, cb) {
	this
		.find()
		//.select('name', 'alternatenames', 'country_code', 'feature_class', 'feature_code', 'population')
		.where('alternatenames', name.toLowerCase())
		.where('offset_raw', UTCOffset)
		.sort('population', 'descending')
		.limit(limit)
		.slaveOk()
		.exec(cb)
}

GeonameSchema.statics.findByCoords = function(lon, lat, limit, cb) {
	this
		.find({loc: { $nearSphere: [lon, lat], $maxDistance: 0.01} })
		.limit(limit)
		.slaveOk()
		.exec(cb);
}

GeonameSchema.statics.add = function(data, cb) {
	var geoname = new this(data);
	geoname.save(cb);
}

GeonameSchema.statics.doImport = function(file, cb) {
	var self = this;
	var imported = 0;
	csv()
		.from.path(file, {
		  delimiter : '\t',
		  columns : [
		    '_id',
		    'name',
		    'asciiname',
		    'alternatenames',
		    'latitude',
		    'longitude',
		    'feature_class',
			'feature_code',
			'country_code',
			'cc2',
			'admin1_code',
			'admin2_code',
			'admin3_code',
			'admin4_code',
			'population',
			'elevation',
			'dem',
			'timezone',
			'modification_date'
		  ]
		})
		.transform(function(data, index) {
			if (data.feature_class != 'A' && data.feature_class != 'P') return data;

			data.loc = [
		      parseFloat(data.longitude),
		      parseFloat(data.latitude)
		    ];
		    //data.modification_date = new Date(data.modification_date);

		    data.alternatenames = data.alternatenames ? data.alternatenames.split(',') : [];
		    if (data.alternatenames.indexOf(data.name) == -1) data.alternatenames.push(data.name);
		    if (data.alternatenames.indexOf(data.asciiname) == -1) data.alternatenames.push(data.asciiname);
		    data.alternatenames = data.alternatenames.map(function(s) { return s.toLowerCase() });

		    var timezone = timezones[data.timezone.toLowerCase()];

		    //console.log('data.alternatenames', timezone);

		    return {
		    	_id: data._id,
		    	name: data.name,
		    	alternatenames: data.alternatenames,
		    	loc: [parseFloat(data.longitude), parseFloat(data.latitude)],
		    	feature_class: data.feature_class,
		    	feature_code: data.feature_code,
		    	country_code: data.country_code,
		    	population: data.population,
		    	timezone: data.timezone? data.timezone.toLowerCase() : '',
		    	offset_gmt: timezone ? timezone.gmt_offset : null,
		    	offset_dst: timezone ? timezone.dst_offset : null,
		    	offset_raw: timezone ? timezone.raw_offset : null
		    };
		})
		.on('record', function(data, index) {
			if (data.feature_class == 'A' || data.feature_class == 'P') {
				imported++;
				self.add(data);
			}
		})
		.on('end', function(count) {
		  cb(null, count, imported);
		})
		.on('error', function(err) {
		  console.error(err);
		  cb(err);
		});
}

exports = module.exports = function(uri) {
	var conn = mongoose.createConnection(uri);
	return conn.model('Geoname', GeonameSchema);
}
