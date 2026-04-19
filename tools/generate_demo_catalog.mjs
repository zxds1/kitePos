import fs from "node:fs"
import path from "node:path"

const outputDir = path.resolve(process.cwd(), "uza_pos", "assets", "demo_data")
const outputFile = path.join(outputDir, "demo_shops.json")

const retailTemplates = [
  ["Coca-Cola 500ml", "Beverages", "discrete", "beverages", "Coca-Cola", "Bottle", 38, 65],
  ["Fanta Orange 500ml", "Beverages", "discrete", "beverages", "Fanta", "Bottle", 36, 65],
  ["Sprite 500ml", "Beverages", "discrete", "beverages", "Sprite", "Bottle", 36, 65],
  ["Stoney Tangawizi 500ml", "Beverages", "discrete", "beverages", "Stoney", "Bottle", 37, 70],
  ["Dasani Water 1L", "Beverages", "discrete", "beverages", "Dasani", "Bottle", 28, 55],
  ["Minute Maid Mango 1L", "Beverages", "discrete", "beverages", "Minute Maid", "Pack", 84, 135],
  ["Brookside Milk 500ml", "Beverages", "expiry_tracked", "beverages", "Brookside", "Pack", 43, 72],
  ["Delamere Yoghurt 250ml", "Beverages", "expiry_tracked", "beverages", "Delamere", "Bottle", 40, 75],
  ["Tropical Heat Crisps 50g", "Snacks", "discrete", "snacks", "Tropical Heat", "Pack", 30, 55],
  ["Potato Crisps Salted 120g", "Snacks", "discrete", "snacks", "Lays", "Pack", 72, 120],
  ["Salted Peanuts 100g", "Snacks", "discrete", "snacks", "Nut House", "Pack", 45, 90],
  ["Chocolate Cookies 200g", "Snacks", "discrete", "snacks", "Munchys", "Pack", 78, 125],
  ["Mandazi Mix 500g", "Food Staples", "discrete", "snacks", "Unga", "Pack", 72, 120],
  ["Rice Pishori 2kg", "Food Staples", "multi_pack", "cereals", "Pishori", "Bag", 220, 320],
  ["Wheat Flour 2kg", "Food Staples", "multi_pack", "cereals", "Jogoo", "Bag", 120, 185],
  ["Maize Flour 2kg", "Food Staples", "multi_pack", "cereals", "Hostess", "Bag", 118, 182],
  ["Brown Sugar 2kg", "Food Staples", "multi_pack", "cereals", "Mumias", "Bag", 210, 285],
  ["Cooking Oil 1L", "Food Staples", "bulk_liquid", "household", "Golden Fry", "Bottle", 220, 320],
  ["Sunflower Oil 3L", "Food Staples", "bulk_liquid", "household", "Rina", "Bottle", 590, 760],
  ["Table Salt 1kg", "Food Staples", "discrete", "cereals", "Kensalt", "Pack", 34, 55],
  ["Tea Leaves 500g", "Food Staples", "discrete", "cereals", "Kericho Gold", "Pack", 165, 245],
  ["Bathing Soap Twin Pack", "Personal Care", "multi_pack", "personal_care", "Imperial", "Pack", 90, 145],
  ["Toothpaste 150g", "Personal Care", "discrete", "personal_care", "Colgate", "Piece", 85, 140],
  ["Toothbrush Soft", "Personal Care", "discrete", "personal_care", "Aquafresh", "Piece", 48, 85],
  ["Petroleum Jelly 250ml", "Personal Care", "discrete", "personal_care", "Vaseline", "Jar", 150, 230],
  ["Body Lotion 400ml", "Personal Care", "discrete", "personal_care", "Nivea", "Bottle", 250, 395],
  ["Shampoo 400ml", "Personal Care", "bulk_liquid", "personal_care", "Nice & Lovely", "Bottle", 210, 330],
  ["Sanitary Pads 10 Pack", "Personal Care", "discrete", "personal_care", "Always", "Pack", 95, 155],
  ["Laundry Detergent 1kg", "Household", "discrete", "household", "Ariel", "Pack", 165, 245],
  ["Dishwashing Liquid 750ml", "Household", "bulk_liquid", "household", "Axion", "Bottle", 115, 180],
  ["Bar Soap Laundry", "Household", "discrete", "household", "Sunlight", "Piece", 90, 145],
  ["Toilet Paper 10 Roll", "Household", "multi_pack", "household", "Velvex", "Pack", 285, 395],
  ["Kitchen Towels 2 Roll", "Household", "multi_pack", "household", "Rosy", "Pack", 120, 185],
  ["Bleach 1L", "Household", "bulk_liquid", "household", "Jik", "Bottle", 135, 210],
  ["Matchbox 10 Pack", "Household", "multi_pack", "household", "Solo", "Pack", 48, 85],
  ["AA Batteries 4 Pack", "Accessories", "multi_pack", "accessories", "Energizer", "Pack", 135, 220],
  ["Phone Charger Cable", "Accessories", "discrete", "accessories", "Oraimo", "Piece", 180, 320],
  ["Torch LED", "Accessories", "discrete", "accessories", "Generic", "Piece", 230, 380],
  ["Reusable Shopping Bag", "Accessories", "discrete", "accessories", "Storeline", "Piece", 25, 50],
  ["Umbrella Compact", "Accessories", "discrete", "accessories", "RainSafe", "Piece", 280, 450],
]

