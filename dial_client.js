var SSDP = require('ssdp').SSDP;
var HTTPParser = process.binding("http_parser").HTTPParser;
var request = require('request');
var util = require('util');
var events = require("events");
var libxmljs = require('libxmljs');

var DIAL_XMLNS = "urn:dial-multiscreen-org:schemas:dial";
var DEVICE_TYPE = 'urn:dial-multiscreen-org:service:dial:1';
var UPNP_XMLNS = "urn:schemas-upnp-org:device-1-0";


function DIALDevice() {
}

DIALDevice.prototype = {
	get_status: function(application, callback) {
		request(this.application_url + application, function(error, response, body) {
			if (error)
				callback(error); return;
			
			if (response.statusCode != 200) {
				console.log(body);
				callback(true); return;
			}
			
			callback(false, this.parse_application_information(body));
			
		}.bind(this));
	},
	
	parse_application_information: function(body) {
		var doc = libxmljs.parseXmlString(body);
		
		var info = {
			name: doc.get("/xmlns:service/xmlns:name", DIAL_XMLNS).text(),
			state: doc.get("/xmlns:service/xmlns:state", DIAL_XMLNS).text()
		};
		
		var allow_stop_attr = doc.get("/xmlns:service/xmlns:options/@allowStop", DIAL_XMLNS);
		if (allow_stop_attr != undefined)
			info.allow_stop = {true:true, false:false}[allow_stop_attr.value()];
		
		var href_attr = doc.get("/xmlns:service/xmlns:link/@href", DIAL_XMLNS);
		if (href_attr != undefined) {
			info.resource_name = href_attr.value();
			info.application_instance_url = this.application_url + application + "/" + info.resource_name;
		}
		
		return info;
	},
	
	start: function(application, parameters, callback) {
		request.post(
			{ uri: this.application_url + application
			, body: parameters
			, headers: { "Content-type": "text/plain" }
			},
			function(error, response, body) {
				if (error)
					return callback(error);
				
				if (response.statusCode != 201)
					return callback(true);
				
				var info = {application_instance_url: response.headers.location};
				callback(false, info);
			}.bind(this)
		);
	},
	
	stop: function(application, callback) {
		if (application.application_instance_url == undefined)
			return callback("Application is not currently stopable.");
		
		request.del(application.application_instance_url,
			function(error, response, body) {
				if (error)
					return callback(error);
				
				if (response.statusCode != 200)
					return callback(true);
				
				callback(false);
			}.bind(this)
		);
	}
};

function DIALClient() {
	events.EventEmitter.call(this);
	
	this.ssdp_client = new SSDP;
	this.monkey_patch_ssdp_client(this.ssdp_client);
	
	this.ssdp_client.on('response', function inResponse(msg, rinfo) {
		// console.log('Got a response to an m-search.');
		// console.log("'" + msg + "'");
		var response = this.parse_http_response(msg);
		var device = new DIALDevice();
		device.upnp_description_url = response.headers["LOCATION"];
		request(device.upnp_description_url, function(error, response, body) {
			if (!error && response.statusCode == 200) {
				device.upnp_description = this.parse_upnp_information(body);
				device.application_url = response.headers["application-url"];
				this.emit("device_discovered", device);
			}
		}.bind(this));
	}.bind(this));
}

util.inherits(DIALClient, events.EventEmitter);

DIALClient.prototype.search = function(host) {
	this.ssdp_client.search_ip(DEVICE_TYPE, host);
};

// Parse a HTTP response.
// This hooks into node's C http parser, which isn't ideal, but gets the
// job done.
DIALClient.prototype.parse_http_response = function(msg) {
	p = new HTTPParser(HTTPParser.RESPONSE);
	var info;
	p.onHeadersComplete = function(_info) {
		info = _info;
	};
	p.onBody = function(buf, start, len) { };
	p.onMessageComplete = function() { };
	p.execute(msg, 0, msg.length);
	p.finish();
	
	var new_headers = {};
	while (info.headers.length) {
		var key = info.headers.shift();
		var value = info.headers.shift();
		new_headers[key]=value;
	}
	info.headers = new_headers;
	
	return info;
};

// Parse some of the fields from an XML UPnP device description.
DIALClient.prototype.parse_upnp_information = function(msg) {
	var doc = libxmljs.parseXmlString(msg);
	
	return {
		friendly_name: doc.get("/xmlns:root/xmlns:device/xmlns:friendlyName", UPNP_XMLNS).text(),
		udn: doc.get("/xmlns:root/xmlns:device/xmlns:UDN", UPNP_XMLNS).text(),
		model_name: doc.get("/xmlns:root/xmlns:device/xmlns:modelName", UPNP_XMLNS).text(),
		manufacturer: doc.get("/xmlns:root/xmlns:device/xmlns:manufacturer", UPNP_XMLNS).text()
	};
};

// Add a search_ip nethod to a ssdp client, which allows specifying an
// interface ip to bind on.
DIALClient.prototype.monkey_patch_ssdp_client = function(ssdp_client) {
	ssdp_client.search_ip = function(st, host) {
		var SSDP_IP = '239.255.255.250';
		var SSDP_PORT = 1900;
		var SSDP_IPPORT = SSDP_IP+':'+SSDP_PORT;
		
		if (host == undefined)
			return this.search(st);
		
		this.sock.bind(SSDP_PORT, host);
		
		var pkt = this.getSSDPHeader('M-SEARCH', {
			HOST: SSDP_IPPORT,
			ST: st,
			MAN: '"ssdp:discover"',
			MX: 3
		});
		pkt = new Buffer(pkt);
		console.log(pkt.toString());
		this.sock.send(pkt, 0, pkt.length, SSDP_PORT, SSDP_IP);
	};
};

module.exports.DIALClient = DIALClient;
module.exports.DIALDevice = DIALDevice;
