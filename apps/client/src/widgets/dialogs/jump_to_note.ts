import { t } from "../../services/i18n.js";
import noteAutocompleteService from "../../services/note_autocomplete.js";
import utils from "../../services/utils.js";
import appContext from "../../components/app_context.js";
import BasicWidget from "../basic_widget.js";
import shortcutService from "../../services/shortcuts.js";
import { Modal } from "bootstrap";
import { openDialog } from "../../services/dialog.js";
import commandRegistry from "../../services/command_registry.js";

const TPL = /*html*/`<div class="jump-to-note-dialog modal mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <div class="input-group">
                    <input class="jump-to-note-autocomplete form-control" placeholder="${t("jump_to_note.search_placeholder")}">
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="${t("jump_to_note.close")}"></button>
            </div>
            <div class="modal-body">
                <div class="algolia-autocomplete-container jump-to-note-results"></div>
            </div>
            <div class="modal-footer">
                <button class="show-in-full-text-button btn btn-sm">${t("jump_to_note.search_button")}</button>
            </div>
        </div>
    </div>
</div>`;

const KEEP_LAST_SEARCH_FOR_X_SECONDS = 120;

export default class JumpToNoteDialog extends BasicWidget {

    private lastOpenedTs: number;
    private modal!: bootstrap.Modal;
    private $autoComplete!: JQuery<HTMLElement>;
    private $results!: JQuery<HTMLElement>;
    private $modalFooter!: JQuery<HTMLElement>;
    private isCommandMode: boolean = false;

    constructor() {
        super();

        this.lastOpenedTs = 0;
    }

    doRender() {
        this.$widget = $(TPL);
        this.modal = Modal.getOrCreateInstance(this.$widget[0]);

        this.$autoComplete = this.$widget.find(".jump-to-note-autocomplete");
        this.$results = this.$widget.find(".jump-to-note-results");
        this.$modalFooter = this.$widget.find(".modal-footer");
        this.$modalFooter.find(".show-in-full-text-button").on("click", (e) => this.showInFullText(e));

        shortcutService.bindElShortcut(this.$widget, "ctrl+return", (e) => this.showInFullText(e));

        // Monitor input changes to detect command mode switches
        this.$autoComplete.on("input", () => {
            this.updateCommandModeState();
        });
    }

    private updateCommandModeState() {
        const currentValue = String(this.$autoComplete.val() || "");
        const newCommandMode = currentValue.startsWith(">");

        if (newCommandMode !== this.isCommandMode) {
            this.isCommandMode = newCommandMode;
            this.updateButtonVisibility();
        }
    }

    private updateButtonVisibility() {
        if (this.isCommandMode) {
            this.$modalFooter.hide();
        } else {
            this.$modalFooter.show();
        }
    }

    async jumpToNoteEvent() {
        await this.openDialog();
    }

    async commandPaletteEvent() {
        await this.openDialog(true);
    }

    private async openDialog(commandMode = false) {
        const dialogPromise = openDialog(this.$widget);
        if (utils.isMobile()) {
            dialogPromise.then(($dialog) => {
                const el = $dialog.find(">.modal-dialog")[0];

                function reposition() {
                    const offset = 100;
                    const modalHeight = (window.visualViewport?.height ?? 0) - offset;
                    const safeAreaInsetBottom = (window.visualViewport?.height ?? 0) - window.innerHeight;
                    el.style.height = `${modalHeight}px`;
                    el.style.bottom = `${(window.visualViewport?.height ?? 0) - modalHeight - safeAreaInsetBottom - offset}px`;
                }

                this.$autoComplete.on("focus", () => {
                    reposition();
                });

                window.visualViewport?.addEventListener("resize", () => {
                    reposition();
                });

                reposition();
            });
        }

        // first open dialog, then refresh since refresh is doing focus which should be visible
        this.refresh(commandMode);

        this.lastOpenedTs = Date.now();
    }

    async refresh(commandMode = false) {
        noteAutocompleteService
            .initNoteAutocomplete(this.$autoComplete, {
                allowCreatingNotes: true,
                hideGoToSelectedNoteButton: true,
                allowJumpToSearchNotes: true,
                container: this.$results[0],
                isCommandPalette: true
            })
            // clear any event listener added in previous invocation of this function
            .off("autocomplete:noteselected")
            .off("autocomplete:commandselected")
            .on("autocomplete:noteselected", function (event, suggestion, dataset) {
                if (!suggestion.notePath) {
                    return false;
                }

                appContext.tabManager.getActiveContext()?.setNote(suggestion.notePath);
            })
            .on("autocomplete:commandselected", async (event, suggestion, dataset) => {
                if (!suggestion.commandId) {
                    return false;
                }

                this.modal.hide();
                await commandRegistry.executeCommand(suggestion.commandId);
            });

        if (commandMode) {
            // Start in command mode - manually trigger command search
            this.$autoComplete.autocomplete("val", ">");
            this.isCommandMode = true;
            this.updateButtonVisibility();

            // Manually populate with all commands immediately
            noteAutocompleteService.showAllCommands(this.$autoComplete);

            this.$autoComplete.trigger("focus");
        } else {
            // if you open the Jump To dialog soon after using it previously, it can often mean that you
            // actually want to search for the same thing (e.g., you opened the wrong note at first try)
            // so we'll keep the content.
            // if it's outside of this time limit, then we assume it's a completely new search and show recent notes instead.
            if (Date.now() - this.lastOpenedTs > KEEP_LAST_SEARCH_FOR_X_SECONDS * 1000) {
                this.isCommandMode = false;
                this.updateButtonVisibility();
                noteAutocompleteService.showRecentNotes(this.$autoComplete);
            } else {
                this.$autoComplete
                    // hack, the actual search value is stored in <pre> element next to the search input
                    // this is important because the search input value is replaced with the suggestion note's title
                    .autocomplete("val", this.$autoComplete.next().text())
                    .trigger("focus")
                    .trigger("select");

                // Update command mode state based on the restored value
                this.updateCommandModeState();

                // If we restored a command mode value, manually trigger command display
                if (this.isCommandMode) {
                    // Clear the value first, then set it to ">" to trigger a proper change
                    this.$autoComplete.autocomplete("val", "");
                    noteAutocompleteService.showAllCommands(this.$autoComplete);
                }
            }
        }
    }

    showInFullText(e: JQuery.TriggeredEvent | KeyboardEvent) {
        // stop from propagating upwards (dangerous, especially with ctrl+enter executable javascript notes)
        e.preventDefault();
        e.stopPropagation();

        // Don't perform full text search in command mode
        if (this.isCommandMode) {
            return;
        }

        const searchString = String(this.$autoComplete.val());

        this.triggerCommand("searchNotes", { searchString });
        this.modal.hide();
    }
}
