import contextMenu, { ContextMenuEvent } from "../../../menus/context_menu.js";
import link_context_menu from "../../../menus/link_context_menu.js";
import branches from "../../../services/branches.js";
import dialog from "../../../services/dialog.js";
import { t } from "../../../services/i18n.js";
import BoardApi from "./api.js";
import type BoardView from "./index.js";

interface ShowNoteContextMenuArgs {
    $container: JQuery<HTMLElement>;
    api: BoardApi;
    boardView: BoardView;
}

export function setupContextMenu({ $container, api, boardView }: ShowNoteContextMenuArgs) {
    $container.on("contextmenu", ".board-note", showNoteContextMenu);
    $container.on("contextmenu", ".board-column h3", showColumnContextMenu);

    function showColumnContextMenu(event: ContextMenuEvent) {
        event.preventDefault();
        event.stopPropagation();

        const $el = $(event.currentTarget);
        const column = $el.closest(".board-column").data("column");

        contextMenu.show({
            x: event.pageX,
            y: event.pageY,
            items: [
                {
                    title: t("board_view.delete-column"),
                    uiIcon: "bx bx-trash",
                    async handler() {
                        const confirmed = await dialog.confirm(t("board_view.delete-column-confirmation"));
                        if (!confirmed) {
                            return;
                        }

                        await api.removeColumn(column);
                    }
                }
            ],
            selectMenuItemHandler() {}
        });
    }

    function showNoteContextMenu(event: ContextMenuEvent) {
        event.preventDefault();
        event.stopPropagation();

        const $el = $(event.currentTarget);
        const noteId = $el.data("note-id");
        const branchId = $el.data("branch-id");
        const column = $el.closest(".board-column").data("column");
        if (!noteId) return;

        contextMenu.show({
            x: event.pageX,
            y: event.pageY,
            items: [
                ...link_context_menu.getItems(),
                { title: "----" },
                {
                    title: t("board_view.move-to"),
                    uiIcon: "bx bx-transfer",
                    items: api.columns.map(columnToMoveTo => ({
                        title: columnToMoveTo,
                        enabled: columnToMoveTo !== column,
                        handler: () => api.changeColumn(noteId, columnToMoveTo)
                    }))
                },
                { title: "----" },
                {
                    title: t("board_view.insert-above"),
                    uiIcon: "bx bx-list-plus",
                    handler: () => boardView.insertItemAtPosition(column, branchId, "before")
                },
                {
                    title: t("board_view.insert-below"),
                    uiIcon: "bx bx-empty",
                    handler: () => boardView.insertItemAtPosition(column, branchId, "after")
                },
                { title: "----" },
                {
                    title: t("board_view.delete-note"),
                    uiIcon: "bx bx-trash",
                    handler: () => branches.deleteNotes([ branchId ], false, false)
                }
            ],
            selectMenuItemHandler: ({ command }) =>  link_context_menu.handleLinkContextMenuItem(command, noteId),
        });
    }
}
