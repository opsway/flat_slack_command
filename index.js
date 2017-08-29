
'use strict';

const config = require('./.credentials/config.json');
const googleKey = require('./.credentials/google.json');
const google = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

function authJwt() {
    return new google.auth.JWT(
        googleKey.client_email,
        null,
        googleKey.private_key,
        SCOPES,
        null
    );
}

Date.daysBetween = function (date1, date2) {   //Get 1 day in milliseconds
    let one_day = 1000 * 60 * 60 * 24;    // Convert both dates to milliseconds
    let date1_ms = date1.getTime();
    let date2_ms = date2.getTime();    // Calculate the difference in milliseconds
    let difference_ms = date2_ms - date1_ms;        // Convert back to days and return
    return Math.round(difference_ms / one_day);
}

function getCurrentSlotFor(calendarId) {
    return new Promise((resolve, reject) => {
        let calendar = google.calendar('v3');
        let jwtClient = authJwt();
        jwtClient.authorize(function (err, tokens) {
            if (err) {
                resolve('The API returned an error: ' + err);
                return;
            }
            calendar.events.list({
                auth: jwtClient,
                calendarId: calendarId,
                timeMin: (new Date()).toISOString(),
                maxResults: 5,
                singleEvents: true,
                orderBy: 'startTime'
            }, function (err, response) {
                if (err) {
                    resolve('The API returned an error: ' + err);
                }
                let events = [];
                if (response) {
                    events = response.items;
                }
                if (events.length == 0) {
                    resolve('Free');
                } else {
                    let currentDate = new Date();
                    for (let i = 0; i < events.length; i++) {
                        let event = events[i];
                        let start = new Date(event.start.dateTime || event.start.date);
                        let end = new Date(event.end.dateTime || event.end.date);
                        if (currentDate >= start && currentDate <= end) {
                            resolve(event.summary);
                            return;
                        }
                    }
                    resolve("Free");
                }
            });
        });
    });
}

function flatStatistic(calendarId, year) {
    return new Promise((resolve, reject) => {
        let calendar = google.calendar('v3');
        let jwtClient = authJwt();
        jwtClient.authorize(function (err, tokens) {
            if (err) {
                resolve("NA - " + err);
                return;
            }
            calendar.events.list({
                auth: jwtClient,
                calendarId: calendarId,
                timeMin: (new Date(year, 1, 1)).toISOString(),
                timeMax: (new Date(year+1, 1, 1)).toISOString(),
                maxResults: 100,
                singleEvents: true,
                orderBy: 'startTime'
            }, function (err, response) {
                if (err) {
                    resolve("NA - " + err);
                }
                let events = [];
                if (response) {
                    events = response.items;
                }
                let results = 0;
                let min = 365;
                let max = 0;
                if (events.length == 0) {
                    resolve("В этом году пусто.");
                } else {
                    for (let i = 0; i < events.length; i++) {
                        let event = events[i];
                        let start = new Date(event.start.dateTime || event.start.date);
                        let end = new Date(event.end.dateTime || event.end.date);
                        let days = Date.daysBetween(start, end);
                        if (min >= days) {
                            min = days;
                        }
                        if (max <= days) {
                            max = days;
                        }
                        results += days;
                    }
                    resolve("Загруженность: " + Math.round(results/365 * 100)
                        + "%\n Использовано дней: "+ results
                        + "\nСколько раз (или человек) бронировали: "+ events.length
                        + "\nМинимальное время: "+ min
                        + "\nМаксимальное время: "+ max);
                }
            });
        });
    });
}

/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param calendarId An authorized OAuth2 client.
 * @param timeMin string
 * @param timeMax string
 * @param maxResults integer
 */
