var express = require('express');
var request = require('request');
var hashmap = require('hashmap');
var config = require('config');
var path = require('path');
var bodyParser = require('body-parser');
const readline = require('readline');

var app = express();
var map = new hashmap();

app.use(bodyParser.json({type : ['application/*+json','application/json']}));

// Define the static file path
app.use(express.static(__dirname + '/public'));

var cseURL = "http://"+config.cse.ip+":"+config.cse.port;
var cseRelease = config.cse.release;
var deviceTypes = new hashmap();
var templates = config.templates;
var acpi = {};
var requestNr = 0;
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});							

app.get('/', function (req, res) {
	res.sendFile(path.join(__dirname+'/index.html'));
})

app.get('/templates', function (req, res) {
	res.send(templates);
})

app.get('/devices', function (req, res) {
	var devices =[];
	map.forEach(function(value, key) {
	    devices.push({typeIndex:value.typeIndex,name: key, type: value.type, data: value.data, icon: value.icon,unit:value.unit,stream:value.stream});
  	});
	res.send(devices);
})

app.delete('/devices/:name', function (req, res) {
	map.remove(req.params.name);
	deleteAE(req.params.name);

	res.sendStatus(204);
})

app.post('/devices/:name', function (req, res) {
	let typeIndex = req.query.typeIndex;
	let name = req.params.name;
	let value = req.query.value;
	updateDevice(typeIndex,name,value);

	res.sendStatus(201);
})

app.post('/devices', function (req, res) {
	let typeIndex = req.query.type; 			//type 예: GPS, Lamp, buzzer
	let name = req.query.name;					//name: 사용자가 설정한 가상 디바이스 이름
	var object = {
		typeIndex: typeIndex,
		type: templates[typeIndex].type,
		data: random(templates[typeIndex].min, templates[typeIndex].max),
		icon: templates[typeIndex].icon,
		unit:templates[typeIndex].unit,
		stream:templates[typeIndex].stream
	}
	map.set(name,object);

	createAE(name,typeIndex);
	res.sendStatus(201);
})

app.listen(config.app.port, function () {
	console.log('Simulator API listening on port ' + config.app.port)
})

function listen(name,typeIndex){
	app.post('/S'+name, function (req, res) {

		var req_body = req.body["m2m:sgn"].nev.rep["m2m:cin"];
		if(req_body != undefined) {
			console.log("\n[NOTIFICATION]")
			console.log(req.body["m2m:sgn"].nev.rep["m2m:cin"]);
			var content;
			if (req.body["m2m:sgn"].nev.rep["m2m:cin"].con == "1") {
				content = "1";
			} else {
				content = "0";
			}
			console.log(templates[typeIndex].type + " " + name + " is switched to " + content);

			updateDevice(typeIndex, name, content);
			res.set("X-M2M-RSC", 2000);
			res.status(200);
			if (cseRelease != "1") {
				res.set("X-M2M-RVI", cseRelease);
			}
			res.send();
		}
	});
}

