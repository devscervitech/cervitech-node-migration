import mongoose, { Schema } from 'mongoose';
const ResponseRateSchema = new Schema({
    appUserId: { type: Number, required: true },
    prompt: { type: Number, required: true },
    response: { type: Number, required: true },
    dateCreated: { type: Date, default: Date.now },
});
const ResponseRate = mongoose.model('ResponseRate', ResponseRateSchema);
export default ResponseRate;
