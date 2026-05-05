/* exported readDatasetDescriptors, writeDatasetDescriptors, buildDatasetTags */

var OHM_DATASET_PREFIX = 'ohm:dataset:';
var OHM_DATASET_IARCHIVE = 'ohm:iarchive_url';

var OHM_DATASET_KNOWN_FIELDS = new Set([
	'ohm:dataset:key',
	'ohm:dataset:slice',
	'ohm:dataset:format',
	'ohm:dataset:type',
	'ohm:dataset:from_time',
	'ohm:dataset:to_time',
	'ohm:dataset:status',
	'ohm:dataset:importer',
	'ohm:dataset:mapping_url',
	'ohm:dataset:license',
	'ohm:iarchive_url',
]);

function _splitTagDS(raw) {
	const eq = raw.indexOf('=');
	if (eq === -1) return { name: raw, value: '' };
	return { name: raw.slice(0, eq), value: raw.slice(eq + 1) };
}

function _toNumberDS(v) {
	if (v === null || v === undefined || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

function readDatasetDescriptors(item) {
	const desc = {
		key: '',
		slice: '',
		format: '',
		type: '',
		from_time: null,
		to_time: null,
		status: '',
		importer: '',
		mapping_url: '',
		license: '',
		iarchive_url: '',
		extra: [],
	};
	if (!item || typeof item.getTags !== 'function') return desc;

	for (const t of item.getTags()) {
		const raw = (t && t.tag) || '';
		if (!raw.startsWith('ohm:')) continue;
		const { name, value } = _splitTagDS(raw);
		switch (name) {
			case 'ohm:dataset:key': desc.key = value; break;
			case 'ohm:dataset:slice': desc.slice = value; break;
			case 'ohm:dataset:format': desc.format = value; break;
			case 'ohm:dataset:type': desc.type = value; break;
			case 'ohm:dataset:from_time': desc.from_time = _toNumberDS(value); break;
			case 'ohm:dataset:to_time': desc.to_time = _toNumberDS(value); break;
			case 'ohm:dataset:status': desc.status = value; break;
			case 'ohm:dataset:importer': desc.importer = value; break;
			case 'ohm:dataset:mapping_url': desc.mapping_url = value; break;
			case 'ohm:dataset:license': desc.license = value; break;
			case 'ohm:iarchive_url': desc.iarchive_url = value; break;
			default:
				desc.extra.push({ name, value });
		}
	}
	return desc;
}

function buildDatasetTags(desc) {
	const out = [];
	if (desc.key) out.push(`ohm:dataset:key=${desc.key}`);
	if (desc.slice) out.push(`ohm:dataset:slice=${desc.slice}`);
	if (desc.format) out.push(`ohm:dataset:format=${desc.format}`);
	if (desc.type) out.push(`ohm:dataset:type=${desc.type}`);
	if (desc.from_time !== null && desc.from_time !== undefined && desc.from_time !== '') {
		out.push(`ohm:dataset:from_time=${desc.from_time}`);
	}
	if (desc.to_time !== null && desc.to_time !== undefined && desc.to_time !== '') {
		out.push(`ohm:dataset:to_time=${desc.to_time}`);
	}
	if (desc.status) out.push(`ohm:dataset:status=${desc.status}`);
	if (desc.importer) out.push(`ohm:dataset:importer=${desc.importer}`);
	if (desc.mapping_url) out.push(`ohm:dataset:mapping_url=${desc.mapping_url}`);
	if (desc.license) out.push(`ohm:dataset:license=${desc.license}`);
	if (desc.iarchive_url) out.push(`ohm:iarchive_url=${desc.iarchive_url}`);
	for (const x of desc.extra || []) {
		const name = (x.name || '').trim();
		if (!name) continue;
		if (OHM_DATASET_KNOWN_FIELDS.has(name)) continue;
		out.push(x.value === '' ? name : `${name}=${x.value}`);
	}
	return out;
}

async function writeDatasetDescriptors(item, desc) {
	// Own only ohm:dataset:* and ohm:iarchive_url. Any other tag (incl. plain
	// Zotero tags) survives unchanged.
	const others = item.getTags().filter((t) => {
		const tag = (t && t.tag) || '';
		if (tag.startsWith(OHM_DATASET_PREFIX)) return false;
		if (tag === OHM_DATASET_IARCHIVE || tag.startsWith(OHM_DATASET_IARCHIVE + '=')) return false;
		return true;
	});
	const newTags = buildDatasetTags(desc).map(tag => ({ tag, type: 0 }));
	item.setTags([...others, ...newTags]);
	await item.saveTx();
}

this.OHM_DATASET_PREFIX = OHM_DATASET_PREFIX;
this.OHM_DATASET_KNOWN_FIELDS = OHM_DATASET_KNOWN_FIELDS;
this.readDatasetDescriptors = readDatasetDescriptors;
this.buildDatasetTags = buildDatasetTags;
this.writeDatasetDescriptors = writeDatasetDescriptors;