const cerealsTemplates = [
  ["Pishori Rice 1kg", "Cereals", "bulk_loose", "cereals", "Pishori", "Bag", 110, 170],
  ["Pishori Rice 2kg", "Cereals", "bulk_loose", "cereals", "Pishori", "Bag", 215, 330],
  ["Sindano Rice 1kg", "Cereals", "bulk_loose", "cereals", "Sindano", "Bag", 95, 150],
  ["Basmati Rice 5kg", "Cereals", "bulk_loose", "cereals", "Basmati", "Bag", 560, 780],
  ["Maize Grain 1kg", "Cereals", "bulk_loose", "cereals", "Farm Select", "Bag", 68, 115],
  ["Beans Rosecoco 1kg", "Cereals", "bulk_loose", "cereals", "Farm Select", "Bag", 120, 185],
  ["Beans Wairimu 1kg", "Cereals", "bulk_loose", "cereals", "Farm Select", "Bag", 125, 190],
  ["Green Grams 1kg", "Cereals", "bulk_loose", "cereals", "Farm Select", "Bag", 145, 220],
  ["Black Beans 1kg", "Cereals", "bulk_loose", "cereals", "Farm Select", "Bag", 118, 180],
  ["Red Kidney Beans 1kg", "Cereals", "bulk_loose", "cereals", "Farm Select", "Bag", 135, 205],
  ["Yellow Peas 1kg", "Food Staples", "bulk_loose", "cereals", "Farm Select", "Bag", 105, 160],
  ["Cow Peas 1kg", "Food Staples", "bulk_loose", "cereals", "Farm Select", "Bag", 115, 175],
  ["Ndengu 1kg", "Food Staples", "bulk_loose", "cereals", "Farm Select", "Bag", 150, 230],
  ["Sorghum 1kg", "Food Staples", "bulk_loose", "cereals", "Farm Select", "Bag", 82, 135],
  ["Millet 1kg", "Food Staples", "bulk_loose", "cereals", "Farm Select", "Bag", 130, 205],
  ["Groundnuts 1kg", "Food Staples", "bulk_loose", "cereals", "Farm Select", "Bag", 190, 280],
  ["Cassava Flour 1kg", "Food Staples", "multi_pack", "cereals", "Mama Millers", "Bag", 105, 155],
  ["Sorghum Flour 1kg", "Food Staples", "multi_pack", "cereals", "Mama Millers", "Bag", 110, 165],
  ["Millet Flour 1kg", "Food Staples", "multi_pack", "cereals", "Mama Millers", "Bag", 125, 185],
  ["Wheat Flour 2kg", "Food Staples", "multi_pack", "cereals", "Jogoo", "Bag", 118, 182],
  ["Maize Flour 2kg", "Food Staples", "multi_pack", "cereals", "Hostess", "Bag", 116, 180],
  ["Chapati Flour 2kg", "Food Staples", "multi_pack", "cereals", "Exe", "Bag", 130, 195],
  ["Rice Flour 1kg", "Food Staples", "multi_pack", "cereals", "Mama Millers", "Bag", 145, 210],
  ["Whole Maize 90kg", "Cereals", "bulk_loose", "cereals", "Bulk Farm", "Sack", 4100, 5200],
  ["Pishori Rice 50kg", "Cereals", "bulk_loose", "cereals", "Bulk Farm", "Sack", 5800, 7300],
  ["Beans Mixed 50kg", "Cereals", "bulk_loose", "cereals", "Bulk Farm", "Sack", 6200, 7600],
  ["Sugar 5kg", "Food Staples", "multi_pack", "cereals", "Mumias", "Bag", 560, 735],
  ["Salt 2kg", "Food Staples", "discrete", "cereals", "Kensalt", "Pack", 55, 90],
  ["Tea Leaves 1kg", "Food Staples", "discrete", "cereals", "Kericho Gold", "Pack", 320, 450],
  ["Cooking Oil 5L", "Food Staples", "bulk_liquid", "household", "Rina", "Bottle", 920, 1180],
  ["Sunflower Oil 10L", "Food Staples", "bulk_liquid", "household", "Golden Fry", "Jerrycan", 2100, 2600],
  ["Popcorn Kernels 1kg", "Snacks", "bulk_loose", "cereals", "Farm Select", "Bag", 160, 240],
  ["Green Peas 1kg", "Food Staples", "bulk_loose", "cereals", "Farm Select", "Bag", 140, 210],
  ["Red Lentils 1kg", "Food Staples", "bulk_loose", "cereals", "Farm Select", "Bag", 170, 255],
  ["Oats 1kg", "Food Staples", "discrete", "cereals", "Quaker", "Pack", 210, 320],
  ["Semolina 1kg", "Food Staples", "discrete", "cereals", "Hostess", "Pack", 115, 175],
  ["Soya Chunks 500g", "Food Staples", "discrete", "cereals", "Prosoya", "Pack", 95, 150],
  ["Mixed Cereal Flour 1kg", "Food Staples", "discrete", "cereals", "Uji Power", "Pack", 130, 195],
  ["Dry Green Peas 5kg", "Cereals", "bulk_loose", "cereals", "Bulk Farm", "Bag", 650, 820],
  ["Kidney Beans 5kg", "Cereals", "bulk_loose", "cereals", "Bulk Farm", "Bag", 720, 920],
]

