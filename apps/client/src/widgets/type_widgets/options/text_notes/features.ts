import { OptionMap } from "@triliumnext/commons";
import OptionsWidget from "../options_widget";
import { t } from "../../../../services/i18n";

const TPL = /*html*/`
<div class="options-section">
    <h4>${t("editorfeatures.title")}</h4>

    <div>
        <label class="tn-checkbox">
            <input type="checkbox" name="emoji-completion-enabled" />
            ${t("editorfeatures.emoji_completion_enabled")}
        </label>
    </div>

    <div>
        <label class="tn-checkbox">
            <input type="checkbox" name="note-completion-enabled" />
            ${t("editorfeatures.note_completion_enabled")}
        </label>
    </div>
</div>
`;

export default class EditorFeaturesOptions extends OptionsWidget {

    private $emojiCompletionEnabledCheckbox!: JQuery<HTMLElement>;
    private $noteCompletionEnabledCheckbox!: JQuery<HTMLElement>;

    doRender() {
        this.$widget = $(TPL);

        this.$emojiCompletionEnabledCheckbox = this.$widget.find(`input[name="emoji-completion-enabled"]`);
        this.$emojiCompletionEnabledCheckbox.on("change", () => this.updateCheckboxOption("textNoteEmojiCompletionEnabled", this.$emojiCompletionEnabledCheckbox))

        this.$noteCompletionEnabledCheckbox = this.$widget.find(`input[name="note-completion-enabled"]`);
        this.$noteCompletionEnabledCheckbox.on("change", () => this.updateCheckboxOption("textNoteCompletionEnabled", this.$noteCompletionEnabledCheckbox))
    }

    optionsLoaded(options: OptionMap) {
        this.setCheckboxState(this.$emojiCompletionEnabledCheckbox, options.textNoteEmojiCompletionEnabled);
        this.setCheckboxState(this.$noteCompletionEnabledCheckbox, options.textNoteCompletionEnabled);
    }

}
