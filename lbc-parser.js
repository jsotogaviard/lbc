const request = require('request');
const fs = require('fs');
const dateFormat = require('dateformat');
const nodemailer = require('nodemailer');
const schedule = require('node-schedule');
const config = require('./config.json');
const credential = require('./credential.json');

schedule.scheduleJob(config.cron_frequency, function(){
  request(
    {
      method: 'GET',
      url: 'http://api.scraperapi.com/?key=' + credential.scraper_api_key + '&url=' + config.url,
      headers: {
        Accept: 'application/json',
      },
    },
    function(error, response, body) {
      if(response.statusCode != 200){
        throw Error(response.statusCode);
      } 
      
      console.log('received data');
      receivedData = body.match(/<span itemprop="name" data-qa-id="aditem_title".*?>(.*?)<\/span>/g)
  
      if (fs.existsSync(config.current)) {
          // Read current file
          fs.readFile(config.current, "utf8",function read(err, storedDataIn) {
            if (err) {
                throw err;
            }
            storedData = storedDataIn.split("\n")
            if (!arraysAreEqual(receivedData, storedData)) {
  
              // Rotate current file
              var now = new Date();
              const formattedDate = dateFormat(now, "yyyy-mm-dd-hh-MM-ss");
         
              fs.rename(config.current, './data/' + formattedDate + '.csv', function (err) {
                if (err) throw err;
                console.log('renamed complete');
  
                // Persist new 
                writeCurrent(receivedData)
  
                // Send email
                sendEmail(receivedData)
              });
  
            } else {
              console.log('array are equal, no work');
            } 
        }); 
      } else {
         // Persist new 
        writeCurrent(receivedData)
  
         // Send email
         sendEmail(receivedData)
    }
  }
  );
});

function writeCurrent(receivedData){
      console.log('write current')
      var file = fs.createWriteStream(config.current);
      file.on('error', function(err) { /* error handling */ });
      receivedData.forEach(function(v) { 
        file.write(v + '\n'); 
      });
      file.end();
}

function sendEmail(receivedDate) {
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
   let mailOptions = {
    from: 'LeChat', // sender address
    to: "jsotogaviard@gmail.com, armance.chassaigne@gmail.com", // list of receivers
    subject: "Nouvelle Annonce LBC", // Subject line
    text: receivedData.join("\n")
  };

  transporter.sendMail(mailOptions, function(error, info){
    if(error){
      return console.log(error);
    }
    console.log('Message sent: ' + info.response);
  });

  transporter.close();
}

function arraysAreEqual(x,y){
  var objectsAreSame = true;
  for(var propertyName in x) {
     if(x[propertyName] !== y[propertyName]) {
        objectsAreSame = false;
        break;
     }
  }
  return objectsAreSame;
}