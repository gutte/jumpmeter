var noble = require('noble');

var lightCharacteristic;
var loggingOn = false;
var readingX=0;
var readingY=64;
var readingZ=0;
var t1=0;
var t2=0;
var t3=0;
var l=0;
var jumpcount=0;

var echologlevel=2;			//how much info the program should output
var jumpresettime = 900; 		//jump reset time in milliseconds





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
						console.log('Jump device found.\nLogging started...');
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
		
		//test for event (takeoff/landing)
		
		//T1 can be initiated anytime
		if (variable == 2){
			if (readingY>96 && data<64){
				t1=timest;
				loginfo="T1 (0)";
			}
		}
		
		//if T1 initiated test for other events
		if (t1 != 0) {
			//landing: y var condition
			if ( (variable == 2) && (readingY<64 && data>96) ){
				l=timest;
				tldiff=l-t1;
				loginfo="L ("+tldiff+")";
				jumpcount++;
			}
			// T2 and T3, z var conditions
			if (variable == 3){
				if (readingZ< -30 && data> -30){
					diff=timest-t1;
					if (diff<200) {
						loginfo="T2 ("+diff+")";
						t2=timest;
						t2diff=diff;
					}
				} else if (readingZ < -15 && data> -15){
					diff=timest-t1;
					if (diff<200) {
						loginfo="T3 ("+diff+")";
						t3=timest;
						t3diff=diff;
					}
				}
			}
		}
		
		//store value **** APPLY REAL TIME SERIES LOGGING HERE ****
		if (variable == 1){
			readingX=data;
		} else if (variable == 2){
			readingY=data;
		} else if (variable == 3){
			readingZ=data;
		}
		
		// output to console
		if (echologlevel==2) {
			console.log(" ",timest, readingX, readingY, readingZ, loginfo);
		} else if ((echologlevel==1) && (l != 0)) {
			console.log(" ",t1, "T1 (0)");
			if (t2 != 0) {
				console.log(" ",t2, "T2 (",t2diff,")");
			}
			if (t3 != 0) {			
				console.log(" ",t3, "T3 (",t3diff,")");
			}
			console.log(" ",timest, loginfo);
		} else if ((echologlevel==0) && (l != 0)) {
			if (t3 != 0 ) {
				tluse=tldiff-t3diff;
				tlmethod=3;
			} else if (t2 != 0 ) {
				tluse=tldiff-t2diff;
				tlmethod=2;
			} else {
				tluse=tldiff;
				tlmethod=1;
			}
			h=getjumpheight(tluse);
			if (jumpcount == 1) {
				console.log(" jump #\t\tt (ms)\t\th (cm)\t\tmethod");
			}
			console.log(" ",jumpcount,"\t\t",tluse,"\t\t",h,"\t\t",tlmethod);
		}
		// reset jump if landed or timeout
		if ((timest-t1 >= jumpresettime) || (l != 0)) {
			jumpreset();
		}
	}
}
function jumpreset(){
	t1=0;
	t2=0;
	t3=0;
	t2diff=0;
	t3diff=0;
	l=0;
	tldiff=0;
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

function getjumpheight(tms) {
	//9.81*(tms/1000)^2/8*100
	return Math.round(9.81*(tms/1000)*(tms/1000)/8*100);
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



// exit program stuff


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


