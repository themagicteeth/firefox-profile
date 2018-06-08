// -sp-context: browser
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 *
 * xseei.import.js
 * ===============
 * code-revision 1
 *   https://gist.github.com/nohamelin/8e2e1b50dc7d97044992ae981487c6ec
 *
 * ABOUT
 * -----
 * It's a minimal no-configurable no-localized single-file re-package of the
 * "Import Search Engines from local OpenSearch XML File(s)" feature of the
 * "XML Search Engines Exporter/Importer" (XSEEI) legacy add-on for Mozilla
 * Firefox:
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
 *   - Firefox Developer Edition 61.0b2
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
 *     "Run". A file dialog will be open, to select one or more XML files in
 *     the OpenSearch format to be selected. After picking them, a Javascript
 *     dialog will be shown to confirm you the successful importing task.
 *     Otherwise, check the Browser Console by any related error messages.
 *
 * CONTACT
 * -------
 * You can use any of the provided support channels for the source add-on:
 *   https://github.com/nohamelin/xseei
 *   http://forums.mozillazine.org/viewtopic.php?f=48&t=3020165
 *
 * SEE ALSO
 * --------
 * xseei.export-all.js:
 *   https://gist.github.com/nohamelin/6af8907ca2dd90a9c870629c396c9521
 */


(function() {
"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/osfile.jsm");


function importEnginesFromFiles() {
    let fp = Cc["@mozilla.org/filepicker;1"]
                    .createInstance(Ci.nsIFilePicker);
    fp.init(window,
            "Select XML Search Engine Files",
            Ci.nsIFilePicker.modeOpenMultiple);
    fp.appendFilters(Ci.nsIFilePicker.filterXML);
    fp.open({
        done: result => {
            if (result === Ci.nsIFilePicker.returnCancel)
                return;

            let xmlFiles = [];

            let files = fp.files;
            while (files.hasMoreElements()) {
                let file = files.getNext().QueryInterface(Ci.nsIFile);
                xmlFiles.push(file);
            }

            let importedEngines = [];
            // The use of this empty promise lets us to run sequentially
            // a group of promises, one for each engine. This process is
            // not stopped if one or more promises are rejected in between.
            let sequence = Promise.resolve();
            xmlFiles.forEach(file => {
                sequence = sequence.then(() => {
                    return addEngineFromXmlFile(file);
                }).then(engine => {
                    importedEngines.push(engine);
                }).catch(err => {  // Each engine is reported separately
                    Cu.reportError(
                        "Import of a search engine from the file '" +
                        file.leafName + "' failed: " + err.message || err);
                });
            });
            sequence.then(() => {
                if (importedEngines.length > 0) {
                    if (xmlFiles.length === importedEngines.length) {
                        alert("Successful import");
                    } else {
                        alert(importedEngines.length + " of " + xmlFiles.length
                              + " import tasks were successful");
                    }
                }
            }).catch(Cu.reportError);
        }
    });
}

function addEngineFromXmlFile(file) {
    return new Promise((resolve, reject) => {
        let uri = OS.Path.toFileURI(file.path);

        let searchInstallCallback = {
            onSuccess: engine => {
                resolve(engine);
            },
            onError: errorCode => {
                switch (errorCode) {
                    case Ci.nsISearchInstallCallback.ERROR_DUPLICATE_ENGINE:
                        reject(Error("a search engine with the included " +
                                     "name already exists"));
                        break;

                    case Ci.nsISearchInstallCallback.ERROR_UNKNOWN_FAILURE:
                    default:
                        reject(Error("unknown error"));
                        break;
                }
            }
        };

        Services.search.addEngine(uri,
                                  Ci.nsISearchEngine.DATA_XML,
                                  "",       // iconURL
                                  false,    // confirm
                                  searchInstallCallback);
    });
}


// Run
importEnginesFromFiles();

})();
