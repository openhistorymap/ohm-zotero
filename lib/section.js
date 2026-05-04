/* exported renderOHMSection */
/* global Zotero */

const SUBTOPIC_FALLBACK = ['location', 'structure', 'model', 'events', 'usage', 'general', 'indexes'];
const HTML_NS = 'http://www.w3.org/1999/xhtml';

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
	const desc = {
		from_time: num($('from_time').value),
		to_time: num($('to_time').value),
		topic: ($('topic').value || '').trim(),
		subtopic: ($('subtopic').value || '').trim(),
		quality: num($('quality').value),
		reliability: num($('reliability').value),
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
	if (!item) return;
	const isItemTaggable = (item.isRegularItem && item.isRegularItem())
		|| (item.isAttachment && item.isAttachment())
		|| (item.isNote && item.isNote());
	if (!isItemTaggable) return;

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

	// Topic + subtopic (populated async)
	const topicSel = el(doc, 'select', {
		'data-ohm': 'topic',
		disabled: !editable,
		style: { width: '100%', boxSizing: 'border-box' },
	}, [
		el(doc, 'option', { value: desc.topic || '' }, desc.topic || '— loading —'),
	]);
	const subSel = el(doc, 'select', {
		'data-ohm': 'subtopic',
		disabled: !editable,
		style: { width: '100%', boxSizing: 'border-box' },
	}, [
		el(doc, 'option', { value: desc.subtopic || '' }, desc.subtopic || ''),
	]);
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
	const addAreaBtn = el(doc, 'button', {
		type: 'button',
		disabled: !editable,
		onClick: (e) => {
			e.preventDefault();
			areasList.appendChild(makeAreaRow(''));
		},
		style: { alignSelf: 'flex-start', marginTop: '2px' },
	}, '+ Add area');
	const areasWrap = el(doc, 'div', {
		style: { display: 'flex', flexDirection: 'column', gap: '3px' },
	}, [areasList, addAreaBtn]);
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
			const topicNames = Object.keys(topics || {});
			topicSel.replaceChildren();
			topicSel.appendChild(el(doc, 'option', { value: '' }, '— none —'));
			for (const name of topicNames) {
				topicSel.appendChild(el(doc, 'option', { value: name }, name));
			}
			if (desc.topic && !topicNames.includes(desc.topic)) {
				topicSel.appendChild(el(doc, 'option', { value: desc.topic }, `${desc.topic} (custom)`));
			}
			topicSel.value = desc.topic || '';

			const fillSubs = () => {
				const cur = subSel.value;
				const branch = topics[topicSel.value] || {};
				const subs = Object.keys(branch).length ? Object.keys(branch) : SUBTOPIC_FALLBACK;
				subSel.replaceChildren();
				subSel.appendChild(el(doc, 'option', { value: '' }, '— none —'));
				for (const s of subs) subSel.appendChild(el(doc, 'option', { value: s }, s));
				if (cur && !subs.includes(cur)) {
					subSel.appendChild(el(doc, 'option', { value: cur }, `${cur} (custom)`));
				}
				subSel.value = cur;
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
			topicSel.replaceChildren();
			topicSel.appendChild(el(doc, 'option', { value: desc.topic || '' }, desc.topic || ''));
			subSel.replaceChildren();
			subSel.appendChild(el(doc, 'option', { value: desc.subtopic || '' }, desc.subtopic || ''));
			status.textContent = 'OHM API unreachable — using stored values only.';
			status.style.color = 'var(--fill-secondary)';
		}
	}
	populateVocab();
}

this.renderOHMSection = renderOHMSection;
