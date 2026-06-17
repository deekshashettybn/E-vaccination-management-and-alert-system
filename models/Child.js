const mongoose = require("mongoose");

const childSchema = new mongoose.Schema({
  parentPhone: {
    type: String,
    required: true
  },

  childName: {
    type: String,
    required: true
  },

  dob: {
    type: Date,
    required: true
  },

  gender: {
    type: String,
    required: true
  },

  weight: {
    type: Number,
    required: true
  },

  vaccines: [
    {
  vaccineName: String,
  dueDate: Date,
  status: {
    type: String,
    default: "Pending"
  },
  dateGiven: Date
}
  ]

}, { timestamps: true });

module.exports = mongoose.model("Child", childSchema);