const fashionTemplates = [
  ["Men Crew Neck T-Shirt", "Clothes", "discrete", "fashion_store", "Urban Fit", "Piece", 350, 750],
  ["Women Cotton T-Shirt", "Clothes", "discrete", "fashion_store", "Urban Fit", "Piece", 340, 720],
  ["Slim Fit Jeans", "Fashion", "discrete", "fashion_store", "Denim Co", "Piece", 780, 1450],
  ["Straight Cut Jeans", "Fashion", "discrete", "fashion_store", "Denim Co", "Piece", 790, 1490],
  ["Hoodie Fleece", "Fashion", "discrete", "fashion_store", "Streetline", "Piece", 950, 1650],
  ["Round Neck Sweatshirt", "Fashion", "discrete", "fashion_store", "Streetline", "Piece", 880, 1550],
  ["Polo Shirt", "Clothes", "discrete", "fashion_store", "Classiq", "Piece", 520, 980],
  ["Button Shirt Long Sleeve", "Clothes", "discrete", "fashion_store", "Classiq", "Piece", 690, 1250],
  ["Office Blouse", "Clothes", "discrete", "fashion_store", "Muse", "Piece", 620, 1180],
  ["Maxi Dress", "Fashion", "discrete", "fashion_store", "Muse", "Piece", 980, 1750],
  ["Bodycon Dress", "Fashion", "discrete", "fashion_store", "Muse", "Piece", 890, 1680],
  ["Pleated Skirt", "Fashion", "discrete", "fashion_store", "Muse", "Piece", 620, 1160],
  ["Chino Trousers", "Clothes", "discrete", "fashion_store", "Tailor House", "Piece", 840, 1490],
  ["Cargo Pants", "Clothes", "discrete", "fashion_store", "Tailor House", "Piece", 860, 1520],
  ["School Sweater", "Clothes", "discrete", "fashion_store", "Scholar", "Piece", 720, 1250],
  ["School Shirt", "Clothes", "discrete", "fashion_store", "Scholar", "Piece", 480, 880],
  ["Canvas Sneakers", "Sneakers", "discrete", "footwear", "Stride", "Pair", 980, 1750],
  ["Running Sneakers", "Sneakers", "discrete", "footwear", "Stride", "Pair", 1200, 2200],
  ["Leather Loafers", "Shoes", "discrete", "footwear", "Brogue", "Pair", 1450, 2600],
  ["Casual Sandals", "Sandals", "discrete", "footwear", "Brogue", "Pair", 780, 1450],
  ["Ankle Boots", "Boots", "discrete", "footwear", "Brogue", "Pair", 1650, 2950],
  ["Slides Unisex", "Sandals", "discrete", "footwear", "Brogue", "Pair", 520, 980],
  ["School Shoes", "Shoes", "discrete", "footwear", "Scholar", "Pair", 980, 1850],
  ["Ladies Heels", "Shoes", "discrete", "footwear", "Glam", "Pair", 1150, 2150],
  ["Baseball Cap", "Accessories", "discrete", "accessories", "Streetline", "Piece", 220, 480],
  ["Beanie Knit", "Accessories", "discrete", "accessories", "Streetline", "Piece", 240, 520],
  ["Leather Belt", "Accessories", "discrete", "accessories", "Brogue", "Piece", 260, 560],
  ["Wallet Fold", "Accessories", "discrete", "accessories", "Brogue", "Piece", 320, 650],
  ["Mini Handbag", "Accessories", "discrete", "accessories", "Muse", "Piece", 780, 1450],
  ["Travel Backpack", "Accessories", "discrete", "accessories", "Carryon", "Piece", 980, 1850],
  ["Duffel Bag", "Accessories", "discrete", "accessories", "Carryon", "Piece", 1050, 1980],
  ["Scarf Patterned", "Accessories", "discrete", "accessories", "Muse", "Piece", 220, 520],
  ["Anklet Set", "Accessories", "discrete", "accessories", "Muse", "Piece", 140, 320],
  ["Bracelet Set", "Accessories", "discrete", "accessories", "Muse", "Piece", 150, 340],
  ["Sunglasses Classic", "Accessories", "discrete", "accessories", "Shade", "Piece", 260, 620],
  ["Stud Earrings", "Accessories", "discrete", "accessories", "Shade", "Pair", 180, 420],
  ["Men Socks 3 Pack", "Accessories", "multi_pack", "accessories", "Urban Fit", "Pack", 180, 380],
  ["Women Tights", "Accessories", "discrete", "fashion_store", "Urban Fit", "Piece", 160, 360],
  ["Rain Jacket", "Fashion", "discrete", "fashion_store", "Streetline", "Piece", 980, 1760],
  ["Tracksuit Set", "Fashion", "discrete", "fashion_store", "Streetline", "Set", 1400, 2450],
]

