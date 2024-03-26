var x = document.getElementById("demo");
const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const startQDate = {1: "-01-01", 2:"-04-01", 3:"-07-01", 4:"-10-01"};
const endQDate = {1: "-03-31", 2:"-06-30", 3:"-09-30", 4:"-12-31"};

google.charts.load('current', {
  'packages':['geochart'],
  'mapsApiKey': '[INSERT API KEY]'
});
google.charts.setOnLoadCallback(drawRegionsMap);

var keywords =[];
// var keywords =[]
var mapOptions = [];
var array = [['State', 'Total Patents', {type: 'string', role: 'tooltip'}]];
var cityArray = [['City', 'Total Patents']];
var stateCityToggle = 'state';
var options = {datalessRegionColor:'#ffffff', colors:['ffffff', '#0a58ca'], backgroundColor: '#FFFFFF', region: "US", resolution: "provinces"};
var cityOptions = {displayMode: 'markers', datalessRegionColor:'#ffffff', colorAxis: { minValue: 0}, colors:['ffffff', '#0a58ca'], backgroundColor: '#FFFFFF', region: "US", resolution: "provinces"};
var globalData;
var initial=true;

/*
  Function to draw the map component of application
*/
function drawRegionsMap() {
  if (initial == true){
    globalData = new google.visualization.DataTable();
    globalData.addColumn('string', 'State');
    globalData.addColumn('number', 'Total Patents');
    globalData.addColumn({type: 'string', role: 'tooltip'});
    initial=false;
  }
  // var chartDiv = $('#regions_div');
  // var graphWidth = $(chartDiv).width();
  // var graphHeight = graphWidth * 0.8;
  // if (graphHeight >= 800) {
  //     graphHeight = 800;
  // }
  console.log(stateCityToggle);

  if (stateCityToggle=='state'){
    // var data = google.visualization.arrayToDataTable(array);


    var chart = new google.visualization.GeoChart(document.getElementById('regions_div'));
    /*
      State click functionality for map
    */
    function myClickHandler(){
      var selection = chart.getSelection();
      console.log(selection.length);
      if (selection.length==1){
        document.getElementById("ecosystemData").innerHTML = `
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        `;
        if (mapOptions[0]=='patent'){
          stateCityToggle = 'city';
          getPatentState(states[selection[0].row]);
        } else{mapOptions[0]=='nih'
          stateCityToggle = 'city';
          getNihState(states[selection[0].row]);
        }
      }
    }
    google.visualization.events.addListener(chart, 'select', myClickHandler);
  
    google.visualization.events.addListener(chart, 'ready', function () {
      var countries = document.getElementById('regions_div').getElementsByTagName('path');
      Array.prototype.forEach.call(countries, function(path) {
        path.setAttribute('stroke', '#696969');
      });
    });
  
    
    
    chart.draw(globalData, options);


  } else {

    var data = google.visualization.arrayToDataTable(cityArray);

    var chart = new google.visualization.GeoChart(document.getElementById('regions_div'));

    function myClickHandler(){
      var selection = chart.getSelection();
      console.log(selection.length);
      stateCityToggle = 'state';
      drawRegionsMap();

    }
    google.visualization.events.addListener(chart, 'select', myClickHandler);
  
    google.visualization.events.addListener(chart, 'ready', function () {
      var countries = document.getElementById('regions_div').getElementsByTagName('path');
      Array.prototype.forEach.call(countries, function(path) {
        path.setAttribute('stroke', '#696969');
      });
    });
  
    
    
    chart.draw(globalCityData, cityOptions);


  }
  

  // var options = {colors:['ffffff', 'DB7374'], backgroundColor: '#FFFFFF', region: "US", resolution: "provinces"};



  
}

