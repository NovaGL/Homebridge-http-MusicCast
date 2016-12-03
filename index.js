var Service, Characteristic;
var request = require("request");
var pollingtoevent = require('polling-to-event');

	module.exports = function(homebridge){
		Service = homebridge.hap.Service;
		Characteristic = homebridge.hap.Characteristic;
		homebridge.registerAccessory("homebridge-http", "MusicCast", HttpAccessory);
	}


	function HttpAccessory(log, config) {
		this.log = log;

		// url info
		this.on_url                 = config["on_url"] || this.status_url;
		this.on_body                = config["on_body"];
		this.off_url                = config["off_url"] || this.status_url;
		this.off_body               = config["off_body"];
		this.status_url             = config["musiccast_url"];
		this.brightness_url         = config["brightness_url"] || this.status_url;
		this.brightnesslvl_url      = config["brightnesslvl_url"] || this.status_url;
		this.http_method            = config["http_method"] 	  	 	|| "GET";;
		this.http_brightness_method = config["http_brightness_method"]  || this.http_method;
		this.username               = config["username"] 	  	 	 	|| "";
		this.password               = config["password"] 	  	 	 	|| "";
		this.sendimmediately        = config["sendimmediately"] 	 	|| "";
		this.service                = config["service"] 	  	 	 	|| "Light";
		this.name                   = config["name"] || "MusicCast Device";
		this.brightnessHandling     = config["brightnessHandling"] 	 	|| "yes";
		this.switchHandling 	    = config["switchHandling"] 		 	|| "yes";
		
		//realtime polling info
		this.state = false;
		this.currentlevel = 0;
		this.enableSet = true;
		var that = this;
		
		// Status Polling, if you want to add additional services that don't use switch handling you can add something like this || (this.service=="Smoke" || this.service=="Motion"))
		if (this.status_url && this.switchHandling =="realtime") {
			var powerurl = this.status_url;
			var statusemitter = pollingtoevent(function(done) {
	        	that.httpRequest(powerurl, "", "GET", that.username, that.password, that.sendimmediately, function(error, response, body) {
            		if (error) {
                		that.log('HTTP get power function failed: %s', error.message);
		                callback(error);
            		} else {               				    
						done(null, body);
            		}
        		})
			}, {longpolling:true,interval:300,longpollEventName:"statuspoll"});

		statusemitter.on("statuspoll", function(data) {       
        	var binaryState = parseInt(data.replace(/\D/g,""));
	    	that.state = binaryState > 0;
			that.log(that.service, "received power",that.status_url, "state is currently", binaryState); 
			// switch used to easily add additonal services
			that.enableSet = false;
						if (that.lightbulbService) {
						that.lightbulbService.getCharacteristic(Characteristic.On)
						.setValue(that.state);
					}		
								that.enableSet = true;   
		});

	}
	// Brightness Polling
	if (this.brightnesslvl_url && this.brightnessHandling =="realtime") {
		var brightnessurl = this.brightnesslvl_url;
		var levelemitter = pollingtoevent(function(done) {
	        	that.httpRequest(brightnessurl, "", "GET", that.username, that.password, that.sendimmediately, function(error, response, responseBody) {
            		if (error) {
                			that.log('HTTP get power function failed: %s', error.message);
							return;
            		} else {               				    
						done(null, responseBody);
            		}
        		}) // set longer polling as slider takes longer to set value
    	}, {longpolling:true,interval:300,longpollEventName:"levelpoll"});

		levelemitter.on("levelpoll", function(data) {  
			that.currentlevel = parseInt(data);

			that.enableSet = false;
			if (that.lightbulbService) {				
				that.log(that.service, "received brightness",that.brightnesslvl_url, "level is currently", that.currentlevel); 		        
				that.lightbulbService.getCharacteristic(Characteristic.Brightness)
				.setValue(that.currentlevel);
			}   
			that.enableSet = true;
    	});
	}
	}

	HttpAccessory.prototype = {

	httpRequest: function(url, body, method, username, password, sendimmediately, callback) {
		request({
			url: url,
			body: body,
			method: method,
			rejectUnauthorized: false,
			auth: {
				user: username,
				pass: password,
				sendImmediately: sendimmediately
			}
		},
		function(error, response, body) {
			callback(error, response, body)
		})
	},

	setPowerState: function(powerOn, callback) {
				
	if (this.enableSet == true && (this.currentlevel == 0 || !powerOn )) {
		
		var url;
		var body;
		
		if (!this.status_url) {
				this.log.warn("Ignoring request; No power url defined.");
				callback(new Error("No MusicCast url defined."));
				return;
		}
		
		if (powerOn) {
			var MusicCastOn="/YamahaExtendedControl/v1/main/setPower?power=on";
			url = this.status_url + MusicCastOn ;
			body = this.on_body;
			this.log("Setting power state to on");
		} else {
			var MusicCastOff="/YamahaExtendedControl/v1/main/setPower?power=standby";
			url = this.status_url + MusicCastOff;
			body = this.off_body;
			this.log("Setting power state to off");
		}
		
		this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
			this.log('MusicCast set power function failed: %s', error.message);
			callback(error);
			} else {
			this.log('MusicCast set power function succeeded!');
			callback();
			}
		}.bind(this));
	} else {
	 	callback();
	}
	},
  
  getPowerState: function(callback) {
	if (!this.status_url) {
		this.log.warn("Ignoring request; No status url defined.");
		callback(new Error("No MusicCast url defined."));
		return;
	}
	
	var MusicCaststatus = "/YamahaExtendedControl/v1/main/getStatus";
	var url = this.status_url + MusicCaststatus;
	this.log("Getting power state");
	
	this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
	if (error) {
		this.log('MusicCast get power function failed: %s', error.message);
		callback(error);
	} else {
		var a = JSON.parse(responseBody);
		var power=  a['power'];
		var mapObj = {on:1, standby:0};
		var re = new RegExp(Object.keys(mapObj).join("|"),"gi");
	        binaryState = parseInt(power.replace(re, function(matched){return mapObj[matched];}));
		var powerOn = binaryState > 0;
		this.log("MusicCast Power state is currently %s", binaryState);
		callback(null, powerOn);
	}
	}.bind(this));
  },
	setMute: function(muteOn, callback) {
				
	if (this.enableSet == true && (this.currentlevel == 0 || !muteOn )) {
		
		var url;
		var body;
		
		if (!this.status_url) {
				this.log.warn("Ignoring request; No mute url defined.");
				callback(new Error("No MusicCast url defined."));
				return;
		}
		
		if (muteOn) {
			var MusicCastMuteOn="/YamahaExtendedControl/v1/main/setMute?enable=true";
			url = this.status_url + MusicCastMuteOn ;
			body = this.on_body;
			this.log("Setting mute state to on");
		} else {
			var MusicMuteCastOff="/YamahaExtendedControl/v1/main/setMute?enable=false";
			url = this.status_url + MusicMuteCastOff;
			body = this.off_body;
			this.log("Setting mute state to off");
		}
		
		this.httpRequest(url, body, this.http_method, this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
			this.log('MusicCast set mute function failed: %s', error.message);
			callback(error);
			} else {
			this.log('MusicCast set mute function succeeded!');
			callback();
			}
		}.bind(this));
	} else {
	 	callback();
	}
	},

  getMute: function(callback) {
	if (!this.status_url) {
		this.log.warn("Ignoring request; No status url defined.");
		callback(new Error("No MusicCast url defined."));
		return;
	}
	
	var MusicCaststatus = "/YamahaExtendedControl/v1/main/getStatus";
	var url = this.status_url + MusicCaststatus;
	this.log("Getting power state");
	
	this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
	if (error) {
		this.log('MusicCast get mute function failed: %s', error.message);
		callback(error);
	} else {
		var a = JSON.parse(responseBody);
		var mute=  a['mute'];
		var binaryState  = mute ? 1 : 0;
		var muteOn = binaryState > 0;
		this.log("MusicCast mute state is currently %s", binaryState);
		callback(null, muteOn);
	}
	}.bind(this));
  },

	getBrightness: function(callback) {
		if (!this.status_url) {
			this.log.warn("Ignoring request; No MusicCast url defined.");
			callback(new Error("No MusicCast url defined."));
			return;
		}		
			var MusicCaststatus = "/YamahaExtendedControl/v1/main/getStatus";
			var url = this.status_url + MusicCaststatus;
			this.log("Getting MusicCast Volume level");
	
			this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function(error, response, responseBody) {
			if (error) {
				this.log('MusicCast get Volume function failed: %s', error.message);
				callback(error);
			} else {			
				var a = JSON.parse(responseBody);
				var binaryState = parseInt(a['volume']);
				var level = binaryState;
				this.log("MusicCast Volume is currently %s", binaryState);
				callback(null, level);
			}
			}.bind(this));
	  },

	setBrightness: function(level, callback) {
	if (this.enableSet == true) {
		if (!this.status_url) {
			this.log.warn("Ignoring request; No MusicCast url defined.");
			callback(new Error("No MusicCast url defined."));
			return;
		}    
	
		var MusicCastVolume = "/YamahaExtendedControl/v1/main/setVolume?volume=%b"
		var Volumeurl = this.status_url + MusicCastVolume;
		var url = Volumeurl.replace("%b", level)
	
		this.log("Setting brightness to %s", level);
	
		this.httpRequest(url, "", this.http_brightness_method, this.username, this.password, this.sendimmediately, function(error, response, body) {
		if (error) {
			this.log('MusicCast Volume function failed: %s', error);
			callback(error);
		} else {
			this.log('MusicCast Volume function succeeded!');
			callback();
		}
		}.bind(this));
	} else {
		callback();
	}
	},

	identify: function(callback) {
		this.log("Identify requested!");
		callback(); // success
	},

	getServices: function() {
		
		var that = this;
		
		// you can OPTIONALLY create an information service if you wish to override
		// the default values for things like serial number, model, etc.
		var informationService = new Service.AccessoryInformation();
	
		informationService
		.setCharacteristic(Characteristic.Manufacturer, "Yamaha")
		.setCharacteristic(Characteristic.Model, "MusicCast device")
		.setCharacteristic(Characteristic.SerialNumber, "MusicCast Serial Number");
	
			this.lightbulbService  = new Service.Lightbulb(this.name);			
			//Power Polling
				this.lightbulbService  
				.getCharacteristic(Characteristic.On)
				.on('get', this.getPowerState.bind(this))
				.on('set', this.setPowerState.bind(this));
			// Volume Polling 
				this.lightbulbService  
				.addCharacteristic(new Characteristic.Brightness())
				.on('get', this.getBrightness.bind(this))
				.on('set', this.setBrightness.bind(this));
			// Mute Polling 
				this.lightbulbService  
				.addCharacteristic(new Characteristic.Mute())
				.on('get', this.getMute.bind(this))
				.on('set', this.setMute.bind(this));

	
			return [informationService, this.lightbulbService];		
	}
};
