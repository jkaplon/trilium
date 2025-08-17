import NoteContextAwareWidget from "../note_context_aware_widget.js";
import attributeService from "../../services/attributes.js";
import { t } from "../../services/i18n.js";
import type FNote from "../../entities/fnote.js";
import type { EventData } from "../../components/app_context.js";
import { bookPropertiesConfig, BookProperty } from "./book_properties_config.js";
import attributes from "../../services/attributes.js";
import type { ViewTypeOptions } from "../../services/note_list_renderer.js";

const VIEW_TYPE_MAPPINGS: Record<ViewTypeOptions, string> = {
    grid: t("book_properties.grid"),
    list: t("book_properties.list"),
    calendar: t("book_properties.calendar"),
    table: t("book_properties.table"),
    geoMap: t("book_properties.geo-map"),
    board: t("book_properties.board")
};

const TPL = /*html*/`
<div class="book-properties-widget">
    <style>
        .book-properties-widget {
            padding: 12px 12px 6px 12px;
            display: flex;
        }

        .book-properties-widget > * {
            margin-right: 15px;
        }

        .book-properties-container {
            display: flex;
            align-items: center;
        }

        .book-properties-container > div {
            margin-right: 15px;
        }

        .book-properties-container > .type-number > label {
            display: flex;
            align-items: baseline;
        }

        .book-properties-container input[type="checkbox"] {
            margin-right: 5px;
        }

        .book-properties-container label {
            display: flex;
            justify-content: center;
            align-items: center;
            text-overflow: clip;
            white-space: nowrap;
        }
    </style>

    <div style="display: flex; align-items: baseline">
        <span style="white-space: nowrap">${t("book_properties.view_type")}:&nbsp; &nbsp;</span>

        <select class="view-type-select form-select form-select-sm">
            ${Object.entries(VIEW_TYPE_MAPPINGS)
                .filter(([type]) => type !== "raster")
                .map(([type, label]) => `
                <option value="${type}">${label}</option>
            `).join("")}
        </select>
    </div>

    <div class="book-properties-container">
    </div>
</div>
`;

export default class BookPropertiesWidget extends NoteContextAwareWidget {

    private $viewTypeSelect!: JQuery<HTMLElement>;
    private $propertiesContainer!: JQuery<HTMLElement>;
    private labelsToWatch: string[] = [];

    get name() {
        return "bookProperties";
    }

    get toggleCommand() {
        return "toggleRibbonTabBookProperties";
    }

    isEnabled() {
        return this.note && this.note.type === "book";
    }

    getTitle() {
        return {
            show: this.isEnabled(),
            title: t("book_properties.book_properties"),
            icon: "bx bx-book"
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();

        this.$viewTypeSelect = this.$widget.find(".view-type-select");
        this.$viewTypeSelect.on("change", () => this.toggleViewType(String(this.$viewTypeSelect.val())));

        this.$propertiesContainer = this.$widget.find(".book-properties-container");
    }

    async refreshWithNote(note: FNote) {
        if (!this.note) {
            return;
        }

        const viewType = this.note.getLabelValue("viewType") || "grid";

        this.$viewTypeSelect.val(viewType);

        this.$propertiesContainer.empty();

        const bookPropertiesData = bookPropertiesConfig[viewType];
        if (bookPropertiesData) {
            for (const property of bookPropertiesData.properties) {
                this.$propertiesContainer.append(this.renderBookProperty(property));
                this.labelsToWatch.push(property.bindToLabel);
            }
        }
    }

    async toggleViewType(type: string) {
        if (!this.noteId) {
            return;
        }

        if (!VIEW_TYPE_MAPPINGS.hasOwnProperty(type)) {
            throw new Error(t("book_properties.invalid_view_type", { type }));
        }

        await attributeService.setLabel(this.noteId, "viewType", type);
    }

    entitiesReloadedEvent({ loadResults }: EventData<"entitiesReloaded">) {
        if (loadResults.getAttributeRows().find((attr) =>
                attr.noteId === this.noteId
                && (attr.name === "viewType" || this.labelsToWatch.includes(attr.name ?? "")))) {
            this.refresh();
        }
    }

    renderBookProperty(property: BookProperty) {
        const $container = $("<div>");
        $container.addClass(`type-${property.type}`);
        const note = this.note;
        if (!note) {
            return $container;
        }
        switch (property.type) {
            case "checkbox":
                const $label = $("<label>").text(property.label);
                const $checkbox = $("<input>", {
                    type: "checkbox",
                    class: "form-check-input",
                });
                $checkbox.on("change", () => {
                    if ($checkbox.prop("checked")) {
                        attributes.setLabel(note.noteId, property.bindToLabel);
                    } else {
                        attributes.removeOwnedLabelByName(note, property.bindToLabel);
                    }
                });
                $checkbox.prop("checked", note.hasOwnedLabel(property.bindToLabel));
                $label.prepend($checkbox);
                $container.append($label);
                break;
            case "button":
                const $button = $("<button>", {
                    type: "button",
                    class: "btn btn-sm"
                }).text(property.label);
                if (property.title) {
                    $button.attr("title", property.title);
                }
                if (property.icon) {
                    $button.prepend($("<span>", { class: property.icon }));
                }
                $button.on("click", () => {
                    property.onClick({
                        note,
                        triggerCommand: this.triggerCommand.bind(this)
                    });
                });
                $container.append($button);
                break;
            case "number":
                const $numberInput = $("<input>", {
                    type: "number",
                    class: "form-control form-control-sm",
                    value: note.getLabelValue(property.bindToLabel) || "",
                    width: property.width ?? 100,
                    min: property.min ?? 0
                });
                $numberInput.on("change", () => {
                    const value = $numberInput.val();
                    if (value === "") {
                        attributes.removeOwnedLabelByName(note, property.bindToLabel);
                    } else {
                        attributes.setLabel(note.noteId, property.bindToLabel, String(value));
                    }
                });
                $container.append($("<label>")
                    .text(property.label)
                    .append("&nbsp;".repeat(2))
                    .append($numberInput));
                break;
            case "combobox":
                const $select = $("<select>", {
                    class: "form-select form-select-sm"
                });
                const actualValue = note.getLabelValue(property.bindToLabel) ?? property.defaultValue ?? "";
                for (const option of property.options) {
                    if ("items" in option) {
                        const $optGroup = $("<optgroup>", { label: option.name });
                        for (const item of option.items) {
                            buildComboBoxItem(item, actualValue).appendTo($optGroup);
                        }
                        $optGroup.appendTo($select);
                    } else {
                        buildComboBoxItem(option, actualValue).appendTo($select);
                    }
                }
                $select.on("change", () => {
                    const value = $select.val();
                    if (value === null || value === "") {
                        attributes.removeOwnedLabelByName(note, property.bindToLabel);
                    } else {
                        attributes.setLabel(note.noteId, property.bindToLabel, String(value));
                    }
                });
                $container.append($("<label>")
                    .text(property.label)
                    .append("&nbsp;".repeat(2))
                    .append($select));
                break;
        }

        return $container;
    }


}

function buildComboBoxItem({ value, label }: { value: string, label: string }, actualValue: string) {
    const $option = $("<option>", {
        value,
        text: label
    });
    if (actualValue === value) {
        $option.prop("selected", true);
    }
    return $option;
}
