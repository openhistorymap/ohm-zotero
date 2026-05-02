/* exported OHMApi */
/* global Zotero */

class OHMApi {
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
}
