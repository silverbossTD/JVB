var socket = new WebSocket("ws://localhost:8081");
var averagePing = 0;

var Network = {
	send: function(object) {
		setTimeout(function() {
			socket.send(JSON.stringify(object));
		}, 0);
	},

	login: function() {
		Network.send({what: "login", username: app.username});
		app.currentScreen = "lobbies";
	},

	joinLobby: function() {
		Network.send({what: "join-lobby", lobbyName: app.lobbySelection});
	},

	createGame: function() {
		Network.send({what: "create-game", lobbyName: app.gameName, numPlayers: app.numPlayers});
	},

	kick: function(username) {
		Network.send({what: "kick", username: username});
	},

	leaveLobby: function() {
		Network.send({what: "leave-lobby"});
	},

	changeTeamColor: function(username) {
		Network.send({what: "change-team-color", username: username});
	},

	startGame: function() {
		Network.send({what: "start-game"});
	},

	ping: function() {
		Network.send({what: "ping", time: Date.now()});
	}
};