/*
  Function to generate heatmap. 
  Gathers all the heatmap options here to setup the heatmap generation 
*/
async function generateHeatMap() {
  if (keywords.length==0){
    alert("Please enter a keyword!");
    return;
  }

  document.getElementById("generateButton").innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
  document.getElementById("genBtn").setAttribute("disabled", true);
  var andOr = document.getElementById("andOr").value;
  // var andOr = "AND";
  var source ="";
  if ($('#patentradio').is(':checked')){
    source="patent";
  } else if ($('#nihradio').is(':checked')){
    source="nih";
  } else{
    source="combined";
  }
  // keywords = [document.getElementById("TA").value];
  var startDate = document.getElementById("startY").value + document.getElementById("startQ").value;
  var endDate =document.getElementById("endY").value + document.getElementById("endQ").value;
  

  var deviation = document.getElementById("deviation").checked;
  mapOptions = [source, andOr, startDate, endDate];
  console.log(deviation);
  if (source=="combined"){
    globalData = new google.visualization.DataTable();
    globalData.addColumn('string', 'State');
    globalData.addColumn('number', 'Score');
    globalData.addColumn({type: 'string', role: 'tooltip'});
    getCombined(andOr, startDate, endDate);
  } else if (source=="patent" && deviation){
    globalData = new google.visualization.DataTable();
    globalData.addColumn('string', 'State');
    globalData.addColumn('number', 'Total Patents Deviation');
    globalData.addColumn({type: 'string', role: 'tooltip'});
    getPatentDeviation(andOr, startDate, endDate);
  } else if (source=="patent" && !deviation){
    globalData = new google.visualization.DataTable();
    globalData.addColumn('string', 'State');
    globalData.addColumn('number', 'Total Patents');
    globalData.addColumn({type: 'string', role: 'tooltip'});
    getPatentTotal(andOr, startDate, endDate);
  } else if (source=="nih" && deviation){
    globalData = new google.visualization.DataTable();
    globalData.addColumn('string', 'State');
    globalData.addColumn('number', 'Total Funding Deviation');
    globalData.addColumn({type: 'string', role: 'tooltip'});
    getNihDeviation(andOr, startDate, endDate)
  } else{
    globalData = new google.visualization.DataTable();
    globalData.addColumn('string', 'State');
    globalData.addColumn('number', 'Total Funding');
    globalData.addColumn({type: 'string', role: 'tooltip'});
    getNihTotal(andOr, startDate, endDate);
  }
  
  console.log(andOr, keywords, source, startDate, endDate, deviation);
}

/*
  Function to fix the formatting of the dates
*/
function formatDate(date) {
  var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

  if (month.length < 2) 
      month = '0' + month;
  if (day.length < 2) 
      day = '0' + day;

  return [year, month, day].join('-');
}

/*
  Function to return the total quarters between two dates.
*/
function totalQuarters(start, end){
  var startDate = new Date(start.split('-'));
  var endDate = new Date(end.split('-'));
  endDate.setDate(endDate.getDate()+1);

  var total = ((endDate.getFullYear()*12 + (endDate.getMonth()+1)) - (startDate.getFullYear()*12 + (startDate.getMonth()+1)))/3
  return total
}

/*
  Function to generate Patent Deviation maps.
  Sets up the generation of Patent Deviation map.
*/
async function getPatentDeviation(andOr, startDate, endDate) {
  api = "http://localhost:3200/patentsDeviation?keywords=";
  var query ='';
  for (q of keywords){
    query+=q+" ";
  }
  query = query.slice(0,-1);
  
  totalQuarters(startDate,endDate);
  var endDateObj = new Date(endDate.split('-'));
  endDateObj.setDate(endDateObj.getDate()+1);
  endDate = formatDate(endDateObj);
  api+=query+"&andor="+andOr+"&start="+startDate+"&end="+endDate+"&quarters="+totalQuarters(startDate,endDate);
  console.log(api);
  const response = await fetch(api, {
    method: 'GET'
  });
  const responseJson = await response.json();
  console.log(responseJson);
  // array = [['State', 'Deviation']];
  array=[]
  var maxVal=0;
  var dev;
  for (let i = 0; i < 50; i++){
    dev = responseJson.quarter[states[i]]-responseJson.range[states[i]];
    array.push(["US-"+states[i], dev, "Deviation: "+dev.toFixed(4).toLocaleString("en-US")+"\n Range Average: "+responseJson.range[states[i]].toFixed(4).toLocaleString("en-US")+"\n Q3 2022 Total: "+responseJson.quarter[states[i]].toLocaleString("en-US") ]);
    
    if (maxVal < Math.abs(dev)){
      maxVal = Math.abs(dev);
    }
  }
  globalData.addRows(array)

  // var data = google.visualization.arrayToDataTable(array);
  var chart = new google.visualization.GeoChart(document.getElementById('regions_div'));
  options = {datalessRegionColor:'#ffffff', colorAxis: { minValue: -maxVal, maxValue: maxVal }, colors:['DB7374', 'ffffff', 'green' ], backgroundColor: '#FFFFFF', region: "US", resolution: "provinces"};

  function myClickHandler(){
    var selection = chart.getSelection();
    console.log(selection.length);
    if (selection.length==1){
      document.getElementById("ecosystemData").innerHTML = `
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      `;
      stateCityToggle = 'city';
      getPatentState(states[selection[0].row]);
    }
  }

  google.visualization.events.addListener(chart, 'select', myClickHandler);

  google.visualization.events.addListener(chart, 'ready', function () {
    var countries = document.getElementById('regions_div').getElementsByTagName('path');
    Array.prototype.forEach.call(countries, function(path) {
      path.setAttribute('stroke', '#696969');
    });
  });
  
  chart.draw(globalData, options);
  document.getElementById("generateButton").innerHTML = 'Generate Heatmap';
  document.getElementById("genBtn").removeAttribute("disabled");
}

