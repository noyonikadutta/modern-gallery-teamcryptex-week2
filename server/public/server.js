import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Mongo connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// User schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});
const User = mongoose.model("User", userSchema);

// Serve signup by default
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/register.html"));
});

// Register
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashedPassword });
  await user.save();
  res.send(`<script>alert("Signup successful!"); window.location.href='/login.html';</script>`);
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;   // ✅ get email + password
  const user = await User.findOne({ email }); // ✅ look up by email

  if (!user) {
    return res.send(`<script>alert("Invalid credentials"); window.location.href='/login.html';</script>`);
  }

  const validPass = await bcrypt.compare(password, user.password);
  if (!validPass) {
    return res.send(`<script>alert("Invalid credentials"); window.location.href='/login.html';</script>`);
  }

  // ✅ If everything is fine
  res.send(`<script>alert("Login successful!"); window.location.href='/profile.html';</script>`);
});
