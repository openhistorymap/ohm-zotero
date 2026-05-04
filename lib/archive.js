/* exported OHMArchive */
/* global Zotero */

const SPN_URL = 'https://web.archive.org/save/';
const AVAIL_URL = 'https://archive.org/wayback/available';
const SNAPSHOT_RE = /^https?:\/\/web\.archive\.org\/web\/\d{14}/;

class OHMArchive {
	async savePageNow(url) {
		if (!url) return null;
		try {
			const xhr = await Zotero.HTTP.request('GET', SPN_URL + url, {
				timeout: 120000,
			});
			const finalUrl = xhr.responseURL
				|| (xhr.channel && xhr.channel.URI && xhr.channel.URI.spec)
				|| null;
			if (finalUrl && SNAPSHOT_RE.test(finalUrl)) return finalUrl;
			const cl = xhr.getResponseHeader && xhr.getResponseHeader('Content-Location');
			if (cl) {
				const abs = cl.startsWith('http') ? cl : 'https://web.archive.org' + cl;
				if (SNAPSHOT_RE.test(abs)) return abs;
			}
			return null;
		}
		catch (e) {
			Zotero.logError(e);
			return null;
		}
	}

	async getLatestSnapshot(url) {
		if (!url) return null;
		try {
			const xhr = await Zotero.HTTP.request('GET',
				`${AVAIL_URL}?url=${encodeURIComponent(url)}`,
				{ responseType: 'json', timeout: 10000 });
			const data = xhr.response || JSON.parse(xhr.responseText || '{}');
			const snap = data && data.archived_snapshots && data.archived_snapshots.closest;
			if (snap && snap.available && snap.url) return snap.url;
			return null;
		}
		catch (e) {
			Zotero.logError(e);
			return null;
		}
	}

	async syncUrl(url) {
		if (!url) return { archived: null, source: null };
		const fresh = await this.savePageNow(url);
		if (fresh) return { archived: fresh, source: 'spn' };
		const cached = await this.getLatestSnapshot(url);
		if (cached) return { archived: cached, source: 'wayback' };
		return { archived: null, source: null };
	}
}

async function archiveItems(window, ctx, items) {
	const eligible = items.filter(it => it.isRegularItem && it.isRegularItem() && it.getField('url'));
	if (eligible.length === 0) {
		const pw = new Zotero.ProgressWindow();
		pw.changeHeadline('OHM Archive');
		pw.addLines(['No selected items with a URL.']);
		pw.show();
		pw.startCloseTimer(4000);
		return { ok: 0, fail: 0, skipped: items.length };
	}

	const pw = new Zotero.ProgressWindow({ closeOnClick: false });
	pw.changeHeadline(`OHM: archiving ${eligible.length} URL${eligible.length === 1 ? '' : 's'}…`);
	pw.show();

	const archive = ctx.archive;
	let ok = 0;
	let fail = 0;

	for (let i = 0; i < eligible.length; i++) {
		const item = eligible[i];
		const title = item.getField('title') || '(untitled)';
		const url = item.getField('url');
		const ip = new pw.ItemProgress(null, `${i + 1}/${eligible.length} ${title}`);
		ip.setProgress(50);

		try {
			const result = await archive.syncUrl(url);
			if (result.archived) {
				const desc = ctx.readDescriptors(item);
				desc.iarchive_url = result.archived;
				await ctx.writeDescriptors(item, desc);
				ip.setProgress(100);
				ip.setText(`✓ ${result.source === 'spn' ? 'fresh snapshot' : 'cached snapshot'}`);
				ok++;
			}
			else {
				ip.setError();
				ip.setText('✗ no snapshot available');
				fail++;
			}
		}
		catch (e) {
			Zotero.logError(e);
			ip.setError();
			ip.setText('✗ error: ' + (e && e.message ? e.message : e));
			fail++;
		}

		if (i < eligible.length - 1) {
			await new Promise(r => window.setTimeout(r, 3000));
		}
	}

	pw.changeHeadline(`OHM Archive — ${ok} saved, ${fail} failed`);
	pw.startCloseTimer(10000);
	return { ok, fail, skipped: items.length - eligible.length };
}

this.OHMArchive = OHMArchive;
this.archiveItems = archiveItems;
