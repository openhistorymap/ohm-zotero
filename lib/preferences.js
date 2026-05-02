/* exported bindOHMPreferences */
/* global Zotero, document */

(function () {
	function init() {
		const apiInput = document.getElementById('ohm-pref-apiurl');
		const tagInput = document.getElementById('ohm-pref-tagprefix');
		const status = document.getElementById('ohm-pref-status');
		if (!apiInput || !tagInput) return;

		apiInput.value = Zotero.Prefs.get('extensions.ohm.apiUrl', true) || '';
		tagInput.value = Zotero.Prefs.get('extensions.ohm.tagPrefix', true) || 'ohm:';

		apiInput.addEventListener('change', () => {
			Zotero.Prefs.set('extensions.ohm.apiUrl', apiInput.value.trim(), true);
			if (Zotero.OHM && Zotero.OHM.api) Zotero.OHM.api.resetCache();
		});
		tagInput.addEventListener('change', () => {
			Zotero.Prefs.set('extensions.ohm.tagPrefix', tagInput.value.trim() || 'ohm:', true);
		});

		const test = document.getElementById('ohm-pref-test');
		if (test) {
			test.addEventListener('command', async () => {
				if (!Zotero.OHM) return;
				status.value = 'Testing…';
				Zotero.OHM.api.resetCache();
				try {
					const ix = await Zotero.OHM.api.getIndices(true);
					status.value = ix && ix.length
						? `OK — ${ix.length} indices loaded.`
						: 'Reachable, but no indices returned.';
				}
				catch (e) {
					status.value = 'Failed: ' + (e && e.message ? e.message : e);
				}
			});
		}

		const clearBtn = document.getElementById('ohm-pref-clearcache');
		if (clearBtn) {
			clearBtn.addEventListener('command', () => {
				if (Zotero.OHM && Zotero.OHM.api) Zotero.OHM.api.resetCache();
				status.value = 'Cache cleared.';
			});
		}
	}

	if (document.readyState === 'complete' || document.readyState === 'interactive') {
		init();
	}
	else {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	}
})();
