import { setupHorizontalScrollViaWheel } from "../../widget_utils";
import ViewMode, { ViewModeArgs } from "../view_mode";
import noteCreateService from "../../../services/note_create";
import { EventData } from "../../../components/app_context";
import { BoardData } from "./config";
import SpacedUpdate from "../../../services/spaced_update";
import { setupContextMenu } from "./context_menu";
import BoardApi from "./api";
import { BoardDragHandler, DragContext } from "./drag_handler";
import { DifferentialBoardRenderer } from "./differential_renderer";

const TPL = /*html*/`
<div class="board-view">
    <style>
        .board-view {
            overflow-x: auto;
            position: relative;
            height: 100%;
            user-select: none;
        }

        .board-view-container {
            height: 100%;
            display: flex;
            gap: 1em;
            padding: 1em;
            padding-bottom: 0;
            align-items: flex-start;
        }

        .board-view-container .board-column {
            width: 250px;
            flex-shrink: 0;
            border: 2px solid transparent;
            border-radius: 8px;
            padding: 0.5em;
            background-color: var(--accented-background-color);
            transition: border-color 0.2s ease;
            overflow-y: auto;
            max-height: 100%;
        }

        .board-view-container .board-column.drag-over {
            border-color: var(--main-text-color);
            background-color: var(--hover-item-background-color);
        }

        .board-view-container .board-column h3 {
            font-size: 1em;
            margin-bottom: 0.75em;
            padding: 0.5em 0.5em 0.5em 0.5em;
            border-bottom: 1px solid var(--main-border-color);
            cursor: grab;
            position: relative;
            transition: background-color 0.2s ease, border-radius 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-sizing: border-box;
            background-color: transparent;
        }

        .board-view-container .board-column h3:active {
            cursor: grabbing;
        }

        .board-view-container .board-column h3.editing {
            cursor: default;
        }

        .board-view-container .board-column h3:hover {
            background-color: var(--hover-item-background-color);
            border-radius: 4px;
        }

        .board-view-container .board-column h3.editing {
            background-color: var(--main-background-color);
            border: 1px solid var(--main-text-color);
            border-radius: 4px;
        }

        .board-view-container .board-column.column-dragging {
            opacity: 0.6;
            transform: scale(0.98);
            transition: opacity 0.2s ease, transform 0.2s ease;
        }

        .board-view-container .board-column h3 input {
            background: transparent;
            border: none;
            outline: none;
            font-size: inherit;
            font-weight: inherit;
            color: inherit;
            width: 100%;
            font-family: inherit;
        }

        .board-view-container .board-column h3 .edit-icon {
            opacity: 0;
            margin-left: 0.5em;
            transition: opacity 0.2s ease;
            color: var(--muted-text-color);
        }

        .board-view-container .board-column h3:hover .edit-icon {
            opacity: 1;
        }

        .board-view-container .board-column h3.editing .edit-icon {
            display: none;
        }

        .board-view-container .board-note {
            box-shadow: 1px 1px 4px rgba(0, 0, 0, 0.25);
            margin: 0.65em 0;
            padding: 0.5em;
            border-radius: 5px;
            cursor: move;
            position: relative;
            background-color: var(--main-background-color);
            border: 1px solid var(--main-border-color);
            transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.15s ease;
            opacity: 1;
        }

        .board-view-container .board-note.fade-in {
            animation: fadeIn 0.15s ease-in;
        }

        .board-view-container .board-note.fade-out {
            animation: fadeOut 0.15s ease-out forwards;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeOut {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(-10px); }
        }

        .board-view-container .board-note.card-updated {
            animation: cardUpdate 0.3s ease-in-out;
        }

        @keyframes cardUpdate {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); }
            100% { transform: scale(1); }
        }

        .board-view-container .board-note:hover {
            transform: translateY(-2px);
            box-shadow: 2px 4px 8px rgba(0, 0, 0, 0.35);
        }

        .board-view-container .board-note.dragging {
            opacity: 0.8;
            transform: rotate(5deg);
            z-index: 1000;
            box-shadow: 4px 8px 16px rgba(0, 0, 0, 0.5);
        }

        .board-view-container .board-note.editing {
            box-shadow: 2px 4px 8px rgba(0, 0, 0, 0.35);
            border-color: var(--main-text-color);
        }

        .board-view-container .board-note.editing input {
            background: transparent;
            border: none;
            outline: none;
            font-family: inherit;
            font-size: inherit;
            color: inherit;
            width: 100%;
            padding: 0;
        }

        .board-view-container .board-note .icon {
            margin-right: 0.25em;
        }

        .board-drop-indicator {
            height: 3px;
            background-color: var(--main-text-color);
            border-radius: 2px;
            margin: 0.25em 0;
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .board-drop-indicator.show {
            opacity: 1;
        }

        .column-drop-indicator {
            width: 4px;
            background-color: var(--main-text-color);
            border-radius: 2px;
            opacity: 0;
            transition: opacity 0.2s ease;
            height: 100%;
            z-index: 1000;
            box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
            flex-shrink: 0;
        }

        .column-drop-indicator.show {
            opacity: 1;
        }

        .board-new-item {
            margin-top: 0.5em;
            padding: 0.5em;
            border-radius: 5px;
            color: var(--muted-text-color);
            cursor: pointer;
            transition: all 0.2s ease;
            background-color: transparent;
        }

        .board-new-item:hover {
            border-color: var(--main-text-color);
            color: var(--main-text-color);
            background-color: var(--hover-item-background-color);
        }

        .board-new-item .icon {
            margin-right: 0.25em;
        }

        .board-add-column {
            width: 180px;
            flex-shrink: 0;
            height: 60px;
            border-radius: 8px;
            padding: 0.5em;
            background-color: var(--accented-background-color);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: var(--muted-text-color);
            font-size: 0.9em;
            align-self: flex-start;
        }

        .board-add-column:hover {
            border-color: var(--main-text-color);
            color: var(--main-text-color);
            background-color: var(--hover-item-background-color);
        }

        .board-add-column .icon {
            margin-right: 0.5em;
            font-size: 1.2em;
        }

        .board-drag-preview {
            position: fixed;
            z-index: 10000;
            pointer-events: none;
            opacity: 0.8;
            transform: rotate(5deg);
            box-shadow: 4px 8px 16px rgba(0, 0, 0, 0.5);
            background-color: var(--main-background-color);
            border: 1px solid var(--main-border-color);
            border-radius: 5px;
            padding: 0.5em;
            font-size: 0.9em;
            max-width: 200px;
            word-wrap: break-word;
        }
    </style>

    <div class="board-view-container"></div>
</div>
`;