function getListFor(calendarId, timeMin, timeMax, maxResults = 10) {
    return new Promise((resolve, reject) => {
        let calendar = google.calendar('v3');
        let jwtClient = authJwt();
        jwtClient.authorize(function (err, tokens) {
            if (err) {
                resolve([{"who": 'NA', "where": 'NA', "when": err}]);
                return;
            }
            calendar.events.list({
                auth: jwtClient,
                calendarId: calendarId,
                timeMin: timeMin,
                timeMax: timeMax,
                maxResults: maxResults,
                singleEvents: true,
                orderBy: 'startTime'
            }, function (err, response) {
                if (err) {
                    resolve([{"who": 'NA', "where": 'NA', "when": err}]);
                }
                let flat = '';
                for (let i = 0; i < config.CALENDARS.length; i++) {
                    if (config.CALENDARS[i].id === calendarId) {
                        flat = config.CALENDARS[i].name;
                    }
                }
                let events = [];
                if (response) {
                    events = response.items;
                }
                let results = [];
                if (events.length == 0) {
                    resolve([{"who": 'NA', "where": 'NA', "when": "NA"}]);
                } else {
                    for (let i = 0; i < events.length; i++) {
                        let event = events[i];
                        let start = event.start.dateTime || event.start.date;
                        let end = event.end.dateTime || event.end.date;
                        results.push({"who": event.summary, "where": flat, "when": "C " + start + " по " + end});
                    }
                    resolve(results);
                }
            });
        });
    });
}


/**
 * Format the Knowledge Graph API response into a richly formatted Slack message.
 *
 * @param {string} query The user's search query.
 * @param {object} response The response from the Knowledge Graph API.
 * @returns {object} The formatted message.
 */
function formatSlackMessage (query, response) {
  let entity = false;

  // Extract the first entity from the result list, if any
  if (response && response.length > 0) {
    entity = true;
  }

  // Prepare a rich Slack message
  // See https://api.slack.com/docs/message-formatting
  const slackMessage = {
    response_type: 'in_channel',
    text: `${query}`,
    attachments: []
  };

  if (entity) {
      for (let i = 0; i < response.length; i++) {
          response[i].color = '#3367d6';
          slackMessage.attachments.push(response[i]);
      }

  }
  return slackMessage;
}
// [END functions_slack_format]

// [START functions_verify_webhook]
/**
 * Verify that the webhook request came from Slack.
 *
 * @param {object} body The body of the request.
 * @param {string} body.token The Slack token to be verified.
 */
function verifyWebhook (body) {
  if (!body || body.token !== config.SLACK_TOKEN) {
    const error = new Error('Invalid credentials: ' + body.token + ' Should be: ' + config.SLACK_TOKEN);
    error.code = 401;
    throw error;
  }
}
// [END functions_verify_webhook]

// [START functions_slack_request]
/**
 * Send the user's search query to the Knowledge Graph API.
 *
 * @param {string} query The user's search query.
 */
