const express = require('express');
const bodyParser = require('body-parser');
const fb = require('./fb.js');
const app = express();
const vtoken = process.env.verifyToken;
const ptoken = process.env.pageToken;

app.use(express.static(__dirname + '/tmp'));
app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.get('/', function (req, res) {
  res.send('OK');
});
app.get('/webhook/', function (req, res) {
	fb.handleGetWebHook(req, res);
});
app.post('/webhook/', function (req, res) {
	fb.handlePostWebHook(req, res);
});

app.listen(app.get('port'), function() {
  console.log('running on port', app.get('port'));
});






