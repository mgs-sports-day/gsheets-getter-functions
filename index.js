// gsheets-getter-functions
// Functions to load data from the MGS Sports Day spreadsheet
//
// (c) 2017-22 PPK, TGT; MIT License
// This repository is not intended for public distribution.

var axios = require("axios").default;
var _ = require("underscore");

/**
 * Generate the URL for a GET request to the API
 * @param {String} apiKey - Google Sheets API key
 * @param {String} sheetId - The ID of the public Google Sheet to query
 * @param {String} range - The A1 notation of the values to retrieve
 * @param {String} dimension - The major dimension that results should use ("ROWS" or "COLUMNS")
 * @param {Boolean} format - Should the retrieved data be string formatted as in GDocs?
 * @returns {String} - The encoded URL
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
 * @param {Object} res - The array
 * @returns {Object} - The JSON object
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
 * @param {Number} number - The integer to convert
 * @returns {String} - The column letter
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
 * @param {String} apiKey - Google Sheets API key
 * @param {String} sheetId - The ID of the public Google Sheet to query
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
 * @param {String} apiKey - Google Sheets API key
 * @param {String} sheetId - The ID of the public Google Sheet to query
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
 * @param {String} apiKey - Google Sheets API key
 * @param {String} sheetId - The ID of the public Google Sheet to query
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
 * @param {String} apiKey - Google Sheets API key
 * @param {String} sheetId - The ID of the public Google Sheet to query
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
 * @param {String} apiKey - Google Sheets API key
 * @param {String} sheetId - The ID of the public Google Sheet to query
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
  try {
    var matchingEvents = _.where(eventsList, {db: eventDbName});
    if (_.isEmpty(matchingEvents)) {
      throw "ERROR: INVALID eventDbName";
    }
    var matchingEvent = matchingEvents[0];
    var matchingYearLetters = _.where(formsList, {year: parseInt(yearGroup)});
    if (! _.contains([7, 8, 9, 10], yearGroup)) {
      throw "ERROR: INVALID yearGroup";
    }
    var spreadsheetRange = "y" + yearGroup + "_results!" + intToSpreadsheetColLetter(matchingEvent.startingCol) + "9:" +  intToSpreadsheetColLetter(matchingEvent.startingCol + 4) + (yearGroup == "9" ? "28" : "24"); // year 9 has 10 forms this year; all other have 8 forms
    var queryURL = sdBuildQuery(apiKey, sheetId, spreadsheetRange, "COLUMNS", false);
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

/**
 * For a given year group, get the table of records
 * Once retrieved, these data can be shown (as a summary) or can be queried (e.g. with _) to include data for a single event on its page 
 * @async
 * @param {String} apiKey - Google Sheets API key
 * @param {String} sheetId - The ID of the public Google Sheet to query
 * @param {Number} yearGroup - The year group for which results are to be retrieved (one of [7, 8, 9, 10])
 * @returns {Promise<Array>} - See example below
 * Example: 
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
async function getYearGroupRecords(apiKey, sheetId, yearGroup) {
  var queryURL = sdBuildQuery(apiKey, sheetId, "y" + yearGroup + "_records!A4:J15", "ROWS", false);
  try {
    var response = await axios.get(queryURL);
    response = sdParseRes(response.data.values);
    return response;
  } catch (err) {
    return err;
  }
}

/**
 * For the whole school, get the number of records broken and equalled this year by each year group's competitors
 * @async
 * @param {String} apiKey - Google Sheets API key
 * @param {String} sheetId - The ID of the public Google Sheet to query
 * @returns {Promise<Array>} - See example below
 * Example: 
 * [
      { year: 'Year 7', recordsEqualled: 0, recordsBroken: 0 },
      { year: 'Year 8', recordsEqualled: 0, recordsBroken: 0 },
      { year: 'Year 9', recordsEqualled: 0, recordsBroken: 0 },
      { year: 'Year 10', recordsEqualled: 0, recordsBroken: 0 },
      { year: 'All year groups', recordsEqualled: 0, recordsBroken: 0 }
   ]
}
 */
