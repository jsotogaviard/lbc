const request = require('request');
const fs = require('fs');
const dateFormat = require('dateformat');
const nodemailer = require('nodemailer');
const schedule = require('node-schedule');
const config = require('./config.json');
const credential = require('./credential.json');

const keys = credential.scraper_api_keys
const minute = 60 / keys.length
const minuteAsInt = Math.round(minute);
var cron_frequency = " */" + minuteAsInt + " 8-20 * * *" //8-20
console.log(cron_frequency)

schedule.scheduleJob(cron_frequency, function () {
//schedule.scheduleJob("*/10 * * * * * ", function () {
  const now = new Date()  
  console.log(now)
  const index = now.getMinutes() % keys.length
  request(
    {
      method: 'GET',
      url: 'http://api.scraperapi.com/?key=' + keys[index] + '&url=' + config.url,
      headers: {
        Accept: 'application/json',
      },
    },
    function (error, response, body) {
      if (response.statusCode != 200) {
        console.log(response.statusCode)
        console.log(body)
        console.log(error)
      } else {
        // url regex
        const regex_url = /href=\"\/ventes_immobilieres\/(.*?).htm/g

        // Name regex
        const regex_title = /<span itemprop="name" data-qa-id="aditem_title".*?>(.*?)<\/span>/g;
        const receivedData = []
        var title = regex_title.exec(body)
        var url = regex_url.exec(body)
        while(title !== null){
          receivedData.push({
            title: title[1],
            url: url[1]
          })
          title = regex_title.exec(body)
          url = regex_url.exec(body)
        }
        const urlReceivedData = toSet(receivedData)    
        if (fs.existsSync(config.current)) {
          // Read current file
          fs.readFile(config.current, "utf8", function read(err, urlDataIn) {
            if (err) {
              throw err;
            }
            const urlData = new Set(urlDataIn.split("\n"))
            if (isSuperset(urlReceivedData, urlData)) {

              // Rotate current file
              var now = new Date();
              const formattedDate = dateFormat(now, "yyyy-mm-dd-hh-MM-ss");

              fs.rename(config.current, './data/' + formattedDate + '.csv', function (err) {
                if (err) throw err;
                console.log('renamed complete');

                // Persist new 
                writeCurrent(urlReceivedData)

                // Send email
                sendEmail(receivedData)
              });

            } else {
              console.log('array are equal, no work');
            }
          });
        } else {
          // Persist new 
          writeCurrent(urlReceivedData)

          // Send email
          sendEmail(receivedData)
        }
      }
    }
  );

});

function writeCurrent(receivedData) {
  console.log('write current')
  var file = fs.createWriteStream(config.current);
  file.on('error', function (err) { console.log(err) });
  receivedData.forEach(function (v) {file.write(v + '\n');});
  file.end();
}

function sendEmail(receivedData) {
  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: credential.user,
      pass: credential.pass
    }
  });

  // setup email data with unicode symbols
  var text = ''
  receivedData.forEach(element => {
    text += element.title + ' https://www.leboncoin.fr/ventes_immobilieres/' + element.url + '.htm \n' 
  });
  let mailOptions = {
    from: 'LeChat', // sender address
    to: "jsotogaviard@gmail.com, armance.chassaigne@gmail.com", // list of receivers
    subject: "Nouvelle Annonce LBC", // Subject line
    text: text
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) { return console.log(error); }
    console.log('Message sent: ' + info.response);
  });

  transporter.close();
}

function toSet(receivedData) {
  const urlData = []
  receivedData.forEach(function(element) {
    urlData.push(element.url)
  });
  return new Set(urlData)
}

function isSuperset(set, subset) {
  for (var elem of subset) {
    if (!set.has(elem)) {
      return false;
    }
  }
  return true;
}