/*
  Function to generate Patent Totals maps.
  Sets up the generation of Patent Totals map.
*/
async function getPatentTotal(andOr, startDate, endDate) {
  api = "http://localhost:3200/patentsTotal?keywords=";
  var query ='';
  for (q of keywords){
    query+=q+" ";
  }
  query = query.slice(0,-1);
  
  var endDateObj = new Date(endDate.split('-'));
  endDateObj.setDate(endDateObj.getDate()+1);
  endDate = formatDate(endDateObj);

  api+=query+"&andor="+andOr+"&start="+startDate+"&end="+endDate;
  console.log(api);
  const response = await fetch(api, {
    method: 'GET'
  });
  const responseJson = await response.json();
  console.log(responseJson);
  array = [];

  for (let i = 0; i < 50; i++){
    array.push(["US-"+states[i], responseJson.range[states[i]], "Total Patents: "+responseJson.range[states[i]].toLocaleString("en-US")]);
  }
  globalData.addRows(array)

  // var data = google.visualization.arrayToDataTable(array);
  var chart = new google.visualization.GeoChart(document.getElementById('regions_div'));

  function myClickHandler(){
    var selection = chart.getSelection();
    console.log(selection.length);
    if (selection.length==1){
      document.getElementById("ecosystemData").innerHTML = `
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      `;
      stateCityToggle = 'city';
      getPatentState(states[selection[0].row]);
    }
  }

  google.visualization.events.addListener(chart, 'select', myClickHandler);

  google.visualization.events.addListener(chart, 'ready', function () {
    var countries = document.getElementById('regions_div').getElementsByTagName('path');
    Array.prototype.forEach.call(countries, function(path) {
      path.setAttribute('stroke', '#696969');
    });
  });


  options = {datalessRegionColor:'#ffffff', colorAxis: { minValue: 0}, colors:['ffffff', '#0a58ca'], backgroundColor: '#FFFFFF', region: "US", resolution: "provinces"};
  chart.draw(globalData, options);
  document.getElementById("generateButton").innerHTML = 'Generate Heatmap';
  document.getElementById("genBtn").removeAttribute("disabled");
}

