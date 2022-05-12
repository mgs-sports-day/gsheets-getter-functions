# gsheets-getter-functions

Functions to load data from the MGS Sports Day spreadsheet

**This repository is not intended for public use. It is a set of internal bindings used by MGS Sports Day v1.5.**

## List of functions

All but the helper functions use async/await, and depend on Underscore.js and Axios (see `package.json`).

All functions are documented with jsDoc in `index.ts`, but have not been exported. Simply copy-paste into the new SD app, making modifications (TS, Fetch API, etc.) as you see fit.

Returned data is sorted in spreadsheet order.

These functions need updating year-on-year, as the spreadsheet cell references are likely to change.

Please do not hesitate to ask if anything needs clarifying.

*Struck-through functions have not been implemented yet.*

### Helper functions needed by others

+ sdBuildQuery
+ sdParseRes
+ intToSpreadsheetColLetter

### Functions to be run once on app load, and response stored

+ getEventsList
+ getFormsList
+ getBonusPointsAllocations

### Functions to be run more than once (i.e. to refresh data or when user requests specific event)

+ getSummaryStandings
+ getEventResults
+ getYearGroupRecords
+ getRecordsSummaryStats
+ getFormResults

## Licensing

These functions are Copyright (c) 2017-22 Pal Kerecsenyi, Theodore Tucker and Geza Kerecsenyi, and are licensed under the MIT License (see `LICENSE`).
