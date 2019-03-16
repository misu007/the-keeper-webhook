var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI, { useNewUrlParser: true });


// User Schema
var UserScheme = new Schema({
	_id : String,
	userName : String,
	from: Boolean,
	medium: Boolean,
	to: Boolean,
	created : { 
        type : Date,
        default : Date.now
    }
});
var User = mongoose.model('User', UserScheme);


// Keep Schema
var KeepScheme = new Schema({
	_id : mongoose.Schema.Types.ObjectId,
	from : String,
    medium : String,
    to : String,
    status: String,
    complete: Boolean,
    itemUrl: String,
    authCode: String,
	created : { 
        type : Date,
        default : Date.now
    }
});



var Keep = mongoose.model('Keep', KeepScheme);

module.exports = {
	newUser : function(userName, facebookId, callback){		
		_insertUser(userName, facebookId, callback);		
	},
	getUserById : function(facebookId, callback){
		User.findOne({_id : facebookId}, function(err, user){
			if (callback) callback(user);
		});
	},
	getMediumUsers : function(callback){
		User.find({medium: true}, function(err, users){
			if (callback) callback(users);
		});
	},
	getToUsers : function(callback){
		User.find({to: true}, function(err, users){
			if (callback) callback(users);
		});
	},
	getUserByName : function(userName, callback){
		User.find({userName : userName}, function(err, users){
			if (callback) callback(users);
		});
	},
	newKeep : function(from, itemUrl, callback){
		_insertKeep(from, itemUrl, function(keep){
			if (callback) callback(keep);
		});
	},
	getKeepsByFrom : function(userId, callback){
		Keep.find({from : userId}, function(err, keeps){
			if (callback) callback(keeps);
		});
	},
	getKeepsByMedium : function(userId, callback){
		Keep.find({medium : userId}, function(err, keeps){
			if (callback) callback(keeps);
		});
	},
	getKeepsByTo : function(userId, callback){
		Keep.find({to : userId}, function(err, keeps){
			if (callback) callback(keeps);
		});
	},
	getKeepByAuthCode : function(key, callback){
		try{
			Keep.findOne({authCode : key}, function(err, keep){
				if (err) {
					callback(null);
				} else if (callback){
					callback(keep);
				}
			});
		} catch(ex){
			callback(null);
		}
	},
	setToForKeepById : function(kid, userId, callback){
		Keep.findOneAndUpdate({_id: kid}, {$set:{to:userId}},function(err, keep){
			if (callback) callback(keep);
		});
	},
	setMediumForKeepById : function(kid, userId, callback){
		Keep.findOneAndUpdate({_id: kid}, {$set:{medium:userId}},function(err, keep){
			if (callback) callback(keep);
		});
	},
	approveKeep : function(keep, callback){
		Keep.findOneAndUpdate({_id: keep._id}, {$set:{status:'approved'}},function(err, keep){
			if (callback) callback(keep);
		});
	},
	completeKeep : function(keep, callback){
		Keep.findOneAndUpdate({_id: keep._id}, {$set:{status:'completed', complete: true}},function(err, keep){
			if (callback) callback(keep);
		});
	}

};


function _insertUser(userName, facebookId, callback){
	console.log(userName, facebookId);
	var user = new User({
		_id : facebookId,
		userName : userName,
		from: true,
		medium: true,
		to: true
	});
	user.save(function(err){
		if (err) throw err;
		if (callback) callback(user);
	});
}

function _insertKeep(from, itemUrl, callback){
	var authCode = Math.random().toString(36).slice(-8);
	var keep = new Keep({
		_id : new mongoose.Types.ObjectId(),
		from : from._id,
		itemUrl : itemUrl,
		authCode : authCode,
		complete: false,
		status: 'registered'
	});
	keep.save(function(err){
		if (err) throw err;
		if (callback) callback(keep);
	});
}