const electronicsTemplates = [
  ["Samsung Galaxy A15 128GB", "Phones", "discrete", "phones", "Samsung", "Piece", 14800, 18999],
  ["Redmi 13C 128GB", "Phones", "discrete", "phones", "Xiaomi", "Piece", 11800, 14999],
  ["Tecno Spark 20 128GB", "Phones", "discrete", "phones", "Tecno", "Piece", 12200, 15499],
  ["Infinix Hot 40i 128GB", "Phones", "discrete", "phones", "Infinix", "Piece", 11500, 14800],
  ["Nokia C32 128GB", "Phones", "discrete", "phones", "Nokia", "Piece", 10900, 13900],
  ["iPhone 13 128GB Preowned", "Phones", "discrete", "phones", "Apple", "Piece", 54000, 67500],
  ["Samsung Galaxy Tab A9", "Tablets", "discrete", "phones", "Samsung", "Piece", 18500, 23999],
  ["Lenovo Tab M10", "Tablets", "discrete", "phones", "Lenovo", "Piece", 21000, 26999],
  ["HP 15 i5 Laptop", "Laptops", "discrete", "laptops", "HP", "Piece", 47500, 58999],
  ["Lenovo Ideapad 3 i5", "Laptops", "discrete", "laptops", "Lenovo", "Piece", 49200, 60999],
  ["Dell Latitude Refurb", "Laptops", "discrete", "laptops", "Dell", "Piece", 36000, 46999],
  ["MacBook Air M1", "Laptops", "discrete", "laptops", "Apple", "Piece", 87500, 104999],
  ["43 Inch Smart TV", "TVs", "discrete", "tvs", "Hisense", "Piece", 28500, 35999],
  ["32 Inch HD TV", "TVs", "discrete", "tvs", "Vitron", "Piece", 13500, 18999],
  ["55 Inch 4K TV", "TVs", "discrete", "tvs", "TCL", "Piece", 46200, 57999],
  ["Sound Bar 2.1", "Audio", "discrete", "audio", "JBL", "Piece", 6200, 8999],
  ["Bluetooth Speaker Mini", "Audio", "discrete", "audio", "Oraimo", "Piece", 2450, 3999],
  ["Over Ear Headphones", "Audio", "discrete", "audio", "JBL", "Piece", 3800, 6499],
  ["Wireless Earbuds", "Audio", "discrete", "audio", "Oraimo", "Piece", 2100, 3999],
  ["Power Bank 20000mAh", "Electronics Accessories", "discrete", "phones", "Anker", "Piece", 2800, 4599],
  ["Charger 20W Fast", "Electronics Accessories", "discrete", "phones", "Oraimo", "Piece", 650, 1499],
  ["USB-C Cable 1m", "Electronics Accessories", "discrete", "phones", "Oraimo", "Piece", 220, 550],
  ["iPhone Lightning Cable", "Electronics Accessories", "discrete", "phones", "Apple", "Piece", 650, 1499],
  ["Phone Cover Silicone", "Electronics Accessories", "discrete", "phones", "CaseMate", "Piece", 180, 450],
  ["Screen Guard Tempered", "Electronics Accessories", "discrete", "phones", "CaseMate", "Piece", 120, 350],
  ["Laptop Backpack", "Electronics Accessories", "discrete", "laptops", "Carryon", "Piece", 980, 1999],
  ["Wireless Mouse", "Electronics Accessories", "discrete", "laptops", "Logitech", "Piece", 820, 1599],
  ["USB Keyboard", "Electronics Accessories", "discrete", "laptops", "Logitech", "Piece", 980, 1899],
  ["Laptop Cooling Pad", "Electronics Accessories", "discrete", "laptops", "Cooler Master", "Piece", 980, 1750],
  ["HDMI Cable 2m", "Electronics Components", "discrete", "tvs", "Generic", "Piece", 260, 650],
  ["Extension Cable 4 Way", "Electronics Components", "discrete", "tvs", "Ailyons", "Piece", 580, 1250],
  ["Smart Watch", "Devices", "discrete", "phones", "Hifuture", "Piece", 2400, 5499],
  ["POS Barcode Scanner", "Devices", "discrete", "phones", "Sunmi", "Piece", 3200, 6499],
  ["Mini Receipt Printer", "Devices", "discrete", "phones", "XPrinter", "Piece", 5800, 8999],
  ["Tablet Stand", "Electronics Accessories", "discrete", "phones", "Ugreen", "Piece", 550, 1200],
  ["Bluetooth Keyboard", "Electronics Accessories", "discrete", "phones", "Logitech", "Piece", 1800, 3499],
  ["WiFi Router", "Devices", "discrete", "tvs", "TP-Link", "Piece", 2350, 3999],
  ["Memory Card 128GB", "Electronics Components", "discrete", "phones", "SanDisk", "Piece", 1200, 2399],
  ["USB Flash Disk 64GB", "Electronics Components", "discrete", "laptops", "SanDisk", "Piece", 520, 1299],
  ["Laptop SSD 512GB", "Electronics Components", "discrete", "laptops", "Kingston", "Piece", 4200, 6999],
]

