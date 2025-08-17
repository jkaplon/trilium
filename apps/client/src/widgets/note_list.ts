import NoteContextAwareWidget from "./note_context_aware_widget.js";
import NoteListRenderer from "../services/note_list_renderer.js";
import type FNote from "../entities/fnote.js";
import type { CommandListener, CommandListenerData, CommandMappings, CommandNames, EventData, EventNames } from "../components/app_context.js";
import type ViewMode from "./view_widgets/view_mode.js";

const TPL = /*html*/`
<div class="note-list-widget">
    <style>
    .note-list-widget {
        min-height: 0;
        overflow: auto;
    }

    .note-list-widget .note-list {
        padding: 10px;
    }

    .note-list-widget.full-height,
    .note-list-widget.full-height .note-list-widget-content {
        height: 100%;
    }

    .note-list-widget video {
        height: 100%;
    }
    </style>

    <div class="note-list-widget-content">
    </div>
</div>`;

export default class NoteListWidget extends NoteContextAwareWidget {

    private $content!: JQuery<HTMLElement>;
    private isIntersecting?: boolean;
    private noteIdRefreshed?: string;
    private shownNoteId?: string | null;
    private viewMode?: ViewMode<any> | null;
    private displayOnlyCollections: boolean;

    /**
     * @param displayOnlyCollections if set to `true` then only collection-type views are displayed such as geo-map and the calendar. The original book types grid and list will be ignored.
     */
    constructor(displayOnlyCollections: boolean) {
        super();

        this.displayOnlyCollections = displayOnlyCollections;
    }

    isEnabled() {
        if (!super.isEnabled()) {
            return false;
        }

        if (this.displayOnlyCollections && this.note?.type !== "book") {
            const viewType = this.note?.getLabelValue("viewType");
            if (!viewType || ["grid", "list"].includes(viewType)) {
                return false;
            }
        }

        return this.noteContext?.hasNoteList();
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$content = this.$widget.find(".note-list-widget-content");

        const observer = new IntersectionObserver(
            (entries) => {
                this.isIntersecting = entries[0].isIntersecting;

                this.checkRenderStatus();
            },
            {
                rootMargin: "50px",
                threshold: 0.1
            }
        );

        // there seems to be a race condition on Firefox which triggers the observer only before the widget is visible
        // (intersection is false). https://github.com/zadam/trilium/issues/4165
        setTimeout(() => observer.observe(this.$widget[0]), 10);
    }

    checkRenderStatus() {
        // console.log("this.isIntersecting", this.isIntersecting);
        // console.log(`${this.noteIdRefreshed} === ${this.noteId}`, this.noteIdRefreshed === this.noteId);
        // console.log("this.shownNoteId !== this.noteId", this.shownNoteId !== this.noteId);

        if (this.note && this.isIntersecting && this.noteIdRefreshed === this.noteId && this.shownNoteId !== this.noteId) {
            this.shownNoteId = this.noteId;
            this.renderNoteList(this.note);
        }
    }

    async renderNoteList(note: FNote) {
        const noteListRenderer = new NoteListRenderer({
            $parent: this.$content,
            parentNote: note,
            parentNotePath: this.notePath
        });
        this.$widget.toggleClass("full-height", noteListRenderer.isFullHeight);
        await noteListRenderer.renderList();
        this.viewMode = noteListRenderer.viewMode;
    }

    async refresh() {
        this.shownNoteId = null;

        await super.refresh();
    }

    async refreshNoteListEvent({ noteId }: EventData<"refreshNoteList">) {
        if (this.isNote(noteId) && this.note) {
            await this.renderNoteList(this.note);
        }
    }

    /**
     * We have this event so that we evaluate intersection only after note detail is loaded.
     * If it's evaluated before note detail, then it's clearly intersected (visible) although after note detail load
     * it is not intersected (visible) anymore.
     */
    noteDetailRefreshedEvent({ ntxId }: EventData<"noteDetailRefreshed">) {
        if (!this.isNoteContext(ntxId)) {
            return;
        }

        this.noteIdRefreshed = this.noteId;

        setTimeout(() => this.checkRenderStatus(), 100);
    }

    notesReloadedEvent({ noteIds }: EventData<"notesReloaded">) {
        if (this.noteId && noteIds.includes(this.noteId)) {
            this.refresh();
        }
    }

    entitiesReloadedEvent(e: EventData<"entitiesReloaded">) {
        if (e.loadResults.getAttributeRows().find((attr) => attr.noteId === this.noteId && attr.name && ["viewType", "expanded", "pageSize"].includes(attr.name))) {
            this.refresh();
            this.checkRenderStatus();
        }
    }

    buildTouchBarCommand(data: CommandListenerData<"buildTouchBar">) {
        if (this.viewMode && "buildTouchBarCommand" in this.viewMode) {
            return (this.viewMode as CommandListener<"buildTouchBar">).buildTouchBarCommand(data);
        }
    }

    triggerCommand<K extends CommandNames>(name: K, data?: CommandMappings[K]): Promise<unknown> | undefined | null {
        // Pass the commands to the view mode, which is not actually attached to the hierarchy.
        if (this.viewMode?.triggerCommand(name, data)) {
            return;
        }

        return super.triggerCommand(name, data);
    }

    handleEventInChildren<T extends EventNames>(name: T, data: EventData<T>): Promise<unknown[] | unknown> | null {
        super.handleEventInChildren(name, data);

        if (this.viewMode) {
            const ret = this.viewMode.handleEvent(name, data);
            if (ret) {
                return ret;
            }
        }

        return null;
    }

}