export default class BoardView extends ViewMode<BoardData> {

    private $root: JQuery<HTMLElement>;
    private $container: JQuery<HTMLElement>;
    private spacedUpdate: SpacedUpdate;
    private dragContext: DragContext;
    private persistentData: BoardData;
    private api?: BoardApi;
    private dragHandler?: BoardDragHandler;
    private renderer?: DifferentialBoardRenderer;

    constructor(args: ViewModeArgs) {
        super(args, "board");

        this.$root = $(TPL);
        setupHorizontalScrollViaWheel(this.$root);
        this.$container = this.$root.find(".board-view-container");
        this.spacedUpdate = new SpacedUpdate(() => this.onSave(), 5_000);
        this.persistentData = {
            columns: []
        };
        this.dragContext = {
            draggedNote: null,
            draggedBranch: null,
            draggedNoteElement: null,
            draggedColumn: null,
            draggedColumnElement: null
        };

        args.$parent.append(this.$root);
    }

    async renderList(): Promise<JQuery<HTMLElement> | undefined> {
        if (!this.renderer) {
            // First time setup
            this.$container.empty();
            await this.initializeRenderer();
        }

        await this.renderer!.renderBoard();
        return this.$root;
    }

    private async initializeRenderer() {
        this.api = await BoardApi.build(this.parentNote, this.viewStorage);
        this.dragHandler = new BoardDragHandler(
            this.$container,
            this.api,
            this.dragContext
        );

        this.renderer = new DifferentialBoardRenderer(
            this.$container,
            this.api,
            this.dragHandler,
            (column: string) => this.createNewItem(column),
            this.parentNote,
            this.viewStorage,
            () => this.refreshApi()
        );

        setupContextMenu({
            $container: this.$container,
            api: this.api,
            boardView: this
        });

        // Setup column title editing and add column functionality
        this.setupBoardInteractions();
    }

    private async refreshApi(): Promise<void> {
        if (!this.api) {
            throw new Error("API not initialized");
        }

        await this.api.refresh(this.parentNote);
    }