const wholesaleTemplates = [
  ["Soda Carton 24x300ml", "Beverages", "multi_pack", "wholesale", "Coca-Cola", "Carton", 1380, 1680],
  ["Water Carton 12x1L", "Beverages", "multi_pack", "wholesale", "Dasani", "Carton", 420, 560],
  ["Milk Carton 12x500ml", "Beverages", "multi_pack", "wholesale", "Brookside", "Carton", 520, 690],
  ["Energy Drink Tray", "Beverages", "multi_pack", "wholesale", "Red Bull", "Tray", 1490, 1820],
  ["Crisps Carton 24pcs", "Snacks", "multi_pack", "wholesale", "Tropical Heat", "Carton", 720, 980],
  ["Biscuits Carton 24pcs", "Snacks", "multi_pack", "wholesale", "Munchys", "Carton", 980, 1340],
  ["Groundnuts Sack 25kg", "Food Staples", "bulk_loose", "wholesale", "Bulk Farm", "Sack", 4600, 5900],
  ["Sugar Bale 12x2kg", "Food Staples", "multi_pack", "wholesale", "Mumias", "Bale", 2480, 3120],
  ["Maize Flour Bale 12x2kg", "Food Staples", "multi_pack", "wholesale", "Hostess", "Bale", 1380, 1780],
  ["Wheat Flour Bale 12x2kg", "Food Staples", "multi_pack", "wholesale", "Jogoo", "Bale", 1420, 1820],
  ["Rice Sack 50kg", "Cereals", "bulk_loose", "wholesale", "Pishori", "Sack", 5800, 7200],
  ["Beans Sack 50kg", "Cereals", "bulk_loose", "wholesale", "Bulk Farm", "Sack", 6200, 7600],
  ["Green Grams Sack 50kg", "Cereals", "bulk_loose", "wholesale", "Bulk Farm", "Sack", 7300, 8900],
  ["Cooking Oil Carton 12x1L", "Food Staples", "multi_pack", "wholesale", "Golden Fry", "Carton", 2480, 2990],
  ["Cooking Oil Jerrycan 20L", "Food Staples", "bulk_liquid", "wholesale", "Rina", "Jerrycan", 3600, 4350],
  ["Soap Box 48pcs", "Household", "multi_pack", "wholesale", "Sunlight", "Box", 3050, 3650],
  ["Detergent Carton 12pcs", "Household", "multi_pack", "wholesale", "Ariel", "Carton", 1880, 2440],
  ["Bleach Carton 12x1L", "Household", "multi_pack", "wholesale", "Jik", "Carton", 1480, 1890],
  ["Toilet Paper Bale 40roll", "Household", "multi_pack", "wholesale", "Velvex", "Bale", 1650, 2100],
  ["Kitchen Towel Bale 24roll", "Household", "multi_pack", "wholesale", "Rosy", "Bale", 1780, 2260],
  ["Toothpaste Carton 24pcs", "Personal Care", "multi_pack", "wholesale", "Colgate", "Carton", 1890, 2460],
  ["Toothbrush Box 36pcs", "Personal Care", "multi_pack", "wholesale", "Aquafresh", "Box", 1200, 1680],
  ["Petroleum Jelly Carton", "Personal Care", "multi_pack", "wholesale", "Vaseline", "Carton", 2920, 3680],
  ["Shampoo Carton 12pcs", "Personal Care", "multi_pack", "wholesale", "Nice & Lovely", "Carton", 2120, 2790],
  ["Sanitary Pads Carton", "Personal Care", "multi_pack", "wholesale", "Always", "Carton", 1820, 2380],
  ["AA Batteries Box 24pk", "Accessories", "multi_pack", "wholesale", "Energizer", "Box", 2480, 3050],
  ["Torch Box 12pcs", "Accessories", "multi_pack", "wholesale", "Generic", "Box", 1680, 2200],
  ["Umbrella Bundle 12pcs", "Accessories", "multi_pack", "wholesale", "RainSafe", "Bundle", 2850, 3600],
  ["Phone Cable Box 20pcs", "Electronics Accessories", "multi_pack", "wholesale", "Oraimo", "Box", 2150, 2980],
  ["Charger Box 20pcs", "Electronics Accessories", "multi_pack", "wholesale", "Oraimo", "Box", 4200, 5650],
  ["Power Bank Box 10pcs", "Electronics Accessories", "multi_pack", "wholesale", "Anker", "Box", 18500, 22800],
  ["Phone Cover Bundle 25pcs", "Electronics Accessories", "multi_pack", "wholesale", "CaseMate", "Bundle", 3200, 4200],
  ["Screen Guard Bundle 50pcs", "Electronics Accessories", "multi_pack", "wholesale", "CaseMate", "Bundle", 2500, 3380],
  ["USB Flash Disk Box 20pcs", "Electronics Components", "multi_pack", "wholesale", "SanDisk", "Box", 6800, 8600],
  ["Headphones Box 10pcs", "Audio", "multi_pack", "wholesale", "JBL", "Box", 17800, 22400],
  ["Bluetooth Speaker Box 10pcs", "Audio", "multi_pack", "wholesale", "Oraimo", "Box", 14600, 18500],
  ["Smart TV Shipment 5pcs", "TVs", "multi_pack", "wholesale", "Hisense", "Batch", 136000, 162000],
  ["Laptop Shipment 5pcs", "Laptops", "multi_pack", "wholesale", "HP", "Batch", 228000, 274000],
  ["Smartphone Shipment 10pcs", "Phones", "multi_pack", "wholesale", "Samsung", "Batch", 158000, 198000],
  ["Router Box 12pcs", "Devices", "multi_pack", "wholesale", "TP-Link", "Box", 19800, 24800],
]