/*
  Function to generate NIH Total Funding maps.
  Sets up the generation of NIH Total Funding maps.
*/
async function getNihTotal(andOr, startDate, endDate) {
  //NIH

  nihApi = "http://localhost:3200/nih3?keywords=";
  var query ='';
  for (q of keywords){
    query+=q+" ";
  }
  query = query.slice(0,-1);

  var totalQ = totalQuarters(startDate,endDate);
  console.log(totalQ);


  nihApi+=query+"&operator="+andOr+"&start="+startDate+"&end="+endDate+"&totalQ="+totalQ;
  console.log(nihApi);
  const response = await fetch(nihApi, {
    method: 'GET'
  });
  const rangeCountNih = await response.json();
  console.log(rangeCountNih);


  array = [];

  for (let i = 0; i < 50; i++){
    console.log(typeof rangeCountNih[states[i]]);
    array.push(["US-"+states[i], 0+rangeCountNih[states[i]], "Total Funding: $"+ rangeCountNih[states[i]].toLocaleString("en-US")+" USD"]);
  }
  globalData.addRows(array);
  // var data = google.visualization.arrayToDataTable(array);
  var chart = new google.visualization.GeoChart(document.getElementById('regions_div'));
  options = {datalessRegionColor:'#ffffff', colorAxis: { minValue: 0, labels:{format: '#,### units'} },colors:['ffffff', '#0a58ca'], backgroundColor: '#FFFFFF', region: "US", resolution: "provinces"};

  function myClickHandler(){
    var selection = chart.getSelection();
    console.log(selection.length);
    if (selection.length==1){
      document.getElementById("ecosystemData").innerHTML = `
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      `;
      stateCityToggle = 'city';
      getNihState(states[selection[0].row]);
    }
  }

  google.visualization.events.addListener(chart, 'select', myClickHandler);

  google.visualization.events.addListener(chart, 'ready', function () {
    var countries = document.getElementById('regions_div').getElementsByTagName('path');
    Array.prototype.forEach.call(countries, function(path) {
      path.setAttribute('stroke', '#696969');
    });
  });

  chart.draw(globalData, options);
  document.getElementById("generateButton").innerHTML = 'Generate Heatmap';
  document.getElementById("genBtn").removeAttribute("disabled");
}

