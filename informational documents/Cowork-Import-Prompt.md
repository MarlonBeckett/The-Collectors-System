# Cowork Prompt for Vehicle Collection Import

Use this prompt with Claude, ChatGPT, or any AI assistant to prepare your vehicle collection for easy import into The Collectors System.

---

## The Prompt

Copy and paste this entire prompt:

---

```
I need help preparing my vehicle collection for import into The Collectors System app.

First, ask me: Do you already have a spreadsheet, list, or document with your vehicle information? Or are we starting from scratch?

---

## IF I HAVE AN EXISTING SPREADSHEET/LIST:

I'll share it with you. Then help me create:

1. **A CSV file** matching The Collectors System's exact format
2. **A ZIP file** with photos organized into folders that exactly match the vehicle names in the CSV (I can drag and drop the ZIP directly into the app)

### CSV Format Required:
Headers (in order): name,make,model,year,vehicle_type,vin,plate_number,mileage,tab_expiration,status,notes,purchase_price,purchase_date,nickname,maintenance_notes

- **name** (REQUIRED): Display name (e.g., "Honda CBR 650 F")
- **make**: Manufacturer (Honda, BMW, Harley, etc.)
- **model**: Model name/number
- **year**: 4-digit year
- **vehicle_type**: motorcycle, car, boat, trailer, or other
- **vin**: Vehicle identification number
- **plate_number**: License plate
- **mileage**: Odometer reading
- **tab_expiration**: Registration expiration (MM/DD/YYYY or YYYY-MM-DD)
- **status**: active, sold, traded, or maintenance
- **notes**: General notes (e.g., "SOLD 7/25/2024 - $12,000")
- **purchase_price**: Numbers only, no $ sign
- **purchase_date**: MM/DD/YYYY or YYYY-MM-DD
- **nickname**: Friendly name (e.g., "Bumblebee")
- **maintenance_notes**: Service history or needs

### ZIP File Structure:
Create a ZIP containing folders for each vehicle. **Folder names must EXACTLY match the "name" column in the CSV.**

Example ZIP contents:
my-photos.zip
├── Honda CBR 650 F/
│   ├── IMG_0001.jpg
│   └── IMG_0002.jpg
├── BMW R1250 GS/
│   └── photo1.png
└── Yamaha Vmax/
    └── side_view.jpg

Photo formats: JPG, PNG, WebP, HEIC (max 10MB each)

---

## IF I'M STARTING FROM SCRATCH:

Ask me about my vehicles one by one. I'll tell you what I have, and you'll create:

1. **A formatted CSV** ready to import
2. **A folder naming checklist** so I can organize my photos into a ZIP

Then after I take photos, help me verify the folder names match exactly before I create the ZIP and upload.

---

## IMPORTANT NOTES:

- Avoid these characters in vehicle names: : / \ ?
- The folder names and CSV names must match EXACTLY for automatic photo matching
- If I already have photos organized in folders, help me rename them to match the CSV
- The app accepts drag-and-drop for both CSV and ZIP files

Let's get started!
```

---

## How to Use

### If You Have an Existing Spreadsheet

1. Copy the prompt above and paste it into your AI assistant
2. Share your spreadsheet, Numbers file, or any list you have
3. The AI will convert it to the correct CSV format
4. If you have photos, the AI will tell you exactly how to organize them into folders
5. Create a ZIP of your photo folders
6. Import the CSV into The Collectors System (drag and drop)
7. Import the ZIP file for photos (drag and drop)

### If You're Starting Fresh

1. Copy the prompt above and paste it into your AI assistant
2. Tell the AI about your vehicles (make, model, year, etc.)
3. The AI will create a CSV file for you
4. The AI will give you a checklist of folder names to create
5. Take photos of your vehicles and put them in the matching folders
6. ZIP up the folders
7. Import the CSV, then import the photo ZIP

---

## Import Steps in The Collectors System

### Step 1: Import Vehicles
1. Go to **Settings > Import Vehicles from CSV** (or the Import page)
2. Drag and drop your CSV file (or tap to select)
3. Map columns if needed (usually auto-detected)
4. Review and import

### Step 2: Import Photos
1. Go to **Settings > Import Photos from ZIP** (or Import page > Photos tab)
2. Select the collection to import into
3. Drag and drop your ZIP file (or tap to select)
4. The app automatically matches folders to vehicles by name
5. Review matches (adjust any that didn't match automatically)
6. Upload

---

## Tips

### Naming Consistency is Key
The magic of easy imports is matching names. If your CSV has:
```
name
Honda CBR 650 F
BMW R1250 GS
```

Your ZIP folders should be:
```
my-photos.zip
├── Honda CBR 650 F/
└── BMW R1250 GS/
```

### Characters to Avoid
Don't use these in vehicle names (they cause issues with folders):
- Colons `:`
- Forward slashes `/`
- Backslashes `\`
- Question marks `?`

### Already Have Photos?
If your photos are already organized in folders, share the folder names with the AI. It can help you either:
- Rename the folders to match a standard CSV format
- Create a CSV where the names match your existing folders

Then just ZIP up the folders and import!

---

## Example CSV

```csv
name,make,model,year,vehicle_type,vin,plate_number,mileage,tab_expiration,status,notes,purchase_price,purchase_date,nickname,maintenance_notes
Honda CBR 650 F,Honda,CBR 650 F,2015,motorcycle,,8D1839,12500,2026-08-12,active,Great commuter bike,5500,2020-03-15,,Oil changed 1/2024
BMW R1250 GS,BMW,R1250 GS,2019,motorcycle,WB10J530XKZF78854,8F5353,28000,2026-06-25,active,Adventure ready,18000,2019-08-01,The Beast,New tires needed
Yamaha Vmax,Yamaha,VMX17,2009,motorcycle,JYAVP29E39A001240,4A8447,15000,2026-05-18,maintenance,Needs work,8000,2021-06-10,,Battery on order
Honda Goldwing,Honda,GL1800,2018,motorcycle,JH2SC7902JK001885,2F0529,838,2026-05-17,sold,SOLD 7/25/2024 - $12000,9500,2022-01-20,,
```
