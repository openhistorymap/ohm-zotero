/* exported readOHMDescriptors, writeOHMDescriptors, buildOHMTags, OHM_TAG_PREFIX */

var OHM_TAG_PREFIX = 'ohm:';

var OHM_KNOWN_FIELDS = new Set([
	'ohm:from_time',
	'ohm:to_time',
	'ohm:topic',
	'ohm:topic:topic',
	'ohm:area',
	'ohm:source_quality',
	'ohm:source_reliability',
	'ohm:iarchive_url',
]);

function _splitTag(raw) {
	const eq = raw.indexOf('=');
	if (eq === -1) return { name: raw, value: '' };
	return { name: raw.slice(0, eq), value: raw.slice(eq + 1) };
}

function _toNumber(v) {
	if (v === null || v === undefined || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

function _stripGeo(v) {
	return String(v || '').startsWith('geonames:') ? v.slice('geonames:'.length) : v;
}

function readOHMDescriptors(item) {
	const desc = {
		from_time: null,
		to_time: null,
		topic: '',
		subtopic: '',
		areas: [],
		quality: null,
		reliability: null,
		iarchive_url: '',
		extra: [],
	};
	if (!item || typeof item.getTags !== 'function') return desc;

	for (const t of item.getTags()) {
		const raw = (t && t.tag) || '';
		if (!raw.startsWith(OHM_TAG_PREFIX)) continue;
		const { name, value } = _splitTag(raw);
		switch (name) {
			case 'ohm:from_time': desc.from_time = _toNumber(value); break;
			case 'ohm:to_time': desc.to_time = _toNumber(value); break;
			case 'ohm:topic': desc.topic = value; break;
			case 'ohm:topic:topic': desc.subtopic = value; break;
			case 'ohm:area': desc.areas.push(_stripGeo(value)); break;
			case 'ohm:source_quality': desc.quality = _toNumber(value); break;
			case 'ohm:source_reliability': desc.reliability = _toNumber(value); break;
			case 'ohm:iarchive_url': desc.iarchive_url = value; break;
			default:
				desc.extra.push({ name, value });
		}
	}
	return desc;
}

function buildOHMTags(desc) {
	const out = [];
	if (desc.from_time !== null && desc.from_time !== undefined && desc.from_time !== '') {
		out.push(`ohm:from_time=${desc.from_time}`);
	}
	if (desc.to_time !== null && desc.to_time !== undefined && desc.to_time !== '') {
		out.push(`ohm:to_time=${desc.to_time}`);
	}
	if (desc.topic) out.push(`ohm:topic=${desc.topic}`);
	if (desc.subtopic) out.push(`ohm:topic:topic=${desc.subtopic}`);
	const seenAreas = new Set();
	for (const a of desc.areas || []) {
		const v = String(a || '').trim();
		if (!v) continue;
		const full = v.startsWith('geonames:') ? v : `geonames:${v}`;
		if (seenAreas.has(full)) continue;
		seenAreas.add(full);
		out.push(`ohm:area=${full}`);
	}
	if (desc.quality !== null && desc.quality !== undefined && desc.quality !== '') {
		out.push(`ohm:source_quality=${desc.quality}`);
	}
	if (desc.reliability !== null && desc.reliability !== undefined && desc.reliability !== '') {
		out.push(`ohm:source_reliability=${desc.reliability}`);
	}
	if (desc.iarchive_url) out.push(`ohm:iarchive_url=${desc.iarchive_url}`);
	for (const x of desc.extra || []) {
		const name = (x.name || '').trim();
		if (!name) continue;
		if (OHM_KNOWN_FIELDS.has(name)) continue;
		out.push(x.value === '' ? name : `${name}=${x.value}`);
	}
	return out;
}

async function writeOHMDescriptors(item, desc) {
	const others = item.getTags().filter(t => !((t && t.tag) || '').startsWith(OHM_TAG_PREFIX));
	const newOhm = buildOHMTags(desc).map(tag => ({ tag, type: 0 }));
	item.setTags([...others, ...newOhm]);
	await item.saveTx();
}

this.OHM_TAG_PREFIX = OHM_TAG_PREFIX;
this.readOHMDescriptors = readOHMDescriptors;
this.buildOHMTags = buildOHMTags;
this.writeOHMDescriptors = writeOHMDescriptors;
