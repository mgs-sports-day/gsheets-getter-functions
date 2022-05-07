# gsheets-getter-functions

Functions to load data from the MGS Sports Day spreadsheet

*NOT FOR PUBLIC RELEASE*

## API Keys

Public Google Sheets API key (read-only): `AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE`

Public Google Sheet ID for 2022: `1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0`

## List of functions

All but the helper functions use async/await, and depend on Underscore.js and Axios (see `package.json`).

All functions are documented with jsDoc in `index.js`, but have not been exported. Simply copy-paste into the new SD app, making modifications (TS, Fetch API, etc.) as you see fit.

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

These functions are Copyright (c) 2017-22 Pal Kerecsenyi and Theodore Tucker, and are licensed under the MIT License (see `LICENSE`).

This repository is not intended for public distribution.