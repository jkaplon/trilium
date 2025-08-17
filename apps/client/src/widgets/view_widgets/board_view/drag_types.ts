export interface DragContext {
    draggedNote: any;
    draggedBranch: any;
    draggedNoteElement: JQuery<HTMLElement> | null;
    draggedColumn: string | null;
    draggedColumnElement: JQuery<HTMLElement> | null;
}

export interface BaseDragHandler {
    cleanup(): void;
}
