var request = require('sync-request');
var xmldoc = require('xmldoc');
var moment = require('moment');
var HashMap = require('hashmap');
var AlexaSkill = require('./AlexaSkill');
var config = require('./config');
var APP_ID = config.appId;
var CTA_KEY = config.ctaKey;

var calculateTimeDifference = function (xml) {
  console.log("Calculating time difference");
  var response = new xmldoc.XmlDocument(xml);
  var prdNode = response.childNamed('prd');

  if (prdNode === undefined) {
    return -1;
  } else {
    var prdtmNode = prdNode.childNamed('prdtm');
    var tmstmpNode = prdNode.childNamed('tmstmp');
    console.log("Prediction time: ", prdtmNode);
    console.log("Timestamp: ", tmstmpNode);

    var predictionDate = new moment(prdtmNode, 'YYYYMMDD HH:mm:ss');
    var currentDate = new moment(tmstmpNode, 'YYYYMMDD HH:mm:ss');

    console.log("Current Date: ", currentDate.unix());
    console.log("Prediction Date: ", predictionDate.unix());

    //TODO if the time difference is less than N amount of minutes try to get the next prediction
    var timeDifference = (predictionDate.unix() - currentDate.unix()) / 60;
    console.log(timeDifference);
    return timeDifference;
  }
};

var url = function (stopId, routeId) {
  var url = 'http://www.ctabustracker.com/bustime/api/v1/getpredictions?key=' + CTA_KEY + '&rt=' + routeId + '&stpid=' + stopId;
  console.log(url);
  return url;
};

var getPredictionTimeFromCta = function (stopId, routeId) {
  console.log("Getting prediction from CTA");
  var res = request('GET', url(stopId, routeId));
  //console.log(res.getBody('utf8'));
  return res.getBody('utf8');
};

var handleNextBusRequest = function (stopId, routeId) {
  var xml = getPredictionTimeFromCta(stopId, routeId);
  var timeDifference = calculateTimeDifference(xml);
  return (timeDifference > 0) ? ['Bus number', "<break strength='medium'/>", routeId, ',', 'will arrive in approximately', "<break strength='medium'/>", timeDifference, timeDifference == 1 ? 'minute. ' : 'minutes. '].join(' ') : '';
};

var BusSchedule = function () {
  AlexaSkill.call(this, APP_ID);
};

BusSchedule.prototype = Object.create(AlexaSkill.prototype);
BusSchedule.prototype.constructor = BusSchedule;

BusSchedule.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
  // What happens when the session starts? Optional
  console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId + ", sessionId: " + session.sessionId);
};

BusSchedule.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
  // This is when they launch the skill but don't specify what they want. Prompt them for their bus stop
  var output = 'Welcome to CTA Bus Tracker. ' + 'Say the number of a bus to get how long the next bus is going to take.';

  var reprompt = 'Which bus stop do you want to find more about?';

  response.ask(output, reprompt);

  console.log("onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
};

BusSchedule.prototype.intentHandlers = {
  'GetNextBus': function (intent, session, response) {
    var routes = new HashMap();
    routes.set(config.routes[0].routeId, config.routes[0].stopId);
    routes.set(config.routes[1].routeId, config.routes[1].stopId);
    routes.set(config.routes[2].routeId, config.routes[2].stopId);
    routes.set(config.routes[3].routeId, config.routes[3].stopId);

    var speechOutput;
    var busSchedule = '';

    busSchedule = '';
    routes.forEach(function (stopId, routeId) {
      busSchedule += handleNextBusRequest(stopId, routeId);
    });

    console.log("Speech: ", busSchedule);

    session.attributes = {
      busSchedule: busSchedule
    };

    console.log("Session Attribute: ", session.attributes.busSchedule);

    if (busSchedule != '') {
      speechOutput = {
        speech: "<speak>" + busSchedule + "Would you like to hear the CTA schedule again?" + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
      };
      response.ask(speechOutput);
    } else {
      speechOutput = {
        speech: "<speak>" + "There are no CTA buses coming any time soon. Sorry." + "</speak>",
        type: AlexaSkill.speechOutputType.SSML
      };
      response.tell(speechOutput);
    }
  },

  'Help': function (intent, session, response) {
    var speechOutput = 'Get the time from arrival for any CTA bus stop. ' + 'Which bus stop would you like?';
    response.ask(speechOutput);
  },

  'AMAZON.YesIntent': function (intent, session, response) {
    var sessionAttributes = session.attributes;
    var speechOutput = {
      shouldEndSession: true,
      speech: "<speak>" + sessionAttributes.busSchedule + "</speak>",
      type: AlexaSkill.speechOutputType.SSML
    };
    response.tell(speechOutput);
  },

  'AMAZON.NoIntent': function (intent, session, response) {
    var sessionAttributes = session.attributes;
    sessionAttributes.busSchedule = '';
    var speechOutput = 'Goodbye';
    response.tell(speechOutput);
  },

  'AMAZON.CancelIntent': function (intent, session, response) {
    var sessionAttributes = session.attributes;
    sessionAttributes.busSchedule = '';
    var speechOutput = 'Goodbye';
    response.tell(speechOutput);
  }
};

exports.handler = function (event, context) {
  var skill = new BusSchedule();
  skill.execute(event, context);
};
