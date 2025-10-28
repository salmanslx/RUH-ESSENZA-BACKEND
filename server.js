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
app.use(
  cors({
    origin: ["http://localhost:8080", "https://ruhessenza.com"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
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
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

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

// ✅ GET all products
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// ✅ POST - Add Product
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

      let parsedVariations;
      try {
        parsedVariations = JSON.parse(variations);
      } catch {
        return res.status(400).json({ message: "Invalid variations JSON format" });
      }

      // Product-level images
      const images = (req.files["images"] || []).map((f) => f.path);

      // Variation images
      const variationImages = req.files["variationImages"] || [];
      const indexes = Array.isArray(variationImageIndex)
        ? variationImageIndex
        : variationImageIndex
        ? [variationImageIndex]
        : [];

      indexes.forEach((idx, i) => {
        const index = Number(idx);
        if (parsedVariations[index]) {
          parsedVariations[index].image = variationImages[i]?.path || "";
        }
      });

      // Ensure stock exists
      parsedVariations = parsedVariations.map((v) => ({
        ...v,
        stock: v.stock ?? 0,
      }));

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
      console.error("Error saving product:", err);
      res.status(500).json({ message: "Failed to add product" });
    }
  }
);

// ✅ PUT - Update Product
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
        variationImageIndex,
      } = req.body;

      let parsedVariations;
      try {
        parsedVariations = JSON.parse(variations);
      } catch {
        return res.status(400).json({ message: "Invalid variations JSON format" });
      }

      const product = await Product.findById(req.params.id);
      if (!product)
        return res.status(404).json({ message: "Product not found" });

      const newImages = (req.files["images"] || []).map((f) => f.path);
      const variationImages = req.files["variationImages"] || [];
      const indexes = Array.isArray(variationImageIndex)
        ? variationImageIndex
        : variationImageIndex
        ? [variationImageIndex]
        : [];

      // Merge variation images
      indexes.forEach((idx, i) => {
        const index = Number(idx);
        if (parsedVariations[index]) {
          parsedVariations[index].image = variationImages[i]?.path || "";
        }
      });

      // Preserve existing images and stock
      parsedVariations = parsedVariations.map((v, i) => ({
        ...v,
        image:
          v.image ||
          (product.variations[i] ? product.variations[i].image : ""),
        stock:
          v.stock !== undefined
            ? v.stock
            : product.variations[i]?.stock || 0,
      }));

      product.name = name;
      product.category = category;
      product.description = description;
      product.type = type;
      product.variations = parsedVariations;

      // Only replace product images if new ones uploaded
      if (newImages.length > 0) product.images = newImages;

      await product.save();
      res.json(product);
    } catch (err) {
      console.error("Error updating product:", err);
      res.status(500).json({ message: "Failed to update product" });
    }
  }
);

// ✅ DELETE - Remove Product
app.delete("/api/products/:id", async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
