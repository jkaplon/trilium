import { Tabulator } from "tabulator-tables";
import AttributeDetailWidget from "../../attribute_widgets/attribute_detail";
import { Attribute } from "../../../services/attribute_parser";
import Component from "../../../components/component";
import { CommandListenerData, EventData } from "../../../components/app_context";
import attributes from "../../../services/attributes";
import FNote from "../../../entities/fnote";
import { deleteColumn, renameColumn } from "./bulk_actions";
import dialog from "../../../services/dialog";
import { t } from "../../../services/i18n";

export default class TableColumnEditing extends Component {

    private attributeDetailWidget: AttributeDetailWidget;
    private api: Tabulator;
    private parentNote: FNote;

    private newAttribute?: Attribute;
    private newAttributePosition?: number;
    private existingAttributeToEdit?: Attribute;

    constructor($parent: JQuery<HTMLElement>, parentNote: FNote, api: Tabulator) {
        super();
        const parentComponent = glob.getComponentByEl($parent[0]);
        this.attributeDetailWidget = new AttributeDetailWidget()
                .contentSized()
                .setParent(parentComponent);
        $parent.append(this.attributeDetailWidget.render());
        this.api = api;
        this.parentNote = parentNote;
    }

    addNewTableColumnCommand({ referenceColumn, columnToEdit, direction, type }: EventData<"addNewTableColumn">) {
        let attr: Attribute | undefined;

        this.existingAttributeToEdit = undefined;
        if (columnToEdit) {
            attr = this.getAttributeFromField(columnToEdit.getField());
            if (attr) {
                this.existingAttributeToEdit = { ...attr };
            }
        }

        if (!attr) {
            attr = {
                type: "label",
                name: `${type ?? "label"}:myLabel`,
                value: "promoted,single,text",
                isInheritable: true
            };
        }

        if (referenceColumn && this.api) {
            this.newAttributePosition = this.api.getColumns().indexOf(referenceColumn);

            if (direction === "after") {
                this.newAttributePosition++;
            }
        } else {
            this.newAttributePosition = undefined;
        }

        this.attributeDetailWidget!.showAttributeDetail({
            attribute: attr,
            allAttributes: [ attr ],
            isOwned: true,
            x: 0,
            y: 150,
            focus: "name",
            hideMultiplicity: true
        });
    }

    async updateAttributeListCommand({ attributes }: CommandListenerData<"updateAttributeList">) {
        this.newAttribute = attributes[0];
    }

    async saveAttributesCommand() {
        if (!this.newAttribute) {
            return;
        }

        const { name, value, isInheritable } = this.newAttribute;

        this.api.blockRedraw();
        const isRename = (this.existingAttributeToEdit && this.existingAttributeToEdit.name !== name);
        try {
            if (isRename) {
                const oldName = this.existingAttributeToEdit!.name.split(":")[1];
                const [ type, newName ] = name.split(":");
                await renameColumn(this.parentNote.noteId, type as "label" | "relation", oldName, newName);
            }

            if (this.existingAttributeToEdit && (isRename || this.existingAttributeToEdit.isInheritable !== isInheritable)) {
                attributes.removeOwnedLabelByName(this.parentNote, this.existingAttributeToEdit.name);
            }
            attributes.setLabel(this.parentNote.noteId, name, value, isInheritable);
        } finally {
            this.api.restoreRedraw();
        }
    }

    async deleteTableColumnCommand({ columnToDelete }: CommandListenerData<"deleteTableColumn">) {
        if (!columnToDelete || !await dialog.confirm(t("table_view.delete_column_confirmation"))) {
            return;
        }

        let [ type, name ] = columnToDelete.getField()?.split(".", 2);
        if (!type || !name) {
            return;
        }
        type = type.replace("s", "");

        this.api.blockRedraw();
        try {
            await deleteColumn(this.parentNote.noteId, type as "label" | "relation", name);
            attributes.removeOwnedLabelByName(this.parentNote, `${type}:${name}`);
        } finally {
            this.api.restoreRedraw();
        }
    }

    getNewAttributePosition() {
        return this.newAttributePosition;
    }

    resetNewAttributePosition() {
        this.newAttribute = undefined;
        this.newAttributePosition = undefined;
        this.existingAttributeToEdit = undefined;
    }

    getFAttributeFromField(field: string) {
        const [ type, name ] = field.split(".", 2);
        const attrName = `${type.replace("s", "")}:${name}`;
        return this.parentNote.getLabel(attrName);
    }

    getAttributeFromField(field: string): Attribute | undefined {
        const fAttribute = this.getFAttributeFromField(field);
        if (fAttribute) {
            return {
                name: fAttribute.name,
                value: fAttribute.value,
                type: fAttribute.type,
                isInheritable: fAttribute.isInheritable
            };
        }
        return undefined;
    }

}
