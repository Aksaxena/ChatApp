var express = require('express')
        , app = express()
        , http = require('http')
        , server = http.createServer(app)
        , io = require('socket.io').listen(server),
        mysql = require('mysql'),
        moment = require('moment');

server.listen(3000);


var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'vefinder_chatApp'
});

connection.connect(function (err) {
    if (!err) {
        console.log("Database is connected ... ");
    } else {
        console.log("error connecting database ... ");
    }
});

//start chat server
server.listen(3000);
var currentTime = new Date();
var hours = currentTime.getHours();
var minutes = currentTime.getMinutes();
console.log("======================================");
if (minutes < 10) {
    minutes = "0" + minutes;
}

console.log("<b>" + hours + ":" + minutes + " " + "</b>");
// routing
//app.get('/', function (req, res) {
//  res.sendfile(__dirname + '/index.html');
//});

// usernames which are currently connected to the chat
var usernames = {};
var userIds = {};
var clients = [];
// rooms which are currently available in chat
var clientInfo = {};
io.sockets.on('connection', function (socket) {

    //console.log(socket);
    socket.on('adduserId', function (userIds) {
        console.log("Userid=" + userIds);
        socket.room = userIds;
        socket.join(userIds);

        var query = connection.query("select *,TIME(timestamp) as timestamp,vu.profile_image from tbl_messages as tm left join vefinder_user as vu on vu.user_id=tm.from_id where room_id='" + userIds + "'", function (err, result) {
            if (err) {
                console.log(err);
                throw err;
            } else {
                socket.emit('receiveReadMessages', result);
            }
        });

    });
    // when the client emits 'adduser', this listens and executes
    socket.on('adduser', function (username) {
        //console.log(username);
        // store the username in the socket session for this client
        socket.username = username;
        // store the room name in the socket session for this client
        //socket.room = 'room1';
        // add the client's username to the global list
        usernames[username] = username;
        // send client to room 1
        socket.join(socket.room);
        // echo to client they've connected
        //socket.emit('updatechat', 'SERVER', socket.username+' have connected to '+socket.room);
        // echo to room 1 that a person has connected to their room
        //socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', username + ' has connected to this room '+socket.room);
        //socket.emit('updaterooms', rooms, socket.room);
        console.log("Usernames==");
        console.log(socket.room);
        console.log(usernames);
    });

    // when the client emits 'sendchat', this listens and executes
    socket.on('sendchat', function (data) {
        //data=JSON.parse(data);
        console.log(data);
        console.log(JSON.stringify(data));
        data.timestamp = moment().format('H:mm:s');
        var newChat = {
            from_id: data.from_id,
            to_id: data.to_id,
            message: data.message,
            message_type: data.message_type,
            room_id: data.room_id,
            timestamp: moment().format('YYYY-MM-DD H:mm:s'),
            sender_name: data.sender_name
        };
        var query = connection.query('INSERT INTO tbl_messages SET ?', newChat, function (err, result) {
            if (err) {
                console.log(err);
                throw err;
            } else {
                console.log("here");
                console.log(socket.username);
                connection.query('select * from vefinder_user where user_id=?',[data.from_id],function(err3,result3){
                    if(err3)
                        throw err3;
                    else{
                        console.log("Inside Select users");
                        console.log(result3[0]);
                        data.sender_name=result3[0].username;
                        if(result3[0].profile_image!='n/a' && result3[0].profile_image!=''){
                        data.sender_image="http://54.186.106.85/vefinder/assets/UserImage/"+data.from_id+"/"+result3[0].profile_image;
                    }else{
                        data.sender_image="";
                    }
                        io.sockets.in(data.room_id).emit('updatechat', socket.username, data);
                        io.sockets.emit('broadcast', data);
                    }
                });
                
            }
        });

        // we tell the client to execute 'updatechat' with 2 parameters

    });

//	socket.on('switchRoom', function(newroom){
//		socket.leave(socket.room);
//		socket.join(newroom);
//		socket.emit('updatechat', 'SERVER', 'you have connected to '+ newroom);
//		// sent message to OLD room
//		socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', socket.username+' has left this room');
//		// update socket session room title
//		socket.room = newroom;
//		socket.broadcast.to(newroom).emit('updatechat', 'SERVER', socket.username+' has joined this room');
//		socket.emit('updaterooms', rooms, newroom);
//	});


    socket.on('typing', function (data, callback) {
        console.log("here");
        io.sockets.in(data.room_id).emit('typing', data);
    });


    // when the user disconnects.. perform this
    socket.on('disconnect', function () {
        // remove the username from global usernames list
        delete usernames[socket.username];
        // update list of users in chat, client-side
        io.sockets.emit('updateusers', usernames);
        // echo globally that this client has left
        //socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected');
        socket.leave(socket.room);
    });
});
