/* exported renderDatasetSection */
/* global Zotero */

const DS_HTML_NS = 'http://www.w3.org/1999/xhtml';

const DS_FORMAT_OPTIONS = [
	'', 'geojson', 'shp', 'geopackage', 'kml',
	'csv', 'xls', 'xlsx', 'ods',
	'geotiff', 'tiff', 'png', 'jpg', 'jpeg2000',
	'svg',
	'json', 'pdf', 'html', 'txt',
	'wfs', 'wms', 'arcgis',
	'zip', 'other',
];
const DS_TYPE_OPTIONS = ['', 'vector:geo', 'vector', 'raster:geo', 'raster', 'table', 'other'];
const DS_STATUS_OPTIONS = ['', 'pending', 'imported', 'failed', 'superseded'];
const DS_IMPORTER_OPTIONS = ['', 'baseimporter', 'ogcimporter', 'wfs', 'wms', 'arcgis', 'manual'];

function dsEl(doc, tag, attrs, children) {
	const node = doc.createElementNS(DS_HTML_NS, tag);
	if (attrs) {
		for (const [k, v] of Object.entries(attrs)) {
			if (v === false || v === null || v === undefined) continue;
			if (k === 'style' && typeof v === 'object') {
				for (const [sk, sv] of Object.entries(v)) node.style[sk] = sv;
			}
			else if (k.startsWith('on') && typeof v === 'function') {
				node.addEventListener(k.slice(2).toLowerCase(), v);
			}
			else if (v === true) node.setAttribute(k, '');
			else node.setAttribute(k, String(v));
		}
	}
	if (children) {
		for (const c of [].concat(children)) {
			if (c == null) continue;
			node.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c);
		}
	}
	return node;
}

function dsRow(doc, label, control) {
	return dsEl(doc, 'div', {
		style: {
			display: 'grid',
			gridTemplateColumns: '120px 1fr',
			alignItems: 'center',
			gap: '6px',
			marginBottom: '4px',
		},
	}, [
		dsEl(doc, 'label', { style: { color: 'var(--fill-secondary)', fontSize: '11px' } }, label),
		control,
	]);
}

function dsSelect(doc, name, current, opts, editable) {
	const sel = dsEl(doc, 'select', {
		'data-ohm-ds': name,
		disabled: !editable,
		style: { width: '100%', boxSizing: 'border-box' },
	});
	let known = false;
	for (const o of opts) {
		sel.appendChild(dsEl(doc, 'option', { value: o }, o || '— none —'));
		if (o === current) known = true;
	}
	if (current && !known) {
		sel.appendChild(dsEl(doc, 'option', { value: current }, `${current} (custom)`));
	}
	sel.value = current || '';
	return sel;
}

function dsInput(doc, name, current, opts) {
	return dsEl(doc, 'input', {
		type: opts.type || 'text',
		'data-ohm-ds': name,
		value: current ?? '',
		placeholder: opts.placeholder || '',
		disabled: opts.disabled,
		style: { width: '100%', boxSizing: 'border-box' },
	});
}

function readDatasetForm(root) {
	const $ = id => root.querySelector(`[data-ohm-ds="${id}"]`);
	const num = v => (v === '' || v === null || v === undefined ? null : Number(v));
	const get = id => ($(id) ? ($(id).value || '').trim() : '');
	return {
		key: get('key'),
		slice: get('slice'),
		format: get('format'),
		type: get('type'),
		from_time: num(get('from_time')),
		to_time: num(get('to_time')),
		status: get('status'),
		importer: get('importer'),
		mapping_url: get('mapping_url'),
		license: get('license'),
		iarchive_url: get('iarchive_url'),
		extra: [],
	};
}

function _getParentItem(item) {
	try {
		if (item.parentItem) return item.parentItem;
		if (item.parentID) return Zotero.Items.get(item.parentID);
		if (typeof item.parentItemKey === 'string' && item.libraryID != null) {
			const id = Zotero.Items.getIDFromLibraryAndKey(item.libraryID, item.parentItemKey);
			if (id) return Zotero.Items.get(id);
		}
	}
	catch (e) {
		Zotero.logError(e);
	}
	return null;
}

function _parentDatasetDefaults(parent) {
	const out = {};
	if (!parent || typeof parent.getTags !== 'function') return out;
	for (const t of parent.getTags()) {
		const raw = (t && t.tag) || '';
		if (raw.startsWith('ohm:dataset:all:format=')) out.format = raw.slice('ohm:dataset:all:format='.length);
		else if (raw.startsWith('ohm:dataset:all:type=')) out.type = raw.slice('ohm:dataset:all:type='.length);
	}
	return out;
}

