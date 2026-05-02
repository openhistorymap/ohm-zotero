/* eslint-env mozilla/chrome-script */
/* global Zotero, Services, ChromeUtils */

var OHM;

function install() {}
function uninstall() {}

async function startup({ id, version, rootURI }, _reason) {
	await Zotero.initializationPromise;

	const scope = { Zotero };
	for (const path of [
		'lib/api.js',
		'lib/tags.js',
		'lib/section.js',
		'lib/preferences.js',
	]) {
		Services.scriptloader.loadSubScript(rootURI + path, scope);
	}

	OHM = {
		id,
		version,
		rootURI,
		api: new scope.OHMApi(),
		readDescriptors: scope.readOHMDescriptors,
		writeDescriptors: scope.writeOHMDescriptors,
		buildTags: scope.buildOHMTags,
		renderSection: scope.renderOHMSection,
		bindPreferences: scope.bindOHMPreferences,
		sectionID: null,
	};
	Zotero.OHM = OHM;

	try {
		Zotero.PreferencePanes.register({
			pluginID: id,
			src: rootURI + 'content/preferences.xhtml',
			scripts: [rootURI + 'lib/preferences.js'],
			image: rootURI + 'content/icons/ohm.svg',
			label: 'OHM Data Index',
		});
	}
	catch (e) {
		Zotero.logError(e);
	}

	OHM.sectionID = Zotero.ItemPaneManager.registerSection({
		paneID: 'ohm-descriptors',
		pluginID: id,
		header: {
			l10nID: 'ohm-section-header',
			icon: rootURI + 'content/icons/ohm.svg',
		},
		sidenav: {
			l10nID: 'ohm-section-sidenav',
			icon: rootURI + 'content/icons/ohm.svg',
		},
		onRender: ({ body, item, editable }) => {
			OHM.renderSection(body, item, editable !== false, OHM);
		},
		onItemChange: ({ body, item, setEnabled }) => {
			const ok = !!(item && (
				(item.isRegularItem && item.isRegularItem())
				|| (item.isAttachment && item.isAttachment())
			));
			if (typeof setEnabled === 'function') setEnabled(ok);
			if (ok) OHM.renderSection(body, item, true, OHM);
			else body.replaceChildren();
		},
	});
}

function shutdown() {
	try {
		if (OHM && OHM.sectionID && Zotero.ItemPaneManager) {
			Zotero.ItemPaneManager.unregisterSection(OHM.sectionID);
		}
	}
	catch (e) {
		Zotero.logError(e);
	}
	if (Zotero.OHM === OHM) delete Zotero.OHM;
	OHM = undefined;
}
