import { CellComponent } from "tabulator-tables";
import froca from "../../../services/froca.js";
import FNote from "../../../entities/fnote.js";

/**
 * Custom formatter to represent a note, with the icon and note title being rendered.
 *
 * The value of the cell must be the note ID.
 */
export function NoteFormatter(cell: CellComponent, _formatterParams, onRendered): string {
    let noteId = cell.getValue();
    if (!noteId) {
        return "";
    }

    function buildLink(note: FNote | undefined) {
        if (!note) {
            return;
        }

        const iconClass = note.getIcon();
        const title = note.title;
        const { $noteRef } = buildNoteLink(noteId, title, iconClass, note.getColorClass());
        return $noteRef[0];
    }

    const cachedNote = froca.getNoteFromCache(noteId);
    if (cachedNote) {
        // Cache hit, build the link immediately
        const el = buildLink(cachedNote);
        return el?.outerHTML ?? "";
    } else {
        // Cache miss, load the note asynchronously
        onRendered(async () => {
            const note = await froca.getNote(noteId);
            if (!note) {
                return;
            }

            const el = buildLink(note);
            if (el) {
                cell.getElement().appendChild(el);
            }
        });

        return "";
    }
}

/**
 * Custom formatter for the note title that is quite similar to {@link NoteFormatter}, but where the title and icons are read from separate fields.
 */
export function NoteTitleFormatter(cell: CellComponent) {
    const { noteId, iconClass, colorClass } = cell.getRow().getData();
    if (!noteId) {
        return "";
    }

    const { $noteRef } = buildNoteLink(noteId, cell.getValue(), iconClass, colorClass);
    return $noteRef[0].outerHTML;
}

export function RowNumberFormatter(draggableRows: boolean) {
    return (cell: CellComponent) => {
        let html = "";
        if (draggableRows) {
            html += `<span class="bx bx-dots-vertical-rounded"></span> `;
        }
        html += cell.getRow().getPosition(true);
        return html;
    };
}

export function MonospaceFormatter(cell: CellComponent) {
    return `<code>${cell.getValue()}</code>`;
}

function buildNoteLink(noteId: string, title: string, iconClass: string, colorClass?: string) {
    const $noteRef = $("<span>");
    const href = `#root/${noteId}`;
    $noteRef.addClass("reference-link");
    $noteRef.attr("data-href", href);
    $noteRef.text(title);
    $noteRef.prepend($("<span>").addClass(iconClass));
    if (colorClass) {
        $noteRef.addClass(colorClass);
    }
    return { $noteRef, href };
}
