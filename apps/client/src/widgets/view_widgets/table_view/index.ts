import ViewMode, { type ViewModeArgs } from "../view_mode.js";
import attributes from "../../../services/attributes.js";
import SpacedUpdate from "../../../services/spaced_update.js";
import type { EventData } from "../../../components/app_context.js";
import {Tabulator, SortModule, FormatModule, InteractionModule, EditModule, ResizeColumnsModule, FrozenColumnsModule, PersistenceModule, MoveColumnsModule, MoveRowsModule, ColumnDefinition, DataTreeModule, Options, RowComponent, ColumnComponent} from 'tabulator-tables';
import "tabulator-tables/dist/css/tabulator.css";
import "../../../../src/stylesheets/table.css";
import { canReorderRows, configureReorderingRows } from "./dragging.js";
import buildFooter from "./footer.js";
import getAttributeDefinitionInformation, { buildRowDefinitions } from "./rows.js";
import { AttributeDefinitionInformation, buildColumnDefinitions } from "./columns.js";
import { setupContextMenu } from "./context_menu.js";
import TableColumnEditing from "./col_editing.js";
import TableRowEditing from "./row_editing.js";

const TPL = /*html*/`
<div class="table-view">
    <style>
    .table-view {
        overflow: hidden;
        position: relative;
        height: 100%;
        user-select: none;
        padding: 0 5px 0 10px;
    }

    .table-view-container {
        height: 100%;
    }

    .search-result-widget-content .table-view {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
    }

    .tabulator-cell .autocomplete {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        outline: none !important;
    }

    .tabulator .tabulator-header {
        border-top: unset;
        border-bottom-width: 1px;
    }

    .tabulator .tabulator-header .tabulator-frozen.tabulator-frozen-left,
    .tabulator-row .tabulator-cell.tabulator-frozen.tabulator-frozen-left {
        border-right-width: 1px;
    }

    .tabulator .tabulator-footer {
        background-color: unset;
        padding: 5px 0;
    }

    .tabulator .tabulator-footer .tabulator-footer-contents {
        justify-content: left;
        gap: 0.5em;
    }

    .tabulator button.tree-expand,
    .tabulator button.tree-collapse {
        display: inline-block;
        appearance: none;
        border: 0;
        background: transparent;
        width: 1.5em;
        position: relative;
        vertical-align: middle;
    }

    .tabulator button.tree-expand span,
    .tabulator button.tree-collapse span {
        position: absolute;
        top: 0;
        left: 0;
        font-size: 1.5em;
        transform: translateY(-50%);
    }
    </style>

    <div class="table-view-container"></div>
</div>
`;

export interface StateInfo {
    tableData?: {
        columns?: ColumnDefinition[];
    };
}

export default class TableView extends ViewMode<StateInfo> {

    private $root: JQuery<HTMLElement>;
    private $container: JQuery<HTMLElement>;
    private spacedUpdate: SpacedUpdate;
    private api?: Tabulator;
    private persistentData: StateInfo["tableData"];
    private colEditing?: TableColumnEditing;
    private rowEditing?: TableRowEditing;
    private maxDepth: number = -1;
    private rowNumberHint: number = 1;

    constructor(args: ViewModeArgs) {
        super(args, "table");

        this.$root = $(TPL);
        this.$container = this.$root.find(".table-view-container");
        this.spacedUpdate = new SpacedUpdate(() => this.onSave(), 5_000);
        this.persistentData = {};
        args.$parent.append(this.$root);
    }

    async renderList() {
        this.$container.empty();
        this.renderTable(this.$container[0]);
        return this.$root;
    }

    private async renderTable(el: HTMLElement) {
        const info = getAttributeDefinitionInformation(this.parentNote);
        const modules = [ SortModule, FormatModule, InteractionModule, EditModule, ResizeColumnsModule, FrozenColumnsModule, PersistenceModule, MoveColumnsModule, MoveRowsModule, DataTreeModule ];
        for (const module of modules) {
            Tabulator.registerModule(module);
        }

        this.initialize(el, info);
    }

