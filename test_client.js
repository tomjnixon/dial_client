var vows = require('vows');
var assert = require('assert');

var client = require("./dial_client");
var DIALClient = client.DIALClient;
var DIALDevice = client.DIALDevice;

vows.describe("The DIAL Client").addBatch({
	"A HTTP Response": {
		topic: 
			"HTTP/1.1 200 OK\r\nLOCATION: http://192.168.2.20:51841/dd.xml\r\n" + 
			"CACHE-CONTROL: max-age=1800\r\nEXT:\r\nBOOTID.UPNP.ORG: 1\r\nSERV" +
			"ER: Linux/2.6 UPnP/1.0 quick_ssdp/1.0\r\nST: urn:dial-multiscreen" +
			"-org:service:dial:1\r\nUSN: uuid:deadbeef-dead-beef-dead-beefdead" +
			"beef::urn:dial-multiscreen-org:service:dial:1\r\n\r\n",
		"when parsed": {
			topic: function(http_response) {
				return DIALClient.prototype.parse_http_response(new Buffer(http_response));
			},
			"has a LOCATION header": function(res) {
				assert.equal(res.headers["LOCATION"], "http://192.168.2.20:51841/dd.xml");
			},
			"has the correct status code": function(res) {
				assert.equal(res.statusCode, 200);
			},
			"has an ST header.": function(res) {
				assert.equal(res.headers["ST"], "urn:dial-multiscreen-org:service:dial:1");
			}
		}
	},
	"An application status response while stopped": {
		topic:
			'<?xml version="1.0" encoding="UTF-8"?>\
			<service xmlns="urn:dial-multiscreen-org:schemas:dial">\
				<name>YouTube</name>\
				<options allowStop="true"/>\
				<state>stopped</state>\
			</service>',
		"when parsed": {
			topic: function(response) {
				return DIALDevice.prototype.parse_application_information(response);
			},
			"has a name": function(info) {
				assert.equal(info.name, "YouTube");
			},
			"is in the stopped state": function(info) {
				assert.equal(info.state, "stopped");
			},
			"is allowed to stop": function(info) {
				assert.equal(info.allow_stop, true);
			},
		}
	},
	"An application status response from a Google TV": {
		topic:
			"<?xml version='1.0' encoding='UTF-8'?><service xmlns='urn:dial-multiscreen-org:schemas:dial'><name>YouTube</name><state>stopped</state></service>",
		"when parsed": {
			topic: function(response) {
				return DIALDevice.prototype.parse_application_information(response);
			},
			"has a name": function(info) {
				assert.equal(info.name, "YouTube");
			},
			"is in the stopped state": function(info) {
				assert.equal(info.state, "stopped");
			},
			"has no allow_stop attribute": function(info) {
				assert.isUndefined(info.allow_stop);
			},
		}
	},
	"An UPNP device description": {
		topic:
			'<?xml version="1.0"?><root  xmlns="urn:schemas-upnp-org:device-1-0"  xmlns:r="urn:restful-tv-org:schemas:upnp-dd">  <specVersion>    <major>1</major>    <minor>0</minor>  </specVersion>  <device>    <deviceType>urn:schemas-upnp-org:device:tvdevice:1</deviceType>    <friendlyName>DIAL server sample</friendlyName>    <manufacturer> </manufacturer>    <modelName>NOT A VALID MODEL NAME</modelName>    <UDN>uuid:deadbeef-dead-beef-dead-beefdeadbeef</UDN></device></root>',
		"when parsed": {
			topic: function(dev_desc) {
				return DIALClient.prototype.parse_upnp_information(dev_desc);
			},
			"is an object": function(info) {
				assert.isObject(info);
			},
			"has a friendly name": function(info) {
				assert.equal(info.friendly_name, "DIAL server sample");
			},
			"has an udn.": function(info) {
				assert.equal(info.udn, "uuid:deadbeef-dead-beef-dead-beefdeadbeef");
			},
			"has a model name.": function(info) {
				assert.equal(info.model_name, "NOT A VALID MODEL NAME");
			},
			"has a manufacturer.": function(info) {
				assert.equal(info.manufacturer, " ");
			},
		}
	}
}).export(module);
