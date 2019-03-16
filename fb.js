const db = require('./mongo.js');
const request = require('request');
const qr = require('qrcode');
const QrCode = require('qrcode-reader');
const Jimp = require('jimp');
const fs = require('fs');
const vtoken = process.env.verifyToken;
const ptoken = process.env.pageToken;

module.exports = {
	handleGetWebHook : function(req, res){
		if (req.query['hub.verify_token'] === vtoken) {
			res.send(req.query['hub.challenge']);
		}
		res.send('Error, wrong token');
	},
	handlePostWebHook : function(req, res){
		const body = req.body;
		const messaging_events = req.body.entry[0].messaging
		for (let i = 0; i < messaging_events.length; i++) {
			const event = req.body.entry[0].messaging[i]
			const senderId = event.sender.id
			db.getUserById(senderId, function(user0){
				if (user0){
					handleWebhook(user0, event);
				} else {
					request({
						url: 'https://graph.facebook.com/' + senderId + '?fields=id,name',
						headers: {Authorization:'Bearer ' + ptoken},
						method: 'GET'
					}, function(error, response, body2) {
						if (error) {
							console.log('Error sending messages: ', error)
						} else if (response.body.error) {
							console.log('Error: ', response.body.error)
						} else if (body2){
							if (JSON.parse(body2).name){
								db.newUser(JSON.parse(body2).name, senderId, function(user){
									handleWebhook(user, event);
								});
							}
						}
					});  			
				}
			});
		}
		res.sendStatus(200);  
	}
};

function handleWebhook(user, event){

  	if (event.message && event.message.attachments) {
  		let att = event.message.attachments[0];
  		receivedImage(user, att.payload.url);
  	} else if (event.message && event.message.text) {
  		let text = event.message.text
  		receivedMessage(user, text);
  	} else if (event.postback && event.postback.payload) {
  		let obj = JSON.parse(event.postback.payload);
  		receivedPostback(user, obj);
  	}
}

function receivedMessage(sender, text){
	sendTextMessage(sender._id, text);	
}

function receivedPostback(sender, obj){
	if (obj.target == 'selectTo' && obj.to && obj.keep){
		db.setToForKeepById(obj.keep, obj.to, function(keep){
			db.getMediumUsers(function(users){
				sendTextMessage(sender._id, 'どなたに一時預かりしてもらいますか？');
				const mediumList = users.map(function(user){
					return {
						title: user.userName + ' さん',
						subtitle: '一時預かり先',
						buttons: [{
							type: 'postback',
							title: user.userName + 'さんに決定',
							payload: JSON.stringify({target: 'selectMedium', medium: user._id, keep: obj.keep}) 
						}]
					};
				}).slice(0, 4);
				sendList(sender._id, mediumList);	
			});
		});
	} else if (obj.target == 'selectMedium' && obj.medium && obj.keep){
		db.setMediumForKeepById(obj.keep, obj.medium, function(keep){
			db.getUserById(keep.from, function(userFrom){
				db.getUserById(obj.medium, function(userMedium){
					db.getUserById(keep.to, function(userTo){

						sendRich(keep.from, [{
							title: 'お渡し登録手続きが完了しました',
							'image_url': keep.itemUrl,
							subtitle: userMedium.userName + 'さんがお荷物を保管しています',
							buttons: [{
								type: 'postback',
								title: 'お荷物の状況を確認',
								payload: JSON.stringify({target: 'dummy'}) 

							}]
						}]);

						sendRich(obj.medium, [{
							title: userFrom.userName + 'さんからのお荷物を預かりました',
							'image_url': keep.itemUrl,
							subtitle: userTo.userName + 'さんがお荷物を引き取りに伺います。引渡し時は、受取用QRコードの写真を添付して送付ください。',
							buttons: [{
								type: 'postback',
								title: 'お荷物の状況を確認',
								payload: JSON.stringify({target: 'dummy'}) 

							}]
						}]);

						sendRich(keep.to, [{
							title: userFrom.userName + 'さんからのお荷物を預かりました',
							'image_url': keep.itemUrl,
							subtitle: '保管場所で受取用QRコードを提示し、お受け取りください',
							buttons: [{
								type: 'postback',
								title: '受取用QRコードを表示',
								payload: JSON.stringify({target: 'askQR', code: keep.authCode}) 

							}, {
								type: 'postback',
								title: '保管場所までの行き方は？',
								payload: JSON.stringify({target: 'dummy'}) 

							}]
						}]);

					});
				});
			});
		});
	} else if (obj.target == 'askQR' && obj.code){
		qr.toDataURL(obj.code, function (err, url) {
			const base64Data = url.replace(/^data:image\/png;base64,/, '');
			fs.writeFileSync('./tmp/' + obj.code + '.png', base64Data, 'base64');
			sendTextMessage(sender._id, '受取用QRコードはこちらです！');
			sendAttach(sender._id, 'https://team-surfer.herokuapp.com/' + obj.code + '.png', 'image/png');
		});
	}

}