function createAE(name,typeIndex){
	console.log("\n[REQUEST]");
	
		var options = {
		uri: cseURL + "/" + config.cse.name,
		method: "POST",
		headers: {
			"X-M2M-Origin": "S"+name,  				//요청에 대한 식별 값(Unique Request Identifier)
			"X-M2M-RI": "req"+requestNr,			//접근 권한 부여 대상자, ACP(Access Control Policy, 권한 제어) 기능에 사용
			"Content-Type": "application/vnd.onem2m-res+json;ty=2"
		},
		json: { 							//body 부분
			"m2m:ae":
				{
					"rn":name,							//사용자가 정한 기기 이름.
					"api":"app.company.com",			//애플리케이션의 고유한 식별자(Application ID)
					"rr":false							//Mobius로부터 오는 요청에 대한 수신 가능 여부(Request Reachability). 즉, 다른 AE나 oneM2M 서버로부터의 요청을 받을 수 있는 상태인지를 나타냄.
				}
			}
		};

	var rr="false";
	var poa = "";
	// console.log("##############");
	// console.log(templates);
	// console.log(templates[typeIndex]);
	if(templates[typeIndex].stream=="down"){			//stream이 down 일 때만 다른 AE로 부터 요청을 받을 수 있음.
		options.json["m2m:ae"]["rr"] = true;
		options.json["m2m:ae"] = Object.assign(options.json["m2m:ae"], {"poa":["http://" + config.app.ip + ":" + config.app.port + "/" + name]});// options.json["m2m:ae"]라는 객체에 새로운 속성 "poa"를 추가하거나 기존 "poa" 속성을 덮어씀 pointOfAccess
		listen(name,typeIndex)
	}

	console.log("");
	console.log(options.method + " " + options.uri);
	console.log(options.json);

	if(cseRelease != "1") {
		options.headers = Object.assign(options.headers, {"X-M2M-RVI":cseRelease});
		options.json["m2m:ae"] = Object.assign(options.json["m2m:ae"], {"srv":["2a"]});
	}
	
	requestNr += 1;
	request(options, function (err, resp, body) {
		console.log("[RESPONSE]");
		if(err){
			console.log("AE Creation error : " + err);
		} else {
			console.log("AE Creation :" + resp.statusCode);
			if(resp.statusCode==409){
				resetAE(name,typeIndex);
			}else{
				if(config.cse.acp_required) {
					createAccessControlPolicy(name,typeIndex);
				} else {
					createDataContainer(name,typeIndex);
				}
			}
		}
	});
}



function deleteAE(name){
	console.log("\n[REQUEST]");

	var options = {
		uri: cseURL + "/" + config.cse.name + "/" + name,
		method: "DELETE",
		headers: {
			"X-M2M-Origin": "S"+name,
			"X-M2M-RI": "req"+requestNr,
		}
	};

	if(cseRelease != "1") {
		options.headers = Object.assign(options.headers, {"X-M2M-RVI":cseRelease});
	}
	
	requestNr += 1;
	request(options, function (error, response, body) {
		console.log("[RESPONSE]");
		if(error){
			console.log(error);
		}else{			
			console.log(response.statusCode);
			console.log(body);

		}
	});
}

function resetAE(name,typeIndex){
	console.log("\n[REQUEST]");

	var options = {
		uri: cseURL + "/" + config.cse.name + "/" + name,
		method: "DELETE",
		headers: {
			"X-M2M-Origin": "S"+name,
			"X-M2M-RI": "req"+requestNr,
		}
	};

	if(cseRelease != "1") {
		options.headers = Object.assign(options.headers, {"X-M2M-RVI":cseRelease});
	}
	
	requestNr += 1;
	request(options, function (error, response, body) {
		console.log("[RESPONSE]");
		if(error){
			console.log(error);
		}else{			
			console.log(response.statusCode);
			console.log(body);
			createAE(name,typeIndex);
		}
	});
}

function createAccessControlPolicy(name,typeIndex){
	console.log("\n[REQUEST]");
	
	var options = {
		uri: cseURL + "/" + config.cse.name + "/" + name,
		method: "POST",
		headers: {
			"X-M2M-Origin": "S"+name,
			"X-M2M-RI": "req"+requestNr,
			"Content-Type": "application/json;ty=1"
		},
		json: {
			 "m2m:acp": {
				"rn":"MyACP",
				"pv":{
					"acr":[{
						"acor":["all"],
						"acop":63
						}]
					},
				"pvs":{
					"acr":[{
						"acor":["all"],
						"acop":63
						}]
					}
				}
			}
		};

	console.log("");
	console.log(options.method + " " + options.uri);
	console.log(options.json);

	if(cseRelease != "1") {
		options.headers = Object.assign(options.headers, {"X-M2M-RVI":cseRelease});
	}
	
	requestNr += 1;
	request(options, function (error, response, body) {
		console.log("[RESPONSE]");
		if(error){
			console.log(error);
		}else{
			console.log(response.statusCode);
			console.log(body);
		
			acpi = {
				"acpi":[config.cse.name + "/" + name + "/MyACP"]
			}
			createDataContainer(name, typeIndex);
		}
	});
}

