import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIconShadow from "leaflet/dist/images/marker-shadow.png";
import { marker, latLng, divIcon, Map, type Marker } from "leaflet";
import type FNote from "../../../entities/fnote.js";
import openContextMenu from "./context_menu.js";
import server from "../../../services/server.js";
import { moveMarker } from "./editing.js";
import appContext from "../../../components/app_context.js";
import L from "leaflet";

let gpxLoaded = false;

export default function processNoteWithMarker(map: Map, note: FNote, location: string, isEditable: boolean) {
    const [lat, lng] = location.split(",", 2).map((el) => parseFloat(el));
    const icon = buildIcon(note.getIcon(), note.getColorClass(), note.title, note.noteId);

    const newMarker = marker(latLng(lat, lng), {
        icon,
        draggable: isEditable,
        autoPan: true,
        autoPanSpeed: 5
    }).addTo(map);

    if (isEditable) {
        newMarker.on("moveend", (e) => {
            moveMarker(note.noteId, (e.target as Marker).getLatLng());
        });
    }

    newMarker.on("mousedown", ({ originalEvent }) => {
        // Middle click to open in new tab
        if (originalEvent.button === 1) {
            const hoistedNoteId = appContext.tabManager.getActiveContext()?.hoistedNoteId;
            //@ts-ignore, fix once tab manager is ported.
            appContext.tabManager.openInNewTab(note.noteId, hoistedNoteId);
            return true;
        }
    });

    newMarker.on("contextmenu", (e) => {
        openContextMenu(note.noteId, e, isEditable);
    });

    if (!isEditable) {
        newMarker.on("click", (e) => {
            appContext.triggerCommand("openInPopup", { noteIdOrPath: note.noteId });
        });
    }

    return newMarker;
}

export async function processNoteWithGpxTrack(map: Map, note: FNote) {
    if (!gpxLoaded) {
        const GPX = await import("leaflet-gpx");
        gpxLoaded = true;
    }

    const xmlResponse = await server.get<string | Uint8Array>(`notes/${note.noteId}/open`, undefined, true);
    let stringResponse: string;
    if (xmlResponse instanceof Uint8Array) {
        stringResponse = new TextDecoder().decode(xmlResponse);
    } else {
        stringResponse = xmlResponse;
    }

    const track = new L.GPX(stringResponse, {
        markers: {
            startIcon: buildIcon(note.getIcon(), note.getColorClass(), note.title),
            endIcon: buildIcon("bxs-flag-checkered"),
            wptIcons: {
                "": buildIcon("bx bx-pin")
            }
        },
        polyline_options: {
            color: note.getLabelValue("color") ?? "blue"
        }
    });
    track.addTo(map);
    return track;
}

function buildIcon(bxIconClass: string, colorClass?: string, title?: string, noteIdLink?: string) {
    let html = /*html*/`\
        <img class="icon" src="${markerIcon}" />
        <img class="icon-shadow" src="${markerIconShadow}" />
        <span class="bx ${bxIconClass} ${colorClass ?? ""}"></span>
        <span class="title-label">${title ?? ""}</span>`;

    if (noteIdLink) {
        html = `<div data-href="#root/${noteIdLink}">${html}</div>`;
    }

    return divIcon({
        html,
        iconSize: [25, 41],
        iconAnchor: [12, 41]
    });
}
