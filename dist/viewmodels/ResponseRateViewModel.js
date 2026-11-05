import mongoose from "mongoose";
;
const ResponseRateSchema = new mongoose.Schema({
    appUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'AppUser', required: true },
    prompt: { type: Number, default: 0 },
    response: { type: Number, default: 0 },
    dateCreated: { type: Date, default: Date.now }
});
const ResponseRate = mongoose.model("ResponseRate", ResponseRateSchema);
export default ResponseRate;
