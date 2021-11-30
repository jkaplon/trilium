"use strict";

const lex = require('./lex');
const handleParens = require('./handle_parens');
const parse = require('./parse');
const SearchResult = require("../search_result");
const SearchContext = require("../search_context");
const becca = require('../../../becca/becca');
const beccaService = require('../../../becca/becca_service');
const utils = require('../../utils');
const log = require('../../log');

function loadNeededInfoFromDatabase() {
    const sql = require('../../sql');

    for (const noteId in becca.notes) {
        becca.notes[noteId].contentSize = 0;
        becca.notes[noteId].noteSize = 0;
        becca.notes[noteId].revisionCount = 0;
    }

    const noteContentLengths = sql.getRows(`
        SELECT 
            noteId, 
            LENGTH(content) AS length 
        FROM notes
             JOIN note_contents USING(noteId) 
        WHERE notes.isDeleted = 0`);

    for (const {noteId, length} of noteContentLengths) {
        if (!(noteId in becca.notes)) {
            log.error(`Note ${noteId} not found in becca.`);
            continue;
        }

        becca.notes[noteId].contentSize = length;
        becca.notes[noteId].noteSize = length;
    }

    const noteRevisionContentLengths = sql.getRows(`
        SELECT 
            noteId, 
            LENGTH(content) AS length 
        FROM notes
             JOIN note_revisions USING(noteId) 
             JOIN note_revision_contents USING(noteRevisionId) 
        WHERE notes.isDeleted = 0`);

    for (const {noteId, length} of noteRevisionContentLengths) {
        if (!(noteId in becca.notes)) {
            log.error(`Note ${noteId} not found in becca.`);
            continue;
        }

        becca.notes[noteId].noteSize += length;
        becca.notes[noteId].revisionCount++;
    }
}

/**
 * @param {Expression} expression
 * @param {SearchContext} searchContext
 * @return {SearchResult[]}
 */
function findResultsWithExpression(expression, searchContext) {
    if (searchContext.dbLoadNeeded) {
        loadNeededInfoFromDatabase();
    }

    const allNoteSet = becca.getAllNoteSet();

    const executionContext = {
        noteIdToNotePath: {}
    };

    const noteSet = expression.execute(allNoteSet, executionContext);

    const searchResults = noteSet.notes
        .map(note => {
            const notePathArray = executionContext.noteIdToNotePath[note.noteId] || beccaService.getSomePath(note);

            if (!notePathArray) {
                throw new Error(`Can't find note path for note ${JSON.stringify(note.getPojo())}`);
            }

            if (notePathArray.includes("hidden")) {
                return null;
            }

            return new SearchResult(notePathArray);
        }).filter(Boolean);

    for (const res of searchResults) {
        res.computeScore(searchContext.highlightedTokens);
    }

    if (!noteSet.sorted) {
        searchResults.sort((a, b) => {
            if (a.score > b.score) {
                return -1;
            } else if (a.score < b.score) {
                return 1;
            }

            // if score does not decide then sort results by depth of the note.
            // This is based on the assumption that more important results are closer to the note root.
            if (a.notePathArray.length === b.notePathArray.length) {
                return a.notePathTitle < b.notePathTitle ? -1 : 1;
            }

            return a.notePathArray.length < b.notePathArray.length ? -1 : 1;
        });
    }

    return searchResults;
}

function parseQueryToExpression(query, searchContext) {
    const {fulltextTokens, expressionTokens} = lex(query);
    const structuredExpressionTokens = handleParens(expressionTokens);

    const expression = parse({
        fulltextTokens,
        expressionTokens: structuredExpressionTokens,
        searchContext,
        originalQuery: query
    });

    if (searchContext.debug) {
        log.info(`Fulltext tokens: ` + JSON.stringify(fulltextTokens));
        log.info(`Expression tokens: ` + JSON.stringify(structuredExpressionTokens, null, 4));
        log.info("Expression tree: " + JSON.stringify(expression, null, 4));
    }

    return expression;
}

