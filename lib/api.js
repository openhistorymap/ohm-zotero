/* exported OHMApi */
/* global Zotero */

this.OHMApi = class OHMApi {
	constructor() {
		this._indices = null;
		this._inflight = null;
	}

	get baseUrl() {
		const raw = Zotero.Prefs.get('extensions.ohm.apiUrl', true)
			|| 'https://index.openhistorymap.org';
		return String(raw).replace(/\/+$/, '');
	}

	resetCache() {
		this._indices = null;
		this._inflight = null;
	}

	async getIndices(force = false) {
		if (this._indices && !force) return this._indices;
		if (this._inflight && !force) return this._inflight;
		this._inflight = (async () => {
			try {
				const xhr = await Zotero.HTTP.request('GET', this.baseUrl + '/indices', {
					responseType: 'json',
					timeout: 8000,
				});
				const data = xhr.response || JSON.parse(xhr.responseText || '[]');
				this._indices = Array.isArray(data) ? data : [];
				return this._indices;
			}
			catch (e) {
				Zotero.logError(e);
				this._indices = [];
				return this._indices;
			}
			finally {
				this._inflight = null;
			}
		})();
		return this._inflight;
	}

	async _entry(name) {
		const ix = await this.getIndices();
		const e = ix.find(x => x && x.name === name);
		return e ? e.values : null;
	}

	async topics() {
		const v = await this._entry('topics');
		return (v && typeof v === 'object') ? v : {};
	}

	async areas() {
		const v = await this._entry('areas');
		return Array.isArray(v) ? v : [];
	}

	async years() {
		const v = await this._entry('years');
		return Array.isArray(v) ? v : [];
	}

	async trees() {
		const v = await this._entry('trees');
		return (v && typeof v === 'object') ? v : {};
	}

	async pull() {
		// Tells the ohmi service to re-ingest the Zotero library. This walks
		// every item + every ohm:area's GeoNames hierarchy on the server side,
		// so it can take a while — give it 5 minutes before timing out.
		const xhr = await Zotero.HTTP.request('GET', this.baseUrl + '/pull', {
			responseType: 'text',
			timeout: 300000,
		});
		const raw = String(xhr.responseText || '').trim().replace(/^"|"$/g, '');
		return { ok: raw === 'ok', body: raw, status: xhr.status };
	}

	async searchGeoNames(q, maxRows = 10) {
		const query = (q || '').trim();
		if (query.length < 2) return [];
		const username = Zotero.Prefs.get('extensions.ohm.geonamesUsername', true) || 'openhistorymap';
		const url = 'https://secure.geonames.org/searchJSON'
			+ `?q=${encodeURIComponent(query)}`
			+ `&maxRows=${encodeURIComponent(maxRows)}`
			+ '&style=MEDIUM'
			+ `&username=${encodeURIComponent(username)}`;
		try {
			const xhr = await Zotero.HTTP.request('GET', url, {
				responseType: 'json',
				timeout: 8000,
			});
			const data = xhr.response || JSON.parse(xhr.responseText || '{}');
			if (data && data.status && data.status.message) {
				throw new Error(`GeoNames: ${data.status.message}`);
			}
			return Array.isArray(data.geonames) ? data.geonames : [];
		}
		catch (e) {
			Zotero.logError(e);
			throw e;
		}
	}
};