const localityPool = [
  "Westlands",
  "Kilimani",
  "Ngara",
  "Embakasi",
  "Ruaka",
  "Syokimau",
  "Kasarani",
  "Kikuyu",
  "Ruiru",
  "Mombasa Road",
]

const industryConfigs = [
  {
    slug: "retail_duka",
    label: "General Retail (Duka)",
    summary: "Everyday FMCG and household essentials.",
    image: "retail_store",
    templates: retailTemplates,
    defaultSupplierCategories: ["general"],
  },
  {
    slug: "cereals_store",
    label: "Cereals Store",
    summary: "Loose grains, flour, and staple food demo flows.",
    image: "cereals",
    templates: cerealsTemplates,
    defaultSupplierCategories: ["cereals", "grains", "food staples"],
  },
  {
    slug: "fashion_retail",
    label: "Fashion Retail",
    summary: "Clothing, footwear, and accessories merchandising.",
    image: "fashion_store",
    templates: fashionTemplates,
    defaultSupplierCategories: ["fashion", "apparel", "footwear"],
  },
  {
    slug: "fashion_vendor",
    label: "Fashion Vendor",
    summary: "Supplier-style fashion catalog with bulk stock turnover.",
    image: "fashion_store",
    templates: fashionTemplates,
    defaultSupplierCategories: ["fashion", "apparel", "footwear"],
  },
  {
    slug: "electronics_retail",
    label: "Electronics Retail",
    summary: "Phones, devices, accessories, and warranty-aware stock.",
    image: "phones",
    templates: electronicsTemplates,
    defaultSupplierCategories: ["electronics", "phones", "devices"],
  },
  {
    slug: "electronics_vendor",
    label: "Electronics Vendor",
    summary: "Supplier-grade electronics and accessories ordering flows.",
    image: "phones",
    templates: electronicsTemplates,
    defaultSupplierCategories: ["electronics", "phones", "devices"],
  },
  {
    slug: "wholesale_supplier",
    label: "Wholesale Supplier",
    summary: "Carton and batch inventory for wholesale simulation.",
    image: "wholesale",
    templates: wholesaleTemplates,
    defaultSupplierCategories: ["wholesale"],
  },
]

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

function sellingUnits(template) {
  const [, , inventoryType, , , purchaseUnit, cost, price] = template
  if (inventoryType === "multi_pack") {
    return [
      { unit: purchaseUnit, price, conversion_value: 1 },
      { unit: "Piece", price: Math.max(15, Math.round(price / 6)), conversion_value: 0.17 },
    ]
  }
  if (inventoryType === "bulk_loose") {
    return [
      { unit: "1kg", price, conversion_value: 1 },
      { unit: "500g", price: Math.round(price * 0.58), conversion_value: 0.5 },
      { unit: "250g", price: Math.round(price * 0.32), conversion_value: 0.25 },
    ]
  }
  if (inventoryType === "bulk_liquid") {
    return [
      { unit: purchaseUnit, price, conversion_value: 1 },
      { unit: "500ml", price: Math.round(price * 0.54), conversion_value: 0.5 },
    ]
  }
  return [{ unit: purchaseUnit, price, conversion_value: 1 }]
}