/*
  Function to generate NIH Funding Deviation maps.
  Sets up the generation of NIH Funding Deviation maps.
*/
async function getNihDeviation(andOr, startDate, endDate) { 
  var totalQ = totalQuarters(startDate,endDate);
  //NIH

  var nihApi = "http://localhost:3200/nih3?keywords=";
  var query ='';
  for (q of keywords){
    query+=q+" ";
  }
  query = query.slice(0,-1);

  var totalQ = totalQuarters(startDate,endDate);

  nihApi+=query+"&operator="+andOr;
  console.log(nihApi+"&start="+startDate+"&end="+endDate+"&totalQ="+totalQ);
  const response = await fetch(nihApi+"&start="+startDate+"&end="+endDate+"&totalQ="+totalQ, {
    method: 'GET'
  });
  const rangeCountNih = await response.json();
  console.log(rangeCountNih);


  // console.log(rangeCountNih);


  array = [];
  console.log(nihApi+"&start=2022-07-01&end=2022-09-30&totalQ=1");
  const responseQuarter = await fetch(nihApi+"&start=2022-07-01&end=2022-09-30&totalQ=1", {
    method: 'GET'
  });
  const responseQuarterJson = await responseQuarter.json();
  console.log(responseQuarterJson);

  var maxVal = 0;
  var dev;
  for (let i = 0; i < 50; i++){

    dev = (responseQuarterJson[states[i]]) - (rangeCountNih[states[i]]/totalQ);
    console.log(responseQuarterJson[states[i]], rangeCountNih[states[i]]/totalQ, dev);
    array.push(["US-"+states[i], dev, "Deviation: $"+dev.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})+" USD \n Range Average: $"+(rangeCountNih[states[i]]/totalQ).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})+" USD\n Q3 2022: $"+responseQuarterJson[states[i]].toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})+" USD"]);
    if (maxVal < Math.abs(dev)){
      maxVal = Math.abs(dev);
    }
  }
  globalData.addRows(array);
  // var data = google.visualization.arrayToDataTable(array);
  var chart = new google.visualization.GeoChart(document.getElementById('regions_div'));
  options = {datalessRegionColor:'#ffffff', colorAxis: { minValue: -maxVal, maxValue: maxVal }, colors:['DB7374', 'ffffff', 'green' ], backgroundColor: '#FFFFFF', region: "US", resolution: "provinces"};

  function myClickHandler(){
    var selection = chart.getSelection();
    console.log(selection.length);
    if (selection.length==1){
      document.getElementById("ecosystemData").innerHTML = `
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      `;
      stateCityToggle = 'city';
      getNihState(states[selection[0].row]);
    }
  }

  google.visualization.events.addListener(chart, 'select', myClickHandler);

  google.visualization.events.addListener(chart, 'ready', function () {
    var countries = document.getElementById('regions_div').getElementsByTagName('path');
    Array.prototype.forEach.call(countries, function(path) {
      path.setAttribute('stroke', '#696969');
    });
  });

  chart.draw(globalData, options);
  document.getElementById("generateButton").innerHTML = 'Generate Heatmap';
  document.getElementById("genBtn").removeAttribute("disabled");
}
/*
  Function to generate a single state map for total patents.
  Sets up the generation of a specified state map for total patents.
*/
async function getPatentState(state) {
  var andOr = mapOptions[1];
  var startDate = mapOptions[2];
  var endDate = mapOptions[3];

  api = "http://localhost:3200/patentsState?keywords=";
  var query ='';
  for (q of keywords){
    query+=q+" ";
  }
  query = query.slice(0,-1);
  
  var endDateObj = new Date(endDate.split('-'));
  endDateObj.setDate(endDateObj.getDate()+1);
  endDate = formatDate(endDateObj);

  api+=query+"&andor="+andOr+"&start="+startDate+"&end="+endDate+"&state="+state;
  console.log(api);
  const response = await fetch(api, {
    method: 'GET'
  });
  const responseJson = await response.json();
  console.log(responseJson);

  let ecoData = document.querySelector("#ecosystemData");
  let ecoOut= `Selected State: `+state+`
  <table>
  <tr>
    <th style="width:13%;">Patent #</th>
    <th style="width:30%;">Title</th>
    <th>Inventor Name</th>
    <th>Inventor Location</th>
    <th>Assignee</th>
  </tr>
  `;
  for (let i=0; i < responseJson.patents.count; i++){
    if (responseJson.patents.patents[i].assignees[0].assignee_organization === null){
      responseJson.patents.patents[i].assignees[0].assignee_organization = " ";
    }
    ecoOut+=`
    <tr>
      <td><a href="https://patents.google.com/patent/US`+responseJson.patents.patents[i].patent_number+`" target="_blank"> `+responseJson.patents.patents[i].patent_number+`</a></td>
      <td>`+responseJson.patents.patents[i].patent_title+`</td>
      <td>`+responseJson.patents.patents[i].inventors[0].inventor_first_name+` `+responseJson.patents.patents[i].inventors[0].inventor_last_name+`</td>
      <td>`+responseJson.patents.patents[i].patent_firstnamed_inventor_city+`, `+state+`</td>
      <td>`+responseJson.patents.patents[i].assignees[0].assignee_organization+`</td>
    </tr>
    `;
  }
  ecoData.innerHTML = ecoOut;


  globalCityData = new google.visualization.DataTable();
  globalCityData.addColumn('string', 'City');
  globalCityData.addColumn('number', 'Total Patents');
  globalCityData.addColumn({type: 'string', role: 'tooltip'});
  cityArray = [];
  // console.log(Object.keys(responseJson.range).length);
  // for (let i = 0; i < responseJson.range.length; i++){
  //   console.log(responseJson.range[i]);
  // }
  console.log(responseJson.range);
  Object.keys(responseJson.range).forEach(function(key) {
    cityArray.push([key+", "+state, responseJson.range[key], "Total Patents: "+responseJson.range[key].toLocaleString("en-US")]);
  })
  globalCityData.addRows(cityArray);
  // var data = google.visualization.arrayToDataTable(cityArray);
  var chart = new google.visualization.GeoChart(document.getElementById('regions_div'));

  function myClickHandler(){
    var selection = chart.getSelection();
    console.log(selection.length);
    stateCityToggle = 'state';
    drawRegionsMap();
  }

  google.visualization.events.addListener(chart, 'select', myClickHandler);

  google.visualization.events.addListener(chart, 'ready', function () {
    var countries = document.getElementById('regions_div').getElementsByTagName('path');
    Array.prototype.forEach.call(countries, function(path) {
      path.setAttribute('stroke', '#696969');
    });
  });

  var region = "US-"+state;
  cityOptions = {displayMode: 'markers', datalessRegionColor:'#ffffff', colorAxis: { minValue: 0}, colors:['ffffff', '#0a58ca'], backgroundColor: '#FFFFFF', region: region, resolution: "provinces"};
  chart.draw(globalCityData, cityOptions);


}

