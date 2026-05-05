/* eslint-env mozilla/chrome-script */
/* global Zotero, Services, ChromeUtils */

var OHM;

this.install = function install(_data, _reason) {};
this.uninstall = function uninstall(_data, _reason) {};

this.startup = async function startup({ id, version, rootURI }, _reason) {
	await Zotero.initializationPromise;

	const scope = { Zotero };
	for (const path of [
		'lib/api.js',
		'lib/tags.js',
		'lib/section.js',
		'lib/columns.js',
		'lib/archive.js',
		'lib/dataset_tags.js',
		'lib/dataset_infer.js',
		'lib/dataset_section.js',
		'lib/classify.js',
	]) {
		Services.scriptloader.loadSubScript(rootURI + path, scope);
	}

	OHM = {
		id,
		version,
		rootURI,
		api: new scope.OHMApi(),
		archive: new scope.OHMArchive(),
		archiveItems: scope.archiveItems,
		classifyAttachments: scope.classifyAttachments,
		inferDataset: scope.inferDataset,
		readDescriptors: scope.readOHMDescriptors,
		writeDescriptors: scope.writeOHMDescriptors,
		buildTags: scope.buildOHMTags,
		readDatasetDescriptors: scope.readDatasetDescriptors,
		writeDatasetDescriptors: scope.writeDatasetDescriptors,
		buildDatasetTags: scope.buildDatasetTags,
		renderSection: scope.renderOHMSection,
		renderDatasetSection: scope.renderDatasetSection,
		registerColumns: scope.registerOHMColumns,
		unregisterColumns: scope.unregisterOHMColumns,
		sectionID: null,
		datasetSectionID: null,
		columnsHandle: null,
		windows: new WeakSet(),
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

	OHM.columnsHandle = await OHM.registerColumns(OHM);

	// Bootstrap menu entry into already-open main windows.
	const enumerator = Services.wm.getEnumerator('navigator:browser');
	while (enumerator.hasMoreElements()) {
		const win = enumerator.getNext();
		if (win && win.ZoteroPane) installMenuEntry(win);
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
			const ok = !!(item && item.isRegularItem && item.isRegularItem());
			if (typeof setEnabled === 'function') setEnabled(ok);
			if (ok) OHM.renderSection(body, item, true, OHM);
			else body.replaceChildren();
		},
	});

	OHM.datasetSectionID = Zotero.ItemPaneManager.registerSection({
		paneID: 'ohm-dataset',
		pluginID: id,
		header: {
			l10nID: 'ohm-dataset-section-header',
			icon: rootURI + 'content/icons/ohm.svg',
		},
		sidenav: {
			l10nID: 'ohm-dataset-section-sidenav',
			icon: rootURI + 'content/icons/ohm.svg',
		},
		onRender: ({ body, item, editable }) => {
			OHM.renderDatasetSection(body, item, editable !== false, OHM);
		},
		onItemChange: ({ body, item, setEnabled }) => {
			const ok = !!(item && item.isAttachment && item.isAttachment());
			if (typeof setEnabled === 'function') setEnabled(ok);
			if (ok) OHM.renderDatasetSection(body, item, true, OHM);
			else body.replaceChildren();
		},
	});
};

function installMenuEntry(window) {
	if (!window || !window.document || OHM.windows.has(window)) return;
	OHM.windows.add(window);
	const doc = window.document;
	const popup = doc.getElementById('menu_ToolsPopup');
	if (!popup) return;

	if (!doc.getElementById('ohm-tools-archive-selected')) {
		const item = doc.createXULElement('menuitem');
		item.id = 'ohm-tools-archive-selected';
		item.setAttribute('label', 'OHM: Archive selected URLs (Internet Archive)');
		item.addEventListener('command', async () => {
			try {
				const ZP = window.ZoteroPane || Zotero.getActiveZoteroPane();
				if (!ZP) return;
				const sel = ZP.getSelectedItems().filter(it => it && it.isRegularItem && it.isRegularItem());
				await OHM.archiveItems(window, OHM, sel);
			}
			catch (e) {
				Zotero.logError(e);
			}
		});
		popup.appendChild(item);
	}

	if (!doc.getElementById('ohm-tools-classify-selected')) {
		const item2 = doc.createXULElement('menuitem');
		item2.id = 'ohm-tools-classify-selected';
		item2.setAttribute('label', 'OHM: Auto-classify selected datasets');
		item2.addEventListener('command', async () => {
			try {
				const ZP = window.ZoteroPane || Zotero.getActiveZoteroPane();
				if (!ZP) return;
				const sel = ZP.getSelectedItems().filter(it => it && it.isAttachment && it.isAttachment());
				await OHM.classifyAttachments(window, OHM, sel);
			}
			catch (e) {
				Zotero.logError(e);
			}
		});
		popup.appendChild(item2);
	}
}

function removeMenuEntry(window) {
	if (!window || !window.document) return;
	OHM.windows.delete(window);
	for (const id of ['ohm-tools-archive-selected', 'ohm-tools-classify-selected']) {
		const node = window.document.getElementById(id);
		if (node) node.remove();
	}
}

this.onMainWindowLoad = function ({ window }) {
	try {
		if (OHM) installMenuEntry(window);
	}
	catch (e) {
		Zotero.logError(e);
	}
};

this.onMainWindowUnload = function ({ window }) {
	try {
		if (OHM) removeMenuEntry(window);
	}
	catch (e) {
		Zotero.logError(e);
	}
};

this.shutdown = function shutdown(_data, _reason) {
	try {
		if (OHM && OHM.sectionID && Zotero.ItemPaneManager) {
			Zotero.ItemPaneManager.unregisterSection(OHM.sectionID);
		}
	}
	catch (e) {
		Zotero.logError(e);
	}
	try {
		if (OHM && OHM.datasetSectionID && Zotero.ItemPaneManager) {
			Zotero.ItemPaneManager.unregisterSection(OHM.datasetSectionID);
		}
	}
	catch (e) {
		Zotero.logError(e);
	}
	try {
		if (OHM && OHM.columnsHandle && OHM.unregisterColumns) {
			OHM.unregisterColumns(OHM.columnsHandle);
		}
	}
	catch (e) {
		Zotero.logError(e);
	}
	try {
		const enumerator = Services.wm.getEnumerator('navigator:browser');
		while (enumerator.hasMoreElements()) {
			const win = enumerator.getNext();
			if (win && win.document) removeMenuEntry(win);
		}
	}
	catch (e) {
		Zotero.logError(e);
	}
	if (Zotero.OHM === OHM) delete Zotero.OHM;
	OHM = undefined;
};
