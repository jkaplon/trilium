import ViewMode, { ViewModeArgs } from "../view_mode.js";
import L from "leaflet";
import type { GPX, LatLng, Layer, LeafletMouseEvent, Map, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import SpacedUpdate from "../../../services/spaced_update.js";
import { t } from "../../../services/i18n.js";
import processNoteWithMarker, { processNoteWithGpxTrack } from "./markers.js";
import { hasTouchBar } from "../../../services/utils.js";
import toast from "../../../services/toast.js";
import { CommandListenerData, EventData } from "../../../components/app_context.js";
import { createNewNote, moveMarker, setupDragging } from "./editing.js";
import { openMapContextMenu } from "./context_menu.js";
import attributes from "../../../services/attributes.js";
import { DEFAULT_MAP_LAYER_NAME, MAP_LAYERS } from "./map_layer.js";

const TPL = /*html*/`
<div class="geo-view">
    <style>
        .geo-view {
            overflow: hidden;
            position: relative;
            height: 100%;
        }

        .geo-map-container {
            height: 100%;
            overflow: hidden;
        }

        .leaflet-pane {
            z-index: 1;
        }

        .leaflet-top,
        .leaflet-bottom {
            z-index: 997;
        }

        .geo-map-container.placing-note {
            cursor: crosshair;
        }

        .geo-map-container .marker-pin {
            position: relative;
        }

        .geo-map-container .leaflet-div-icon {
            position: relative;
            background: transparent;
            border: 0;
            overflow: visible;
        }

        .geo-map-container .leaflet-div-icon .icon-shadow {
            position: absolute;
            top: 0;
            left: 0;
            z-index: -1;
        }

        .geo-map-container .leaflet-div-icon .bx {
            position: absolute;
            top: 3px;
            left: 2px;
            background-color: white;
            color: black;
            padding: 2px;
            border-radius: 50%;
            font-size: 17px;
        }

        .geo-map-container .leaflet-div-icon .title-label {
            display: block;
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            font-size: 0.75rem;
            height: 1rem;
            color: black;
            width: 100px;
            text-align: center;
            text-overflow: ellipsis;
            text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white;
            white-space: no-wrap;
            overflow: hidden;
        }

        .geo-map-container.dark .leaflet-div-icon .title-label {
            color: white;
            text-shadow: -1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black, 1px 1px 0 black;
        }
    </style>

    <div class="geo-map-container"></div>
</div>`;

interface MapData {
    view?: {
        center?: LatLng | [number, number];
        zoom?: number;
    };
}

const DEFAULT_COORDINATES: [number, number] = [3.878638227135724, 446.6630455551659];
const DEFAULT_ZOOM = 2;
export const LOCATION_ATTRIBUTE = "geolocation";

enum State {
    Normal,
    NewNote
}

export default class GeoView extends ViewMode<MapData> {

    private $root: JQuery<HTMLElement>;
    private $container!: JQuery<HTMLElement>;
    private map?: Map;
    private spacedUpdate: SpacedUpdate;
    private _state: State;
    private ignoreNextZoomEvent?: boolean;

    private currentMarkerData: Record<string, Marker>;
    private currentTrackData: Record<string, GPX>;

    constructor(args: ViewModeArgs) {
        super(args, "geoMap");
        this.$root = $(TPL);
        this.$container = this.$root.find(".geo-map-container");
        this.spacedUpdate = new SpacedUpdate(() => this.onSave(), 5_000);

        this.currentMarkerData = {};
        this.currentTrackData = {};
        this._state = State.Normal;

        args.$parent.append(this.$root);
    }

    async renderList() {
        this.renderMap();
        return this.$root;
    }

    async renderMap() {
        const map = L.map(this.$container[0], {
            worldCopyJump: true
        });

        const layerName = this.parentNote.getLabelValue("map:style") ?? DEFAULT_MAP_LAYER_NAME;
        let layer: Layer;
        const layerData = MAP_LAYERS[layerName];

        if (layerData.type === "vector") {
            const style = (typeof layerData.style === "string" ? layerData.style : await layerData.style());
            await import("@maplibre/maplibre-gl-leaflet");

            layer = L.maplibreGL({
                style: style as any
            });
        } else {
            layer = L.tileLayer(layerData.url, {
                attribution: layerData.attribution,
                detectRetina: true
            });
        }

        if (this.parentNote.hasLabel("map:scale")) {
            L.control.scale().addTo(map);
        }

        this.$container.toggleClass("dark", !!layerData.isDarkTheme);

        layer.addTo(map);

        this.map = map;

        this.#onMapInitialized();
    }

    async #onMapInitialized() {
        const map = this.map;
        if (!map) {
            throw new Error(t("geo-map.unable-to-load-map"));
        }

        this.#restoreViewportAndZoom();

        const isEditable = !this.isReadOnly;
        const updateFn = () => this.spacedUpdate.scheduleUpdate();
        map.on("moveend", updateFn);
        map.on("zoomend", updateFn);
        map.on("click", (e) => this.#onMapClicked(e))
        map.on("contextmenu", (e) => openMapContextMenu(this.parentNote.noteId, e, isEditable));

        if (isEditable) {
            setupDragging(this.$container, map, this.parentNote.noteId);
        }

        this.#reloadMarkers();

        if (hasTouchBar) {
            map.on("zoom", () => {
                if (!this.ignoreNextZoomEvent) {
                    this.triggerCommand("refreshTouchBar");
                }

                this.ignoreNextZoomEvent = false;
            });
        }
    }

    async #restoreViewportAndZoom() {
        const map = this.map;
        if (!map) {
            return;
        }

        const parsedContent = await this.viewStorage.restore();

        // Restore viewport position & zoom
        const center = parsedContent?.view?.center ?? DEFAULT_COORDINATES;
        const zoom = parsedContent?.view?.zoom ?? DEFAULT_ZOOM;
        map.setView(center, zoom);
    }

    private onSave() {
        const map = this.map;
        let data: MapData = {};
        if (map) {
            data = {
                view: {
                    center: map.getBounds().getCenter(),
                    zoom: map.getZoom()
                }
            };
        }

        this.viewStorage.store(data);
    }

    async #reloadMarkers() {
        if (!this.map) {
            return;
        }

        // Delete all existing markers
        for (const marker of Object.values(this.currentMarkerData)) {
            marker.remove();
        }

        // Delete all existing tracks
        for (const track of Object.values(this.currentTrackData)) {
            track.remove();
        }

        // Add the new markers.
        this.currentMarkerData = {};
        const notes = await this.parentNote.getSubtreeNotes();
        const draggable = !this.isReadOnly;
        for (const childNote of notes) {
            if (childNote.mime === "application/gpx+xml") {
                const track = await processNoteWithGpxTrack(this.map, childNote);
                this.currentTrackData[childNote.noteId] = track;
                continue;
            }

            const latLng = childNote.getAttributeValue("label", LOCATION_ATTRIBUTE);
            if (latLng) {
                const marker = processNoteWithMarker(this.map, childNote, latLng, draggable);
                this.currentMarkerData[childNote.noteId] = marker;
            }
        }
    }

    #changeState(newState: State) {
        this._state = newState;
        this.$container.toggleClass("placing-note", newState === State.NewNote);
        if (hasTouchBar) {
            this.triggerCommand("refreshTouchBar");
        }
    }

    async onEntitiesReloaded({ loadResults }: EventData<"entitiesReloaded">) {
        // If any of the children branches are altered.
        if (loadResults.getBranchRows().find((branch) => branch.parentNoteId === this.parentNote.noteId)) {
            this.#reloadMarkers();
            return;
        }

        // If any of note has its location attribute changed.
        // TODO: Should probably filter by parent here as well.
        const attributeRows = loadResults.getAttributeRows();
        if (attributeRows.find((at) => [LOCATION_ATTRIBUTE, "color", "iconClass"].includes(at.name ?? ""))) {
            this.#reloadMarkers();
        }

        // Full reload if map layer is changed.
        if (loadResults.getAttributeRows().some(attr => (attr.name?.startsWith("map:") && attributes.isAffecting(attr, this.parentNote)))) {
            return true;
        }
    }

    async geoMapCreateChildNoteEvent({ ntxId }: EventData<"geoMapCreateChildNote">) {
        toast.showPersistent({
            icon: "plus",
            id: "geo-new-note",
            title: "New note",
            message: t("geo-map.create-child-note-instruction")
        });

        this.#changeState(State.NewNote);

        const globalKeyListener: (this: Window, ev: KeyboardEvent) => any = (e) => {
            if (e.key !== "Escape") {
                return;
            }

            this.#changeState(State.Normal);

            window.removeEventListener("keydown", globalKeyListener);
            toast.closePersistent("geo-new-note");
        };
        window.addEventListener("keydown", globalKeyListener);
    }

    async #onMapClicked(e: LeafletMouseEvent) {
        if (this._state !== State.NewNote) {
            return;
        }

        toast.closePersistent("geo-new-note");
        await createNewNote(this.parentNote.noteId, e);
        this.#changeState(State.Normal);
    }

    deleteFromMapEvent({ noteId }: EventData<"deleteFromMap">) {
        moveMarker(noteId, null);
    }

    buildTouchBarCommand({ TouchBar }: CommandListenerData<"buildTouchBar">) {
        const map = this.map;
        const that = this;
        if (!map) {
            return;
        }

        return [
            new TouchBar.TouchBarSlider({
                label: "Zoom",
                value: map.getZoom(),
                minValue: map.getMinZoom(),
                maxValue: map.getMaxZoom(),
                change(newValue) {
                    that.ignoreNextZoomEvent = true;
                    map.setZoom(newValue);
                },
            }),
            new TouchBar.TouchBarButton({
                label: "New geo note",
                click: () => this.triggerCommand("geoMapCreateChildNote"),
                enabled: (this._state === State.Normal)
            })
        ];
    }

}