/*
  Function to generate a single state map for total NIH funding.
  Sets up the generation of a specified state map for total NIH funding.
*/
async function getNihState(state) {
  var andOr = mapOptions[1];
  var startDate = mapOptions[2];
  var endDate = mapOptions[3];
  var totalQ = totalQuarters(startDate,endDate);

  nihApi = "http://localhost:3200/nihState?keywords=";
  var query ='';
  for (q of keywords){
    query+=q+" ";
  }
  query = query.slice(0,-1);
  

  nihApi+=query+"&operator="+andOr+"&start="+startDate+"&end="+endDate+"&totalQ="+totalQ+"&state="+state;
  console.log(nihApi);
  const response = await fetch(nihApi, {
    method: 'GET'
  });

  const rangeCountNih = await response.json();
  console.log(rangeCountNih)
  let ecoData = document.querySelector("#ecosystemData");
  let ecoOut= `Selected State: `+state+`
  <table>
  <tr>
    <th style="width:13%;">App Id</th>
    <th style="width:30%;">Title</th>
    <th>Principal Investigator</th>
    <th>Org Location</th>
    <th>Organization</th> 
  </tr>
  `;
  // App Id: appl_id https://reporter.nih.gov/project-details/{appl_id}
  // Title: project_title
  // PI: principal_investigators[0].full_name
  // Org Location: organization[0].org_city, organization[0].org_state
  // Organization: organization[0].org_name
  for (let i=0; i < Object.keys(rangeCountNih.finalStateDetails.results).length; i++){
    ecoOut+=`
    <tr>
      <td><a href="https://reporter.nih.gov/project-details/`+rangeCountNih.finalStateDetails.results[i].appl_id+`" target="_blank"> `+rangeCountNih.finalStateDetails.results[i].appl_id+`</a></td>
      <td>`+rangeCountNih.finalStateDetails.results[i].project_title+`</td>
      <td>`+rangeCountNih.finalStateDetails.results[i].principal_investigators[0].full_name+`</td>
      <td>`+rangeCountNih.finalStateDetails.results[i].organization.org_city+`, `+state+`</td>
      <td>`+rangeCountNih.finalStateDetails.results[i].organization.org_name+`</td>
    </tr>
    `;
  }
  ecoData.innerHTML = ecoOut;

  globalCityData = new google.visualization.DataTable();
  globalCityData.addColumn('string', 'City');
  globalCityData.addColumn('number', 'Total Funding');
  globalCityData.addColumn({type: 'string', role: 'tooltip'});

  // cityArray = [['City', 'Total Funding']];
  cityArray = [];
  // console.log(Object.keys(responseJson.range).length);
  // for (let i = 0; i < responseJson.range.length; i++){
  //   console.log(responseJson.range[i]);
  // }
  console.log(rangeCountNih.range);
  Object.keys(rangeCountNih.range).forEach(function(key) {
    cityArray.push([key+", "+state, rangeCountNih.range[key], "Total Funding: $"+ rangeCountNih.range[key].toLocaleString("en-US")+" USD"]);
  })
  globalCityData.addRows(cityArray);
  // var data = google.visualization.arrayToDataTable(cityArray);
  var chart = new google.visualization.GeoChart(document.getElementById('regions_div'));

  function myClickHandler(){
    var selection = chart.getSelection();
    console.log(selection.length);
    stateCityToggle = 'state';
    drawRegionsMap();
  }

  google.visualization.events.addListener(chart, 'select', myClickHandler);

  google.visualization.events.addListener(chart, 'ready', function () {
    var countries = document.getElementById('regions_div').getElementsByTagName('path');
    Array.prototype.forEach.call(countries, function(path) {
      path.setAttribute('stroke', '#696969');
    });
  });

  var region = "US-"+state;
  cityOptions = {displayMode: 'markers', datalessRegionColor:'#ffffff', colorAxis: { minValue: 0}, colors:['ffffff', '#0a58ca'], backgroundColor: '#FFFFFF', region: region, resolution: "provinces"};
  chart.draw(globalCityData, cityOptions);


}

