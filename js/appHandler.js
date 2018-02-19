/*authors: Ibrahima HAIDARA / Martin Romero */ 
var fs = require("fs");
var userList = {};
var Base64Decode = require('base64-stream').decode;




function base64_decode(base64str, file) {
    var bitmap = new Buffer(base64str, 'base64');
    fs.writeFileSync(file, bitmap);
}


//----------------------------Watson developer cloud + visual recognition---------------
var watson = require('watson-developer-cloud');
var visual_recognition = watson.visual_recognition({
  api_key: '8f2100a69fea9d4b534df0e9c7302fc2976289a9',
  version: 'v3',
  version_date: '2016-05-20'
});

//-----------------Mongo DB connection and options using a server certificate------------
var MONGODB_URL = "mongodb://admin:MGDNKSWIXONYFNMS@sl-eu-fra-2-portal.1.dblayer.com:17425,sl-eu-fra-2-portal.0.dblayer.com:17425/compose?authSource=admin&ssl=true";
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var myDB;
var ca = [fs.readFileSync(__dirname + "/../servercert.crt")];
var options = {
    mongos: {
        ssl: true,
        sslValidate: true,
        sslCA:ca,
    }
}

MongoClient.connect(MONGODB_URL, options, function(err, db) {
    assert.equal(null, err);
    myDB = db;
});

exports.saveCredentials = function (socket){
  var returnCallBack = {};
  socket.on("save_credentials_to_db", function(data, callback){
    doesUserAlreadyExist(data.name, data.password, function(res){
    if(res.exist == true){
      socket.emit("user_already_in_db", "That user does already exist! Please, log in instead");

    }else{
     var dr = data.image.match(/,(.*)$/)[1];
     var image = base64_decode(dr, "photo.jpg");
     var params = {
       images_file: fs.createReadStream("photo.jpg")
     };


    visual_recognition.detectFaces(params,
      function(err, response) {
        if (err)
          console.log("err");
        else{
          console.log(JSON.stringify(response, null, 2));
          if(response.images[0].faces.length != 0){

            myDB.collection("users").save(data, function(err, res){
                if(err){
                  returnCallBack = {saveToDB: "no", humanFace: "yes"};
                  callback(returnCallBack);
                }
                else{
                 returnCallBack = {saveToDB: "yes", humanFace: "yes"};
                 callback(returnCallBack);
               }
            });
           
          }
          else{
           returnCallBack = {saveToDB: "no", humanFace: "no"};
           callback(returnCallBack);
         }
       }
     });
  }

  });

});

}


function doesUserAlreadyExist(name, password, fn){
  var bool; var user = {};

    myDB.collection("users").find({}).toArray(function(err, result){
      if(err)
        console.log("Eroor while retrieving data "+err);
      else{
        for(i=0; i<result.length; i++){
          if(result[i].name == name && result[i].password == password){
           bool = true; user = result[i];
           break;
         }
         else{
          bool = false; 
        }
      }
      fn({exist: bool, user: user});
    }
      
    });

  
}


exports.login = function (socket, io){
  var user = {};
  socket.on("login", function(data, callback){
    doesUserAlreadyExist(data.name, data.password, function(res){
      if(res.exist == true){
        user ={
          exist: res.exist,
          principal: res.user
        };
      socket.username = data.name;
      userList[socket.username] = socket;
      updateUserlist(io);
      socket.broadcast.emit("connected_user", socket.username);
        callback(user);
      }
      else{
        user = {
          exist: res.exist
        }
        callback(user);
      }
    });



  });
}


function updateUserlist(io){
    io.emit("user list", Object.keys(userList));
  }



exports.dispatchChatMessages = function (socket, io){
  socket.on('chat message', function(data, callback){
    var msg = data.message.trim();
    var date = new Date();
    var time = date.getHours()+" : "+date.getMinutes();
    if(msg.substr(0, 3) === "/w "){
      msg = msg.substr(3);
      var index = msg.indexOf(" ");
      if(index != -1){
        var name = msg.substr(0, index);
        msg = msg.substr(index+1);
        if(name in userList){
          if(data.hasFile){
           userList[name].emit('private_msg_with_file', {msg:msg, username: socket.username+" ---> "+name, timestamp: time, multimedia: data.file, mood: data.mood});
           userList[socket.username].emit('private_msg_with_file', {msg:msg, username: socket.username+" ---> "+name, timestamp: time, multimedia: data.file, mood: data.mood});
          }
          else{
            userList[name].emit('private_msg', {msg:msg, username: socket.username+" ---> "+name, timestamp: time, mood: data.mood});
            userList[socket.username].emit('private_msg', {msg:msg, username: socket.username+" ---> "+name, timestamp: time, mood: data.mood});
          }

        }
        else{
          callback("Error. Please enter a valid chat name");
        }
        
      }
      else{
        callback("Error. Please enter a message")
      }
      
    }
    else{

      if(data.hasFile){
        io.emit('add_chat_msg_to_list_with_file', {msg:msg, username: socket.username, timestamp: time, multimedia: data.file, mood: data.mood});
      }
      else{
          io.emit('add_chat_msg_to_list', {msg:msg, username: socket.username, timestamp: time, mood: data.mood});
      }
    }
    
  });
}

exports.disconnect = function(socket, io){

  socket.on("disconnect", function(data){
      if(!socket.username) return;
      delete userList[socket.username];
      updateUserlist(io);
      socket.broadcast.emit("disconnected_user", socket.username);
    });
}