    private setupBoardInteractions() {
        // Handle column title editing with click detection that works with dragging
        this.$container.on('mousedown', 'h3[data-column-value]', (e) => {
            const $titleEl = $(e.currentTarget);

            // Don't interfere with editing mode
            if ($titleEl.hasClass('editing') || $(e.target).is('input')) {
                return;
            }

            const startTime = Date.now();
            let hasMoved = false;
            const startX = e.clientX;
            const startY = e.clientY;

            const handleMouseMove = (moveEvent: JQuery.MouseMoveEvent) => {
                const deltaX = Math.abs(moveEvent.clientX - startX);
                const deltaY = Math.abs(moveEvent.clientY - startY);
                if (deltaX > 5 || deltaY > 5) {
                    hasMoved = true;
                }
            };

            const handleMouseUp = (upEvent: JQuery.MouseUpEvent) => {
                const duration = Date.now() - startTime;
                $(document).off('mousemove', handleMouseMove);
                $(document).off('mouseup', handleMouseUp);

                // If it was a quick click without much movement, treat as edit request
                if (duration < 500 && !hasMoved && upEvent.button === 0) {
                    const columnValue = $titleEl.attr('data-column-value');
                    if (columnValue) {
                        const columnItems = this.api?.getColumn(columnValue) || [];
                        this.startEditingColumnTitle($titleEl, columnValue, columnItems);
                    }
                }
            };

            $(document).on('mousemove', handleMouseMove);
            $(document).on('mouseup', handleMouseUp);
        });

        // Handle add column button
        this.$container.on('click', '.board-add-column', (e) => {
            e.stopPropagation();
            this.startCreatingNewColumn($(e.currentTarget));
        });
    }

    private createTitleStructure(title: string): { $titleText: JQuery<HTMLElement>; $editIcon: JQuery<HTMLElement> } {
        const $titleText = $("<span>").text(title);
        const $editIcon = $("<span>")
            .addClass("edit-icon icon bx bx-edit-alt")
            .attr("title", "Click to edit column title");

        return { $titleText, $editIcon };
    }

