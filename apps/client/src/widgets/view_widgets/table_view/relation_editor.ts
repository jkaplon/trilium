import { CellComponent } from "tabulator-tables";
import note_autocomplete from "../../../services/note_autocomplete";
import froca from "../../../services/froca";

export function RelationEditor(cell: CellComponent, onRendered, success, cancel, editorParams){
    //cell - the cell component for the editable cell
    //onRendered - function to call when the editor has been rendered
    //success - function to call to pass thesuccessfully updated value to Tabulator
    //cancel - function to call to abort the edit and return to a normal cell
    //editorParams - params object passed into the editorParams column definition property

    //create and style editor
    const editor = document.createElement("input");

    const $editor = $(editor);
    editor.classList.add("form-control");

    //create and style input
    editor.style.padding = "3px";
    editor.style.width = "100%";
    editor.style.boxSizing = "border-box";

    //Set value of editor to the current value of the cell
    const originalNoteId = cell.getValue();
    if (originalNoteId) {
        const note = froca.getNoteFromCache(originalNoteId);
        editor.value = note.title;
    } else {
        editor.value = "";
    }

    //set focus on the select box when the editor is selected
    onRendered(function(){
        let newNoteId = originalNoteId;

        note_autocomplete.initNoteAutocomplete($editor, {
            allowCreatingNotes: true,
            hideAllButtons: true
        }).on("autocomplete:noteselected", (event, suggestion, dataset) => {
            const notePath = suggestion.notePath;
            newNoteId = (notePath ?? "").split("/").at(-1);
        }).on("blur", () => {
            if (!editor.value) {
                newNoteId = "";
            }
            success(newNoteId);
        });
        editor.focus();
    });

    const container = document.createElement("div");
    container.classList.add("input-group");
    container.classList.add("autocomplete");
    container.appendChild(editor);
    return container;
};
