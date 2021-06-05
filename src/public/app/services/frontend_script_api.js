import server from './server.js';
import utils from './utils.js';
import toastService from './toast.js';
import linkService from './link.js';
import froca from './froca.js';
import noteTooltipService from './note_tooltip.js';
import protectedSessionService from './protected_session.js';
import dateNotesService from './date_notes.js';
import searchService from './search.js';
import CollapsibleWidget from '../widgets/collapsible_widget.js';
import ws from "./ws.js";
import appContext from "./app_context.js";
import NoteContextAwareWidget from "../widgets/note_context_aware_widget.js";
import NoteContextCachingWidget from "../widgets/note_context_caching_widget.js";
import BasicWidget from "../widgets/basic_widget.js";

/**
 * This is the main frontend API interface for scripts. It's published in the local "api" object.
 *
 * @constructor
 * @hideconstructor
 */
function FrontendScriptApi(startNote, currentNote, originEntity = null, $container = null) {
    const $pluginButtons = $("#plugin-buttons");

    /** @property {jQuery} container of all the rendered script content */
    this.$container = $container;

    /** @property {object} note where script started executing */
    this.startNote = startNote;
    /** @property {object} note where script is currently executing */
    this.currentNote = currentNote;
    /** @property {object|null} entity whose event triggered this execution */
    this.originEntity = originEntity;

    // to keep consistency with backend API
    this.dayjs = dayjs;

    /** @property {CollapsibleWidget} */
    this.CollapsibleWidget = CollapsibleWidget;

    /** @property {NoteContextAwareWidget} */
    this.TabAwareWidget = NoteContextAwareWidget;

    /** @property {NoteContextCachingWidget} */
    this.TabCachingWidget = NoteContextCachingWidget;

    /** @property {BasicWidget} */
    this.BasicWidget = BasicWidget;

    /**
     * Activates note in the tree and in the note detail.
     *
     * @method
     * @param {string} notePath (or noteId)
     * @returns {Promise<void>}
     */
    this.activateNote = async notePath => {
        await appContext.tabManager.getActiveContext().setNote(notePath);
    };

    /**
     * Activates newly created note. Compared to this.activateNote() also makes sure that frontend has been fully synced.
     *
     * @param {string} notePath (or noteId)
     * @return {Promise<void>}
     */
    this.activateNewNote = async notePath => {
        await ws.waitForMaxKnownEntityChangeId();

        await appContext.tabManager.getActiveContext().setNote(notePath);
        appContext.triggerEvent('focusAndSelectTitle');
    };

    /**
     * Open a note in a new tab.
     *
     * @param {string} notePath (or noteId)
     * @param {boolean} activate - set to true to activate the new tab, false to stay on the current tab
     * @return {Promise<void>}
     */
    this.openTabWithNote = async (notePath, activate) => {
        await ws.waitForMaxKnownEntityChangeId();

        await appContext.tabManager.openContextWithNote(notePath, activate);

        if (activate) {
            appContext.triggerEvent('focusAndSelectTitle');
        }
    };

    /**
     * @typedef {Object} ToolbarButtonOptions
     * @property {string} title
     * @property {string} [icon] - name of the boxicon to be used (e.g. "time" for "bx-time" icon)
     * @property {function} action - callback handling the click on the button
     * @property {string} [shortcut] - keyboard shortcut for the button, e.g. "alt+t"
     */

    /**
     * Adds new button the the plugin area.
     *
     * @param {ToolbarButtonOptions} opts
     */
    this.addButtonToToolbar = opts => {
        const buttonId = "toolbar-button-" + opts.title.replace(/\s/g, "-");

        let button;
        if (utils.isMobile()) {
            $('#plugin-buttons-placeholder').remove();
            button = $('<a class="dropdown-item" href="#">')
                .on('click', () => {
                    setTimeout(() => $pluginButtons.dropdown('hide'), 0);
                });

            if (opts.icon) {
                button.append($("<span>").addClass("bx bx-" + opts.icon))
                    .append("&nbsp;");
            }

            button.append($("<span>").text(opts.title));
        } else {
            button = $('<span class="button-widget icon-action bx" data-toggle="tooltip" title="" data-placement="right"></span>')
                .addClass("bx bx-" + opts.icon);

            button.attr("title", opts.title);
            button.tooltip({html: true});
        }

        button = button.on('click', opts.action);

        button.attr('id', buttonId);

        if ($("#" + buttonId).replaceWith(button).length === 0) {
            $pluginButtons.append(button);
        }

        if (opts.shortcut) {
            utils.bindGlobalShortcut(opts.shortcut, opts.action);

            button.attr("title", "Shortcut " + opts.shortcut);
        }
    };

    function prepareParams(params) {
        if (!params) {
            return params;
        }

        return params.map(p => {
            if (typeof p === "function") {
                return "!@#Function: " + p.toString();
            }
            else {
                return p;
            }
        });
    }

    /**
     * Executes given anonymous function on the backend.
     * Internally this serializes the anonymous function into string and sends it to backend via AJAX.
     *
     * @param {string} script - script to be executed on the backend
     * @param {Array.<?>} params - list of parameters to the anonymous function to be send to backend
     * @return {Promise<*>} return value of the executed function on the backend
     */
    this.runOnBackend = async (script, params = []) => {
        if (typeof script === "function") {
            script = script.toString();
        }

        const ret = await server.post('script/exec', {
            script: script,
            params: prepareParams(params),
            startNoteId: startNote.noteId,
            currentNoteId: currentNote.noteId,
            originEntityName: "notes", // currently there's no other entity on frontend which can trigger event
            originEntityId: originEntity ? originEntity.noteId : null
        }, "script");

        if (ret.success) {
            await ws.waitForMaxKnownEntityChangeId();

            return ret.executionResult;
        }
        else {
            throw new Error("server error: " + ret.error);
        }
    };

    /**
     * @deprecated new name of this API call is runOnBackend so use that
     * @method
     */
    this.runOnServer = this.runOnBackend;

    /**
     * This is a powerful search method - you can search by attributes and their values, e.g.:
     * "#dateModified =* MONTH AND #log". See full documentation for all options at: https://github.com/zadam/trilium/wiki/Search
     *
     * @method
     * @param {string} searchString
     * @returns {Promise<NoteShort[]>}
     */
    this.searchForNotes = async searchString => {
        return await searchService.searchForNotes(searchString);
    };

    /**
     * This is a powerful search method - you can search by attributes and their values, e.g.:
     * "#dateModified =* MONTH AND #log". See full documentation for all options at: https://github.com/zadam/trilium/wiki/Search
     *
     * @method
     * @param {string} searchString
     * @returns {Promise<NoteShort|null>}
     */
    this.searchForNote = async searchString => {
        const notes = await this.searchForNotes(searchString);

        return notes.length > 0 ? notes[0] : null;
    };

    /**
     * Returns note by given noteId. If note is missing from cache, it's loaded.
     **
     * @param {string} noteId
     * @return {Promise<NoteShort>}
     */
    this.getNote = async noteId => await froca.getNote(noteId);

    /**
     * Returns list of notes. If note is missing from cache, it's loaded.
     *
     * This is often used to bulk-fill the cache with notes which would have to be picked one by one
     * otherwise (by e.g. createNoteLink())
     *
     * @param {string[]} noteIds
     * @param {boolean} [silentNotFoundError] - don't report error if the note is not found
     * @return {Promise<NoteShort[]>}
     */
    this.getNotes = async (noteIds, silentNotFoundError = false) => await froca.getNotes(noteIds, silentNotFoundError);

    /**
     * Update frontend tree (note) cache from the backend.
     *
     * @param {string[]} noteIds
     * @method
     */
    this.reloadNotes = async noteIds => await froca.reloadNotes(noteIds);

    /**
     * Instance name identifies particular Trilium instance. It can be useful for scripts
     * if some action needs to happen on only one specific instance.
     *
     * @return {string}
     */
    this.getInstanceName = () => window.glob.instanceName;

    /**
     * @method
     * @param {Date} date
     * @returns {string} date in YYYY-MM-DD format
     */
    this.formatDateISO = utils.formatDateISO;

    /**
     * @method
     * @param {string} str
     * @returns {Date} parsed object
     */
    this.parseDate = utils.parseDate;

    /**
     * Show info message to the user.
     *
     * @method
     * @param {string} message
     */
    this.showMessage = toastService.showMessage;

    /**
     * Show error message to the user.
     *
     * @method
     * @param {string} message
     */
    this.showError = toastService.showError;

    /**
     * @method
     * @deprecated - this is now no-op since all the changes should be gracefully handled per widget
     */
    this.refreshTree = () => {};

    /**
     * Create note link (jQuery object) for given note.
     *
     * @method
     * @param {string} notePath (or noteId)
     * @param {object} [params]
     * @param {boolean} [params.showTooltip=true] - enable/disable tooltip on the link
     * @param {boolean} [params.showNotePath=false] - show also whole note's path as part of the link
     * @param {string} [title=] - custom link tile with note's title as default
     */
    this.createNoteLink = linkService.createNoteLink;

    /**
     * Adds given text to the editor cursor
     *
     * @param {string} text - this must be clear text, HTML is not supported.
     * @method
     */
    this.addTextToActiveTabEditor = text => appContext.triggerCommand('addTextToActiveEditor', {text});

    /**
     * @method
     * @returns {NoteShort} active note (loaded into right pane)
     */
    this.getActiveTabNote = () => appContext.tabManager.getActiveContextNote();

    /**
     * See https://ckeditor.com/docs/ckeditor5/latest/api/module_core_editor_editor-Editor.html for a documentation on the returned instance.
     *
     * @method
     * @param callback - method receiving "textEditor" instance
     */
    this.getActiveTabTextEditor = callback => appContext.triggerCommand('executeInActiveEditor', {callback});

    /**
     * @method
     * @returns {Promise<string|null>} returns note path of active note or null if there isn't active note
     */
    this.getActiveTabNotePath = () => appContext.tabManager.getActiveContextNotePath();

    /**
     * @method
     * @param {object} $el - jquery object on which to setup the tooltip
     */
    this.setupElementTooltip = noteTooltipService.setupElementTooltip;

    /**
     * @deprecated use protectNote and protectSubtree instead
     * @method
     */
    this.protectActiveNote = async () => {
        const activeNote = appContext.tabManager.getActiveContextNote();

        await protectedSessionService.protectNote(activeNote.noteId, true, false);
    };

    /**
     * @method
     * @param {string} noteId
     * @param {boolean} protect - true to protect note, false to unprotect
     */
    this.protectNote = async (noteId, protect) => {
        await protectedSessionService.protectNote(noteId, protect, false);
    };

    /**
     * @method
     * @param {string} noteId
     * @param {boolean} protect - true to protect subtree, false to unprotect
     */
    this.protectSubTree = async (noteId, protect) => {
        await protectedSessionService.protectNote(noteId, protect, true);
    };

    /**
     * Returns date-note for today. If it doesn't exist, it is automatically created.
     *
     * @method
     * @return {Promise<NoteShort>}
     */
    this.getTodayNote = dateNotesService.getTodayNote;

    /**
     * Returns date-note. If it doesn't exist, it is automatically created.
     *
     * @method
     * @param {string} date - e.g. "2019-04-29"
     * @return {Promise<NoteShort>}
     */
    this.getDateNote = dateNotesService.getDateNote;

    /**
     * Returns month-note. If it doesn't exist, it is automatically created.
     *
     * @method
     * @param {string} month - e.g. "2019-04"
     * @return {Promise<NoteShort>}
     */
    this.getMonthNote = dateNotesService.getMonthNote;

    /**
     * Returns year-note. If it doesn't exist, it is automatically created.
     *
     * @method
     * @param {string} year - e.g. "2019"
     * @return {Promise<NoteShort>}
     */
    this.getYearNote = dateNotesService.getYearNote;

    /**
     * Hoist note in the current tab. See https://github.com/zadam/trilium/wiki/Note-hoisting
     *
     * @method
     * @param {string} noteId - set hoisted note. 'root' will effectively unhoist
     * @return {Promise}
     */
    this.setHoistedNoteId = (noteId) => {
        const activeNoteContext = appContext.tabManager.getActiveContext();

        if (activeNoteContext) {
            activeNoteContext.setHoistedNoteId(noteId);
        }
    };

    /**
     * @method
     * @param {string} keyboardShortcut - e.g. "ctrl+shift+a"
     * @param {function} handler
     */
    this.bindGlobalShortcut = utils.bindGlobalShortcut;

    /**
     * Trilium runs in backend and frontend process, when something is changed on the backend from script,
     * frontend will get asynchronously synchronized.
     *
     * This method returns a promise which resolves once all the backend -> frontend synchronization is finished.
     * Typical use case is when new note has been created, we should wait until it is synced into frontend and only then activate it.
     *
     * @method
     */
    this.waitUntilSynced = ws.waitForMaxKnownEntityChangeId;

    /**
     * This will refresh all currently opened notes which have included note specified in the parameter
     *
     * @param includedNoteId - noteId of the included note
     */
    this.refreshIncludedNote = includedNoteId => appContext.triggerEvent('refreshIncludedNote', {noteId: includedNoteId});

    /**
     * Return randomly generated string of given length. This random string generation is NOT cryptographically secure.
     *
     * @method
     * @param {number} length of the string
     * @returns {string} random string
     */
    this.randomString = utils.randomString;
}

export default FrontendScriptApi;
