const WebSocket = require('ws');
const aruba_telemetry_proto = require('./aruba_iot_proto.js').aruba_telemetry;
const connectDB = require('./mongoConnect.js');
const { AccessPoint, SignalReport, Tags } = require('./model.js');

// set variable to keep each ap location
var seenLocations = new Set();
connectDB();

// สร้าง websockets server ที่ port 3003
const wss = new WebSocket.Server({ port: 3003 });

wss.on('connection', function connection(ws) { // สร้าง connection
  console.log("Aruba Websocket Established");
  ws.on('message', function incoming(message) {
    let telemetryReport = aruba_telemetry_proto.Telemetry.decode(message);
    let myobj = JSON.stringify(telemetryReport);
    let obj = JSON.parse(myobj);

    if (obj["reported"] == null) {
      console.log("AP send message but not have reported");
    } else {
      console.log(obj["reporter"]["name"] + ": " + obj.reported.length);
      console.log(obj.reported);
      add_sensors(obj["reporter"]["name"], obj.reported);
    }
  });

  ws.on('close', function close() {
    console.log('disconnected');
  });

  ws.send('init message to client');
});

async function add_sensors(location, sensor) {
  for (k of sensor) {
    if (k["deviceClass"].includes('iBeacon') == true && k["deviceClass"].includes('arubaBeacon') == false && k['rssi'] != null) {
      let data = {
        tagMac: k['mac'],
        deviceClass: 'iBeacon',
        rssi: k['rssi']['history'],
        timeStamp: new Date().toISOString(),
        major: k["beacons"][0]['ibeacon']['major'],
        minor: k["beacons"][0]['ibeacon']['minor'],
        location: location
      };
      await add_db(location, data);
    } else if (k["deviceClass"] == 'arubaTag' && k['rssi'] != null) {
      let data = {
        tagMac: k['mac'],
        deviceClass: 'arubaTag',
        rssi: k['rssi']['history'],
        timeStamp: new Date().toISOString(),
        location: location,
        battery: k['sensors']['battery']
      };
      await add_db(location, data);
    } else if (k["deviceClass"] == 'eddystone' && k['rssi'] != null) {
      let data = {
        tagMac: k['mac'],
        deviceClass: 'eddystone',
        rssi: k['rssi']['history'],
        timeStamp: new Date().toISOString(),
        location: location,
        dynamicValue: k['sensors']['temperatureC']
      };
      await add_db(location, data);
    } else if (k["deviceClass"] == 'unclassified' && k['rssi'] != null) {
      let data = {
        tagMac: k['mac'],
        deviceClass: 'unclassified',
        rssi: k['rssi']['history'],
        timeStamp: new Date().toISOString(),
        location: location,
        dynamicValue: k['stats']['frame_cnt']
      };
      await add_db(location, data);
    } else {
      await add_ap(location);
      await delay(50)
    }
  }
}

// สร้างฟังก์ชันหน่วงเวลา
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function add_ap(location) {
  // Check if location has already been processed
  if (!seenLocations.has(location)) {
    await AccessPoint.findOneAndUpdate(
      { location: location },
      { $setOnInsert: { location: location } },
      { upsert: true, new: true }
    );
    seenLocations.add(location); // Mark this location as seen
  }
}
async function add_db(location, data) {
  const tagMac = data.tagMac;
  const deviceClass = data.deviceClass;
  const battery = data.battery || "-";

  // Check if location has already been processed
  if (!seenLocations.has(location)) {
    await AccessPoint.findOneAndUpdate(
      { location: location },
      { $setOnInsert: { location: location } },
      { upsert: true, new: true }
    );
    seenLocations.add(location); // Mark this location as seen
  }

  // Always update the battery and deviceClass for the tag
  await Tags.findOneAndUpdate(
    { tagMac: tagMac },
    {
      $set: { battery: battery, deviceClass: deviceClass }
    },
    { upsert: false, new: true } //if not found tag not add to db
  );

  // Insert the signal report
  const newSignalReport = new SignalReport(data);
  await newSignalReport.save();
}