/*
  Function to normalize both Patent and NIH data
  Conducts the calculations to combine the Patent and NIH data.
*/
function normalizedVal(patents, nih, allPat, allNih){
  max_patents = Math.max(1, ...allPat);
  max_nih = Math.max(1, ...allNih);
  min_patents = Math.min(...allPat);
  min_nih = Math.min(...allNih);
  console.log(max_patents);

  // min_patents=Infinity
  // min_nih=Infinity
  // for (let i = 0; i < patents.length; i++){
  //   if (patents[i]<min_patents && patents[i]!=0){
  //     min_patents= patents[i];
  //   }
  //   if (nih[i]<min_nih && nih[i]!=0){
  //     min_nih= nih[i];
  //   }
  // }
  // if (max_patents==min_patents)
  //   max_patents=0;
  // if (max_nih==min_nih)
  //   max_nih=0;

  mm_patents = [];
  mm_nih = [];
  c_patents = 0.4;
  c_nih = 0.6;

  value=0;
  for (let i = 0; i < patents.length; i++){
    if (max_patents==0 || patents[i]==0)
      dp = 0;
    else
      dp = (patents[i]-min_patents)/(max_patents-min_patents);
  
  
    if (max_nih==0 || nih[i]==0)
      dn=0;
    else
      dn = (nih[i]-min_nih)/(max_nih-min_nih);

    value+=(dp*c_patents)+(dn*c_nih);
  }
  return value;
}

/*
  Function to generate heatmap for scores of both total NIH funding and Total Patents.
  Sets up heatmap of scores coming from NIH funding and Patents.
*/
async function getCombined(andOr, startDate, endDate) {
  patApi = "http://localhost:3200/patentsQuarter?keywords=";
  var query ='';
  for (q of keywords){
    query+=q+" ";
  }
  query = query.slice(0,-1);
  
  var endDateObj = new Date(endDate.split('-'));
  endDateObj.setDate(endDateObj.getDate()+1);
  endDate = formatDate(endDateObj);

  patApi+=query+"&andor="+andOr+"&start="+startDate+"&end="+endDate;
  console.log(patApi);
  const responsePat = await fetch(patApi, {
    method: 'GET'
  });
  const responseJsonPat = await responsePat.json();
  console.log(responseJsonPat);

  var allPat = [];
  for (let i = 0; i < 50; i++) {
    allPat = allPat.concat(responseJsonPat[states[i]]);
  } 
  console.log(allPat);
  //NIH

  nihApi = "http://localhost:3200/nih2?keywords=";
  var query ='';
  for (q of keywords){
    query+=q+" ";
  }
  query = query.slice(0,-1);
  
  var totalQ = totalQuarters(startDate,endDate);

  
  var start = new Date(startDate.split('-'));
  var curQ = Math.ceil((start.getMonth()+1)/3);
  var curY = start.getFullYear();
  console.log(curQ);

  nihApi+=query+"&operator="+andOr;
  console.log(nihApi);
  
  let rangeCountNih ={};
  for (let i = 0; i < 50; i++) {
    rangeCountNih[states[i]] = [];
  }
  let allNih=[];
  for (let i = 0; i < totalQ; i++){
    
    const responseNih = await fetch(nihApi+"&start="+curY+startQDate[curQ]+"&end="+curY+endQDate[curQ], {
      method: 'GET'
    });
    const responseJsonNih = await responseNih.json();

    for (let i = 0; i < 50; i++) {
      rangeCountNih[states[i]].push(responseJsonNih[states[i]]);
      allNih.push(responseJsonNih[states[i]]);
    }

    if(curQ!=4){
      curQ++;
    } else{
      curQ=1;
      curY+=1;
    }
  }
  // console.log(rangeCountNih);
  // console.log(responseJsonPat);
  // console.log(rangeCountNih);
  array = [];
  for (let i = 0; i < 50; i++) {
    // console.log(states[i],"\nPatent_max:", Math.max(...responseJsonPat[states[i]]),
    //   "\nPatent_min:", Math.min(...responseJsonPat[states[i]]),
    //   "\nNIH_max:", Math.max(...rangeCountNih[states[i]]), 
    //   "\nNIH_min:", Math.min(...rangeCountNih[states[i]]));
    var patSum = 0;
    var nihSum = 0;
    for (let j = 0; j < responseJsonPat[states[i]].length; j++){
      patSum += responseJsonPat[states[i]][j];
      nihSum += rangeCountNih[states[i]][j];
    }
    var tempScore = normalizedVal(responseJsonPat[states[i]], rangeCountNih[states[i]], allPat, allNih)
    temp = ["US-"+states[i],tempScore, "Score: "+tempScore.toFixed(4)+"\n Total Patents: "+patSum.toLocaleString("en-US")+"\n Total Funding: $"+ nihSum.toLocaleString("en-US")+" USD"] ;
    // console.log(temp[0], temp[1]);
    array.push(temp);
    // console.log(states[i], normalizedVal(responseJsonPat[states[i]], rangeCountNih[states[i]]));

  }
  globalData.addRows(array);

  // for (let i = 0; i < 50; i++){
  //   array.push(["US-"+states[i], responseJson.range[states[i]]]);
  // }
 
  // var data = google.visualization.arrayToDataTable(array);
  var chart = new google.visualization.GeoChart(document.getElementById('regions_div'));

  function myClickHandler(){
    var selection = chart.getSelection();
    console.log(selection.length);
    if (selection.length==1){
      document.getElementById("ecosystemData").innerHTML = `
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      `;
      stateCityToggle = 'city';
      getPatentState(states[selection[0].row]);
    }
  }

  google.visualization.events.addListener(chart, 'select', myClickHandler);

  google.visualization.events.addListener(chart, 'ready', function () {
    var countries = document.getElementById('regions_div').getElementsByTagName('path');
    Array.prototype.forEach.call(countries, function(path) {
      path.setAttribute('stroke', '#696969');
    });
  });


  options = {datalessRegionColor:'#ffffff', colorAxis: { minValue: 0}, colors:['ffffff', '#0a58ca'], backgroundColor: '#FFFFFF', region: "US", resolution: "provinces"};
  chart.draw(globalData, options);
  document.getElementById("generateButton").innerHTML = 'Generate Heatmap';
  document.getElementById("genBtn").removeAttribute("disabled");
}