    private startEditingColumnTitle($titleEl: JQuery<HTMLElement>, columnValue: string, columnItems: { branch: any; note: any; }[]) {
        if ($titleEl.hasClass("editing")) {
            return; // Already editing
        }

        const $titleSpan = $titleEl.find("span").first(); // Get the text span
        const currentTitle = $titleSpan.text();
        $titleEl.addClass("editing");

        // Disable dragging while editing
        $titleEl.attr("draggable", "false");

        const $input = $("<input>")
            .attr("type", "text")
            .val(currentTitle)
            .attr("placeholder", "Column title");

        // Prevent events from bubbling to parent drag handlers
        $input.on('mousedown mouseup click', (e) => {
            e.stopPropagation();
        });

        $titleEl.empty().append($input);
        $input.focus().select();

        const finishEdit = async (save: boolean = true) => {
            if (!$titleEl.hasClass("editing")) {
                return; // Already finished
            }

            $titleEl.removeClass("editing");

            // Re-enable dragging after editing
            $titleEl.attr("draggable", "true");

            let finalTitle = currentTitle;
            if (save) {
                const newTitle = $input.val() as string;
                if (newTitle.trim() && newTitle !== currentTitle) {
                    await this.renameColumn(columnValue, newTitle.trim(), columnItems);
                    finalTitle = newTitle.trim();
                }
            }

            // Recreate the title structure
            const { $titleText, $editIcon } = this.createTitleStructure(finalTitle);
            $titleEl.empty().append($titleText, $editIcon);
        };

        $input.on("blur", () => finishEdit(true));
        $input.on("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                finishEdit(true);
            } else if (e.key === "Escape") {
                e.preventDefault();
                finishEdit(false);
            }
        });
    }

    private async renameColumn(oldValue: string, newValue: string, columnItems: { branch: any; note: any; }[]) {
        try {
            // Get all note IDs in this column
            const noteIds = columnItems.map(item => item.note.noteId);

            // Use the API to rename the column (update all notes)
            // This will trigger onEntitiesReloaded which will automatically refresh the board
            await this.api?.renameColumn(oldValue, newValue, noteIds);
        } catch (error) {
            console.error("Failed to rename column:", error);
        }
    }

    private async createNewItem(column: string) {
        try {
            // Get the parent note path
            const parentNotePath = this.parentNote.noteId;

            // Create a new note as a child of the parent note
            const { note: newNote } = await noteCreateService.createNote(parentNotePath, {
                activate: false,
                title: "New item"
            });

            if (newNote) {
                // Set the status label to place it in the correct column
                await this.api?.changeColumn(newNote.noteId, column);

                // Refresh the board to show the new item
                await this.renderList();

                // Start inline editing of the newly created card
                this.startInlineEditingCard(newNote.noteId);
            }
        } catch (error) {
            console.error("Failed to create new item:", error);
        }
    }

    async insertItemAtPosition(column: string, relativeToBranchId: string, direction: "before" | "after"): Promise<void> {
        try {
            // Create the note without opening it
            const newNote = await this.api?.insertRowAtPosition(column, relativeToBranchId, direction, false);

            if (newNote) {
                // Refresh the board to show the new item
                await this.renderList();

                // Start inline editing of the newly created card
                this.startInlineEditingCard(newNote.noteId);
            }
        } catch (error) {
            console.error("Failed to insert new item:", error);
        }
    }

    private startInlineEditingCard(noteId: string) {
        this.renderer?.startInlineEditing(noteId);
    }

    forceFullRefresh() {
        this.renderer?.forceFullRender();
        return this.renderList();
    }

    private startCreatingNewColumn($addColumnEl: JQuery<HTMLElement>) {
        if ($addColumnEl.hasClass("editing")) {
            return; // Already editing
        }

        $addColumnEl.addClass("editing");

        const $input = $("<input>")
            .attr("type", "text")
            .attr("placeholder", "Enter column name...")
            .css({
                background: "var(--main-background-color)",
                border: "1px solid var(--main-text-color)",
                borderRadius: "4px",
                padding: "0.5em",
                color: "var(--main-text-color)",
                fontFamily: "inherit",
                fontSize: "inherit",
                width: "100%",
                textAlign: "center"
            });

        $addColumnEl.empty().append($input);
        $input.focus();

        const finishEdit = async (save: boolean = true) => {
            if (!$addColumnEl.hasClass("editing")) {
                return; // Already finished
            }

            $addColumnEl.removeClass("editing");

            if (save) {
                const columnName = $input.val() as string;
                if (columnName.trim()) {
                    await this.createNewColumn(columnName.trim());
                }
            }

            // Restore the add button
            $addColumnEl.html('<span class="icon bx bx-plus"></span>Add Column');
        };

        $input.on("blur", () => finishEdit(true));
        $input.on("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                finishEdit(true);
            } else if (e.key === "Escape") {
                e.preventDefault();
                finishEdit(false);
            }
        });
    }

    private async createNewColumn(columnName: string) {
        try {
            // Check if column already exists
            if (this.api?.columns.includes(columnName)) {
                console.warn("A column with this name already exists.");
                return;
            }

            // Create the new column
            await this.api?.createColumn(columnName);

            // Refresh the board to show the new column
            await this.renderList();
        } catch (error) {
            console.error("Failed to create new column:", error);
        }
    }

    async onEntitiesReloaded({ loadResults }: EventData<"entitiesReloaded">) {
        // Check if any changes affect our board
        const hasRelevantChanges =
            // React to changes in status attribute for notes in this board
            loadResults.getAttributeRows().some(attr => attr.name === this.api?.statusAttribute && this.noteIds.includes(attr.noteId!)) ||
            // React to changes in note title
            loadResults.getNoteIds().some(noteId => this.noteIds.includes(noteId)) ||
            // React to changes in branches for subchildren (e.g., moved, added, or removed notes)
            loadResults.getBranchRows().some(branch => this.noteIds.includes(branch.noteId!)) ||
            // React to changes in note icon or color.
            loadResults.getAttributeRows().some(attr => [ "iconClass", "color" ].includes(attr.name ?? "") && this.noteIds.includes(attr.noteId ?? "")) ||
            // React to attachment change
            loadResults.getAttachmentRows().some(att => att.ownerId === this.parentNote.noteId && att.title === "board.json") ||
            // React to changes in "groupBy"
            loadResults.getAttributeRows().some(attr => attr.name === "board:groupBy" && attr.noteId === this.parentNote.noteId);

        if (hasRelevantChanges && this.renderer) {
            // Use differential rendering with API refresh
            await this.renderer.renderBoard(true);
        }

        // Don't trigger full view refresh - let differential renderer handle it
        return false;
    }

    private onSave() {
        this.viewStorage.store(this.persistentData);
    }

}