function receivedImage(sender, img){
	db.getKeepsByMedium(sender._id, function(orgKeeps){
		const keeps = orgKeeps.filter(function(keep){
			return keep.complete == false;
		});
		if (keeps && keeps.length > 0){
			request({
				method: 'GET',
				url: img, 
				encoding: null
			}, function (error, response, body){
				if(!error){
					var tmpFileName = './tmp/' + Math.random().toString(36).slice(-8) + '.png';
					fs.writeFileSync(tmpFileName, body, 'binary');
					let buffer = fs.readFileSync(tmpFileName);
					Jimp.read(buffer, function(err, image) {
						var qrr = new QrCode();
						qrr.callback = function(err1, value) {
							if (err1) {
								console.error(err1);
								sendTextMessage(sender._id, '確認がとれませんでした。再度お試しください。');
							} else {
								const authCode = value.result && value.result.length > 1 ? value.result: '-----';
								db.getKeepByAuthCode(authCode, function(keep2){
									if (keep2 && keep2.complete == false){
										db.completeKeep(keep2, function(){
											db.getUserById(keep2.from, function(userFrom){
												db.getUserById(keep2.medium, function(userMedium){
													db.getUserById(keep2.to, function(userTo){


														sendRich(keep2.to, [{
															title: 'QRコードが認証されました',
															'image_url': keep2.itemUrl,
															subtitle: userMedium.userName + 'さんより、' + userFrom.userName + 'さんからのお荷物を受け取ることができます。',
															buttons: [{
																type: 'postback',
																title: 'なにか困ったときは？',
																payload: JSON.stringify({target: 'dummy'}) 

															}]
														}]);
														sendRich(keep2.medium, [{
															title: 'QRコードが認証されました',
															'image_url': keep2.itemUrl,
															subtitle: userTo.userName + 'さんの本人確認ができました。' + userFrom.userName + 'さんからのお荷物をお渡しください。',
															buttons: [{
																type: 'postback',
																title: 'なにか困ったときは？',
																payload: JSON.stringify({target: 'dummy'}) 

															}]
														}]);
														sendRich(keep2.from, [{
															title: 'お客様のお荷物は、' + userTo.userName + 'さんに受け渡りました',
															'image_url': keep2.itemUrl,
															subtitle: userMedium.userName + 'さんに保管してもらったお荷物は、無事、' + userTo.userName + 'さんの元に渡りました。 一時保管してくれた' + userMedium.userName + 'さんを評価しましょう！',
															buttons: [{
																type: 'postback',
																title: 'フィードバックする',
																payload: JSON.stringify({target: 'dummy'}) 

															}]
														}]);
														

													});
												});
											});


										});
									} else {
										sendTextMessage(sender._id, '確認がとれませんでした。再度お試しください。');
									}
								});

							}
						};
						qrr.decode(image.bitmap);
					});
				} else {
					sendTextMessage(sender._id, '確認がとれませんでした。再度お試しください。');
				}
			});


		} else {
			db.newKeep(sender, img, function(keep){
				sendTextMessage(sender._id, sender.userName + 'さん、登録ありがとうございます。');
				db.getToUsers(function(users){
					sendTextMessage(sender._id, '最終的にどなたにお渡ししたいですか？');
					const toList = users.map(function(user){
						return {
							title: user.userName + ' さん',
							subtitle: 'お渡しする方',
							buttons: [{
								type: 'postback',
								title: user.userName + 'さんに決定',
								payload: JSON.stringify({target: 'selectTo', to: user._id, keep: keep._id}) 
							}]
						};
					}).slice(0, 4);
					sendList(sender._id, toList);
				});
			});

		}

	});
}


function sendTextMessage(senderId, text) {
	const messageData = { text:text }
	request({
		url: 'https://graph.facebook.com/me/messages',
		headers: {Authorization:'Bearer ' + ptoken},
		method: 'POST',
		json: {
			recipient: {id:senderId},
			message: messageData,
		}
	}, 
	function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	});
}

function sendAttach(senderId, url) { 
	const messageData = { 
		attachment: {
			type: 'image', 
			payload: {
				is_reusable: true,
				url: url
			}
		}
	};
	request({
		url: 'https://graph.facebook.com/me/messages',
		headers: {Authorization:'Bearer ' + ptoken},
		method: 'POST',
		json: {
			recipient: {id:senderId},
			message: messageData,
		}		
	}, 
	function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	});
}


function sendList(senderId, els) { 
	const messageData = { 
		attachment: {
			type: 'template', 
			payload: {
				template_type: 'list',
				'top_element_style': 'compact',
				elements: els
			}
		}
	};
	request({
		url: 'https://graph.facebook.com/me/messages',
		headers: {Authorization:'Bearer ' + ptoken},
		method: 'POST',
		json: {
			recipient: {id:senderId},
			message: messageData,
		}
	}, 
	function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	});
}

function sendRich(senderId, els) { 
	const messageData = {
		attachment: {
			type: 'template', 
			payload: {
				template_type: 'generic',
				elements: els
			}
		}
	};
	request({
		url: 'https://graph.facebook.com/me/messages',
		headers: {Authorization:'Bearer ' + ptoken},
		method: 'POST',
		json: {
			recipient: {id:senderId},
			message: messageData,
		}
	}, 
	function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	});
}
