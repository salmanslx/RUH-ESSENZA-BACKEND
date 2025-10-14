import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

dotenv.config();

const app = express();

// ---------------- MIDDLEWARE ----------------
app.use(cors());
app.use(express.json());

// ---------------- CLOUDINARY ----------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "products", // Cloudinary folder
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});
const upload = multer({ storage });

// ---------------- MONGODB ----------------
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// ---------------- MODEL ----------------
const productSchema = new mongoose.Schema(
  {
    name: String,
    category: String,
    description: String,
    type: { type: String, enum: ["featured", "combo"], default: "featured" },
    variations: [
      {
        size: String,
        price: Number,
        originalPrice: Number,
        image: String, // optional variation-specific image
      },
    ],
    images: [String], // Cloudinary URLs
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

// ---------------- ROUTES ----------------

// GET all products
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// POST add product
app.post("/api/products", upload.array("images"), async (req, res) => {
  try {
    const { name, category, description, type, variations } = req.body;
    const parsedVariations = JSON.parse(variations);

    const images = req.files.map((f) => f.path); // Cloudinary URLs

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
    console.error(err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

// PUT update product
app.put("/api/products/:id", upload.array("images"), async (req, res) => {
  try {
    const { name, category, description, type, variations } = req.body;
    const parsedVariations = JSON.parse(variations);

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.name = name;
    product.category = category;
    product.description = description;
    product.type = type;
    product.variations = parsedVariations;

    if (req.files.length > 0) {
      product.images = req.files.map((f) => f.path); // update Cloudinary images
    }

    await product.save();
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update product" });
  }
});

// DELETE product
app.delete("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
