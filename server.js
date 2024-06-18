var mysql = require('mysql');
const WebSocket = require('ws');
const protobuf = require('protobufjs');
const aruba_telemetry_proto = require('./aruba_iot_proto.js').aruba_telemetry;
const connectDB = require('./mongoConnect.js');
const { AccessPoint, Tags, SignalReport } = require('./model.js');


const seenLocations = new Set();
connectDB();

const wss = new WebSocket.Server({ port: 3003 });

// สร้าง websockets server ที่ port 4000
wss.on('connection', function connection(ws) { // สร้าง connection
  console.log("Aruba Websocket Established");
  ws.on('message', function incoming(message) {

    // รอรับ data อะไรก็ตาม ที่มาจาก client แบบตลอดเวลา
    //console.log('received: %s', message);
    let telemetryReport = aruba_telemetry_proto.Telemetry.decode(message);
    //telemetryReport.toJSON();
    let myobj = JSON.stringify(telemetryReport);
    let obj = JSON.parse(myobj);
    //console.log(myobj);

    if (obj["reported"] == null) {
      console.log("AP not reported ");
    } else {
      console.log(myobj);
      console.log(obj["reporter"]["name"]);
      //console.log(obj["reporter"]["ipv4"]);
      console.log(obj["reported"]);
      //console.log(obj.reported);
      add_sensors(obj["reporter"]["name"], obj.reported);
    }
    //console.log(telemetryReport.body);
  });
  ws.on('close', function close() {
    // จะทำงานเมื่อปิด Connection ในตัวอย่างคือ ปิด Browser
    console.log('disconnected');
  });
  ws.send('init message to client');
  // ส่ง data ไปที่ client เชื่อมกับ websocket server นี้
});
async function beacon(report) {
  var c = 0;
  for (k of report) {
    c += 1;
    console.log(c);
    console.log(k.beacons);
  }
}

async function add_sensors(location, sensor) {
  // await beacon(sensor);
  console.log(sensor.length);
  let count = 0;
  for (k of sensor) {
    if (sensor[count]["deviceClass"].includes('iBeacon') == true && sensor[count]["deviceClass"].includes('arubaBeacon') == false && sensor[count]['rssi'] != null) {
      let data = {
        mac: sensor[count]['mac'],
        deviceClass: 'iBeacon',
        rssi: sensor[count]['rssi']['history'],
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
        rssi: sensor[count]['rssi']['history'],
        timeStamp: new Date().toISOString(),
        location: location
      };
      await add_db(data);
    } else if (sensor[count]["deviceClass"] == 'eddystone' && sensor[count]['rssi'] != null) {
      let data = {
        mac: sensor[count]['mac'],
        deviceClass: 'eddystone',
        rssi: sensor[count]['rssi']['history'],
        timeStamp: new Date().toISOString(),
        location: location,
        dynamicValue: sensor[count]['sensors']['temperatureC']
      };
      await add_db(data);
    } else if (sensor[count]["deviceClass"] == 'unclassified' && sensor[count]['rssi'] != null) {
      let data = {
        mac: sensor[count]['mac'],
        deviceClass: 'unclassified',
        rssi: sensor[count]['rssi']['history'],
        timeStamp: new Date().toISOString(),
        location: location,
        dynamicValue: sensor[count]['stats']['frame_cnt']
      };
      await add_db(data);
    }
    count += 1;
  }
}

// const data = require('./BLE.SignalReport.json');
// getdata(data);
// async function getdata(data){
//  for(dt of data){
//   const newData = {
//     tagMac: dt.mac,
//     diviceClass: dt.deviceClass,
//     rssi: dt.rssi,
//     timeStamp: dt.timeStamp,
//     location: dt.location
//   }
//   await add_db(newData);
//  }
// }

async function add_db(data) {

  const location = data.location;
  const tagMac = data.tagMac

  // Check if location has already been processed
  if (!seenLocations.has(location)) {
    await AccessPoint.findOneAndUpdate(
      { location: location },
      { $setOnInsert: { location: location } },
      { upsert: true, new: true }
    );
    seenLocations.add(location); // Mark this location as seen
  }
  if (!seenLocations.has(tagMac)) {
    await Tags.findOneAndUpdate(
      { tagMac: tagMac },
      { $setOnInsert: { tagMac: tagMac } },
      { upsert: true, new: true }
    );
    seenLocations.add(tagMac); // Mark this location as seen
  }

  // Insert the signal report
  const newSignalReport = new SignalReport(data);
  await newSignalReport.save();
}

