import { LatLng, LeafletMouseEvent } from "leaflet";
import attributes from "../../../services/attributes";
import { LOCATION_ATTRIBUTE } from "./index.js";
import dialog from "../../../services/dialog";
import server from "../../../services/server";
import { t } from "../../../services/i18n";
import type { Map } from "leaflet";
import type { DragData } from "../../note_tree.js";
import froca from "../../../services/froca.js";
import branches from "../../../services/branches.js";

const CHILD_NOTE_ICON = "bx bx-pin";

// TODO: Deduplicate
interface CreateChildResponse {
    note: {
        noteId: string;
    };
}

export async function moveMarker(noteId: string, latLng: LatLng | null) {
    const value = latLng ? [latLng.lat, latLng.lng].join(",") : "";
    await attributes.setLabel(noteId, LOCATION_ATTRIBUTE, value);
}

export async function createNewNote(noteId: string, e: LeafletMouseEvent) {
    const title = await dialog.prompt({ message: t("relation_map.enter_title_of_new_note"), defaultValue: t("relation_map.default_new_note_title") });

    if (title?.trim()) {
        const { note } = await server.post<CreateChildResponse>(`notes/${noteId}/children?target=into`, {
            title,
            content: "",
            type: "text"
        });
        attributes.setLabel(note.noteId, "iconClass", CHILD_NOTE_ICON);
        moveMarker(note.noteId, e.latlng);
    }
}

export function setupDragging($container: JQuery<HTMLElement>, map: Map, mapNoteId: string) {
    $container.on("dragover", (e) => {
        // Allow drag.
        e.preventDefault();
    });
    $container.on("drop", async (e) => {
        if (!e.originalEvent) {
            return;
        }

        const data = e.originalEvent.dataTransfer?.getData('text');
        if (!data) {
            return;
        }

        try {
            const parsedData = JSON.parse(data) as DragData[];
            if (!parsedData.length) {
                return;
            }

            const { noteId } = parsedData[0];

            const offset = $container.offset();
            const x = e.originalEvent.clientX - (offset?.left ?? 0);
            const y = e.originalEvent.clientY - (offset?.top ?? 0);
            const latlng = map.containerPointToLatLng([ x, y ]);

            const note = await froca.getNote(noteId, true);
            const parents = note?.getParentNoteIds();
            if (parents?.includes(mapNoteId)) {
                await moveMarker(noteId, latlng);
            } else {
                await branches.cloneNoteToParentNote(noteId, mapNoteId);
                await moveMarker(noteId, latlng);
            }
        } catch (e) {
            console.warn(e);
        }
    });
}
