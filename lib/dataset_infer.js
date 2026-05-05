/* exported inferDataset */

var DS_FORMAT_BY_EXT = {
	geojson: 'geojson',
	json: 'json',
	shp: 'shp',
	shapefile: 'shp',
	gpkg: 'geopackage',
	geopackage: 'geopackage',
	kml: 'kml',
	kmz: 'kml',
	csv: 'csv',
	tsv: 'csv',
	xls: 'xls',
	xlsx: 'xlsx',
	ods: 'ods',
	pdf: 'pdf',
	html: 'html',
	htm: 'html',
	txt: 'txt',
	geotiff: 'geotiff',
	tif: 'tiff',
	tiff: 'tiff',
	png: 'png',
	jpg: 'jpg',
	jpeg: 'jpg',
	jp2: 'jpeg2000',
	svg: 'svg',
	zip: 'zip',
};

var DS_TYPE_BY_FORMAT = {
	geojson: 'vector:geo',
	shp: 'vector:geo',
	geopackage: 'vector:geo',
	kml: 'vector:geo',
	wfs: 'vector:geo',
	arcgis: 'vector:geo',
	geotiff: 'raster:geo',
	wms: 'raster:geo',
	tiff: 'raster',
	png: 'raster',
	jpg: 'raster',
	jpeg2000: 'raster',
	csv: 'table',
	xls: 'table',
	xlsx: 'table',
	ods: 'table',
	svg: 'vector',
};

// Order matters — first match wins.
var DS_HOST_HINTS = [
	{ match: /\/wfs\b/i, importer: 'ogcimporter', format: 'wfs', type: 'vector:geo' },
	{ match: /\/wms\b/i, importer: 'ogcimporter', format: 'wms', type: 'raster:geo' },
	{ match: /\/arcgis\/rest\/services\//i, importer: 'baseimporter', format: 'arcgis', type: 'vector:geo' },
	{ match: /raw\.githubusercontent\.com/i, importer: 'baseimporter' },
	{ match: /\/api\.geonames\.org\//i, importer: 'baseimporter' },
];

function _extFromUrl(url) {
	if (!url) return '';
	let path = '';
	try { path = new URL(url).pathname; }
	catch { path = url; }
	const last = (path.split('/').pop() || '').split('?')[0];
	const dot = last.lastIndexOf('.');
	if (dot < 0) return '';
	const ext = last.slice(dot + 1).toLowerCase();
	if (ext.length > 8) return '';
	return ext;
}

function _parseDatasetTitle(title) {
	if (!title) return null;
	const t = String(title).trim();
	if (!t) return null;
	if (t === 'dataset') return { key: 'default', slice: '' };
	const m = t.match(/^dataset=([^:]+)(?::(.+))?$/);
	if (!m) return null;
	return { key: m[1], slice: m[2] || '' };
}

function inferDataset(input) {
	const url = (input && input.url) || '';
	const title = (input && input.title) || '';
	const out = {};

	const tparsed = _parseDatasetTitle(title);
	if (tparsed) {
		if (tparsed.key) out.key = tparsed.key;
		if (tparsed.slice) out.slice = tparsed.slice;
	}

	if (url) {
		for (const h of DS_HOST_HINTS) {
			if (h.match.test(url)) {
				if (h.format && !out.format) out.format = h.format;
				if (h.type && !out.type) out.type = h.type;
				if (h.importer && !out.importer) out.importer = h.importer;
				break;
			}
		}
	}

	if (!out.format) {
		const ext = _extFromUrl(url);
		if (ext && DS_FORMAT_BY_EXT[ext]) out.format = DS_FORMAT_BY_EXT[ext];
	}

	if (!out.type && out.format) {
		out.type = DS_TYPE_BY_FORMAT[out.format] || 'other';
	}

	if (!out.importer) out.importer = 'baseimporter';

	return out;
}

this.inferDataset = inferDataset;
