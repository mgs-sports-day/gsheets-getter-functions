// gsheets-getter-functions
// Functions to load data from the MGS Sports Day spreadsheet
//
// (c) 2017-22 PPK, TGT; MIT License
// This repository is not intended for public distribution.

var axios = require("axios").default;
var _ = require("underscore");

/**
 * Generate the URL for a GET request to the API
 * @param {string} apiKey - Google Sheets API key
 * @param {string} sheetId - The ID of the public Google Sheet to query
 * @param {string} range - The A1 notation of the values to retrieve
 * @param {string} dimension - The major dimension that results should use ("ROWS" or "COLUMNS")
 * @param {boolean} format - Should the retrieved data be string formatted as in GDocs?
 * @returns {string} - The encoded URL
 */
function sdBuildQuery(apiKey, sheetId, range, dimension, format) {
  range = encodeURIComponent(range);
  if (format) {
    format = "FORMATTED_VALUE";
  } else {
    format = "UNFORMATTED_VALUE";
  }
  return "https://sheets.googleapis.com/v4/spreadsheets/" + sheetId + "/values/" + range + "?majorDimension=" + dimension + "&valueRenderOption=" + format + "&key=" + apiKey;
}

/**
 * Convert the 2D array from the API into a JSON object, using array[0] as the headers
 * @param {object} res - The array
 * @returns {object} - The JSON object
 */
function sdParseRes(res) {
  var headers = res[0];
  var dataset = res.slice(1);
  var result = dataset.map(function (a) {
      var object = {};
      headers.forEach(function (k, i) {
          object[k] = a[i];
      });
      return object;
  });
  return result;
}

/**
 * Convert an integer to its spreadsheet column letter (e.g. 1 = A, 2 = B, 27 = AA, etc.)
 * @param {number} number - The integer to convert
 * @returns {string} - The column letter
 */
function intToSpreadsheetColLetter(number) {
  var baseChar = ("A").charCodeAt(0);
  var letters  = "";
  do {
    number -= 1;
    letters = String.fromCharCode(baseChar + (number % 26)) + letters;
    number = (number / 26) >> 0;
  }
  while(number > 0);
  return letters;
}

/**
 * Get the list of all events from the spreadsheet
 * Useful to run this function once on app load, as this array is needed by other functions later
 * @async
 * @param {string} apiKey - Google Sheets API key
 * @param {string} sheetId - The ID of the public Google Sheet to query
 * @returns {Promise<Array>} - See example below
 * Example: 
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
async function getEventsList(apiKey, sheetId) {
  var queryURL = sdBuildQuery(apiKey, sheetId, "event_list!A2:F13", "ROWS", false);
  try {
    var response = await axios.get(queryURL);
    response = sdParseRes(response.data.values);
    return response;
  } catch (err) {
    return err;
  }
}

/**
 * Get the list of all forms from the spreadsheet
 * Useful to run this function once on app load, as this array is needed by other functions later
 * @async
 * @param {string} apiKey - Google Sheets API key
 * @param {string} sheetId - The ID of the public Google Sheet to query
 * @returns {Promise<Array>} - See example below
 * Example: 
 * [
 *   { year: 7, form: 'B' },
 *   { year: 7, form: 'D' },
 *   { year: 7, form: 'E' }, ...
 * ]
 */
async function getFormsList(apiKey, sheetId) {
  var queryURL = sdBuildQuery(apiKey, sheetId, "summary!A3:B37", "ROWS", false);
  try {
    var response = await axios.get(queryURL);
    response = sdParseRes(response.data.values);
    return response;
  } catch (err) {
    return err;
  }
}

/**
 * Get the table of bonus points awarded when records are broken/equalled from the spreadsheet
 * Useful to run this function once on app load and store results locally
 *  as only bonus point values (not their meanings) are retrieved for each event.
 *  Otherwise, there is no way to verbally indicate to the user if a record has been broken.
 * @async
 * @param {string} apiKey - Google Sheets API key
 * @param {string} sheetId - The ID of the public Google Sheet to query
 * @returns {Promise<Object>} - See example below
 * Example: 
 * {
 *    noRecord: 0,
 *    equal: 1,
 *    beat: 2
 * }
 */
async function getBonusPointsAllocations(apiKey, sheetId) {
  var queryURL = sdBuildQuery(apiKey, sheetId, "point_allocations_record!B3:B5", "ROWS", false);
  try {
    var response = await axios.get(queryURL);
    var allocations = {
      "noRecord": response.data.values[0][0],
      "equal": response.data.values[1][0],
      "beat": response.data.values[2][0]
    };
    return allocations;
  } catch (err) {
    return err;
  }
}