/**
 * @param {string} query
 * @return {Note[]}
 */
function searchNotes(query, params = {}) {
    const searchResults = findResultsWithQuery(query, new SearchContext(params));

    return searchResults.map(sr => becca.notes[sr.noteId]);
}

/**
 * @param {string} query
 * @param {SearchContext} searchContext
 * @return {SearchResult[]}
 */
function findResultsWithQuery(query, searchContext) {
    query = query || "";
    searchContext.originalQuery = query;

    const expression = parseQueryToExpression(query, searchContext);

    if (!expression) {
        return [];
    }

    return findResultsWithExpression(expression, searchContext);
}

function searchNotesForAutocomplete(query) {
    const searchContext = new SearchContext({
        fastSearch: true,
        includeArchivedNotes: false,
        fuzzyAttributeSearch: true
    });

    const allSearchResults = findResultsWithQuery(query, searchContext)
        .filter(res => !res.notePathArray.includes("hidden"));

    const trimmed = allSearchResults.slice(0, 200);

    highlightSearchResults(trimmed, searchContext.highlightedTokens);

    return trimmed.map(result => {
        return {
            notePath: result.notePath,
            noteTitle: beccaService.getNoteTitle(result.noteId),
            notePathTitle: result.notePathTitle,
            highlightedNotePathTitle: result.highlightedNotePathTitle
        }
    });
}

function highlightSearchResults(searchResults, highlightedTokens) {
    highlightedTokens = Array.from(new Set(highlightedTokens));

    // we remove < signs because they can cause trouble in matching and overwriting existing highlighted chunks
    // which would make the resulting HTML string invalid.
    // { and } are used for marking <b> and </b> tag (to avoid matches on single 'b' character)
    // < and > are used for marking <small> and </small>
    highlightedTokens = highlightedTokens.map(token => token.replace('/[<\{\}]/g', ''));

    // sort by the longest so we first highlight longest matches
    highlightedTokens.sort((a, b) => a.length > b.length ? -1 : 1);

    for (const result of searchResults) {
        const note = becca.notes[result.noteId];

        result.highlightedNotePathTitle = result.notePathTitle.replace('/[<\{\}]/g', '');

        if (highlightedTokens.find(token => note.type.includes(token))) {
            result.highlightedNotePathTitle += ` "type: ${note.type}'`;
        }

        if (highlightedTokens.find(token => note.mime.includes(token))) {
            result.highlightedNotePathTitle += ` "mime: ${note.mime}'`;
        }

        for (const attr of note.getAttributes()) {
            if (highlightedTokens.find(token => utils.normalize(attr.name).includes(token)
                || utils.normalize(attr.value).includes(token))) {

                result.highlightedNotePathTitle += ` "${formatAttribute(attr)}'`;
            }
        }
    }

    for (const token of highlightedTokens) {
        // this approach won't work for strings with diacritics
        const tokenRegex = new RegExp("(" + utils.escapeRegExp(token) + ")", "gi");

        for (const result of searchResults) {
            result.highlightedNotePathTitle = result.highlightedNotePathTitle.replace(tokenRegex, "{$1}");
        }
    }

    for (const result of searchResults) {
        result.highlightedNotePathTitle = result.highlightedNotePathTitle
            .replace(/"/g, "<small>")
            .replace(/'/g, "</small>")
            .replace(/{/g, "<b>")
            .replace(/}/g, "</b>");
    }
}

function formatAttribute(attr) {
    if (attr.type === 'relation') {
        return '~' + utils.escapeHtml(attr.name) + "=…";
    }
    else if (attr.type === 'label') {
        let label = '#' + utils.escapeHtml(attr.name);

        if (attr.value) {
            const val = /[^\w_-]/.test(attr.value) ? '"' + attr.value + '"' : attr.value;

            label += '=' + utils.escapeHtml(val);
        }

        return label;
    }
}

module.exports = {
    searchNotesForAutocomplete,
    findResultsWithQuery,
    searchNotes
};
