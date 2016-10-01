# homebridge-http-musiccast

Supports MusicCast devices on the HomeBridge Platform.

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install homebridge-http using: npm install -g homebridge-http-musiccast
3. Update your configuration file. See sample-config.json in this repository for a sample. 

# Configuration

Set and forget setup for MusicCast support on Homebridge, very rough at the moment. Currently supports on\off and volume.

Configuration sample:

 ```
"accessories": [ 
	{
            "accessory":      	"MusicCast",
            "name":           	"YSP-1600 Lounge",	  
	    "musiccast_url":  	"http://192.168.1.35"		
          }    ]
```
