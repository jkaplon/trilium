import BoardApi from "./api";
import { DragContext } from "./drag_types";
import { NoteDragHandler } from "./note_drag_handler";
import { ColumnDragHandler } from "./column_drag_handler";

export class BoardDragHandler {
    private noteDragHandler: NoteDragHandler;
    private columnDragHandler: ColumnDragHandler;

    constructor(
        $container: JQuery<HTMLElement>,
        api: BoardApi,
        context: DragContext,
    ) {
        // Initialize specialized drag handlers
        this.noteDragHandler = new NoteDragHandler($container, api, context);
        this.columnDragHandler = new ColumnDragHandler($container, api, context);
    }

    // Note drag methods - delegate to NoteDragHandler
    setupNoteDrag($noteEl: JQuery<HTMLElement>, note: any, branch: any) {
        this.noteDragHandler.setupNoteDrag($noteEl, note, branch);
    }

    setupNoteDropZone($columnEl: JQuery<HTMLElement>, column: string) {
        this.noteDragHandler.setupNoteDropZone($columnEl, column);
    }

    // Column drag methods - delegate to ColumnDragHandler
    setupColumnDrag($columnEl: JQuery<HTMLElement>, columnValue: string) {
        this.columnDragHandler.setupColumnDrag($columnEl, columnValue);
    }

    setupColumnDropZone($columnEl: JQuery<HTMLElement>) {
        this.columnDragHandler.setupColumnDropZone($columnEl);
    }

    cleanup() {
        this.noteDragHandler.cleanup();
        this.columnDragHandler.cleanup();
    }
}

// Export the drag context type for external use
export type { DragContext } from "./drag_types";
