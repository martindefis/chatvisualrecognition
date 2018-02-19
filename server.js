/*authors: Ibrahima HAIDARA / Martin Romero */ 
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var express = require('express');
var appHandler = require("./js/appHandler");

//---------------------------Tone Analyzer---------------------------
var toneModule = require("./js/ToneAnalyzer");
let bodyParser = require('body-parser');
let ToneAnalyzerV3 = require('watson-developer-cloud/tone-analyzer/v3');
let toneAnalyzer = new ToneAnalyzerV3({
  version_date: '2017-09-21',
});


//----------------------------express-https-redirect---------------------------------
var httpsRedirect = require('express-https-redirect'); //redirecting from http to https
//----------------------------Tone Analyzer------------------------------------------


app.use('/css', express.static(__dirname + '/css'));
app.use('/js', express.static(__dirname + '/js'));
app.use(bodyParser.json());
app.use('/', httpsRedirect());

app.post('/tone', (req, res, next) => {
    let toneRequest = toneModule.createToneRequest(req.body);

    if (toneRequest) {
      toneAnalyzer.tone_chat(toneRequest, (err, response) => {
        if (err) {
          return next(err);
        }
        let answer = {mood: toneModule.happyOrUnhappy(response)};
        return res.json(answer);
      });
    }
    else {
      return res.status(400).send({error: 'Invalid Input'});
    }
  });



app.get('/', function(req, res){
  res.sendFile(__dirname + '/client.html');
});

let port = process.env.PORT || process.env.VCAP_APP_PORT || 8080;

server.listen(port, function(){
  console.log('listening on *: '+port);
});



io.on('connection', function(socket){
  
  appHandler.saveCredentials(socket);

  appHandler.login(socket, io);

  socket.on("typing", function(data){
    socket.broadcast.emit("typing", data);
  });

  appHandler.dispatchChatMessages(socket, io);

  appHandler.disconnect(socket, io);


});

