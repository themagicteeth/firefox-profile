// -sp-context: browser
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 *
 * xseei.export-all.js
 * ===================
 * code-revision 3
 *   https://gist.github.com/nohamelin/6af8907ca2dd90a9c870629c396c9521
 *
 * ABOUT
 * -----
 * It's a minimal no-configurable no-localized single-file re-package of the
 * "Export All Search Engines as OpenSearch XML files in a ZIP File" feature
 * of the "XML Search Engines Exporter/Importer" (XSEEI) legacy add-on for
 * Mozilla Firefox:
 *   https://addons.mozilla.org/firefox/addon/search-engines-export-import/
 *
 * ...to be used in those Firefox builds not supporting anymore legacy add-ons
 * (i.e. Firefox 57 and later versions), where the unique system available
 * to create extensions (called "WebExtensions") doesn't let to implement this
 * functionality.
 * As a bonus, it supports Gecko-comparable releases of the SeaMonkey suite
 * too, that did not receive any official compatible release of the add-on.
 *
 * COMPATIBILITY
 * -------------
 * It has been checked to work with:
 *   - Firefox 57, 58, 59 & 60
 *   - Firefox ESR 60.0
 *   - Firefox Developer Edition 61.0b5
 *   - SeaMonkey 2.49.1
 *
 * HOW TO RUN
 * ----------
 * It's expected to be run via the Javascript Scratchpad tool:
 *   https://developer.mozilla.org/en-US/docs/Tools/Scratchpad
 *
 * You will need to have enabled "Enable browser chrome and add-on debugging
 * toolboxes" in the Developer Tools settings (or, alternatively, ensure that
 * the preference *devtools.chrome.enabled* is set to true via about:config).
 * Then:
 *
 *  1) Use the "Open File..." command in the Scratchpad to load this file.
 *     A "This scratchpad executes in the Browser context" warning should be
 *     shown on top of the contents of the file. Otherwise, go to the
 *     "Environment" menu and ensure that "Browser" is selected.
 *  2) Make sure there is no selected text in the editor, and use the command
 *     "Run". A file dialog will be open, to select where the ZIP file with
 *     your search engines will be saved. After picking it, a Javascript dialog
 *     will be shown to confirm you the successful task. Otherwise, check the
 *     Browser Console by any related error messages.
 *
 * CONTACT
 * -------
 * You can use any of the provided support channels for the source add-on:
 *   https://github.com/nohamelin/xseei
 *   http://forums.mozillazine.org/viewtopic.php?f=48&t=3020165
 *
 * SEE ALSO
 * --------
 * xseei.import.js:
 *   https://gist.github.com/nohamelin/8e2e1b50dc7d97044992ae981487c6ec
 */


