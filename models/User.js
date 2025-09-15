const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["customer", "restaurant", "admin"],
      default: "customer",
    },
    phone: String,
    address: String,
    emailVerified: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    tokenBlacklist: [String], // For logout functionality
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  
  // Check if password is already hashed (bcrypt hashes start with $2b$)
  if (this.password.startsWith('$2b$') || this.password.startsWith('$2a$')) {
    return next(); // Skip hashing if already hashed
  }
  
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model("User", userSchema);
