# Collections
Collections are a unique type of notes that don't have a content, but instead display its child notes in various presentation methods.

Classic collections are read-only mode and compiles the contents of all child notes into one continuous view. This makes it ideal for reading extensive information broken into smaller, manageable segments.

*   <a class="reference-link" href="Collections/Grid%20View.md">Grid View</a> which is the default presentation method for child notes (see <a class="reference-link" href="../Basic%20Concepts%20and%20Features/Notes/Note%20List.md">Note List</a>), where the notes are displayed as tiles with their title and content being visible.
*   <a class="reference-link" href="Collections/List%20View.md">List View</a> is similar to <a class="reference-link" href="Collections/Grid%20View.md">Grid View</a>, but it displays the notes one under the other with the content being expandable/collapsible, but also works recursively.

More specialized collections were introduced, such as the:

*   <a class="reference-link" href="Collections/Calendar%20View.md">Calendar View</a> which displays a week, month or year calendar with the notes being shown as events. New events can be added easily by dragging across the calendar.
*   <a class="reference-link" href="Collections/Geo%20Map%20View.md">Geo Map View</a> which displays a geographical map in which the notes are represented as markers/pins on the map. New events can be easily added by pointing on the map.
*   <a class="reference-link" href="Collections/Table%20View.md">Table View</a> displays each note as a row in a table, with <a class="reference-link" href="../Advanced%20Usage/Attributes/Promoted%20Attributes.md">Promoted Attributes</a> being shown as well. This makes it easy to visualize attributes of notes, as well as making them easily editable.
*   <a class="reference-link" href="Collections/Board%20View.md">Board View</a> (Kanban) displays notes in columns, grouped by the value of a label.

For a quick presentation of all the supported view types, see the child notes of this help page, including screenshots.

## Configuration

To adjust the view type, see the dedicated _Collections_ tab in the <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Ribbon.md">Ribbon</a>.

## Use cases

### Creating a new collection

To create a new collections, right click in the <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Note%20Tree.md">Note Tree</a> and look for the _Collections_ entry and select the desired type.

### Adding a description to a collection

To add a text before the collection, for example to describe it:

1.  Create a new collection.
2.  In the <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Ribbon.md">Ribbon</a>, go to _Basic Properties_ and change the note type from _Collection_ to _Text_.

Now the text will be displayed above while still maintaining the collection view.

### Using saved search

Since collections are based on the <a class="reference-link" href="../Basic%20Concepts%20and%20Features/Notes/Note%20List.md">Note List</a> mechanism, it's possible to apply the same configuration to <a class="reference-link" href="Saved%20Search.md">Saved Search</a> to do advanced querying and presenting the result in an adequate matter such as a calendar, a table or even a map.

### Creating a collection from scratch

By default, collections come with a default configuration and sometimes even sample notes. To create a collection completely from scratch:

1.  Create a new note of type _Text_ (or any type).
2.  In the <a class="reference-link" href="../Basic%20Concepts%20and%20Features/UI%20Elements/Ribbon.md">Ribbon</a>, go to _Basic Properties_ and select _Collection_ as the note type.
3.  Still in the ribbon, go to _Collection Properties_ and select the desired view type.
4.  Consult the help page of the corresponding view type in order to understand how to configure them.

## Under the hood

Collections by themselves are simply notes with no content that rely on the <a class="reference-link" href="../Basic%20Concepts%20and%20Features/Notes/Note%20List.md">Note List</a> mechanism (the one that lists the children notes at the bottom of a note) to display information.

By default, new collections use predefined <a class="reference-link" href="../Advanced%20Usage/Templates.md">Templates</a> that are stored safely in the <a class="reference-link" href="../Advanced%20Usage/Hidden%20Notes.md">Hidden Notes</a> to define some basic configuration such as the type of view, but also some <a class="reference-link" href="../Advanced%20Usage/Attributes/Promoted%20Attributes.md">Promoted Attributes</a> to make editing easier.

Collections don't store their configuration (e.g. the position on the map, the hidden columns in a table) in the content of the note itself, but as attachments.