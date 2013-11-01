DIALClient = require("./dial_client").DIALClient;

client = new DIALClient();

client.on("device_discovered", function(device) {
	console.log(device);
	if (device.upnp_description.udn != "uuid:7d39e4d2-19da-454c-8ef5-9f8768732a3e")
		return;
	
	console.log("Starting on '" + device.upnp_description.friendly_name + "'");
	device.start("TestApp", "key=value", function(error, application) {
		if (error) {
			console.log("error while starting: " + error);
			return;
		}
		
		setTimeout(function() {
			console.log("Stopping on '" + device.upnp_description.friendly_name + "'");
			device.stop(application, function(error) {
				if (error) {
					console.log("Error while stopping: " + error);
				}
			});
		}, 1000);
	});
});

client.search("192.168.2.20");