function createDataContainer(name,typeIndex){
	console.log("\n[REQUEST]");
	
	var options = {
		uri: cseURL + "/" + config.cse.name + "/" + name,
		method: "POST",
		headers: {
			"X-M2M-Origin": "S"+name,
			"X-M2M-RI": "req"+requestNr,
			"Content-Type": "application/json;ty=3"
		},
		json: {
			"m2m:cnt":{
				"rn":"DATA",
				"mni":10000
			}
		}
	};

	options.json["m2m:cnt"] = Object.assign(options.json["m2m:cnt"], acpi);
	
	console.log("");
	console.log(options.method + " " + options.uri);
	console.log(options.json);

	if(cseRelease != "1") {
		options.headers = Object.assign(options.headers, {"X-M2M-RVI":cseRelease});
	}
	
	requestNr += 1;
	request(options, function (error, response, body) {
		console.log("[RESPONSE]");
		if(error){
			console.log(error);
		}else{
			console.log(response.statusCode);
			console.log(body);
		
			createContentInstance(name,typeIndex,fire);

			if(templates[typeIndex].stream=="up"){
				var fire = setInterval(function() {
					createContentInstance(name,typeIndex,fire);
				}, templates[typeIndex].freq*1000);
			} else if(templates[typeIndex].stream=="down"){
				createCommandContainer(name,typeIndex);	
			}
		
		}
	});
}

function createCommandContainer(name,typeIndex){
	console.log("\n[REQUEST]");
	
	var options = {
		uri: cseURL + "/" + config.cse.name + "/" + name,
		method: "POST",
		headers: {
			"X-M2M-Origin": "S"+name,
			"X-M2M-RI": "req"+requestNr,
			"Content-Type": "application/json;ty=3"
		},
		json: {
			"m2m:cnt":{
				"rn":"COMMAND",
				"mni":10000
			}
		}
	};

	options.json["m2m:cnt"] = Object.assign(options.json["m2m:cnt"], acpi);
	
	console.log("");
	console.log(options.method + " " + options.uri);
	console.log(options.json);

	if(cseRelease != "1") {
		options.headers = Object.assign(options.headers, {"X-M2M-RVI":cseRelease});
	}
	
	requestNr += 1;
	request(options, function (error, response, body) {
		console.log("[RESPONSE]");
		if(error){
			console.log(error);
		}else{
			console.log(response.statusCode);
			console.log(body);
		
			createSubscription(name,typeIndex)	
		
		}
	});
}


function updateDevice(typeIndex,name,data){
	var con = data;

	var object = {
		typeIndex: typeIndex,
		type: templates[typeIndex].type,
		data: con,
		icon: templates[typeIndex].icon,
		unit: templates[typeIndex].unit,
		stream:templates[typeIndex].stream
	}

		console.log("\n[REQUEST]");

		map.set(name,object);

		var options = {
			uri: cseURL + "/" + config.cse.name + "/" + name + "/DATA",
			method: "POST",
			headers: {
				"X-M2M-Origin": "S"+name,
				"X-M2M-RI": "req"+requestNr,
				"Content-Type": "application/json;ty=4"
			},
			json: {
				"m2m:cin":{
					"con": con
				}
			}
		};
	
		console.log("");
		console.log(options.method + " " + options.uri);
		console.log(options.json);

		if(cseRelease != "1") {
			options.headers = Object.assign(options.headers, {"X-M2M-RVI":cseRelease});
		}
		
		requestNr += 1;
		request(options, function (error, response, body) {
			console.log("[RESPONSE]");
			if(error){
				console.log(error);
			}else{
				console.log(response.statusCode);
				console.log(body);
			}
		});

}

