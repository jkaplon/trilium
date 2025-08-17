import type FNote from "../entities/fnote.js";
import BoardView from "../widgets/view_widgets/board_view/index.js";
import CalendarView from "../widgets/view_widgets/calendar_view.js";
import GeoView from "../widgets/view_widgets/geo_view/index.js";
import ListOrGridView from "../widgets/view_widgets/list_or_grid_view.js";
import TableView from "../widgets/view_widgets/table_view/index.js";
import type { ViewModeArgs } from "../widgets/view_widgets/view_mode.js";
import type ViewMode from "../widgets/view_widgets/view_mode.js";

const allViewTypes = ["list", "grid", "calendar", "table", "geoMap", "board"] as const;
export type ArgsWithoutNoteId = Omit<ViewModeArgs, "noteIds">;
export type ViewTypeOptions = typeof allViewTypes[number];

export default class NoteListRenderer {

    private viewType: ViewTypeOptions;
    private args: ArgsWithoutNoteId;
    public viewMode?: ViewMode<any>;

    constructor(args: ArgsWithoutNoteId) {
        this.args = args;
        this.viewType = this.#getViewType(args.parentNote);
    }

    #getViewType(parentNote: FNote): ViewTypeOptions {
        const viewType = parentNote.getLabelValue("viewType");

        if (!(allViewTypes as readonly string[]).includes(viewType || "")) {
            // when not explicitly set, decide based on the note type
            return parentNote.type === "search" ? "list" : "grid";
        } else {
            return viewType as ViewTypeOptions;
        }
    }

    get isFullHeight() {
        switch (this.viewType) {
            case "list":
            case "grid":
                return false;
            default:
                return true;
        }
    }

    async renderList() {
        const args = this.args;
        const viewMode = this.#buildViewMode(args);
        this.viewMode = viewMode;
        await viewMode.beforeRender();
        return await viewMode.renderList();
    }

    #buildViewMode(args: ViewModeArgs) {
        switch (this.viewType) {
            case "calendar":
                return new CalendarView(args);
            case "table":
                return new TableView(args);
            case "geoMap":
                return new GeoView(args);
            case "board":
                return new BoardView(args);
            case "list":
            case "grid":
            default:
                return new ListOrGridView(this.viewType, args);
        }
    }

}
