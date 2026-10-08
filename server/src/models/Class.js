import mongoose from 'mongoose';

const { Schema } = mongoose;

export const ClassSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }
  },
  { timestamps: true }
);

export const Class = mongoose.model('Class', ClassSchema);
export default Class;
