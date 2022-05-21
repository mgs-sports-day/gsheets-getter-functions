// gsheets-getter-functions
// Functions to load data from the MGS Sports Day spreadsheet
//
// (c) 2017-22 PPK, TGT, GDK; MIT License
// This repository is not intended for public use. It is a set of internal bindings used by MGS Sports Day v1.5.

import { indexOf, pluck, where } from 'underscore';
import type {
    BonusPointAllocations,
    Dimension, EventRecordStanding, EventResults,
    Form, FormResults,
    SportEvent,
    SportEventName, SubeventFormResult,
    SummaryResults,
    YearGroup, YearGroupRecordSummary,
} from './types';
import { ParserFunction, RequestBuilder, RequestCache } from './cache';

class GSheetsAPI {
    private readonly apiKey: string;
    private readonly sheetId: string;

    constructor(apiKey: string, sheetId: string) {
        this.apiKey = apiKey;
        this.sheetId = sheetId;
    }

    /**
     * Convert an integer to its spreadsheet column letter (e.g. 1 = A, 2 = B, 27 = AA, etc.)
     * @param {Number} number - The integer to convert
     * @returns {String} - The column letter
     */
    private static intToSpreadsheetColLetter(number: number) {
        const baseChar = ('A').charCodeAt(0);
        let letters = '';
        do {
            number -= 1;
            letters = String.fromCharCode(baseChar + (number % 26)) + letters;
            number = (number / 26) >> 0;
        } while (number > 0);
        return letters;
    }

    /**
     * Create a RequestBuilder for a request to the Google Sheets API.
     * @param {String} range - The A1 notation of the values to retrieve
     * @param {String} dimension - The major dimension that results should use ("ROWS" or "COLUMNS")
     * @param {Boolean} isFormatted - Should the retrieved data be string formatted as in GDocs?
     * @param {Function} parser - Generate a final object from the server's response. Use RequestCache.twoDimensionParser in most cases.
     * @returns {RequestBuilder}
     */
    private newRequest<T>(range: string, dimension: Dimension, isFormatted: boolean, parser: ParserFunction<T>) {
        const builder = this.newRequestBuilder<T>()
        return builder.add(() => {
            return new RequestCache<T>(this.apiKey, this.sheetId, range, dimension, isFormatted).setParser(parser);
        })
    }

    private newRequestBuilder<T>() {
        return new RequestBuilder<T>(this.apiKey, this.sheetId)
    }

    /**
     * Get the list of all events from the spreadsheet
     * Useful to run this function once on app load, as this array is needed by other functions later
     * @async
     * @returns {RequestBuilder<Array>} - See example below
     * @example
     * [ {
     *   db: 'longJump',
     *   pretty: 'Long Jump',
     *   subs: 'b',
     *   scored: 'overall',
     *   units: 'metre',
     *   startingCol: 4
     *   }, ...
     * ]
     */
    getEventsList() {
        const request = this.newRequest<SportEvent[]>('event_list!A2:F13', 'ROWS', false, RequestCache.twoDimensionParser);
        request.alwaysCache = true;
        return request;
    }

    /**
     * Get the list of all forms from the spreadsheet
     * Useful to run this function once on app load, as this array is needed by other functions later
     * @async
     * @returns {RequestBuilder<Array>} - See example below
     * @example
     * [
     *   { year: 7, form: 'B' },
     *   { year: 7, form: 'D' },
     *   { year: 7, form: 'E' }, ...
     * ]
     */
    getFormsList() {
        return this.newRequest<Form[]>('summary!A3:B37', 'ROWS', false, RequestCache.twoDimensionParser);
    }

    /**
     * Get the table of bonus points awarded when records are broken/equalled from the spreadsheet
     * Useful to run this function once on app load and store results locally
     *  as only bonus point values (not their meanings) are retrieved for each event.
     *  Otherwise, there is no way to verbally indicate to the user if a record has been broken.
     * @async
     * @returns {RequestBuilder<Object>} - See example below
     * @example
     * {
     *    noRecord: 0,
     *    equal: 1,
     *    beat: 2
     * }
     */
    getBonusPointsAllocations() {
        return this.newRequest<BonusPointAllocations>(
            'point_allocations_record!B3:B5',
            'ROWS',
            false,
            response => {
                return {
                    noRecord: response[0][0], equal: response[1][0], beat: response[2][0],
                };
            });
    }

    /**
     * Get a list of all forms, their total points, and year group and whole school position standings
     * @async
     * @returns {RequestBuilder<Array>} - See example below
     * @example
     * [
     { year: 7, form: 'B', points: 480, yearPos: 2, schoolPos: 9 },
     { year: 7, form: 'D', points: 424, yearPos: 7, schoolPos: 24 },
     { year: 7, form: 'E', points: 480, yearPos: 2, schoolPos: 9 },
     { year: 7, form: 'H', points: 449, yearPos: 6, schoolPos: 20 }, ...
     * ]
     */
    getSummaryStandings() {
        return this.newRequest<SummaryResults[]>('summary!A3:E37', 'ROWS', false, RequestCache.twoDimensionParser);
    }