function buildProduct(industry, shop, template, index, shopIndex) {
  const [name, category, inventoryType, imageKey, brand, purchaseUnit, cost, price] = template
  const id = `${shop.id}-variant-${String(index + 1).padStart(2, "0")}`
  const baseStock = inventoryType === "multi_pack" ? 18 : inventoryType === "bulk_loose" ? 140 : 32
  const stockRemaining = baseStock + ((shopIndex + index) % 9) * (inventoryType === "bulk_loose" ? 8 : 3)
  const lowStockThreshold = inventoryType === "bulk_loose" ? 30 : inventoryType === "multi_pack" ? 6 : 8
  const isFashion = industry.slug.startsWith("fashion")
  const isElectronics = industry.slug.startsWith("electronics")
  const tracksMobile = isElectronics && ["Phones", "Tablets"].includes(category)
  const tracksWarranty = isElectronics && ["Phones", "Tablets", "Laptops", "TVs"].includes(category)
  const sizeOptions = ["S", "M", "L", "XL", "42", "43", "44"]
  const colorOptions = ["Black", "White", "Blue", "Brown", "Red", "Green"]

  return {
    id,
    variant_id: id,
    location_id: shop.locations[0].id,
    name,
    category,
    categories: [category],
    inventory_type: inventoryType,
    brand,
    purchase_unit: purchaseUnit,
    purchase_value: cost,
    cost_per_purchase: cost,
    selling_units: sellingUnits(template),
    stock_remaining: stockRemaining,
    low_stock_threshold: lowStockThreshold,
    is_active: true,
    image_url: `assets/demo_data/images/${imageKey}.jpg`,
    style_code: isFashion ? `${slugify(brand).slice(0, 4).toUpperCase()}-${String(index + 1).padStart(3, "0")}` : null,
    size: isFashion ? sizeOptions[(index + shopIndex) % sizeOptions.length] : null,
    color: isFashion ? colorOptions[(index + shopIndex) % colorOptions.length] : null,
    gender: isFashion ? (index % 2 === 0 ? "unisex" : "women") : null,
    material: isFashion ? (index % 3 === 0 ? "Cotton" : "Poly Blend") : null,
    model_name: isElectronics ? name.replace(/\s+\d.*$/, "") : null,
    storage_capacity: tracksMobile ? (index % 2 === 0 ? "128GB" : "256GB") : null,
    device_condition: isElectronics ? (index % 5 === 0 ? "refurbished" : "new") : null,
    serial_number: isElectronics ? `SF-${shopIndex + 1}${String(index + 1).padStart(4, "0")}-${(900 + index).toString()}` : null,
    imei: tracksMobile ? `3567890${String(shopIndex).padStart(2, "0")}${String(index + 1).padStart(6, "0")}`.slice(0, 15) : null,
    warranty_enabled: tracksWarranty,
    warranty_months: tracksWarranty ? (category === "Laptops" || category === "TVs" ? 12 : 6) : null,
    is_returnable: true,
    return_window_days: tracksWarranty ? 14 : 7,
    created_at: new Date(Date.now() - (index + 3) * 86400000).toISOString(),
    updated_at: new Date(Date.now() - (index % 5) * 43200000).toISOString(),
  }
}

function buildSale(shop, product, index) {
  const sellingUnit = product.selling_units[0]
  const quantity = product.inventory_type === "bulk_loose" ? 2 : 1
  const total = Math.round(sellingUnit.price * quantity)
  return {
    id: `${shop.id}-sale-${String(index + 1).padStart(2, "0")}`,
    shop_id: shop.id,
    location_id: shop.locations[0].id,
    terminal_id: `${shop.id}-terminal-main`,
    payment_method: index % 3 === 0 ? "mpesa" : "cash",
    total_amount: total,
    timestamp: new Date(Date.now() - (index + 1) * 21600000).toISOString(),
    client_transaction_id: `${shop.id}-sale-ctx-${index + 1}`,
    status: "completed",
    sync_status: "synced",
    mpesa_receipt_number: index % 3 === 0 ? `QF${shop.id.slice(-3).toUpperCase()}${1000 + index}` : null,
    amount_paid: total,
    change_due: 0,
    items: [
      {
        variant_id: product.variant_id,
        product_name: product.name,
        inventory_type: product.inventory_type,
        unit_sold: sellingUnit.unit,
        quantity,
        price_per_unit: sellingUnit.price,
        total_price: total,
        deduction_value: sellingUnit.conversion_value * quantity,
        conversion_factor: sellingUnit.conversion_value,
        stock_before: product.stock_remaining + quantity + 3,
        stock_after: product.stock_remaining + 3,
        client_transaction_id: `${shop.id}-sale-item-${index + 1}`,
      },
    ],
  }
}

