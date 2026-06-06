import mongoose, { Schema, model } from 'mongoose';

export async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI!);
}

const deviceSchema = new Schema({
  token: { type: String, unique: true, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export const Device = model('Device', deviceSchema);

const seenPostSchema = new Schema({
  postId: { type: String, unique: true, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 },
});

export const SeenPost = model('SeenPost', seenPostSchema);

// Recruit prospects kept for 7 days so the app can browse them in its own tab.
const recruitPostSchema = new Schema({
  postId: { type: String, unique: true, required: true },
  title: String,
  subreddit: String,
  permalink: String,
  url: String,
  source: String,
  created_utc: Number,
  createdAt: { type: Date, default: Date.now, expires: 604800 },
});

export const RecruitPost = model('RecruitPost', recruitPostSchema);
