const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const accessPoint = new Schema({
    apName:          {type: String, require: true},
    location:        {type: String, default: "-"},
    description:     {type: String, default: "-"}
})

const tags = new Schema({
    tagMac:          {type: String, require: true},
    assetName:       {type: String, default: "unknown"},
    deviceClass:     {type: String, require: true},
    description:     {type: String, default: "-"},
    battery:         {type: String, default: "-"}
})

//for arubaTags only
const signalReport = new Schema({
    tagMac :         {type: String, require: true},
    location :       {type: String, require: true},
    deviceClass :    {type: String, require: true},
    rssi :           {type: [{}], require: true},
    timeStamp :      {type: Date, require: true},
    major:           {type: String, default: null},
    minor:           {type: String, default: null},
    dynamicValue:    {type: String, default: null},
    battery:         {type: String, default:"-"}
})

const AccessPoint = mongoose.model("accessPoint", accessPoint, "accessPoint");
const Tags = mongoose.model("tags", tags, "tags");
const SignalReport = mongoose.model("SignalReport", signalReport, "SignalReport");

module.exports = { AccessPoint, Tags, SignalReport };