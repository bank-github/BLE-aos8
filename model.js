const { Timestamp } = require('mongodb');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const accessPoint = new Schema({
    location:        {type: String, require: true}
})

const tags = new Schema({
    mac:             {type: String, require: true},
    assetName:       {type: String,default: "unknow"},
})

//for arubaTags only
const signalReport = new Schema({
    tagMac :         {type: String, require: true},
    location :       {type: String, require: true},
    deviceClass :    {type: String, require: true},
    rssi :           {type: [String], require: true},
    timeStamp :      {type: Date, require: true}
})

const AccessPoint = mongoose.model("accessPoint", accessPoint, "accessPoint");
const Tags = mongoose.model("tags", tags, "tags");
const SignalReport = mongoose.model("SignalReport", signalReport, "SignalReport");

module.exports = { AccessPoint, Tags, SignalReport };