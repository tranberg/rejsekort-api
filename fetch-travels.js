const request = require('superagent');
const cheerio = require('cheerio');

// Urls requests
const login_url = 'https://selvbetjening.rejsekort.dk/CWS/Home/UserNameLogin';
const login_form = 'https://selvbetjening.rejsekort.dk/CWS/Home/Index';
const recent_travels_url = 'https://selvbetjening.rejsekort.dk/CWS/TransactionServices/TravelCardHistory';
const all_travels_url = 'https://selvbetjening.rejsekort.dk/CWS/TransactionServices/TravelCardHistory'

var login_token
var travel_token
var all_travels_html

// Create an agent that can hold cookies
const agent = request.agent();

// Get login token
async function get_login_token() {
  var res = await agent.get(login_url)
  var token_string = res.text.match(/<input name="__RequestVerificationToken.*/)[0]
  var token = token_string.match(/value=".*"/)[0].slice(7, 99)
  login_token = token
}

// Login
async function logIn(username, password) {

  await get_login_token();

  var res = await agent.post(login_form).type('form').send({
    Username: username,
    Password: password,
    __RequestVerificationToken: login_token
  })
};

// Get token for form to get all travels
async function get_travel_form_token() {
  var res = await agent.get(recent_travels_url)
  var token_string = res.text.match(/antiForgeryToken = '<input name="__RequestVerificationToken.*/)[0]
  var token = token_string.match(/value=".*"/)[0].slice(7, 99)
  travel_token = token
}

// Get all travels
async function get_all_travels() {

  await get_travel_form_token()

  // Get first set of travels
  var res = await agent.post(all_travels_url).type('form').send({
    periodSelected: 'All',
    __RequestVerificationToken: travel_token
  })
  all_travels_html = res.text

  // Loop over all pages until all travels are included
  finished = false
  iteration = 1
  while (!finished) {
    // Get new token
    var token_string = res.text.match(/antiForgeryToken = '<input name="__RequestVerificationToken.*/)[0]
    var token = token_string.match(/value=".*"/)[0].slice(7, 99)

    // Load next page
    var res = await agent.post(all_travels_url).type('form').send({
      periodSelected: 'All',
      __RequestVerificationToken: token,
      page: `${iteration*5+1}`
    })

    // Check if page contains additional travels
    if (!res.text.match(/Error, please try again later./)) {
      all_travels_html = all_travels_html + res.text
    } else {
      finished = true
    }
    iteration++
  }
}

// Parse travels by looping over all 'tr' elements across tables
// Travels are split in several tables for pagination
function parse_travels() {
  const $ = cheerio.load(all_travels_html)
  var travel_list = []
  var travel_index = -1
  $('tr').each(function() {
    num_childs = $(this).children('td').length
    if (num_childs == 9) {
      td_index = 1
      skip_row = true
      $(this).children('td').each(function() {
        if (td_index > 1) {
          // Check existence of travel number.
          if (td_index == 2) {
            if ($(this).text().length > 0) {
              if (!$(this).text().match('/')) {
                skip_row = false
                travel_index++
                travel_list[travel_index] = {}
                travel_list[travel_index]['number'] = $(this).text()
              }
            }
          }
          if (!skip_row) {
            if (td_index == 3) {
              travel_list[travel_index]['date'] = $(this).text()
            }
            if (td_index == 4) {
              travel_list[travel_index]['start-time'] = $(this).text()
            }
            if (td_index == 5) {
              travel_list[travel_index]['start-station'] = $(this).text()
            }
            if (td_index == 6) {
              travel_list[travel_index]['end-time'] = $(this).text()
            }
            if (td_index == 7) {
              travel_list[travel_index]['end-station'] = $(this).text()
            }
          }
        }
        td_index++
      })
    }
  })

  // Change data format for Greenbit
  const ACTIVITY_TYPE_TRANSPORTATION = 'ACTIVITY_TYPE_TRANSPORTATION';
  const TRANSPORTATION_MODE_PUBLIC = 'public';
  const activities = [];
  const num_travels = travel_list.length
  for (a=0; a<num_travels; a++) {

    date_split = travel_list[a]['date'].split('/')
    start_time = new Date(`20${date_split[2]}-${date_split[1]}-${date_split[0]}T${travel_list[a]['start-time']}`)
    end_time = new Date(`20${date_split[2]}-${date_split[1]}-${date_split[0]}T${travel_list[a]['end-time']}`)

    activities.push({
      id: `rejsekort${travel_list[a]['number']}`,
      datetime: end_time,
      activityType: ACTIVITY_TYPE_TRANSPORTATION,
      durationHours: (end_time - start_time) / 3600000, // this currently only works for travels within the same date
      transportationMode: TRANSPORTATION_MODE_PUBLIC
    })
  }
  return activities
}

async function collect() {
  await logIn(process.argv[2], process.argv[3])
  await get_all_travels()
  return parse_travels()
}

collect().then(x => console.log(x))