    /**
     * For a single event and year group, get the positions and points scored by competitors from each form, in each of the sub-events A, B, C
     *  Also returns total points per form in that event, and number of Record Bonus points
     * @async
     * @param {String} eventDbName - The database name (the "db" field in eventsList) of the event for which results are to be retrieved
     * @param {Number} yearGroup - The year group for which results are to be retrieved (one of [7, 8, 9, 10])
     * @returns {RequestBuilder<Object>} - See example below
     * @example
     * {
          A: [
            { letter: 'AC/GMT', pos: 8, pts: 23 },
            { letter: 'DVN/JPJ', pos: 1, pts: 31 }, ...
          ],
          B: [
            { letter: 'AC/GMT', pos: 5, pts: 16 },
            { letter: 'DVN/JPJ', pos: 6, pts: 15 }, ...
          ],
          C: [
            { letter: 'AC/GMT', pos: 6, pts: 5 },
            { letter: 'DVN/JPJ', pos: 8, pts: 3 }, ...
          ],
          RB: [
            { letter: 'AC/GMT', pos: '', pts: 0 },
            { letter: 'DVN/JPJ', pos: '', pts: 2 }, ...
          ],
          TOTAL: [
            { letter: 'AC/GMT', pos: '', pts: 44 },
            { letter: 'DVN/JPJ', pos: '', pts: 51 }, ...
          ]
        }
     */
    getEventResults(eventDbName: SportEventName, yearGroup: YearGroup) {
        return this.newRequestBuilder<EventResults[]>()
            .add(() => this.getEventsList())
            .add(() => this.getFormsList())
            .add(([eventsList, formsList]) => {
                const matchingEvents = where(eventsList, { db: eventDbName });
                if (matchingEvents.length === 0) {
                    throw new Error('invalid eventDbName');
                }
                const matchingEvent = matchingEvents[0];
                const matchingYearLetters = where(formsList, { year: yearGroup });
                if (![7, 8, 9, 10].includes(yearGroup)) {
                    throw new Error('invalid yearGroup');
                }

                const spreadsheetRange = `y${yearGroup}_results!${
                    GSheetsAPI.intToSpreadsheetColLetter(matchingEvent.startingCol as number)
                }9:${
                    GSheetsAPI.intToSpreadsheetColLetter((matchingEvent.startingCol as number) + 4)
                }${
                    yearGroup === 9 ? '28' : '24' // year 9 has 10 forms this year; all others have 8 forms
                }`;

                return {
                    matchingEvent, matchingYearLetters,
                    spreadsheetRange,
                }
            })
            .add(([,,{matchingEvent, matchingYearLetters, spreadsheetRange}]) => {
                return this.newRequest(
                    spreadsheetRange,
                    'COLUMNS',
                    false,
                    (dataset) => {
                        // add headers as first row of all arrays, ready for JSON parsing
                        const resultsTabHeaders = ['letter', 'pos', 'pts'];
                        const tabA = [resultsTabHeaders];
                        const tabB = [resultsTabHeaders];
                        const tabC = [resultsTabHeaders];
                        const tabRB = [resultsTabHeaders];
                        const tabTotal = [resultsTabHeaders];

                        // for each column (i.e. sub-event) we get back from the API
                        for (let i = 0; i < dataset.length; i++) {
                            let currentColData = dataset[i];
                            // for every form in this year group
                            for (let j = 0; j < matchingYearLetters.length; j++) {
                                // get the first 2 numbers from the stack (our relevant pos and pts)
                                const newRecord = [matchingYearLetters[j].form, currentColData[0], currentColData[1]];
                                // and add them as a new sub-array in the relevant array
                                switch (i) {
                                    case 0:
                                        tabA.push(newRecord);
                                        break;
                                    case 1:
                                        tabB.push(newRecord);
                                        break;
                                    case 2:
                                        tabC.push(newRecord);
                                        break;
                                    case 3:
                                        tabRB.push(newRecord);
                                        break;
                                    case 4:
                                        tabTotal.push(newRecord);
                                        break;
                                }
                                // remove the first two elements of the array for the next j
                                currentColData = currentColData.slice(2);
                            }
                        }

                        return {
                            a: RequestCache.twoDimensionParser(tabA),
                            b: RequestCache.twoDimensionParser(tabB),
                            c: RequestCache.twoDimensionParser(tabC),
                            rb: RequestCache.twoDimensionParser(tabRB),
                            total: RequestCache.twoDimensionParser(tabTotal),
                        } as {
                            a: SubeventFormResult[],
                            b: SubeventFormResult[],
                            c: SubeventFormResult[],
                            rb: SubeventFormResult[],
                            total: SubeventFormResult[],
                        };
                    }
                )
            })
    }

