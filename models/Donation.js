const mongoose = require('mongoose');

const DonationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['food', 'clothes', 'money'], required: true },
    amount: { type: Number, default: 0 },
    description: { type: String, default: '' },
    donationDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Donation', DonationSchema);
