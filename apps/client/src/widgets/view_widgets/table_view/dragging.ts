import type { Tabulator } from "tabulator-tables";
import type FNote from "../../../entities/fnote.js";
import branches from "../../../services/branches.js";

export function canReorderRows(parentNote: FNote) {
    return !parentNote.hasLabel("sorted")
        && parentNote.type !== "search";
}

export function configureReorderingRows(tabulator: Tabulator) {
    tabulator.on("rowMoved", (row) => {
        const branchIdsToMove = [ row.getData().branchId ];

        const prevRow = row.getPrevRow();
        if (prevRow) {
            branches.moveAfterBranch(branchIdsToMove, prevRow.getData().branchId);
            return;
        }

        const nextRow = row.getNextRow();
        if (nextRow) {
            branches.moveBeforeBranch(branchIdsToMove, nextRow.getData().branchId);
        }
    });
}
