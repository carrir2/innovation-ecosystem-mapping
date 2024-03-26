const express = require("express");
const app = express();
const port = 3200;
const https = require("https");
const axios = require("axios"); // same purpose as https but with lesser code.
const fs = require("fs");
const { response } = require("express");
const { Http2ServerResponse } = require("http2");
// const puppeteer = require('puppeteer');
require("dotenv").config();
const startQDate = {1: "-01-01", 2:"-04-01", 3:"-07-01", 4:"-10-01"};
const endQDate = {1: "-03-31", 2:"-06-30", 3:"-09-30", 4:"-12-31"};
const states = [ "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", 
"HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", 
"MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", 
"OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

app.use(express.static(__dirname + "/public"));

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

/*
getNIHData(nihProjectsURL, searchBody) function makes an API call to the NIH website with a provided URL and search criteria. 
The function then processes the data it receives, extracting information about the total costs of research projects by state. 
The results are returned as an object that includes state-level cost details (which is a sum of direct cost amount and indirect cost amount),
total record count, and the original data response.
*/
const getNIHData = (nihProjectsURL, searchBody)=>
axios
.post(nihProjectsURL, searchBody)
.then(response => {
  console.log("NIH API call made successfully!!");
  let results = response.data.results;
  let stateCostAmt = results
    .map((result, idx, _) => ({
      orgState: result.organization.org_state,
      totalCost: result.direct_cost_amt+result.indirect_cost_amt
    }))
    .filter(tResult => tResult.orgState != null)
    .reduce((states, tResult) => {
      if (tResult.orgState in states) {
        states[tResult.orgState] += tResult.totalCost;
      } else {
        states[tResult.orgState] = tResult.totalCost;
      }
      return states;
    }, {});
    // console.log(`State details: ${stateCounts.toString()}`)
    return {
      stateDetails: stateCostAmt,
      totalRecords: response.data.meta.total,
      dataRes:  response.data.results
    };
})
.catch((err) => {
  console.log(`An error occurred while fetching data from NIH:\n ${err}`);
  throw err;
});

/*
  Old non-optimized NIH endpoint.
*/
app.get("/nih", async (req, res)=> {
  let keywords = req.query.keywords;
  let startDate = req.query.start;
  let endDate = req.query.end;
  const searchOperator = req.query.operator;

  if(typeof searchOperator != "string" && searchOperator!=='and' && searchOperator!=='or'){
    res.statusCode=400;
    res.send("Not a valid search operator")
    return;
  }

  const searchText =
    typeof keywords == "string" ? keywords : keywords.join(" ");

  const nihProjectsURL = `https://api.reporter.nih.gov/v2/projects/search`;
  const recordLim = 500;
  let jsons = [];
  let isNext = true;
  
  let searchBody = {
    criteria: {
      advanced_text_search: {
        operator: searchOperator,
        search_text: searchText,
        search_field: "projecttitle,abstracttext,terms"
        // "Oncology cancer"
      },
      project_start_date: { from_date: startDate, to_date: endDate },
      org_countries:["UNITED STATES"],
    },
    include_fields: ["ProjectTitle", "Organization", "DirectCostAmt", "IndirectCostAmt"],
    offset: 0,
    limit: recordLim
  };

  let totalCalls = 0;
  const finalStateDetails = {};
  
  while(isNext){
    console.log("Initiating API call..");
    console.log(searchBody);
    await getNIHData(nihProjectsURL, searchBody).then(nihData=>{
      console.log(nihData.totalRecords);
      totalCalls++;
      // jsons=jsons.concat(nihData.stateDetails);
      for(state in nihData.stateDetails){
        
        if(state in finalStateDetails){
          finalStateDetails[state]+=nihData.stateDetails[state];
        }else{
          finalStateDetails[state]=nihData.stateDetails[state];
        }
      }

      if(searchBody.offset+recordLim <= nihData.totalRecords){
        searchBody.offset+=recordLim;
      }else{
        isNext = false;
      }
    });
  }
  console.log(`Total API calls made= ${totalCalls}`);
  for (let i = 0; i < 50; i++) {
    if (!finalStateDetails.hasOwnProperty(states[i])){
      finalStateDetails[states[i]] = 0;
    }
  }
  res.send(finalStateDetails);
});


/*
  Patent Deviation Endpoint.
  
  Endpoint: /patentsDeviation

  Method: GET

  Description:
  This endpoint retrieves both time range and recent single quarter Data.

  Request Parameters:

  keywords: A string or an array of strings that represent the search keywords. If an array is provided, the elements will be concatenated using a whitespace separator.

  andor: A string parameter that takes values "AND" or "OR". If the parameter value is "AND", the search uses an AND operator for multiple search criteria. If the parameter value is "OR", the search uses an OR operator for multiple search criteria. The default value is "AND".

  start: A string parameter that represents the start date of the date range for the patent search. The date should be in the format "YYYY-MM-DD".

  end: A string parameter that represents the end date of the date range for the patent search. The date should be in the format "YYYY-MM-DD".

  quarters: An integer parameter that represents the number of quarters in the date range. The default value is 1.

  Response:

  The response from the server is a JSON object containing two key-value pairs:

  quarter: A JSON object containing the count of patents for each state in the US for the specific quarter. The state code is used as the key, and the number of patents filed in that state is the value.

  range: A JSON object containing the count of patents for each state in the US for the specified date range. The state code is used as the key, and the number of patents filed in that state divided by the number of quarters in the range is the value.

  Example Request:

  GET /patentsDeviation?keywords=artificial%20intelligence&andor=OR&start=2022-01-01&end=2022-12-31&quarters=4
*/
app.get("/patentsDeviation", (req, res) => {
  let keywords = req.query.keywords;
  const searchText =
    typeof keywords == "string" ? keywords : keywords.join(" ");
  const andOr = req.query.andor;
  const startDate = req.query.start;
  const endDate = req.query.end;
  const totalQuarters=req.query.quarters;

  let searchBody = {
    q:{
      _and: [{
        _gte: {
          patent_date: "2022-07-01"
        }
      }, {
        _lt: {
          patent_date: "2022-10-01"
        }
      }, {
        assignee_lastknown_country: "US"
      }, {
        _or: [{
          _text_all: {
            patent_abstract: searchText
          }
        }, {
          _text_all: {
            patent_title: searchText
          }
        }]
      }]
    },
    f: ["patent_firstnamed_inventor_state"],
    s: [{
      patent_date: "desc"
    }],
    o: {
      matched_subentities_only: "true",
      page: 1,
      per_page: 100000,
      include_subentity_total_counts: "false"
    }
  };
  searchBodyString = JSON.stringify(searchBody)
  if (andOr=="OR"){
    searchBodyString = searchBodyString.replaceAll("\"_text_all\":", "\"_text_any\":");
  }
  searchBody = JSON.parse(searchBodyString);
  searchBodyRange = searchBody;
  axios
    .post("https://api.patentsview.org/patents/query", searchBody)
    .then((response) => {
      console.log("Patent Call Quarter Successful");
      let results = response.data.patents;
      let quarterCount ={};
      if (response.data.count!=0){
        quarterCount = results
        .map((result, idx, _) => result.patent_firstnamed_inventor_state)
        .filter((state) => state != null)
        .reduce((states, state) => {
          if (state in states) {
            states[state] += 1;
          } else {
            states[state] = 1;
          }
          return states;
        }, {});
      }
      for (let i = 0; i < 50; i++) {
        if (!quarterCount.hasOwnProperty(states[i])){
          quarterCount[states[i]] = 0;
        }
      }
      
      searchBody.q._and[0]._gte.patent_date = startDate;
      searchBody.q._and[1]._lt.patent_date = endDate;
      axios
      .post("https://api.patentsview.org/patents/query", searchBodyRange)
      .then((response) => {
        console.log("Patent Call Range Successful");
        let results = response.data.patents;
        let rangeCount ={};
        if (response.data.count!=0){
          rangeCount = results
            .map((result, idx, _) => result.patent_firstnamed_inventor_state)
            .filter((state) => state != null)
            .reduce((states, state) => {
              if (state in states) {
                states[state] += 1;
              } else {
                states[state] = 1;
              }
              return states;
            }, {});
        }
        for (let i = 0; i < 50; i++) {
          if (!rangeCount.hasOwnProperty(states[i])){
            rangeCount[states[i]] = 0;
          } else{
            rangeCount[states[i]] = rangeCount[states[i]]/totalQuarters;
          }
        }

        var responseData = {quarter: quarterCount, range: rangeCount};
        res.send(responseData);
      })
      .catch((err) => {
        console.log(`An error occurred while fetching data from PatentsView:\n ${err}`);
        res.send("Error");
      });
      
    })
    .catch((err) => {
      console.log(`An error occurred while fetching data from PatentsView:\n ${err}`);
      res.send("Error");
    });
});
    


/*
  Total Patents endpoint
  
  Endpoint: "/patentsTotal"
  Method: GET

  Description:
  This endpoint retrieves the total number of patents that match the search criteria specified in the query parameters. The search criteria include keywords, start date, end date, and and/or operator. The response includes the count of patents grouped by the state of the first-named inventor.

  Request Query Parameters:

  keywords: A string or an array of strings representing the search terms.
  andor: A string that specifies the operator to use to combine the search terms. Possible values are "AND" and "OR". Default value is "AND".
  start: A string representing the start date in yyyy-mm-dd format.
  end: A string representing the end date in yyyy-mm-dd format.
  Response:

  range: An object containing the count of patents grouped by the state of the first-named inventor. The keys of the object are the state abbreviations (e.g. "CA") and the values are the count of patents for each state.
  Example Usage:
  GET /patentsTotal?keywords=electric%20car&start=2010-01-01&end=2022-05-01
*/
app.get("/patentsTotal", (req, res) => {
  let keywords = req.query.keywords;
  const searchText =
    typeof keywords == "string" ? keywords : keywords.join(" ");
  const andOr = req.query.andor;
  const startDate = req.query.start;
  const endDate = req.query.end;

  let searchBody = {
    q:{
      _and: [{
        _gte: {
          patent_date: startDate
        }
      }, {
        _lt: {
          patent_date: endDate
        }
      }, {
        assignee_lastknown_country: "US"
      }, {
        _or: [{
          _text_all: {
            patent_abstract: searchText
          }
        }, {
          _text_all: {
            patent_title: searchText
          }
        }]
      }]
    },
    f: ["patent_firstnamed_inventor_state"],
    s: [{
      patent_date: "desc"
    }],
    o: {
      matched_subentities_only: "true",
      page: 1,
      per_page: 100000,
      include_subentity_total_counts: "false"
    }
  };
  searchBodyString = JSON.stringify(searchBody)
  if (andOr=="OR"){
    searchBodyString = searchBodyString.replaceAll("\"_text_all\":", "\"_text_any\":");
  }
  searchBody = JSON.parse(searchBodyString);
  searchBodyRange = searchBody;
  axios
    .post("https://api.patentsview.org/patents/query", searchBody)
    .then((response) => {
      console.log("Patent Call Range Successful");
      let results = response.data.patents;
      console.log(response.data);
      let rangeCount ={};
      if (response.data.count!=0){
        rangeCount = results
        .map((result, idx, _) => result.patent_firstnamed_inventor_state)
        .filter((state) => state != null)
        .reduce((states, state) => {
          if (state in states) {
            states[state] += 1;
          } else {
            states[state] = 1;
          }
          return states;
        }, {});
      }
      for (let i = 0; i < 50; i++) {
        if (!rangeCount.hasOwnProperty(states[i])){
          rangeCount[states[i]] = 0;
        }
      }
      var responseData = {range: rangeCount};
      res.send(responseData);      
    })
    .catch((err) => {
      console.log(`An error occurred while fetching data from PatentsView:\n ${err}`);
      res.send("Error");
    });
});

/*
  Patents Quarter Endpoint
  Returns patent data of each state separated by time range quarters.
  
  For fetching the patent data a search query body is created based on these parameters using an object searchBody. The query body specifies search 
  criteria such as the start and end date of the patent, the assignee's last known country, and the keywords to search for in the patent abstract or 
  title. The search criteria are formatted using the PatentsView API query language.

  If the andor parameter is set to "OR", the search criteria are modified to search for any of the keywords instead of all of them.
*/
app.get("/patentsQuarter", (req, res) => {
  let keywords = req.query.keywords;
  const searchText =
    typeof keywords == "string" ? keywords : keywords.join(" ");
  const andOr = req.query.andor;
  const startDate = req.query.start;
  const endDate = req.query.end;

  let searchBody = {
    q:{
      _and: [{
        _gte: {
          patent_date: startDate
        }
      }, {
        _lt: {
          patent_date: endDate
        }
      }, {
        assignee_lastknown_country: "US"
      }, {
        _or: [{
          _text_all: {
            patent_abstract: searchText
          }
        }, {
          _text_all: {
            patent_title: searchText
          }
        }]
      }]
    },
    f: ["patent_firstnamed_inventor_state", "patent_date"],
    s: [{
      patent_date: "desc"
    }],
    o: {
      matched_subentities_only: "true",
      page: 1,
      per_page: 100000,
      include_subentity_total_counts: "false"
    }
  };
  searchBodyString = JSON.stringify(searchBody)
  if (andOr=="OR"){
    searchBodyString = searchBodyString.replaceAll("\"_text_all\":", "\"_text_any\":");
  }
  searchBody = JSON.parse(searchBodyString);
  searchBodyRange = searchBody;
  axios
    .post("https://api.patentsview.org/patents/query", searchBody)
    .then((response) => {

      console.log("Patent Call Range Successful");
      let results = response.data.patents;
      // console.log(response.data.count);
      // console.log(response.data);
      let rangeCount ={};
      let quarterCount ={};
      for (let i = 0; i < 50; i++) {
        rangeCount[states[i]] = [];
        quarterCount[states[i]] = 0;
      }
      if (response.data.count!=0){
        const count = response.data.count;

        var start = new Date(startDate.split('-'));
        var curQ = Math.ceil((start.getMonth()+1)/3);
        var curY = start.getFullYear();
        console.log(curY);

        for (let i = count-1; i >= 0; i--){
          let state = response.data.patents[i].patent_firstnamed_inventor_state;
          if (states.includes(state)){
            var dateString = response.data.patents[i].patent_date;
            var date = new Date(dateString.split('-'));
            var quarter = Math.ceil((date.getMonth()+1)/3);
            var year = date.getFullYear();
            if (curQ!=quarter || curY!=year){
              
              for (let i = 0; i < 50; i++) {
                rangeCount[states[i]].push(quarterCount[states[i]]);
                quarterCount[states[i]] = 0;
              }
              if(curQ!=4){
                curQ++;
              } else{
                curQ=1;
                curY+=1;
              }
              i++;
            } else{
              quarterCount[state]+=1;
            }
          }
        }
        for (let i = 0; i < 50; i++) {
          rangeCount[states[i]].push(quarterCount[states[i]]);
          quarterCount[states[i]] = 0;
        }
      } else{
        for (let i = 0; i < 50; i++) {
          rangeCount[states[i]].push(0);

        }
      }

      
      res.send(rangeCount);      
    })
    .catch((err) => {
      console.log(`An error occurred while fetching data from PatentsView:\n ${err}`);
      res.send("Error");
    });
});

/*
  Patents State Endpoint
  Returns patent data of a specified state and query 
  This API endpoint retrieves patent data based on the search criteria specified in the request parameters.

  HTTP Method: GET

  Endpoint: /patentsState

  Parameters:

  keywords: (string or array of strings) One or more keywords to search in patent abstract and title.
  andor: (string) The logical operator used to combine the search keywords. Possible values are "AND" and "OR". If not provided, "AND" is used by default.
  start: (string) The start date of the patent search range. Format: YYYY-MM-DD.
  end: (string) The end date of the patent search range. Format: YYYY-MM-DD.
  state: (string) The state in which the inventor is located.

  Response:

  range: (object) The number of patents in each city that match the search criteria. The keys are city names and the values are the number of patents in each city.
  patents: (array) An array of patent objects that match the search criteria. Each patent object contains the following properties:

  patent_number: (string) The unique identifier of the patent.
  patent_title: (string) The title of the patent.
  inventor_first_name: (string) The first name of the inventor.
  inventor_last_name: (string) The last name of the inventor.
  patent_firstnamed_inventor_city: (string) The city in which the inventor is located.
  assignee_organization: (string) The name of the organization that owns the patent.

  Example Request:

  GET /patentsState?keywords=smartphone&andor=OR&start=2010-01-01&end=2020-12-31&state=CA
*/
app.get("/patentsState", (req, res) => {
  let keywords = req.query.keywords;
  const searchText =
    typeof keywords == "string" ? keywords : keywords.join(" ");
  const andOr = req.query.andor;
  const startDate = req.query.start;
  const endDate = req.query.end;
  const state = req.query.state;

  let searchBody = {
    q:{
      _and: [{
        _gte: {
          patent_date: startDate
        }
      }, {
        _lt: {
          patent_date: endDate
        }
      }, {
        patent_firstnamed_inventor_state: state
      }, {
        _or: [{
          _text_all: {
            patent_abstract: searchText
          }
        }, {
          _text_all: {
            patent_title: searchText
          }
        }]
      }]
    },
    f: ["patent_number", "patent_title", "inventor_first_name", "inventor_last_name", "patent_firstnamed_inventor_city", "assignee_organization"],
    s: [{
      patent_date: "desc"
    }],
    o: {
      matched_subentities_only: "true",
      page: 1,
      per_page: 100000,
      include_subentity_total_counts: "false"
    }
  };
  searchBodyString = JSON.stringify(searchBody)
  if (andOr=="OR"){
    searchBodyString = searchBodyString.replaceAll("\"_text_all\":", "\"_text_any\":");
  }
  searchBody = JSON.parse(searchBodyString);
  console.log(searchBodyString);
  searchBodyRange = searchBody;
  axios
    .post("https://api.patentsview.org/patents/query", searchBody)
    .then((response) => {
      let patents = response.data;
      let results = response.data.patents;
      let rangeCount ={};
      if (response.data.count!=0){
        rangeCount = results
        .map((result, idx, _) => result.patent_firstnamed_inventor_city)
        .filter((state) => state != null)
        .reduce((states, state) => {
          if (state in states) {
            states[state] += 1;
          } else {
            states[state] = 1;
          }
          return states;
        }, {});
      }
      var responseData = {range: rangeCount, patents};
      res.send(responseData);  
      
    })
    .catch((err) => {
      console.log(`An error occurred while fetching data from PatentsView:\n ${err}`);
      res.send("Error");
    });
});

/*
  NIH Semi-optimized Endpoint
  Returns NIH funding data by state.
  Same as `/nih3` but it makes more than 15000 API calls unlike the `/nih3` endpoint.
*/
app.get("/nih2", async (req, res)=> {
  let keywords = req.query.keywords;
  let startDate = req.query.start;
  let endDate = req.query.end;
  const searchOperator = req.query.operator;
  console.log(keywords);

  if(typeof searchOperator != "string" && searchOperator!=='and' && searchOperator!=='or'){
    res.statusCode=400;
    res.send("Not a valid search operator")
    return;
  }

  const searchText =
    typeof keywords == "string" ? keywords : keywords.join(" ");

  const nihProjectsURL = `https://api.reporter.nih.gov/v2/projects/search`;
  const recordLim = 500;
  let isNext = true;
  
  let searchBody = {
    criteria: {
      advanced_text_search: {
        operator: searchOperator,
        search_text: searchText,
        search_field: "projecttitle,abstracttext,terms"
        // "Oncology cancer"
      },
      project_start_date: { from_date: startDate, to_date: endDate },
      org_countries:["UNITED STATES"],
    },
    include_fields: ["ProjectTitle", "Organization", "DirectCostAmt", "IndirectCostAmt"],
    offset: 0,
    limit: recordLim
  };

  let promises = [];
  let totalRecords = 0;
  
  await getNIHData(nihProjectsURL, searchBody).then(nihData=>{
    totalRecords=nihData.totalRecords;
  });
  

  for(let i =0 ; i<Math.ceil(totalRecords/500); i++){
    console.log("Initiating API call..");
    // console.log(searchBody);

    promises.push(
      getNIHData(nihProjectsURL, searchBody).then(nihData=>{
        console.log(nihData.totalRecords);
        totalRecords = nihData.totalRecords;
        return nihData.stateDetails;
      })
    );

    if(searchBody.offset+recordLim <= totalRecords){
      searchBody.offset+=recordLim;
    }else{
      isNext = false;
    }
  }

  Promise.all(promises).then(statesData => {
    let finalStateDetails = {};
    for(let stateData of statesData){
      for(let state in stateData){
        if(state in finalStateDetails){
          finalStateDetails[state]+=stateData[state];
        }else{
          finalStateDetails[state]=stateData[state];
        }
      }
    }
    for (let i = 0; i < 50; i++) {
      if (!finalStateDetails.hasOwnProperty(states[i])){
        finalStateDetails[states[i]] = 0;
      }
    }
    // console.log(finalStateDetails);
    res.send(finalStateDetails);
  }).catch(error => {
    console.log(`An error occurred while fetching data from NIH:\n ${error}`);
    res.statusCode = 500;
    res.send("Internal Server Error");
  });
});




/*
  Returns total quarters when given a start and end date.
  totalQuarters(start, end)

  Calculates the total number of quarters between two dates, including the start date and excluding the end date.

  Parameters:
  start (string): A string representing the start date in the format 'YYYY-MM-DD'.
  end (string): A string representing the end date in the format 'YYYY-MM-DD'.
  Returns:
  A number representing the total number of quarters between the start and end dates.

  Notes:
  * The start date is included in the calculation, but the end date is excluded.
  * The start and end dates are assumed to be of type string.
  * The function uses the JavaScript Date object to parse the input dates, which assumes that the input dates are in the local time zone.
*/
function totalQuarters(start, end){
  console.log(typeof end);
  var startDate = new Date(start.split('-'));
  var endDate = new Date(end.split('-'));
  endDate.setDate(endDate.getDate()+1);

  var total = ((endDate.getFullYear()*12 + (endDate.getMonth()+1)) - (startDate.getFullYear()*12 + (startDate.getMonth()+1)))/3
  return total
}

/*
  A utility function 
  Modulo function
*/
function mod(n, m) {
  return ((n % m) + m) % m;
}

/*
NIH Optimized Endpoint
Returns NIH funding data by state

Endpoint: /nih3

Method: GET

Description: This API endpoint searches NIH (National Institutes of Health) project data based on the provided search parameters using the advanced
text search feature and returns the state-level cost details of projects. It accepts the following query parameters:

keywords: (string or array) A list of keywords to search for.
start: (string) The start date for the search (format: YYYY-MM-DD).
end: (string) The end date for the search (format: YYYY-MM-DD).
totalQ: (integer) The total number of quarters to search.
operator: (string) The search operator to use for the keywords (and/or).
Returns: The count of NIH projects by state.

Error Responses:

400 Bad Request: Returned when the searchOperator is not a valid string or is not and or or.
500 Internal Server Error: Returned when there is an error while fetching data from the NIH API.

Example: GET /nih3?keywords=cancer&start=2010-01-01&end=2012-12-31&totalQ=12&operator=and
*/
app.get("/nih3", async (req, res)=> {
  let keywords = req.query.keywords;
  let startDate = req.query.start;
  let endDate = req.query.end;
  let totalQ = parseInt(req.query.totalQ);
  const searchOperator = req.query.operator;
  console.log(typeof endDate);

  if(typeof searchOperator != "string" && searchOperator!=='and' && searchOperator!=='or'){
    res.statusCode=400;
    res.send("Not a valid search operator")
    return;
  }

  const searchText =
    typeof keywords == "string" ? keywords : keywords.join(" ");
  console.log(searchText);

  const nihProjectsURL = `https://api.reporter.nih.gov/v2/projects/search`;
  const recordLim = 500;
  let isNext = true;
  
  let searchBody = {
    criteria: {
      advanced_text_search: {
        operator: searchOperator,
        search_text: searchText,
        search_field: "projecttitle,abstracttext,terms"
        // "Oncology cancer"
      },
      project_start_date: { from_date: startDate, to_date: endDate },
      org_countries:["UNITED STATES"],
    },
    include_fields: ["ProjectTitle", "Organization", "DirectCostAmt", "IndirectCostAmt"],
    offset: 0,
    limit: recordLim
  };

  let promises = [];
  let totalRecords = 0;
  let read = true; 
  let startQ = 1;
  let endQ = totalQ;

  let date = new Date(searchBody.criteria.project_start_date.to_date.split('-'));
  let dateQ = Math.ceil((date.getMonth()+1)/3);
  let dateY = date.getFullYear();
  let length = totalQ;
  let total=0;
  while (read){
    console.log(totalRecords);
    searchBody.offset=0;
    await getNIHData(nihProjectsURL, searchBody).then(nihData=>{
      totalRecords=nihData.totalRecords;
    });
    
    if (totalRecords<15000){
      total+=totalRecords;
      if (searchBody.criteria.project_start_date.to_date == endDate){
        read=false;
      }
      console.log(searchBody);
      for(let i =0 ; i<Math.ceil(totalRecords/500); i++){
        // console.log("Initiating API call..");
        // console.log(searchBody);
    
        promises.push(
          getNIHData(nihProjectsURL, searchBody).then(nihData=>{
            console.log(nihData.totalRecords);
            totalRecords = nihData.totalRecords;
            return nihData.stateDetails;
          })
        );
    
        if(searchBody.offset+recordLim <= totalRecords){
          searchBody.offset+=recordLim;
        }
      }

      if(dateQ!=4){
        dateQ++;
      } else{
        dateQ=1;
        dateY+=1;
      }
      searchBody.criteria.project_start_date.from_date = dateY+startQDate[dateQ];
      let tempDate = dateY+endQDate[dateQ];
      if (tempDate!=endDate)
        for (let i = 0; i < length; i++){   
          if(dateQ!=4){
            dateQ++;
          } else{
            dateQ=1;
            dateY+=1;
          }
          tempDate = dateY+endQDate[dateQ];
          if (tempDate==endDate){
            i=length;
          }
        }
      searchBody.criteria.project_start_date.to_date = dateY+endQDate[dateQ];

    } else{
      let decrease = (14000 - totalRecords)/Math.abs(totalRecords);
      endQ = Math.abs(Math.floor(endQ*decrease));
      console.log(endQ);
      date = new Date(searchBody.criteria.project_start_date.to_date.split('-'));
      dateQ = Math.ceil((date.getMonth()+1)/3);
      dateY = date.getFullYear();
      dateY-= Math.floor(endQ/4)
      dateQ -= mod(endQ,4);
      if (dateQ <= 0){
        dateY-=1; 
      }
      dateQ = mod(dateQ,4);
      // console.log("3",dateQ, -1%4);
      if (dateQ==0){
        dateQ=4;
      }
      searchBody.criteria.project_start_date.to_date = dateY+endQDate[dateQ];
      console.log(dateY,endQDate[dateQ]);
      length = totalQuarters(searchBody.criteria.project_start_date.from_date, searchBody.criteria.project_start_date.to_date)
    }

  }

  



  Promise.all(promises).then(statesData => {
    let finalStateDetails = {};
    for(let stateData of statesData){
      for(let state in stateData){
        if(state in finalStateDetails){
          finalStateDetails[state]+=stateData[state];
        }else{
          finalStateDetails[state]=stateData[state];
        }
      }
    }
    for (let i = 0; i < 50; i++) {
      if (!finalStateDetails.hasOwnProperty(states[i])){
        finalStateDetails[states[i]] = 0;
      }
    }
    // console.log(finalStateDetails);
    // console.log(total);
    // console.log(length);
    res.send(finalStateDetails);
  }).catch(error => {
    console.log(`An error occurred while fetching data from NIH:\n ${error}`);
    res.statusCode = 500;
    res.send("Internal Server Error");
  });
});

function convertCase(str) {
  var lower = String(str).toLowerCase();
  return lower.replace(/(^| )(\w)/g, function(x) {
    return x.toUpperCase();
  });
}

/*
  NIH State Endpoint
  Returns NIH data and funding for a specified state
*/
app.get("/nihState", async (req, res)=> {
  let keywords = req.query.keywords;
  let startDate = req.query.start;
  let endDate = req.query.end;
  let totalQ = parseInt(req.query.totalQ);
  let state = req.query.state;
  const searchOperator = req.query.operator;
  console.log(typeof endDate);

  if(typeof searchOperator != "string" && searchOperator!=='and' && searchOperator!=='or'){
    res.statusCode=400;
    res.send("Not a valid search operator")
    return;
  }

  const searchText =
    typeof keywords == "string" ? keywords : keywords.join(" ");
  console.log(searchText);

  const nihProjectsURL = `https://${process.env.NIH_PROJECTS_URL}`;
  const recordLim = 500;
  let isNext = true;
  
  let searchBody = {
    criteria: {
      advanced_text_search: {
        operator: searchOperator,
        search_text: searchText,
        search_field: "projecttitle,abstracttext,terms"
        // "Oncology cancer"
      },
      project_start_date: { from_date: startDate, to_date: endDate },
      org_countries:["UNITED STATES"],
      org_states:[state]
    },
    include_fields: ["ApplId", "ProjectTitle", "Organization", "DirectCostAmt", "IndirectCostAmt", "PrincipalInvestigators"],
    offset: 0,
    limit: recordLim
  };

  let promises = [];
  let totalRecords = 0;
  let read = true; 
  let startQ = 1;
  let endQ = totalQ;

  let date = new Date(searchBody.criteria.project_start_date.to_date.split('-'));
  let dateQ = Math.ceil((date.getMonth()+1)/3);
  let dateY = date.getFullYear();
  let length = totalQ;
  let total=0;
  while (read){
    console.log(totalRecords);
    searchBody.offset=0;
    await getNIHData(nihProjectsURL, searchBody).then(nihData=>{
      totalRecords=nihData.totalRecords;
    });
    
    if (totalRecords<15000){
      total+=totalRecords;
      if (searchBody.criteria.project_start_date.to_date == endDate){
        read=false;
      }
      console.log(searchBody);
      for(let i =0 ; i<Math.ceil(totalRecords/500); i++){
        // console.log("Initiating API call..");
        // console.log(searchBody);
    
        promises.push(
          getNIHData(nihProjectsURL, searchBody).then(nihData=>{
            // console.log(nihData.totalRecords);
            totalRecords = nihData.totalRecords;
            return nihData.dataRes;
          })
        );
    
        if(searchBody.offset+recordLim <= totalRecords){
          searchBody.offset+=recordLim;
        }
      }

      if(dateQ!=4){
        dateQ++;
      } else{
        dateQ=1;
        dateY+=1;
      }
      searchBody.criteria.project_start_date.from_date = dateY+startQDate[dateQ];
      let tempDate = dateY+endQDate[dateQ];
      if (tempDate!=endDate)
        for (let i = 0; i < length; i++){   
          if(dateQ!=4){
            dateQ++;
          } else{
            dateQ=1;
            dateY+=1;
          }
          tempDate = dateY+endQDate[dateQ];
          if (tempDate==endDate){
            i=length;
          }
        }
      searchBody.criteria.project_start_date.to_date = dateY+endQDate[dateQ];

    } else{
      let decrease = (14000 - totalRecords)/Math.abs(totalRecords);
      endQ = Math.abs(Math.floor(endQ*decrease));
      console.log(endQ);
      date = new Date(searchBody.criteria.project_start_date.to_date.split('-'));
      dateQ = Math.ceil((date.getMonth()+1)/3);
      dateY = date.getFullYear();
      dateY-= Math.floor(endQ/4)
      dateQ -= mod(endQ,4);
      if (dateQ <= 0){
        dateY-=1; 
      }
      dateQ = mod(dateQ,4);
      // console.log("3",dateQ, -1%4);
      if (dateQ==0){
        dateQ=4;
      }
      searchBody.criteria.project_start_date.to_date = dateY+endQDate[dateQ];
      // console.log(dateY,endQDate[dateQ]);
      length = totalQuarters(searchBody.criteria.project_start_date.from_date, searchBody.criteria.project_start_date.to_date)
    }

  }

  



  Promise.all(promises).then(dataRes => {
    let finalStateDetails = {results:[]};
    let arrData =[]
    let rangeCount ={};
    var cityName="";
    for(let d of dataRes){
      if (d.length!=0){
        for(let i = 0; i < d.length; i++){
          cityName = convertCase(d[i].organization.org_city);
          d[i].organization.org_city=cityName;
          if (cityName!=null){
            if(cityName in rangeCount){
              rangeCount[cityName]+=d[i].direct_cost_amt+d[i].indirect_cost_amt;
            }else{
              rangeCount[cityName]=d[i].direct_cost_amt+d[i].indirect_cost_amt;
            }
          }

        }


      }

      finalStateDetails["results"] = finalStateDetails["results"].concat(d);
    }
    // console.log(finalStateDetails);
    // console.log(finalStateDetails);
    
    console.log(length);
    // finalStateDetails = {results: arrData}
    res.send({"finalStateDetails":finalStateDetails, "range":rangeCount});
  }).catch(error => {
    console.log(`An error occurred while fetching data from NIH:\n ${error}`);
    res.statusCode = 500;
    res.send("Internal Server Error");
  });
});

app.listen(port, () => {
  console.log(`Listening on *:${port}`);
});
