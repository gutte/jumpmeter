var noble = require('noble');

var lightCharacteristic;
var loggingOn = false;
var readingX=0;
var readingY=64;
var readingZ=0;
var takeoff=0;

noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    //
    // Once the BLE radio has been powered on, it is possible
    // to begin scanning for services. Pass an empty array to
    // scan for all services (uses more time and power).
    //
    console.log('Scanning for devices...');
    noble.startScanning(['ffa0'], false);   // ffa0: accelerometer service
  }
  else {
    noble.stopScanning();
  }
})

noble.on('discover', function(peripheral) {
	
	noble.stopScanning();
	//console.log('found peripheral:', peripheral.advertisement);
	/********************************* 
	peripheral = {
	  id: "<id>",
	  address: "<BT address">, // Bluetooth Address of device, or 'unknown' if not known
	  addressType: "<BT address type>", // Bluetooth Address type (public, random), or 'unknown' if not known
	  connectable: <connectable>, // true or false, or undefined if not known
	  advertisement: {
		localName: "<name>",
		txPowerLevel: <int>,
		serviceUuids: ["<service UUID>", ...],
		manufacturerData: <Buffer>,
		serviceData: [
			{
				uuid: "<service UUID>"
				data: <Buffer>
			},
			...
		]
	  },
	  rssi: <rssi>
	};
	*******************************/
	
	//check its connectable then connect
	peripheral.connect(function(err) {
		// discover services
		peripheral.discoverServices(["ffa0",'ffd0'], function(err, services) {
			services.forEach(function(service) {
				//console.log('found service:', service.uuid);
				
				// discover characteristics
				if (service.uuid=='ffa0') {
					service.discoverCharacteristics(["ffa3","ffa4","ffa5"], function(err, characteristics) {
						characteristics.forEach(function(characteristic) {
							switch(characteristic.uuid) {
								case "ffa3":
									var dimension=1;
									break;
								case "ffa4":
									var dimension=2;
									break;
								case "ffa5":
									var dimension=3;
									break;
							}
							var basetime = Date.now()
							characteristic.notify(true, function() {});
							characteristic.on('data', function(data, isNotification) {
								logdata(dimension,data.readInt8(0),Date.now()-basetime);
							});
						});
						console.log('Jump device found. Starting logging!');
						loggingOn=true;
						setTimeout(function () {
							lighton();
						}, 300);

					});
				} else if (service.uuid =='ffd0'){
					service.discoverCharacteristics(["ffd2"], function(err, characteristics) {
						characteristics.forEach(function(characteristic) {
							lightCharacteristic = characteristic ;
						});
					});
				}
			});
		});
	});
});




function errorlog(err) {
	console.log(err);
}

function logdata(variable,data,timest) {
	if (loggingOn) {
		loginfo="";
		if (variable == 1){
			readingX=data;
		}
		if (variable == 2){
			if (readingY>100 && data<60){
				takeoff=timest;
				loginfo="T1 (0)";
			} else if (readingY<30 && data>100) {
				diff=timest-takeoff;
				if (diff<1000) {
					loginfo="L ("+diff+")";
				}
			}
			readingY=data;
		}
		if (variable == 3){
			if (readingZ< -70 && data> -30){
				diff=timest-takeoff;
				if (diff<200) {
					loginfo="T2 ("+diff+")";
				}
			} else if (readingZ < -15 && data> -15){
				diff=timest-takeoff;
				if (diff<200) {
					loginfo="T3 ("+diff+")";
				}
			}
			readingZ=data;
		}
		console.log(" ",timest, readingX, readingY, readingZ, loginfo);
	}
}

function lighton() {
	var light = new Buffer(1);
	light.writeUInt8(1);
	lightCharacteristic.write(light, false, function() {});
}

function lightoff() {
	var light = new Buffer(1);
	light.writeUInt8(0);
	lightCharacteristic.write(light, false, function() {});
}



// service.on('characteristicsDiscover', callback(characteristics));


/*********************
characteristic = {
  uuid: "<uuid>",
   // properties: 'broadcast', 'read', 'writeWithoutResponse', 'write', 'notify', 'indicate', 'authenticatedSignedWrites', 'extendedProperties'
  properties: [...]
};
*************/

// READ & WRITE

// characteristic.read([callback(error, data)]);

// characteristic.write(data, notify[, callback(error)]);


// NOTIFY

// characteristic.notify(notify[, callback(error)]);  //true/false

// characteristic.on('notify', callback(state));

// characteristic.on('data', callback(data, isNotification));



// enter to exit program


var stdin = process.stdin;

// without this, we would only get streams once enter is pressed
stdin.setRawMode( true );

// resume stdin in the parent process (node app won't quit all by itself
// unless an error or process.exit() happens)
stdin.resume();

// i don't want binary, do you?
stdin.setEncoding( 'utf8' );

// on any data into stdin
stdin.on( 'data', function( key ){
  // ctrl-c ( end of text )
  if ( key === '\u0003' ) {
	setTimeout(function () {
		process.exit();
	}, 1000);
	loggingOn=false;
	console.log('Logging stopped');
	lightoff();
    
  }
  // write the key to stdout all normal like
  //process.stdout.write( key );
});