function createContentInstance(name,typeIndex,fire){
	var con;
    if (templates[typeIndex].type === "GPS") {
        // Retrieve previous GPS value from map.get(name).data
        var prevGPSData = map.get(name).data;
        var prevLatitude, prevLongitude;

        // Check if previous GPS data exists
        if (prevGPSData) {
            var prevGPSValue = JSON.parse(prevGPSData);
            prevLatitude = parseFloat(prevGPSValue.latitude);
            prevLongitude = parseFloat(prevGPSValue.longitude);
        } else {
            // Initialize to default values if no previous data
			prevLatitude = Math.random() * 180 - 90;
			prevLongitude = Math.random() * 360 - 180;
        }

        var maxdelta = templates[typeIndex].maxdelta; // in meters

        // Generate random angle in radians
        var angle = Math.random() * 2 * Math.PI;

        // Generate random distance within maxdelta using square root for uniform distribution
        var u = Math.random();
        var distance = maxdelta * Math.sqrt(u); // in meters

        // Calculate deltaX and deltaY in meters
        var deltaX = distance * Math.cos(angle);
        var deltaY = distance * Math.sin(angle);

        // Convert deltaX and deltaY to degrees
        var deltaLatitude = deltaY / 111000; // Approximate meters per degree latitude
        var deltaLongitude = deltaX / (111000 * Math.cos(prevLatitude * Math.PI / 180)); // Adjust for longitude

        // Calculate new latitude and longitude
        var latitude = prevLatitude + deltaLatitude;
        var longitude = prevLongitude + deltaLongitude;

        // Ensure latitude is between -90 and 90 degrees
        if (latitude > 90) latitude = 90 - (latitude - 90);
        if (latitude < -90) latitude = -90 - (latitude + 90);

        // Ensure longitude is between -180 and 180 degrees
        if (longitude > 180) longitude = -180 + (longitude - 180);
        if (longitude < -180) longitude = 180 + (longitude + 180);

        con = { latitude: latitude, longitude: longitude };
        con = JSON.stringify(con); // JSON to string
	} else {
        con = random(templates[typeIndex].min, templates[typeIndex].max).toString();
    }
	var object = {
		typeIndex: typeIndex,
		type: templates[typeIndex].type,
		data: con,
		icon: templates[typeIndex].icon,
		unit: templates[typeIndex].unit,
		stream:templates[typeIndex].stream
	}
	if(map.has(name)){
		console.log("\n[REQUEST]");

		map.set(name,object);
		
		var options = {
			uri: cseURL + "/" + config.cse.name + "/" + name + "/DATA",
			method: "POST",
			headers: {
				"X-M2M-Origin": "S"+name,
				"X-M2M-RI": "req"+requestNr,
				"Content-Type": "application/json;ty=4"
			},
			json: {
				"m2m:cin":{
					"con": con
				}
			}
		};
	
		console.log("");
		console.log(options.method + " " + options.uri);
		console.log(options.json);

		if(cseRelease != "1") {
			options.headers = Object.assign(options.headers, {"X-M2M-RVI":cseRelease});
		}
	
		requestNr += 1;
		request(options, function (error, response, body) {
			console.log("[RESPONSE]");
			if(error){
				console.log(error);
			}else{
				console.log(response.statusCode);
				console.log(body);
			}
		});

	}else{
		clearInterval(fire);
	}


}

function createSubscription(name,typeIndex){
	console.log("\n[REQUEST]");

	var options = {
		uri: cseURL + "/" + config.cse.name + "/" + name + "/COMMAND",
		method: "POST",
		headers: {
			"X-M2M-Origin": "S"+name,
			"X-M2M-RI": "req"+requestNr,
			"Content-Type": "application/json;ty=23"
		},
		json: {
			"m2m:sub": {
				"rn": "sub",
				"nu": ["http://"+config.app.ip+":"+config.app.port+"/"+"S"+name+"?ct=json"],
				"nct": 2,
				"enc": {
					"net": [3]
				}
			}
		}
	};

	console.log("");
	console.log(options.method + " " + options.uri);
	console.log(options.json);

	if(cseRelease != "1") {
		options.headers = Object.assign(options.headers, {"X-M2M-RVI":cseRelease});
	}
	
	requestNr += 1;
	request(options, function (error, response, body) {
		console.log("[RESPONSE]");
		if(error){
			console.log(error);
		}else{
			console.log(response.statusCode);
			console.log(body);
		}
	});
}

function random(min, max) { 
	return Math.floor(Math.random() * (max - min + 1) + min);
}