    private async initialize(el: HTMLElement, info: AttributeDefinitionInformation[]) {
        const viewStorage = await this.viewStorage.restore();
        this.persistentData = viewStorage?.tableData || {};

        this.maxDepth = parseInt(this.parentNote.getLabelValue("maxNestingDepth") ?? "-1", 10);
        const { definitions: rowData, hasSubtree: hasChildren, rowNumber } = await buildRowDefinitions(this.parentNote, info, this.maxDepth);
        this.rowNumberHint = rowNumber;
        const movableRows = canReorderRows(this.parentNote) && !hasChildren;
        const columnDefs = buildColumnDefinitions({
            info,
            movableRows,
            existingColumnData: this.persistentData.columns,
            rowNumberHint: this.rowNumberHint
        });
        let opts: Options = {
            layout: "fitDataFill",
            index: "branchId",
            columns: columnDefs,
            data: rowData,
            persistence: true,
            movableColumns: true,
            movableRows,
            footerElement: buildFooter(this.parentNote),
            persistenceWriterFunc: (_id, type: string, data: object) => {
                (this.persistentData as Record<string, {}>)[type] = data;
                this.spacedUpdate.scheduleUpdate();
            },
            persistenceReaderFunc: (_id, type: string) => this.persistentData?.[type],
        };

        if (hasChildren) {
            opts = {
                ...opts,
                dataTree: hasChildren,
                dataTreeStartExpanded: true,
                dataTreeBranchElement: false,
                dataTreeElementColumn: "title",
                dataTreeChildIndent: 20,
                dataTreeExpandElement: `<button class="tree-expand"><span class="bx bx-chevron-right"></span></button>`,
                dataTreeCollapseElement: `<button class="tree-collapse"><span class="bx bx-chevron-down"></span></button>`
            }
        }

        this.api = new Tabulator(el, opts);

        this.colEditing = new TableColumnEditing(this.args.$parent, this.args.parentNote, this.api);
        this.rowEditing = new TableRowEditing(this.api, this.args.parentNotePath!);

        if (movableRows) {
            configureReorderingRows(this.api);
        }
        setupContextMenu(this.api, this.parentNote);
    }

    private onSave() {
        this.viewStorage.store({
            tableData: this.persistentData,
        });
    }

    async onEntitiesReloaded({ loadResults }: EventData<"entitiesReloaded">) {
        if (!this.api) {
            return;
        }

        // Force a refresh if sorted is changed since we need to disable reordering.
        if (loadResults.getAttributeRows().find(a => a.name === "sorted" && attributes.isAffecting(a, this.parentNote))) {
            return true;
        }

        // Refresh if promoted attributes get changed.
        if (loadResults.getAttributeRows().find(attr =>
            attr.type === "label" &&
            (attr.name?.startsWith("label:") || attr.name?.startsWith("relation:")) &&
            attributes.isAffecting(attr, this.parentNote))) {
            this.#manageColumnUpdate();
            return await this.#manageRowsUpdate();
        }

        // Refresh max depth
        if (loadResults.getAttributeRows().find(attr => attr.type === "label" && attr.name === "maxNestingDepth" && attributes.isAffecting(attr, this.parentNote))) {
            this.maxDepth = parseInt(this.parentNote.getLabelValue("maxNestingDepth") ?? "-1", 10);
            return await this.#manageRowsUpdate();
        }

        if (loadResults.getBranchRows().some(branch => branch.parentNoteId === this.parentNote.noteId || this.noteIds.includes(branch.parentNoteId ?? ""))
            || loadResults.getNoteIds().some(noteId => this.noteIds.includes(noteId))
            || loadResults.getAttributeRows().some(attr => this.noteIds.includes(attr.noteId!))) {
            return await this.#manageRowsUpdate();
        }

        return false;
    }

    #manageColumnUpdate() {
        if (!this.api) {
            return;
        }

        const info = getAttributeDefinitionInformation(this.parentNote);
        const columnDefs = buildColumnDefinitions({
            info,
            movableRows: !!this.api.options.movableRows,
            existingColumnData: this.persistentData?.columns,
            rowNumberHint: this.rowNumberHint,
            position: this.colEditing?.getNewAttributePosition()
        });
        this.api.setColumns(columnDefs);
        this.colEditing?.resetNewAttributePosition();
    }

    addNewRowCommand(e) { this.rowEditing?.addNewRowCommand(e); }
    addNewTableColumnCommand(e) { this.colEditing?.addNewTableColumnCommand(e); }
    deleteTableColumnCommand(e) { this.colEditing?.deleteTableColumnCommand(e); }
    updateAttributeListCommand(e) { this.colEditing?.updateAttributeListCommand(e); }
    saveAttributesCommand() { this.colEditing?.saveAttributesCommand(); }

    async #manageRowsUpdate() {
        if (!this.api) {
            return;
        }

        const info = getAttributeDefinitionInformation(this.parentNote);
        const { definitions, hasSubtree, rowNumber } = await buildRowDefinitions(this.parentNote, info, this.maxDepth);
        this.rowNumberHint = rowNumber;

        // Force a refresh if the data tree needs enabling/disabling.
        if (this.api.options.dataTree !== hasSubtree) {
            return true;
        }

        await this.api.replaceData(definitions);
        return false;
    }

}