(function() {
"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

const MOZSEARCH_NS = "http://www.mozilla.org/2006/browser/search/";
const OPENSEARCH_NS = "http://a9.com/-/spec/opensearch/1.1/";

const MOZSEARCH_EMPTY_ENGINE_DOC = `<?xml version="1.0"?>
<SearchPlugin xmlns="${MOZSEARCH_NS}" xmlns:os="${OPENSEARCH_NS}"/>
`;


function exportAllEnginesToFile() {
    let engines = Services.search.getVisibleEngines();

    let fp = Cc["@mozilla.org/filepicker;1"]
                    .createInstance(Ci.nsIFilePicker);
    fp.init(window, "Export All Search Engines", Ci.nsIFilePicker.modeSave);
    fp.appendFilter("ZIP Files", "*.zip");
    fp.defaultString = "searchengines " + filenameDateString() + ".zip";
    fp.defaultExtension = "zip";
    fp.open({
        done: result => {
            if (result === Ci.nsIFilePicker.returnCancel)
                return;

            saveEnginesToZipFile(engines, fp.file).then(() => {
                alert("Successful export");
            }).catch(Cu.reportError);
        }
    });
}

function saveEnginesToZipFile(engines, file) {
    return Promise.resolve().then(() => {
        if (engines.length === 0) {
            throw Error("the given engines array must not be empty");
        }

        let zw = Cc["@mozilla.org/zipwriter;1"]
                    .createInstance(Ci.nsIZipWriter);
        zw.open(file, FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE
                                            | FileUtils.MODE_TRUNCATE);

        let serializer = new XMLSerializer();
        let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                        .createInstance(Ci.nsIScriptableUnicodeConverter);
        converter.charset = "UTF-8";

        engines.forEach(engine => {
            let doc = serializeEngineToDocument(engine);
            let str = serializer.serializeToString(doc);
            let istream = converter.convertToInputStream(str);

            // Engines with very similar names can end with the same
            // sanitized filename; we catch these to add a proper suffix.
            let filename = sanitizeEngineName(engine.name);
            if (zw.hasEntry(filename + ".xml")) {
                let candidateFilename;
                let apparitions = 1;
                do {
                    candidateFilename = `${filename} (${apparitions})`;
                    apparitions += 1;
                } while (zw.hasEntry(candidateFilename + ".xml"));
                filename = candidateFilename;
            }

            zw.addEntryStream(filename + ".xml",
                              Date.now() * 1000,
                              Ci.nsIZipWriter.COMPRESSION_DEFAULT,
                              istream,
                              false);
        });
        zw.close();
    });
}

function serializeEngineToDocument(engine) {
    let e = engine.wrappedJSObject;
    let doc = (new DOMParser()).parseFromString(MOZSEARCH_EMPTY_ENGINE_DOC,
                                                "application/xml");

    doc.documentElement.appendChild(doc.createTextNode("\n"));
    appendTextNode(doc, OPENSEARCH_NS, "ShortName", e.name);
    appendTextNode(doc, OPENSEARCH_NS, "Description", e.description);
    appendTextNode(doc, OPENSEARCH_NS, "InputEncoding", e.queryCharset);
    if (e.iconURI) {
        let imageNode = appendTextNode(doc, OPENSEARCH_NS, "Image",
                                       e.iconURI.spec);
        if (imageNode) {
            imageNode.setAttribute("width", "16");
            imageNode.setAttribute("height", "16");
        }
    }
    appendTextNode(doc, MOZSEARCH_NS, "UpdateInterval", e._updateInterval);
    appendTextNode(doc, MOZSEARCH_NS, "UpdateUrl", e._updateURL);
    appendTextNode(doc, MOZSEARCH_NS, "IconUpdateUrl", e._iconUpdateURL);
    appendTextNode(doc, MOZSEARCH_NS, "SearchForm", e.searchForm);
    if (e._extensionID) {
        appendTextNode(doc, MOZSEARCH_NS, "ExtensionID", e._extensionID);
    }
    for (let i = 0; i < e._urls.length; ++i) {
        addSerializedEngineUrlToElement(e._urls[i],
                                        doc,
                                        doc.documentElement);
        doc.documentElement.appendChild(doc.createTextNode("\n"));
    }
    return doc;
}

function addSerializedEngineUrlToElement(engineUrl, doc, element) {
    let url = doc.createElementNS(OPENSEARCH_NS, "Url");

    url.setAttribute("type", engineUrl.type);
    url.setAttribute("method", engineUrl.method);
    url.setAttribute("template", engineUrl.template);
    if (engineUrl.rels.length)
        url.setAttribute("rel", engineUrl.rels.join(" "));
    if (engineUrl.resultDomain)
        url.setAttribute("resultDomain", engineUrl.resultDomain);

    for (let i = 0; i < engineUrl.params.length; ++i) {
        if (engineUrl.params[i].purpose) {  // non-standard MozParam found
            continue;
        }
        let param = doc.createElementNS(OPENSEARCH_NS, "Param");
        param.setAttribute("name", engineUrl.params[i].name);
        param.setAttribute("value", engineUrl.params[i].value);
        url.appendChild(doc.createTextNode("\n  "));
        url.appendChild(param);
    }
    url.appendChild(doc.createTextNode("\n"));
    element.appendChild(url);
}

function appendTextNode(document, namespace, localName, value) {
    if (!value) return null;

    let node = document.createElementNS(namespace, localName);
    node.appendChild(document.createTextNode(value));
    document.documentElement.appendChild(node);
    document.documentElement.appendChild(document.createTextNode("\n"));
    return node;
}

function sanitizeEngineName(name) {
    name = name.toLowerCase()
               .replace(/\s+/g, "-")    // Replace spaces with a hyphen
               .replace(/-{2,}/g, "-")  // Reduce consecutive hyphens
               .normalize("NFKD")       // Decompose chars with diacritics
               .replace(/[^-a-z0-9]/g, "");     // Final cleaning
    if (name.length < 1) {
        name = Math.random().toString(36).replace(/^.*\./, "");
    }
    return name.substring(0, 60 /*=MAX_ENGINE_FILENAME_LENGTH*/);
}

function filenameDateString(date = new Date()) {
    let year = String(date.getFullYear()).padStart(4, "0");
    let month = String(date.getMonth() + 1).padStart(2, "0");
    let day = String(date.getDate()).padStart(2, "0");
    return [year, month, day].join("-");
}

// Run
exportAllEnginesToFile();

})();
