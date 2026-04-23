import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

dotenv.config();
const app = express();

// ---------------- ✅ CORS FIX ----------------
const allowedOrigins = [
  "http://localhost:5173",
  "https://ruhessenza.com"
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("CORS not allowed"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

app.options("*", cors());

// ---------------- MIDDLEWARE ----------------
app.use(express.json());

// ---------------- CLOUDINARY ----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------------- MULTER STORAGE ----------------
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "products",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});
const upload = multer({ storage });

// ---------------- MONGODB ----------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ---------------- MODEL ----------------
const variationSchema = new mongoose.Schema(
  {
    size: String,
    price: Number,
    originalPrice: Number,
    stock: { type: Number, default: 0 },
    image: String,
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: String,
    category: String,
    description: String,
    type: { type: String, enum: ["featured", "combo"], default: "featured" },
    variations: [variationSchema],
    images: [String],
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

// ---------------- ROUTES ----------------

// ✅ ROOT
app.get("/", (req, res) => {
  res.send("🚀 API is running");
});

// ✅ DEBUG ROUTE (VERY IMPORTANT)
app.get("/test", (req, res) => {
  res.send("✅ TEST WORKING");
});

// ✅ GET PRODUCTS
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    console.error("❌ Fetch error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// ✅ ADD PRODUCT
app.post(
  "/api/products",
  upload.fields([
    { name: "images" },
    { name: "variationImages" },
  ]),
  async (req, res) => {
    try {
      const {
        name,
        category,
        description,
        type,
        variations,
        variationImageIndex,
      } = req.body;

      let parsedVariations = JSON.parse(variations);

      const images = (req.files["images"] || []).map(f => f.path);
      const variationImages = req.files["variationImages"] || [];

      const indexes = Array.isArray(variationImageIndex)
        ? variationImageIndex
        : variationImageIndex
        ? [variationImageIndex]
        : [];

      indexes.forEach((idx, i) => {
        if (parsedVariations[idx]) {
          parsedVariations[idx].image = variationImages[i]?.path || "";
        }
      });

      const newProduct = new Product({
        name,
        category,
        description,
        type,
        variations: parsedVariations,
        images,
      });

      await newProduct.save();
      res.status(201).json(newProduct);

    } catch (err) {
      console.error("❌ Save error:", err);
      res.status(500).json({ message: "Failed to add product" });
    }
  }
);

// ✅ UPDATE PRODUCT
app.put(
  "/api/products/:id",
  upload.fields([
    { name: "images" },
    { name: "variationImages" },
  ]),
  async (req, res) => {
    try {
      const {
        name,
        category,
        description,
        type,
        variations,
      } = req.body;

      const parsedVariations = JSON.parse(variations);

      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ message: "Not found" });

      const newImages = (req.files["images"] || []).map(f => f.path);

      product.name = name;
      product.category = category;
      product.description = description;
      product.type = type;
      product.variations = parsedVariations;
      product.images = [...product.images, ...newImages];

      await product.save();
      res.json(product);

    } catch (err) {
      console.error("❌ Update error:", err);
      res.status(500).json({ message: "Failed to update" });
    }
  }
);

// ✅ DELETE PRODUCT
app.delete("/api/products/:id", async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });

    res.json({ message: "Deleted successfully" });

  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).json({ message: "Failed to delete" });
  }
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});