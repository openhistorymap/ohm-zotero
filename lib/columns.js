/* exported registerOHMColumns, unregisterOHMColumns */
/* global Zotero */

function _formatYear(n) {
	if (n === null || n === undefined || n === '' || Number.isNaN(n)) return '';
	const v = Number(n);
	if (!Number.isFinite(v)) return '';
	const abs = Math.abs(v);
	const rounded = Number.isInteger(v) ? abs : Math.round(abs * 100) / 100;
	return v < 0 ? `${rounded} BCE` : `${rounded} CE`;
}

function _topicLabel(d) {
	if (!d.topic) return '';
	return d.subtopic ? `${d.topic}:${d.subtopic}` : d.topic;
}

function _areasLabel(d) {
	const n = d.areas ? d.areas.length : 0;
	if (n === 0) return '';
	if (n === 1) return d.areas[0];
	return `${n} (${d.areas.slice(0, 2).join(', ')}…)`;
}

// Resolve the "effective" descriptor for a row. For regular items we just
// read the source descriptors. For attachments we layer the dataset
// descriptor (which overrides) on top of the parent's source descriptor
// (so inherited fields like topic/areas/quality still show in the tree).
function _resolve(item, ctx) {
	const isAttachment = item.isAttachment && item.isAttachment();
	if (!isAttachment) return ctx.readDescriptors(item);

	const ds = ctx.readDatasetDescriptors ? ctx.readDatasetDescriptors(item) : {};
	let parent = null;
	try {
		parent = item.parentItem || (item.parentID ? Zotero.Items.get(item.parentID) : null);
	}
	catch (e) {
		Zotero.logError(e);
	}
	const p = parent ? ctx.readDescriptors(parent) : null;
	return {
		from_time: ds.from_time != null ? ds.from_time : (p ? p.from_time : null),
		to_time: ds.to_time != null ? ds.to_time : (p ? p.to_time : null),
		topic: p ? p.topic : '',
		subtopic: p ? p.subtopic : '',
		areas: p ? p.areas : [],
		quality: p ? p.quality : null,
		reliability: p ? p.reliability : null,
	};
}

function _columns(ctx) {
	const id = ctx.id;
	const read = item => _resolve(item, ctx);
	return [
		{
			dataKey: 'ohm-from-time',
			label: 'OHM From',
			pluginID: id,
			defaultHidden: true,
			minWidth: 70,
			dataProvider: item => _formatYear(read(item).from_time),
		},
		{
			dataKey: 'ohm-to-time',
			label: 'OHM To',
			pluginID: id,
			defaultHidden: true,
			minWidth: 70,
			dataProvider: item => _formatYear(read(item).to_time),
		},
		{
			dataKey: 'ohm-topic',
			label: 'OHM Topic',
			pluginID: id,
			defaultHidden: true,
			minWidth: 100,
			dataProvider: item => _topicLabel(read(item)),
		},
		{
			dataKey: 'ohm-areas',
			label: 'OHM Areas',
			pluginID: id,
			defaultHidden: true,
			minWidth: 80,
			dataProvider: item => _areasLabel(read(item)),
		},
		{
			dataKey: 'ohm-quality',
			label: 'OHM Q',
			pluginID: id,
			defaultHidden: true,
			minWidth: 50,
			dataProvider: (item) => {
				const v = read(item).quality;
				return v === null || v === undefined ? '' : String(v);
			},
		},
		{
			dataKey: 'ohm-reliability',
			label: 'OHM R',
			pluginID: id,
			defaultHidden: true,
			minWidth: 50,
			dataProvider: (item) => {
				const v = read(item).reliability;
				return v === null || v === undefined ? '' : String(v);
			},
		},
	];
}

async function registerOHMColumns(ctx) {
	if (!Zotero.ItemTreeManager || typeof Zotero.ItemTreeManager.registerColumns !== 'function') {
		Zotero.warn('OHM: ItemTreeManager.registerColumns unavailable; skipping columns');
		return null;
	}
	try {
		return await Zotero.ItemTreeManager.registerColumns(_columns(ctx));
	}
	catch (e) {
		Zotero.logError(e);
		return null;
	}
}

async function unregisterOHMColumns(handle) {
	if (!handle || !Zotero.ItemTreeManager) return;
	try {
		if (typeof Zotero.ItemTreeManager.unregisterColumns === 'function') {
			await Zotero.ItemTreeManager.unregisterColumns(handle);
		}
		else if (typeof Zotero.ItemTreeManager.unregisterColumn === 'function') {
			const ids = [].concat(handle);
			for (const i of ids) await Zotero.ItemTreeManager.unregisterColumn(i);
		}
	}
	catch (e) {
		Zotero.logError(e);
	}
}

this.registerOHMColumns = registerOHMColumns;
this.unregisterOHMColumns = unregisterOHMColumns;