    /**
     * For a given year group, get the table of records
     * Once retrieved, these data can be shown (as a summary) or can be queried (e.g. with _) to include data for a single event on its page
     * @async
     * @param {Number} yearGroup - The year group for which results are to be retrieved (one of [7, 8, 9, 10])
     * @returns {RequestBuilder<Array>} - See example below
     * @example
     * [
         {
          event: 'longJump', // this is the event's dbName for cross-referencing
          units: 'metre', // always in singular form; frontend needs to pluralize as appropriate
          standingScore: 3.74, // the actual distance/time achieved in the above units
          standingHolder: 'Luca G', // first name and last initial only
          standingYear: 2018,
          currentScore: 5.55,
          currentHolder: 'Harry P',
          currentForm: 'W', // letters only
          currentYear: 2022,
          doScore: 2
        }, ...
       ]
     }
     */
    async getYearGroupRecords(yearGroup: YearGroup) {
        return this.newRequest<EventRecordStanding[]>('y' + yearGroup + '_records!A4:J15', 'ROWS', false, RequestCache.twoDimensionParser);
    }

    /**
     * For the whole school, get the number of records broken and equalled this year by each year group's competitors
     * @async
     * @returns {RequestBuilder<Array>} - See example below
     * @example
     * [
         { year: 'Year 7', recordsEqualled: 0, recordsBroken: 0 },
         { year: 'Year 8', recordsEqualled: 0, recordsBroken: 0 },
         { year: 'Year 9', recordsEqualled: 0, recordsBroken: 0 },
         { year: 'Year 10', recordsEqualled: 0, recordsBroken: 0 },
         { year: 'All year groups', recordsEqualled: 0, recordsBroken: 0 }
       ]
     }
     */
    async getRecordsSummaryStats() {
        return this.newRequest<YearGroupRecordSummary[]>('records_summary!A3:C8', 'ROWS', false, RequestCache.twoDimensionParser);
    }

    /**
     * For a single form, get that form's positions and points in all events
     * Once retrieved, these data can be shown (as a summary on a form's page) or can be queried (e.g. with _) to include data for a single event
     * @async
     * @param {Number} yearGroup - The year group for which results are to be retrieved (one of [7, 8, 9, 10])
     * @param {String} formLetters - The letter part only of a form's name (e.g. "W" for 8W, or "PJH/DMT" for 9PJH/DMT)
     * @returns {RequestBuilder<Array>} - See example below
     * @example
         [
             {
              eventDb: 'longJump',
              eventPretty: 'Long Jump',
              posA: 5,
              ptsA: 26,
              posB: 3,
              ptsB: 28,
              posC: undefined,
              ptsC: undefined,
              ptsRB: 0,
              ptsTOTAL: 54
            }, ...
        ]
     */
    getFormResults(yearGroup: YearGroup, formLetters: string) {
        return this.newRequestBuilder<FormResults[]>()
            .add(() => this.getEventsList())
            .add(() => this.getFormsList())
            .add(([,formsList]) => {
                const possibleForms = pluck(where(formsList, { year: yearGroup }), 'form');
                if (possibleForms.length === 0) {
                    throw new Error('invalid yearGroup');
                }
                // find n; where our form is the nth row in the SS
                let position = indexOf(possibleForms, formLetters);
                if (position === -1) {
                    throw new Error('invalid formLetters');
                }
                // convert to a row number: *2 because each form takes two rows; +8 initial offset from top of sheet; +1 off-by-one correction (JS counts from 0)
                position = (2 * position) + 8 + 1;

                // API request
                return `y${yearGroup}_results!D${position}:BF${position + 1}`;
            })
            .add(([eventsList,,ssRange]) => {
                return this.newRequest(
                    ssRange,
                    'COLUMNS',
                    false,
                    (dataset) => {
                        // add headers as first row of all arrays, ready for JSON parsing
                        let results = [['eventDb', 'eventPretty', 'posA', 'ptsA', 'posB', 'ptsB', 'posC', 'ptsC', 'ptsRB', 'ptsTOTAL']];
                        // for every event
                        for (let i = 0; i < eventsList.length; i++) {
                            // make up the new line from the SS
                            // the first 5 arrays are the columns for this event (A, B, C, RB, TOTAL)
                            // consider the [0][1], etc. as relative Y, X co-ords within an SS form event 'block'
                            const newLine = [
                                eventsList[i].db,
                                eventsList[i].pretty,
                                dataset[0][0], // posA
                                dataset[0][1], // ptsA
                                dataset[1][0], // posB
                                dataset[1][1], // ptsB
                                dataset[2][0], // posC
                                dataset[2][1], // ptsC
                                dataset[3][1], // ptsRB
                                dataset[4][1], // ptsTOTAL
                            ];
                            results.push(newLine);
                            // remove the first 5 arrays from the stack ready for the next i
                            dataset = dataset.slice(5);
                        }
                        return RequestCache.twoDimensionParser(results);
                    }
                )
            })
    }
}

export default GSheetsAPI
