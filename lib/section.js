/* exported renderOHMSection */
/* global Zotero */

const SUBTOPIC_FALLBACK = ['location', 'structure', 'model', 'events', 'usage', 'general', 'indexes'];
const HTML_NS = 'http://www.w3.org/1999/xhtml';

// Mirrors ohmi/topics.json. Used for immediate-render dropdown population
// so the section is usable before /indices resolves (or if it never does).
// populateVocab augments this list with anything new the API returns.
const OHM_TOPICS = [
	{ id: 'agriculture' },
	{ id: 'climate' },
	{ id: 'economy' },
	{ id: 'entertainment' },
	{ id: 'ephemeral' },
	{ id: 'geography' },
	{ id: 'industry' },
	{ group: 'Infrastructure', items: [
		{ id: 'infrastructure:air' },
		{ id: 'infrastructure:roads' },
		{ id: 'infrastructure:water' },
	] },
	{ id: 'politics' },
	{ id: 'religion' },
	{ id: 'urban' },
	{ id: 'war' },
];

function topicLabel(id) {
	if (!id) return '';
	return id.split(':')
		.map(p => p.charAt(0).toUpperCase() + p.slice(1))
		.join(' / ');
}

function topicLabelInGroup(id) {
	const last = id.includes(':') ? id.split(':').pop() : id;
	return last.charAt(0).toUpperCase() + last.slice(1);
}

function flattenTopicIds(entries) {
	const out = [];
	for (const e of entries) {
		if (e.group) for (const it of e.items) out.push(it.id);
		else out.push(e.id);
	}
	return out;
}

function populateTopicSelect(doc, sel, current, entries) {
	sel.replaceChildren();
	sel.appendChild(el(doc, 'option', { value: '' }, '— none —'));
	for (const e of entries) {
		if (e.group) {
			const og = el(doc, 'optgroup', { label: e.group });
			for (const it of e.items) {
				og.appendChild(el(doc, 'option', { value: it.id }, topicLabelInGroup(it.id)));
			}
			sel.appendChild(og);
		}
		else {
			sel.appendChild(el(doc, 'option', { value: e.id }, topicLabel(e.id)));
		}
	}
	const known = new Set(flattenTopicIds(entries));
	if (current && !known.has(current)) {
		sel.appendChild(el(doc, 'option', { value: current }, `${topicLabel(current)} (custom)`));
	}
	sel.value = current || '';
}

function populateSubtopicSelect(doc, sel, current, subs) {
	const cur = current || '';
	sel.replaceChildren();
	sel.appendChild(el(doc, 'option', { value: '' }, '— none —'));
	for (const s of subs) {
		sel.appendChild(el(doc, 'option', { value: s }, s.charAt(0).toUpperCase() + s.slice(1)));
	}
	if (cur && !subs.includes(cur)) {
		sel.appendChild(el(doc, 'option', { value: cur }, `${cur} (custom)`));
	}
	sel.value = cur;
}

