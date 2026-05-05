/* exported classifyAttachments */
/* global Zotero */

async function classifyAttachments(window, ctx, items) {
	const candidates = (items || []).filter(it => it && it.isAttachment && it.isAttachment());
	if (!candidates.length) {
		try {
			(window || Services.wm.getMostRecentWindow('navigator:browser'))
				.alert('OHM: select one or more attachments first.');
		}
		catch {}
		return;
	}

	const pw = new Zotero.ProgressWindow({ closeOnClick: false });
	pw.changeHeadline(`OHM Auto-classify — 0/${candidates.length}`);
	pw.show();

	const rowProgress = new Map();
	for (const it of candidates) {
		const title = (it.getDisplayTitle && it.getDisplayTitle())
			|| (it.getField && it.getField('title'))
			|| it.key;
		const ip = new pw.ItemProgress(
			'chrome://zotero/skin/treesource-search.png',
			title,
		);
		rowProgress.set(it.key, ip);
	}

	let updated = 0;
	let skipped = 0;
	let failed = 0;

	for (let i = 0; i < candidates.length; i++) {
		const it = candidates[i];
		const ip = rowProgress.get(it.key);
		try {
			const url = (it.getField && it.getField('url')) || '';
			const title = (it.getField && it.getField('title')) || '';
			const guess = ctx.inferDataset({ url, title });
			const cur = ctx.readDatasetDescriptors(it);

			let changed = false;
			const next = { ...cur };
			for (const k of ['key', 'slice', 'format', 'type', 'importer']) {
				if (guess[k] && !cur[k]) {
					next[k] = guess[k];
					changed = true;
				}
			}

			if (changed) {
				await ctx.writeDatasetDescriptors(it, next);
				updated++;
				if (ip && ip.setIcon) ip.setIcon('chrome://zotero/skin/tick.png');
			}
			else {
				skipped++;
			}
		}
		catch (e) {
			Zotero.logError(e);
			failed++;
			if (ip && ip.setError) ip.setError();
		}

		pw.changeHeadline(`OHM Auto-classify — ${i + 1}/${candidates.length}`);
	}

	pw.changeHeadline(
		`OHM Auto-classify — ${updated} updated, ${skipped} unchanged, ${failed} failed`,
	);
	pw.startCloseTimer(8000);
}

this.classifyAttachments = classifyAttachments;
