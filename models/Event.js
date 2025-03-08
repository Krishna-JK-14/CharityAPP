const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    location: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    volunteers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    images: [{ type: String }]
});

module.exports = mongoose.model('Event', EventSchema);
