import { executeBulkActions } from "../../../services/bulk_action.js";

export async function renameColumn(parentNoteId: string, type: "label" | "relation", originalName: string, newName: string) {
    if (type === "label") {
        return executeBulkActions([parentNoteId], [{
            name: "renameLabel",
            oldLabelName: originalName,
            newLabelName: newName
        }], true);
    } else {
        return executeBulkActions([parentNoteId], [{
            name: "renameRelation",
            oldRelationName: originalName,
            newRelationName: newName
        }], true);
    }
}

export async function deleteColumn(parentNoteId: string, type: "label" | "relation", columnName: string) {
    if (type === "label") {
        return executeBulkActions([parentNoteId], [{
            name: "deleteLabel",
            labelName: columnName
        }], true);
    } else {
        return executeBulkActions([parentNoteId], [{
            name: "deleteRelation",
            relationName: columnName
        }], true);
    }
}