/*
  Function to adjust map size to fit the window size.
  Makes map dynamic.
*/
$(window).resize(function(){
  console.log("R");
  drawRegionsMap();
});

/*
  Function to allow user to press enter to add keyword
  in input keyword text area.
*/
$("#inputKey").on('keyup', function (event) {
  if (event.keyCode === 13) {
     addKeyword();
  }
});

/*
  Function to add keywords to query.
*/
function addKeyword(){
  var keyword = document.getElementById("inputKey").value.toLowerCase();
  if (!keywords.includes(keyword) && keyword.length > 0 && keyword.length < 25){
    keywords.push(keyword);
    loadKeywords();
  }
}

/*
  Function to remove keywords to query.
*/
function removeKeyword(keyword){

  if (keywords.includes(keyword)){
    var index = keywords.indexOf(keyword);
    keywords.splice(index, 1);
    loadKeywords();
    console.log(keyword);
    console.log(index);
  }
}

/*
  Function load all keywords in box
*/
function loadKeywords(){
  let keywordsTags = document.querySelector("#keywords");
  let keywordOut = ''
  for (let i = 0; i < keywords.length; i++){
    keywordOut += `
    <div class="pillbutton">
      <div style="display: inline;">`+keywords[i]+`</div>
      <div class="close" style="display: inline;" onclick="removeKeyword('`+keywords[i]+`')">×</div>
    </div>`;
  }

  keywordsTags.innerHTML = keywordOut;
}

/*
  Function for creating the tooltips for search options
*/
var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
})

/*
  Function when the web application initially loads up.
  Sets up the components of web app.
*/
function initialLoad(){
  loadKeywords();
  let startYearDrop = document.querySelector("#startYDiv");
  let endYearDrop = document.querySelector("#endYDiv");
  let yearOutStart = "";
  let yearOutEnd = ""
  let currentYear = new Date().getFullYear();
  for (let i = currentYear; i >= 2016; i--){
    yearOutStart+=`
    <option value="`+i+`"`;
    if (i==2018){
      yearOutStart+= ` selected="2018"`;
    }
    yearOutStart+=`>`+i+`</option>`;


    yearOutEnd+=`
    <option value="`+i+`"`;
    if (i==2022){
      yearOutEnd+= ` selected="2022"`;
    }
    yearOutEnd+=`>`+i+`</option>`;
  }
  yearOutStart+='</select>';
  yearOutEnd+='</select>';
  startYearDrop.innerHTML='<select class="form-select" aria-label="default-select" name="startY" id="startY">' + yearOutStart;
  endYearDrop.innerHTML='<select class="form-select" aria-label="default-select" name="endY" id="endY">' + yearOutEnd;
}