/**
 * Get a list of all forms, their total points, and year group and whole school position standings
 * @async
 * @param {string} apiKey - Google Sheets API key
 * @param {string} sheetId - The ID of the public Google Sheet to query
 * @returns {Promise<Array>} - See example below
 * Example: 
 * [
      { year: 7, form: 'B', points: 480, yearPos: 2, schoolPos: 9 },
      { year: 7, form: 'D', points: 424, yearPos: 7, schoolPos: 24 },
      { year: 7, form: 'E', points: 480, yearPos: 2, schoolPos: 9 },
      { year: 7, form: 'H', points: 449, yearPos: 6, schoolPos: 20 }, ...
 * ]
 */
async function getSummaryStandings(apiKey, sheetId) {
  var queryURL = sdBuildQuery(apiKey, sheetId, "summary!A3:E37", "ROWS", false);
  try {
    var response = await axios.get(queryURL);
    response = sdParseRes(response.data.values);
    return response;
  } catch (err) {
    return err;
  }
}


/**
 * For a single event and year group, get the positions and points scored by competitors from each form, in each of the sub-events A, B, C
 *  Also returns total points per form in that event, and number of Record Bonus points
 * @async
 * @param {string} apiKey - Google Sheets API key
 * @param {string} sheetId - The ID of the public Google Sheet to query
 * @param {Array} eventsList - The array of events returned by getEventsList()
 * @param {Array} formsList - The array of forms returned by getFormsList()
 * @param {String} eventDbName - The database name (the "db" field in eventsList) of the event for which results are to be retrieved
 * @param {Number} yearGroup - The year group for which results are to be retrieved (one of [7, 8, 9, 10])
 * @returns {Promise<Object>} - See example below
 * Example: 
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
async function getEventResults(apiKey, sheetId, eventsList, formsList, eventDbName, yearGroup) {
  var matchingEvent = _.where(eventsList, {db: eventDbName})[0];
  var matchingYearLetters = _.where(formsList, {year: parseInt(yearGroup)});
  var spreadsheetRange = "y" + yearGroup + "_results!" + intToSpreadsheetColLetter(matchingEvent.startingCol) + "9:" +  intToSpreadsheetColLetter(matchingEvent.startingCol + 4) + (yearGroup == "9" ? "28" : "24"); // year 9 has 10 forms this year; all other have 8 forms
  var queryURL = sdBuildQuery(apiKey, sheetId, spreadsheetRange, "COLUMNS", false);
  try {
    var response = await axios.get(queryURL);
    var dataset = response.data;
    // add headers as first row of all arrays, ready for JSON parsing
    var resultsTabHeaders = ["letter", "pos", "pts"];
    var tabA = [resultsTabHeaders];
    var tabB = [resultsTabHeaders];
    var tabC = [resultsTabHeaders];
    var tabRB = [resultsTabHeaders];
    var tabTOTAL = [resultsTabHeaders];
    // for each column (i.e. sub-event) we get back from the API 
    for (var i = 0; i < dataset.values.length; i++) {
      var currentColData = dataset.values[i];
      // for every form in this year group
      for (var j = 0; j < matchingYearLetters.length; j++) {
        // get the first 2 numbers from the stack (our relevant pos and pts)
        var newRecord = [matchingYearLetters[j].form, currentColData[0], currentColData[1]];
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
            tabTOTAL.push(newRecord);
            break;
        }
        // remove the first two elements of the array for the next j
        currentColData = currentColData.slice(2);
      }
    }
    var results = {
      "A": sdParseRes(tabA),
      "B": sdParseRes(tabB),
      "C": sdParseRes(tabC),
      "RB": sdParseRes(tabRB),
      "TOTAL": sdParseRes(tabTOTAL)
    };
    return results;
  } catch (err) {
    return err;
  }
}


// END OF FUNCTIONS

// TGT testing code
(async() => {
  var events = await getEventsList("AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE", "1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0");
  var forms = await getFormsList("AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE", "1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0");
  console.log(await getEventResults("AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE", "1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0", events, forms, "100m", 9));
})()

/*

TODO

event_record(id, year) = SD1 l. 389
form(year, form) - SD1 l. 431
records summary = records_summary!A3:C8
records(year)

*/