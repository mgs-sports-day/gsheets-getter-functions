// DO NOT USE THESE FUNCTIONS YET

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

async function getEventResults(apiKey, sheetId, eventsList, formsList, eventDbName, yearGroup) {
  var matchingEvent = _.where(eventsList, {db: eventDbName})[0];
  var matchingYearLetters = _.where(formsList, {year: parseInt(yearGroup)});
  var spreadsheetRange = "y" + yearGroup + "_results!" + intToSpreadsheetColLetter(matchingEvent.startingCol) + "9:" +  intToSpreadsheetColLetter(matchingEvent.startingCol + 4) + "24";
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

(async() => {
  var events = await getEventsList("AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE", "1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0");
  var forms = await getFormsList("AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE", "1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0");
  console.log(forms);
  console.log(await getEventResults("AIzaSyCFfbIjKZGPkuXnYUFD4E14flZNKMC9rQE", "1l5ZpGQ6ElmXMdLbr801MFv8cOBf9QVfAHJqiCQti1q0", events, forms, "100m", 10));
})()

/*

TODO

event_record(id, year) = l. 389
form(year, form) - l. 431
records summary = records_summary!A3:C8
records(year)

*/