function renderDatasetSection(body, item, editable, ctx) {
	body.replaceChildren();
	if (!item || !item.isAttachment || !item.isAttachment()) return;

	const doc = body.ownerDocument;
	const desc = ctx.readDatasetDescriptors(item);
	const parent = _getParentItem(item);
	const parentDesc = parent ? ctx.readDescriptors(parent) : null;
	const parentDefaults = _parentDatasetDefaults(parent);

	const root = dsEl(doc, 'div', {
		'data-ohm-ds-root': '',
		style: {
			display: 'flex',
			flexDirection: 'column',
			gap: '4px',
			padding: '6px 8px 8px',
			fontSize: '12px',
		},
	});

	const url = (item.getField && item.getField('url')) || '';
	if (url) {
		const link = dsEl(doc, 'a', {
			href: '#',
			title: url,
			style: {
				color: 'var(--accent-blue, blue)',
				wordBreak: 'break-all',
				cursor: 'pointer',
				fontSize: '11px',
			},
			onClick: (e) => { e.preventDefault(); Zotero.launchURL(url); },
		}, url);
		root.appendChild(dsRow(doc, 'URL', link));
	}

	const keyInput = dsInput(doc, 'key', desc.key, { placeholder: 'default', disabled: !editable });
	const sliceInput = dsInput(doc, 'slice', desc.slice, { placeholder: 'e.g. 1400', disabled: !editable });
	root.appendChild(dsRow(doc, 'Dataset key', keyInput));
	root.appendChild(dsRow(doc, 'Slice', sliceInput));

	const formatSel = dsSelect(doc, 'format', desc.format, DS_FORMAT_OPTIONS, editable);
	const typeSel = dsSelect(doc, 'type', desc.type, DS_TYPE_OPTIONS, editable);
	root.appendChild(dsRow(doc, 'Format', formatSel));
	if (parentDefaults.format && !desc.format) {
		root.appendChild(dsRow(doc, '', dsEl(doc, 'div', {
			style: { fontSize: '10px', color: 'var(--fill-secondary)', fontStyle: 'italic' },
		}, `(parent default: ${parentDefaults.format})`)));
	}
	root.appendChild(dsRow(doc, 'Type', typeSel));
	if (parentDefaults.type && !desc.type) {
		root.appendChild(dsRow(doc, '', dsEl(doc, 'div', {
			style: { fontSize: '10px', color: 'var(--fill-secondary)', fontStyle: 'italic' },
		}, `(parent default: ${parentDefaults.type})`)));
	}

	const fromInput = dsInput(doc, 'from_time', desc.from_time, { type: 'number', disabled: !editable });
	const toInput = dsInput(doc, 'to_time', desc.to_time, { type: 'number', disabled: !editable });
	fromInput.step = 'any';
	toInput.step = 'any';
	root.appendChild(dsRow(doc, 'From year', fromInput));
	root.appendChild(dsRow(doc, 'To year', toInput));
	if (parentDesc && (parentDesc.from_time != null || parentDesc.to_time != null)) {
		root.appendChild(dsRow(doc, '', dsEl(doc, 'div', {
			style: { fontSize: '10px', color: 'var(--fill-secondary)', fontStyle: 'italic' },
		}, `(source range: ${parentDesc.from_time ?? '?'} → ${parentDesc.to_time ?? '?'})`)));
	}

	const statusSel = dsSelect(doc, 'status', desc.status, DS_STATUS_OPTIONS, editable);
	const importerSel = dsSelect(doc, 'importer', desc.importer, DS_IMPORTER_OPTIONS, editable);
	const mappingInput = dsInput(doc, 'mapping_url', desc.mapping_url, {
		placeholder: 'https://.../mapping.json',
		disabled: !editable,
	});
	const licenseInput = dsInput(doc, 'license', desc.license, {
		placeholder: '(inherit from source)',
		disabled: !editable,
	});
	root.appendChild(dsRow(doc, 'Status', statusSel));
	root.appendChild(dsRow(doc, 'Importer', importerSel));
	root.appendChild(dsRow(doc, 'Mapping URL', mappingInput));
	root.appendChild(dsRow(doc, 'License', licenseInput));

	// IA snapshot row
	const iaInput = dsInput(doc, 'iarchive_url', desc.iarchive_url, {
		placeholder: '(no snapshot — click Sync IA)',
		disabled: !editable,
	});
	const iaOpenBtn = dsEl(doc, 'button', {
		type: 'button',
		title: 'Open archived URL in browser',
		style: { padding: '0 6px' },
		onClick: (e) => {
			e.preventDefault();
			const u = (iaInput.value || '').trim();
			if (u) Zotero.launchURL(u);
		},
	}, '↗');
	const iaStatus = dsEl(doc, 'span', {
		style: { fontSize: '11px', color: 'var(--fill-secondary)' },
	}, '');
	const iaSyncBtn = dsEl(doc, 'button', {
		type: 'button', disabled: !editable,
		title: 'Save Page Now via Internet Archive, falling back to the latest existing snapshot',
		onClick: async (e) => {
			e.preventDefault();
			const itemUrl = (item.getField && item.getField('url') || '').trim();
			if (!itemUrl) {
				iaStatus.textContent = 'Item has no URL.';
				iaStatus.style.color = 'var(--accent-red, red)';
				return;
			}
			iaSyncBtn.disabled = true;
			iaStatus.textContent = 'Asking Internet Archive…';
			iaStatus.style.color = 'var(--fill-secondary)';
			try {
				const result = await ctx.archive.syncUrl(itemUrl);
				if (result.archived) {
					iaInput.value = result.archived;
					iaStatus.textContent = result.source === 'spn'
						? 'Fresh snapshot saved (unsaved — click Save).'
						: 'Latest existing snapshot found (unsaved — click Save).';
					iaStatus.style.color = 'var(--accent-green, green)';
				}
				else {
					iaStatus.textContent = 'No snapshot available.';
					iaStatus.style.color = 'var(--accent-red, red)';
				}
			}
			catch (err) {
				Zotero.logError(err);
				iaStatus.textContent = 'Sync failed: ' + (err && err.message ? err.message : err);
				iaStatus.style.color = 'var(--accent-red, red)';
			}
			finally { iaSyncBtn.disabled = !editable; }
		},
	}, '↻ Sync IA');
	const iaTopRow = dsEl(doc, 'div', {
		style: { display: 'flex', gap: '4px', alignItems: 'center' },
	}, [iaInput, iaOpenBtn, iaSyncBtn]);
	root.appendChild(dsRow(doc, 'IA snapshot', dsEl(doc, 'div', {
		style: { display: 'flex', flexDirection: 'column', gap: '3px' },
	}, [iaTopRow, iaStatus])));

	// Buttons
	const status = dsEl(doc, 'div', {
		style: { fontSize: '11px', color: 'var(--fill-secondary)', marginTop: '4px' },
	}, '');

	function applyGuess(guess) {
		if (guess.key && !keyInput.value) keyInput.value = guess.key;
		if (guess.slice && !sliceInput.value) sliceInput.value = guess.slice;
		const fillSelect = (sel, value) => {
			if (!value || sel.value) return;
			if (![...sel.options].some(o => o.value === value)) {
				sel.appendChild(dsEl(doc, 'option', { value }, `${value} (custom)`));
			}
			sel.value = value;
		};
		fillSelect(formatSel, guess.format);
		fillSelect(typeSel, guess.type);
		fillSelect(importerSel, guess.importer);
	}

	const inferBtn = dsEl(doc, 'button', {
		type: 'button', disabled: !editable,
		title: 'Infer key / slice / format / type / importer from URL and title',
		onClick: (e) => {
			e.preventDefault();
			const u = (item.getField && item.getField('url')) || '';
			const t = (item.getField && item.getField('title')) || '';
			const guess = ctx.inferDataset({ url: u, title: t });
			applyGuess(guess);
			status.textContent = 'Auto-classified (unsaved — click Save).';
			status.style.color = 'var(--accent-green, green)';
		},
	}, '↻ Auto-classify');

	const saveBtn = dsEl(doc, 'button', {
		type: 'button', disabled: !editable,
		onClick: async (e) => {
			e.preventDefault();
			saveBtn.disabled = true;
			revertBtn.disabled = true;
			status.textContent = 'Saving…';
			status.style.color = 'var(--fill-secondary)';
			try {
				await ctx.writeDatasetDescriptors(item, readDatasetForm(root));
				status.textContent = 'Saved.';
				status.style.color = 'var(--accent-green, green)';
			}
			catch (err) {
				Zotero.logError(err);
				status.textContent = 'Save failed: ' + (err && err.message ? err.message : err);
				status.style.color = 'var(--accent-red, red)';
			}
			finally {
				saveBtn.disabled = !editable;
				revertBtn.disabled = !editable;
			}
		},
	}, 'Save');
	const revertBtn = dsEl(doc, 'button', {
		type: 'button', disabled: !editable,
		onClick: (e) => { e.preventDefault(); renderDatasetSection(body, item, editable, ctx); },
	}, 'Revert');

	const buttons = dsEl(doc, 'div', {
		style: {
			display: 'flex', gap: '6px', marginTop: '6px',
			alignItems: 'center', flexWrap: 'wrap',
		},
	}, [inferBtn, saveBtn, revertBtn, status]);
	root.appendChild(buttons);

	body.appendChild(root);
}

this.renderDatasetSection = renderDatasetSection;