async function getRecordsSummaryStats(apiKey, sheetId) {
  var queryURL = sdBuildQuery(apiKey, sheetId, "records_summary!A3:C8", "ROWS", false);
  try {
    var response = await axios.get(queryURL);
    response = sdParseRes(response.data.values);
    return response;
  } catch (err) {
    return err;
  }
}

/**
 * For a single form, get that form's positions and points in all events 
 * Once retrieved, these data can be shown (as a summary on a form's page) or can be queried (e.g. with _) to include data for a single event
 * @async
 * @param {String} apiKey - Google Sheets API key
 * @param {String} sheetId - The ID of the public Google Sheet to query
 * @param {Array} eventsList - The array of events returned by getEventsList()
 * @param {Array} formsList - The array of forms returned by getFormsList()
 * @param {Number} yearGroup - The year group for which results are to be retrieved (one of [7, 8, 9, 10])
 * @param {String} formLetters - The letter part only of a form's name (e.g. "W" for 8W, or "PJH/DMT" for 9PJH/DMT)
 * @returns {Promise<Array>} - See example below
 * Example: 
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
async function getFormResults(apiKey, sheetId, eventsList, formsList, yearGroup, formLetters) {
  try {
    var possForms = _.pluck(_.where(formsList, {year: yearGroup}), "form");
    if (_.isEmpty(possForms)) {
      throw "ERROR: INVALID yearGroup";
    }
    // find n; where our form is the nth row in the SS
    var position = _.indexOf(possForms, formLetters);
    if (position === -1) {
      throw "ERROR: INVALID formLetters"
    }
    // convert to a row number: *2 because each form takes two rows; +8 initial offset from top of sheet; +1 off-by-one correction (JS counts from 0)
    position = (2 * position) + 8 + 1;
    // API request
    var ssRange = "y" + yearGroup + "_results!D" + position + ":BF" + (position + 1);
    var queryURL = sdBuildQuery(apiKey, sheetId, ssRange, "COLUMNS", false);
    var response = await axios.get(queryURL);
    var dataset = response.data;
    // add headers as first row of all arrays, ready for JSON parsing
    var results = [["eventDb", "eventPretty", "posA", "ptsA", "posB", "ptsB", "posC", "ptsC", "ptsRB", "ptsTOTAL"]];
    // for every event
    for (var i = 0; i < eventsList.length; i++) {
      // make up the new line from the SS
      // the first 5 arrays are the columns for this event (A, B, C, RB, TOTAL)
      // consider the [0][1], etc. as relative Y, X co-ords within an SS form event 'block'
      var newLine = [
        eventsList[i].db,
        eventsList[i].pretty,
        dataset.values[0][0], // posA
        dataset.values[0][1], // ptsA
        dataset.values[1][0], // posB
        dataset.values[1][1], // ptsB
        dataset.values[2][0], // posC
        dataset.values[2][1], // ptsC
        dataset.values[3][1], // ptsRB
        dataset.values[4][1] // ptsTOTAL
      ];
      results.push(newLine);
      // remove the first 5 arrays from the stack ready for the next i
      dataset.values = dataset.values.slice(5);
    }
    results = sdParseRes(results);
    return results;
  }
  catch(err) {
    return err;
  }

}

// END OF FUNCTIONS

// Testing code

(async() => {
  var events = await getEventsList("AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE", "1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0");
  console.log("=== getEventsList ===");
  console.log(events);
  var forms = await getFormsList("AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE", "1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0");
  console.log("=== getFormsList ===");
  console.log(forms);
  console.log("=== getBonusPointsAllocations ===");
  console.log(await getBonusPointsAllocations("AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE", "1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0"));
  console.log("=== getSummaryStandings ===");
  console.log(await getSummaryStandings("AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE", "1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0"));
  console.log("=== getEventResults ===");
  console.log(await getEventResults("AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE", "1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0", events, forms, "100m", 9));
  console.log("=== getYearGroupRecords ===");
  console.log(await getYearGroupRecords("AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE", "1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0", 10));
  console.log("=== getRecordsSummaryStats ===");
  console.log(await getRecordsSummaryStats("AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE", "1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0", 7));
  console.log("=== getFormResults ===");
  console.log(await getFormResults("AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE", "1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0", events, forms, 8, "W"));
})();
