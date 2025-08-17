# Board View
<figure class="image"><img style="aspect-ratio:918/248;" src="Board View_image.png" width="918" height="248"></figure>

The Board view presents sub-notes in columns for a Kanban-like experience. Each column represents a possible value for a status label, which can be adjusted.

## How it works

When first creating a collection of _Board_ type, a few subnotes will be created, each having a `#status` label set. The board then groups each note by the value of the status attribute.

Notes are displayed recursively, so even the child notes of the child notes will be displayed. However, unlike the <a class="reference-link" href="Table%20View.md">Table View</a>, the notes are not displayed in a hierarchy.

## Interaction with columns

*   Create a new column by pressing _Add Column_ near the last column.
    *   Once pressed, a text box will be displayed to set the name of the column. Press Enter to confirm.
*   To reorder a column, simply hold the mouse over the title and drag it to the desired position.
*   To delete a column, right click on its title and select _Delete column_.
*   To rename a column, click on the note title.
    *   Press Enter to confirm.
    *   Upon renaming a column, the corresponding status attribute of all its notes will be changed in bulk.
*   If there are many columns, use the mouse wheel to scroll.

## Interaction with notes

*   Create a new note in any column by pressing _New item_
    *   Enter the name of the note and press _Enter_.
    *   Doing so will create a new note. The new note will have an attribute (`status` label by default) set to the name of the column.
*   To change the state of a note, simply drag a note from one column to the other to change its state.
*   The order of the notes in each column corresponds to their position in the tree.
    *   It's possible to reorder notes simply by dragging them to the desired position within the same columns.
    *   It's also possible to drag notes across columns, at the desired position.
*   For more options, right click on a note to display a context menu with the following options:
    *   Open the note in a new tab/split/window or quick edit.
    *   Move the note to any column.
    *   Insert a new note above/below the current one.
    *   Delete the current note.
*   If there are many notes within the column, move the mouse over the column and use the mouse wheel to scroll.

## Configuration

### Grouping by another attribute

By default, the label used to group the notes is `#status`. It is possible to use a different label if needed by defining a label named `#board:groupBy` with the value being the attribute to use (without `#` attribute prefix).

> [!NOTE]
> It's currently not possible to set a relation as the grouping criteria. There are plans to add support for it.

## Interaction

## Limitations

*   It is not possible yet to use group by a relation, only by label.