function makeSearchRequest (query) {
  return new Promise((resolve, reject) => {
      // Return a formatted message
      let results = [];
      let d;
      let startTime;
      let endTime;
      switch (query.toLowerCase()) {
          case 'help':
            let commands = [
                {"title": "list", "text": "/flat list - Вывод квартир и домов доступных сотрудникам OpsWay."},
                {"title": "now", "text": "/flat now - Вывести информацию кто сейчас живет на квартирах."},
                {"title": "calendar", "text": "/flat calendar - Вывести информацию про текущую бронь на пол года."},
                {"title": "history", "text": "/flat history - Вывести историю проживания (до текущей даты)."},
                {"title": "stat", "text": "/flat stat - Узнать статистику проживаний и брони за текущий год."},
                {"title": "send", "text": "/flat send - Послать запрос на бронь."},
            ];
              resolve(formatSlackMessage("Доступные команды: ", commands));

            break;
          case 'list':
              let flats = [
                  {"title": "Карпаты", "title_link": "https://opsway.atlassian.net/wiki/spaces/support/blog/2017/04/03/114159619", "text": "Коттеджный домик в Карпатах (Украина). с. Яблуница"},
                  {"title": "Кипр",  "title_link": "https://opsway.atlassian.net/wiki/spaces/support/blog/2016/04/28/67108884", "text": "Аппартаменты на Кипре. г.Паралимни"}
              ];
              resolve(formatSlackMessage("Список жилья, которое арендует OpsWay: ", flats));

              break;
          case 'now':
              for (let i=0; i<config.CALENDARS.length; i++) {
                  results.push(getCurrentSlotFor(config.CALENDARS[i].id));
              }
              Promise.all(results).then(values => {
                  let flats = [];
                  for (let i=0; i < values.length; i++) {
                      flats.push({"title": config.CALENDARS[i].name, "text": values[i]});
                  }
                  resolve(formatSlackMessage("Сейчас в квартирах: ", flats));
              });
              break;
          case 'calendar':
              d = new Date();
              startTime = d.toISOString();
              endTime = (new Date(d.getFullYear() + 1, d.getMonth(), d.getDate())).toISOString();
              for (let i=0; i<config.CALENDARS.length; i++) {
                  results.push(getListFor(config.CALENDARS[i].id, startTime, endTime));
              }
              Promise.all(results).then(values => {
                  let flats = [];
                  for (let i=0; i < values.length; i++) {
                      console.log(values);
                      if (values[i].length !== undefined) {
                          for (let j = 0; j < values[i].length; j++) {
                              flats.push({
                                  "title": values[i][j].where + ' - ' + values[i][j].who,
                                  "text": values[i][j].when
                              });
                          }
                      }
                  }
                  resolve(formatSlackMessage("Текущая бронь в квартирах: ", flats));
              });
              break;
          case 'history':
              d = new Date();
              startTime = (new Date(d.getFullYear() - 1, d.getMonth(), d.getDate())).toISOString();
              endTime = d.toISOString();
              for (let i=0; i<config.CALENDARS.length; i++) {
                  results.push(getListFor(config.CALENDARS[i].id, startTime, endTime, 25));
              }
              Promise.all(results).then(values => {
                  let flats = [];
                  for (let i=0; i < values.length; i++) {
                      console.log(values);
                      if (values[i].length !== undefined) {
                          for (let j = 0; j < values[i].length; j++) {
                              flats.push({
                                  "title": values[i][j].where + ' - ' + values[i][j].who,
                                  "text": values[i][j].when
                              });
                          }
                      }
                  }
                  resolve(formatSlackMessage("История проживаний: ", flats));
              });
              break;
          case 'stat':
              d = new Date();
              for (let i=0; i<config.CALENDARS.length; i++) {
                  results.push(flatStatistic(config.CALENDARS[i].id, d.getFullYear()));
              }
              Promise.all(results).then(values => {
                  let flats = [];
                  for (let i=0; i < values.length; i++) {
                      flats.push({"title": config.CALENDARS[i].name, "text": values[i]});
                  }
                  resolve(formatSlackMessage("Статика проживаний и брони за "+d.getFullYear()+"год: ", flats));
              });
              break;
          case 'send':
              resolve(formatSlackMessage("Coming soon...", false));
              break;
          default:
              resolve(formatSlackMessage("Используйте '/flat help' для получения справки.", false));
      }

  });
}
// [END functions_slack_request]

// [START functions_slack_search]
/**
 * Receive a Slash Command request from Slack.
 *
 * Trigger this function by making a POST request with a payload to:
 * https://[YOUR_REGION].[YOUR_PROJECT_ID].cloudfunctions.net/flatCommand
 *
 * @example
 * curl -X POST "https://us-central1.your-project-id.cloudfunctions.net/kgSearch" --data '{"token":"[YOUR_SLACK_TOKEN]","text":"giraffe"}'
 *
 * @param {object} req Cloud Function request object.
 * @param {object} req.body The request payload.
 * @param {string} req.body.token Slack's verification token.
 * @param {string} req.body.text The user's search query.
 * @param {object} res Cloud Function response object.
 */
exports.flatCommand = function flatCommand (req, res) {
  return Promise.resolve()
    .then(() => {
      if (req.method !== 'POST') {
        const error = new Error('Only POST requests are accepted');
        error.code = 405;
        throw error;
      }

      // Verify that this request came from Slack
      verifyWebhook(req.body);

      // Make the request to the Knowledge Graph Search API
      return makeSearchRequest(req.body.text);
    })
    .then((response) => {
      // Send the formatted message back to Slack
      res.json(response);
    })
    .catch((err) => {
      console.error(err);
      res.status(err.code || 500).send(err);
      return Promise.reject(err);
    });
};
// [END functions_slack_search]