function el(doc, tag, attrs, children) {
	const node = doc.createElementNS(HTML_NS, tag);
	if (attrs) {
		for (const [k, v] of Object.entries(attrs)) {
			if (v === false || v === null || v === undefined) continue;
			if (k === 'style' && typeof v === 'object') {
				for (const [sk, sv] of Object.entries(v)) node.style[sk] = sv;
			}
			else if (k.startsWith('on') && typeof v === 'function') {
				node.addEventListener(k.slice(2).toLowerCase(), v);
			}
			else if (k === 'dataset' && typeof v === 'object') {
				for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
			}
			else if (v === true) {
				node.setAttribute(k, '');
			}
			else {
				node.setAttribute(k, String(v));
			}
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

function row(doc, label, control, opts = {}) {
	return el(doc, 'div', {
		style: {
			display: 'grid',
			gridTemplateColumns: opts.wide ? '120px 1fr' : '120px 1fr',
			alignItems: 'center',
			gap: '6px',
			marginBottom: '4px',
		},
	}, [
		el(doc, 'label', { style: { color: 'var(--fill-secondary)', fontSize: '11px' } }, label),
		control,
	]);
}

function statusLine(doc, text, color) {
	return el(doc, 'div', {
		style: {
			fontSize: '11px',
			color: color || 'var(--fill-secondary)',
			marginTop: '4px',
		},
	}, text);
}

function readForm(root) {
	const $ = id => root.querySelector(`[data-ohm="${id}"]`);
	const num = v => (v === '' || v === null || v === undefined ? null : Number(v));
	const ia = $('iarchive_url');
	const desc = {
		from_time: num($('from_time').value),
		to_time: num($('to_time').value),
		topic: ($('topic').value || '').trim(),
		subtopic: ($('subtopic').value || '').trim(),
		quality: num($('quality').value),
		reliability: num($('reliability').value),
		iarchive_url: ia ? (ia.value || '').trim() : '',
		areas: [],
		extra: [],
	};
	for (const li of root.querySelectorAll('[data-ohm-area-row]')) {
		const v = (li.querySelector('input').value || '').trim();
		if (v) desc.areas.push(v);
	}
	for (const li of root.querySelectorAll('[data-ohm-extra-row]')) {
		const inputs = li.querySelectorAll('input');
		const name = (inputs[0].value || '').trim();
		const value = (inputs[1].value || '').trim();
		if (name) desc.extra.push({ name, value });
	}
	return desc;
}

function renderOHMSection(body, item, editable, ctx) {
	body.replaceChildren();
	if (!item || !item.isRegularItem || !item.isRegularItem()) return;

	const doc = body.ownerDocument;
	const desc = ctx.readDescriptors(item);
	const root = el(doc, 'div', {
		'data-ohm-root': '',
		style: {
			display: 'flex',
			flexDirection: 'column',
			gap: '4px',
			padding: '6px 8px 8px',
			fontSize: '12px',
		},
	});

	// Year range
	const fromInput = el(doc, 'input', {
		type: 'number',
		step: 'any',
		'data-ohm': 'from_time',
		value: desc.from_time ?? '',
		placeholder: 'e.g. -1500',
		disabled: !editable,
		style: { width: '100%', boxSizing: 'border-box' },
	});
	const toInput = el(doc, 'input', {
		type: 'number',
		step: 'any',
		'data-ohm': 'to_time',
		value: desc.to_time ?? '',
		placeholder: 'e.g. -1200',
		disabled: !editable,
		style: { width: '100%', boxSizing: 'border-box' },
	});
	root.appendChild(row(doc, 'From year', fromInput));
	root.appendChild(row(doc, 'To year', toInput));

	// Topic + subtopic — populate immediately from the hardcoded OHM list,
	// then let populateVocab augment with anything new the API returns.
	const topicSel = el(doc, 'select', {
		'data-ohm': 'topic',
		disabled: !editable,
		style: { width: '100%', boxSizing: 'border-box' },
	});
	const subSel = el(doc, 'select', {
		'data-ohm': 'subtopic',
		disabled: !editable,
		style: { width: '100%', boxSizing: 'border-box' },
	});
	let topicEntries = OHM_TOPICS.slice();
	populateTopicSelect(doc, topicSel, desc.topic, topicEntries);
	populateSubtopicSelect(doc, subSel, desc.subtopic, SUBTOPIC_FALLBACK);
	topicSel.addEventListener('change', () => {
		populateSubtopicSelect(doc, subSel, subSel.value, SUBTOPIC_FALLBACK);
	});
	root.appendChild(row(doc, 'Topic', topicSel));
	root.appendChild(row(doc, 'Sub-topic', subSel));

	// Quality / reliability
	const qInput = el(doc, 'input', {
		type: 'number',
		min: '0',
		max: '5',
		step: '1',
		'data-ohm': 'quality',
		value: desc.quality ?? '',
		disabled: !editable,
		style: { width: '6em' },
	});
	const rInput = el(doc, 'input', {
		type: 'number',
		min: '0',
		max: '5',
		step: '1',
		'data-ohm': 'reliability',
		value: desc.reliability ?? '',
		disabled: !editable,
		style: { width: '6em' },
	});
	root.appendChild(row(doc, 'Quality (0-5)', qInput));
	root.appendChild(row(doc, 'Reliability (0-5)', rInput));

	// Areas (geonames)
	const areasList = el(doc, 'div', {
		'data-ohm': 'areas',
		style: { display: 'flex', flexDirection: 'column', gap: '3px' },
	});
	const areaIndex = { byId: new Map() };

	function makeAreaRow(value) {
		const input = el(doc, 'input', {
			type: 'text',
			value: value || '',
			placeholder: 'GeoNames ID (e.g. 3175395)',
			disabled: !editable,
			style: { flex: '1', minWidth: '0' },
		});
		const labelSpan = el(doc, 'span', {
			style: { fontSize: '11px', color: 'var(--fill-secondary)', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
		}, '');
		const updateLabel = () => {
			const v = (input.value || '').trim();
			const m = areaIndex.byId.get(v);
			labelSpan.textContent = m ? `– ${m.name}${m.adminName1 ? ', ' + m.adminName1 : ''}` : '';
		};
		input.addEventListener('input', updateLabel);
		updateLabel();
		const remove = el(doc, 'button', {
			type: 'button',
			disabled: !editable,
			title: 'Remove',
			style: { padding: '0 6px' },
			onClick: (e) => { e.preventDefault(); rowEl.remove(); },
		}, '×');
		const rowEl = el(doc, 'div', {
			'data-ohm-area-row': '',
			style: { display: 'flex', gap: '4px', alignItems: 'center' },
		}, [input, labelSpan, remove]);
		return rowEl;
	}

	for (const a of desc.areas) areasList.appendChild(makeAreaRow(a));

	// GeoNames search box
	const searchInput = el(doc, 'input', {
		type: 'text',
		placeholder: 'Search GeoNames (e.g. "Lazio")…',
		disabled: !editable,
		style: { flex: '1', minWidth: '0' },
	});
	const searchStatus = el(doc, 'span', {
		style: { fontSize: '11px', color: 'var(--fill-secondary)' },
	}, '');
	const suggestions = el(doc, 'div', {
		style: {
			display: 'none',
			flexDirection: 'column',
			border: '1px solid var(--fill-quinary, #ccc)',
			borderRadius: '3px',
			maxHeight: '180px',
			overflowY: 'auto',
			background: 'var(--material-background, #fff)',
		},
	});
	const searchRow = el(doc, 'div', {
		style: { display: 'flex', gap: '4px', alignItems: 'center' },
	}, [searchInput, searchStatus]);

	let searchTimer = null;
	let searchSeq = 0;
	function clearSuggestions() {
		suggestions.replaceChildren();
		suggestions.style.display = 'none';
	}
	function pickResult(g) {
		const id = String(g.geonameId);
		areaIndex.byId.set(id, {
			id,
			name: g.name,
			adminName1: g.adminName1 || g.countryName || '',
		});
		const newRow = makeAreaRow(id);
		areasList.appendChild(newRow);
		newRow.querySelector('input').dispatchEvent(new doc.defaultView.Event('input'));
		searchInput.value = '';
		clearSuggestions();
	}
	async function runSearch(q) {
		const seq = ++searchSeq;
		searchStatus.textContent = '…';
		try {
			const results = await ctx.api.searchGeoNames(q, 10);
			if (seq !== searchSeq) return;
			suggestions.replaceChildren();
			if (!results.length) {
				searchStatus.textContent = 'no matches';
				suggestions.style.display = 'none';
				return;
			}
			searchStatus.textContent = `${results.length} result${results.length === 1 ? '' : 's'}`;
			for (const g of results) {
				const subtitle = [g.adminName1, g.countryName].filter(Boolean).join(', ');
				const fcode = [g.fcl, g.fcode].filter(Boolean).join(':');
				const item = el(doc, 'div', {
					style: {
						padding: '3px 6px',
						cursor: 'pointer',
						borderBottom: '1px solid var(--fill-quinary, #eee)',
						display: 'flex',
						justifyContent: 'space-between',
						gap: '6px',
					},
					onClick: () => pickResult(g),
				}, [
					el(doc, 'span', {}, [
						el(doc, 'strong', {}, g.name || '(unnamed)'),
						subtitle ? el(doc, 'span', { style: { color: 'var(--fill-secondary)', marginLeft: '4px' } }, `– ${subtitle}`) : null,
					]),
					el(doc, 'span', {
						style: { fontSize: '10px', color: 'var(--fill-secondary)', whiteSpace: 'nowrap' },
					}, `${g.geonameId}${fcode ? ' · ' + fcode : ''}`),
				]);
				suggestions.appendChild(item);
			}
			suggestions.style.display = 'flex';
		}
		catch (e) {
			if (seq !== searchSeq) return;
			searchStatus.textContent = 'search failed';
			suggestions.style.display = 'none';
		}
	}
	searchInput.addEventListener('input', () => {
		const q = searchInput.value.trim();
		if (searchTimer) doc.defaultView.clearTimeout(searchTimer);
		if (q.length < 2) {
			searchSeq++;
			searchStatus.textContent = '';
			clearSuggestions();
			return;
		}
		searchTimer = doc.defaultView.setTimeout(() => runSearch(q), 350);
	});

	const addAreaBtn = el(doc, 'button', {
		type: 'button',
		disabled: !editable,
		onClick: (e) => {
			e.preventDefault();
			areasList.appendChild(makeAreaRow(''));
		},
		style: { alignSelf: 'flex-start', marginTop: '2px' },
	}, '+ Add area (manual ID)');
	const areasWrap = el(doc, 'div', {
		style: { display: 'flex', flexDirection: 'column', gap: '3px' },
	}, [searchRow, suggestions, areasList, addAreaBtn]);
	root.appendChild(row(doc, 'Areas', areasWrap));

	// Extra ohm:* tags
	const extrasList = el(doc, 'div', {
		'data-ohm': 'extra',
		style: { display: 'flex', flexDirection: 'column', gap: '3px' },
	});
	function makeExtraRow(name, value) {
		const ki = el(doc, 'input', {
			type: 'text', value: name || '', placeholder: 'ohm:something',
			disabled: !editable,
			style: { flex: '1', minWidth: '0' },
		});
		const vi = el(doc, 'input', {
			type: 'text', value: value || '', placeholder: 'value',
			disabled: !editable,
			style: { flex: '1', minWidth: '0' },
		});
		const remove = el(doc, 'button', {
			type: 'button', disabled: !editable, title: 'Remove',
			style: { padding: '0 6px' },
			onClick: (e) => { e.preventDefault(); rowEl.remove(); },
		}, '×');
		const rowEl = el(doc, 'div', {
			'data-ohm-extra-row': '',
			style: { display: 'flex', gap: '4px', alignItems: 'center' },
		}, [ki, vi, remove]);
		return rowEl;
	}
	for (const x of desc.extra) extrasList.appendChild(makeExtraRow(x.name, x.value));
	const addExtraBtn = el(doc, 'button', {
		type: 'button',
		disabled: !editable,
		onClick: (e) => {
			e.preventDefault();
			extrasList.appendChild(makeExtraRow('ohm:', ''));
		},
		style: { alignSelf: 'flex-start', marginTop: '2px' },
	}, '+ Add ohm:* tag');
	const extrasWrap = el(doc, 'div', {
		style: { display: 'flex', flexDirection: 'column', gap: '3px' },
	}, [extrasList, addExtraBtn]);
	root.appendChild(row(doc, 'Extra tags', extrasWrap));

	// Internet Archive row
	const iaInput = el(doc, 'input', {
		type: 'text',
		'data-ohm': 'iarchive_url',
		value: desc.iarchive_url || '',
		placeholder: '(no snapshot — click Sync IA)',
		disabled: !editable,
		style: { flex: '1', minWidth: '0' },
	});
	const iaOpenBtn = el(doc, 'button', {
		type: 'button',
		title: 'Open archived URL in browser',
		style: { padding: '0 6px' },
		onClick: (e) => {
			e.preventDefault();
			const u = (iaInput.value || '').trim();
			if (u) Zotero.launchURL(u);
		},
	}, '↗');
	const iaStatus = el(doc, 'span', {
		style: { fontSize: '11px', color: 'var(--fill-secondary)' },
	}, '');
	const iaSyncBtn = el(doc, 'button', {
		type: 'button',
		disabled: !editable,
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
			iaStatus.textContent = 'Asking Internet Archive… (up to 60s)';
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
			finally {
				iaSyncBtn.disabled = !editable;
			}
		},
	}, '↻ Sync IA');
	const iaTopRow = el(doc, 'div', {
		style: { display: 'flex', gap: '4px', alignItems: 'center' },
	}, [iaInput, iaOpenBtn, iaSyncBtn]);
	const iaWrap = el(doc, 'div', {
		style: { display: 'flex', flexDirection: 'column', gap: '3px' },
	}, [iaTopRow, iaStatus]);
	root.appendChild(row(doc, 'IA snapshot', iaWrap));

	// Status + buttons
	const status = statusLine(doc, '');
	const saveBtn = el(doc, 'button', {
		type: 'button',
		disabled: !editable,
		onClick: async (e) => {
			e.preventDefault();
			saveBtn.disabled = true;
			revertBtn.disabled = true;
			status.textContent = 'Saving…';
			status.style.color = 'var(--fill-secondary)';
			try {
				await ctx.writeDescriptors(item, readForm(root));
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
	const revertBtn = el(doc, 'button', {
		type: 'button',
		disabled: !editable,
		onClick: (e) => {
			e.preventDefault();
			renderOHMSection(body, item, editable, ctx);
		},
	}, 'Revert');
	const refreshBtn = el(doc, 'button', {
		type: 'button',
		title: 'Refresh OHM vocabularies from the data index API',
		onClick: async (e) => {
			e.preventDefault();
			ctx.api.resetCache();
			status.textContent = 'Refreshing vocabularies…';
			await populateVocab(true);
			status.textContent = 'Vocabularies refreshed.';
		},
	}, '↻ Refresh');
	const buttons = el(doc, 'div', {
		style: { display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' },
	}, [saveBtn, revertBtn, refreshBtn, status]);
	root.appendChild(buttons);

	body.appendChild(root);

	// ---- async vocabulary population ----
	async function populateVocab(force = false) {
		try {
			const [topics, areas] = await Promise.all([
				ctx.api.topics(),
				ctx.api.areas(),
			]);

			const apiTopicIds = Object.keys(topics || {});
			const known = new Set(flattenTopicIds(OHM_TOPICS));
			const extras = apiTopicIds.filter(t => !known.has(t)).sort();
			topicEntries = extras.length
				? OHM_TOPICS.concat(extras.map(id => ({ id })))
				: OHM_TOPICS.slice();
			populateTopicSelect(doc, topicSel, topicSel.value || desc.topic, topicEntries);

			const fillSubs = () => {
				const branch = topics[topicSel.value] || {};
				const subs = Object.keys(branch).length ? Object.keys(branch) : SUBTOPIC_FALLBACK;
				populateSubtopicSelect(doc, subSel, subSel.value, subs);
			};
			fillSubs();
			topicSel.addEventListener('change', fillSubs);

			areaIndex.byId.clear();
			for (const a of areas || []) {
				if (a && a.id) areaIndex.byId.set(String(a.id), a);
			}
			for (const r of areasList.querySelectorAll('[data-ohm-area-row] input')) {
				r.dispatchEvent(new doc.defaultView.Event('input'));
			}
			if (force) status.textContent = '';
		}
		catch (err) {
			Zotero.logError(err);
			status.textContent = 'OHM API unreachable — using built-in topic list.';
			status.style.color = 'var(--fill-secondary)';
		}
	}
	populateVocab();
}

this.renderOHMSection = renderOHMSection;
