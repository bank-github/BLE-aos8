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
  let count = 0;
  for (k of sensor) {
    if (sensor[count]["deviceClass"].includes('iBeacon') == true && sensor[count]["deviceClass"].includes('arubaBeacon') == false && sensor[count]['rssi'] != null) {
      let data = {
        tagMac: sensor[count]['mac'],
        deviceClass: 'iBeacon',
        rssi: sensor[count]['rssi']['max'],
        timeStamp: new Date().toISOString(),
        major: sensor[count]["beacons"][0]['ibeacon']['major'],
        minor: sensor[count]["beacons"][0]['ibeacon']['minor'],
        location: location
      };
      await add_db(data);
    } else if (sensor[count]["deviceClass"] == 'arubaTag' && sensor[count]['rssi'] != null) {
      let data = {
        tagMac: sensor[count]['mac'],
        deviceClass: 'arubaTag',
        rssi: sensor[count]['rssi']['max'],
        timeStamp: new Date().toISOString(),
        location: location,
        battery: sensor[count]['sensors']['battery']
      };
      await add_db(data);
    } else if (sensor[count]["deviceClass"] == 'eddystone' && sensor[count]['rssi'] != null) {
      let data = {
        tagMac: sensor[count]['mac'],
        deviceClass: 'eddystone',
        rssi: sensor[count]['rssi']['max'],
        timeStamp: new Date().toISOString(),
        location: location,
        dynamicValue: sensor[count]['sensors']['temperatureC']
      };
      await add_db(data);
    } else if (sensor[count]["deviceClass"] == 'unclassified' && sensor[count]['rssi'] != null) {
      let data = {
        tagMac: sensor[count]['mac'],
        deviceClass: 'unclassified',
        rssi: sensor[count]['rssi']['max'],
        timeStamp: new Date().toISOString(),
        location: location,
        dynamicValue: sensor[count]['stats']['frame_cnt']
      };
      await add_db(data);
    } else {
      await add_ap(location);
    }
    count += 1;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function add_ap(location) {
  if (!seenLocations.has(location)) {
    await AccessPoint.findOneAndUpdate(
      { apName: location },
      { $setOnInsert: { apName: location } },
      { upsert: true, new: true }
    );
    // Delay for 100 ms to add apName to db
    await delay(100);
    seenLocations.add(location); // Mark this location as seen
  }
}
async function add_db(data) {
  const location = data.location;
  const tagMac = data.tagMac;
  const deviceClass = data.deviceClass;
  const battery = data.battery || "-";

  // Check if location has already been processed
  if (!seenLocations.has(location)) {
    await AccessPoint.findOneAndUpdate(
      { apName: location },
      { $setOnInsert: { apName: location } },
      { upsert: true, new: true }
    );
    // Delay for 100 ms to add apName to db
    await delay(100);
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