function buildRestock(shop, product, index) {
  const quantityReceived = product.inventory_type === "bulk_loose" ? 25 : product.inventory_type === "multi_pack" ? 8 : 12
  const costPerUnit = Math.max(1, Math.round(product.cost_per_purchase))
  return {
    id: `${shop.id}-restock-${String(index + 1).padStart(2, "0")}`,
    shop_id: shop.id,
    location_id: shop.locations[0].id,
    variant_id: product.variant_id,
    product_name: product.name,
    purchase_unit: product.purchase_unit,
    purchase_unit_qty: 1,
    quantity_received: quantityReceived,
    cost_per_unit: costPerUnit,
    total_cost: quantityReceived * costPerUnit,
    timestamp: new Date(Date.now() - (index + 2) * 43200000).toISOString(),
    client_transaction_id: `${shop.id}-restock-ctx-${index + 1}`,
    source: "manual",
    supplier_name: shop.is_supplier ? shop.shop_name : `${industryConfigs.find((entry) => entry.slug === shop.shop_type)?.label ?? "Supplier"} Supply Hub`,
    status: "completed",
    sync_status: "synced",
    conversion_snapshot: {
      inventory_type: product.inventory_type,
      purchase_unit: product.purchase_unit,
    },
  }
}

function buildShop(config, shopIndex) {
  const locality = localityPool[shopIndex % localityPool.length]
  const isSupplier = shopIndex >= 5
  const labelRoot = config.label.replace(/\s*\(.+\)/, "")
  const shopName = isSupplier
    ? `${locality} ${labelRoot} Supply ${shopIndex + 1}`
    : `${locality} ${labelRoot} Shop ${shopIndex + 1}`
  const shopId = `${config.slug}-demo-${shopIndex + 1}`
  const locationId = `${shopId}-loc-main`
  const ownerName = isSupplier ? `${labelRoot} Demo Supplier` : `${labelRoot} Demo Owner`
  const ownerPhone = `254700${String(100000 + shopIndex * 37 + config.slug.length).slice(-6)}`
  const shop = {
    id: shopId,
    shop_name: shopName,
    shop_type: config.slug,
    industry_types: [config.slug],
    industry_features: config.slug.startsWith("fashion")
      ? { size_tracking: true, color_tracking: true, brand_tracking: true }
      : config.slug.startsWith("electronics")
        ? { imei_tracking: true, serial_tracking: true, warranty_tracking: true }
        : config.slug === "cereals_store"
          ? { weight_tracking: true, grade_tracking: true }
          : {},
    owner_name: ownerName,
    owner_phone: ownerPhone,
    region_code: "nai",
    ward_code: locality.toLowerCase().replace(/\s+/g, "_"),
    address: `${locality}, Nairobi`,
    business_license: `DEMO-${config.slug.toUpperCase()}-${String(shopIndex + 1).padStart(3, "0")}`,
    consent_given: true,
    accept_mpesa: true,
    mpesa_phone: ownerPhone,
    mpesa_display_name: shopName,
    profile_image_url: `assets/demo_data/images/${config.image}.jpg`,
    current_user: {
      id: `${shopId}-owner`,
      shop_id: shopId,
      role: "owner",
      full_name: ownerName,
      profile_image_url: `assets/demo_data/images/${config.image}.jpg`,
      assigned_location_ids: [locationId],
      assigned_terminal_ids: [`${shopId}-terminal-main`],
      is_active: true,
      is_device_bound: true,
    },
    locations: [
      {
        id: locationId,
        shop_id: shopId,
        name: "Main Branch",
        code: `${config.slug.slice(0, 3).toUpperCase()}-${String(shopIndex + 1).padStart(2, "0")}`,
        address: `${locality}, Nairobi`,
        location_type: "physical",
        is_default: true,
        is_active: true,
        metadata: {
          industry_types: [config.slug],
        },
      },
    ],
    demo_summary: config.summary,
    is_supplier: isSupplier,
    supplier_categories: isSupplier ? config.defaultSupplierCategories : [],
    supplier_description: isSupplier
      ? `${shopName} is a demo supplier workspace with local catalog, order, restock, and analytics simulation.`
      : null,
    storefront_hint: `See how a ${labelRoot.toLowerCase()} shop looks with live products, sales, and stock movement.`,
  }

  const products = config.templates.map((template, index) =>
    buildProduct(config, shop, template, index, shopIndex)
  )
  const sales = products.slice(0, 12).map((product, index) => buildSale(shop, product, index))
  const restocks = products.slice(0, 8).map((product, index) => buildRestock(shop, product, index))

  return {
    ...shop,
    products,
    sales,
    restocks,
  }
}

const shops = industryConfigs.flatMap((config) =>
  Array.from({ length: 10 }, (_, index) => buildShop(config, index))
)

fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(
  outputFile,
  `${JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      shop_count: shops.length,
      category_count: industryConfigs.length,
      shops,
    },
    null,
    2
  )}\n`,
  "utf8"
)

console.log(`Generated ${shops.length} demo shops at ${outputFile}`)
