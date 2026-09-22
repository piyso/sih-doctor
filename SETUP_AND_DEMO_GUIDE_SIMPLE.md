# 🏛️ AIIA Hospital OS — Simple Step-by-Step Setup & Demo Guide
### Smart India Hackathon 2026 | Problem Statement ID: 26047
**All India Institute of Ayurveda (AIIA), Ministry of Ayush & MoHFW, Govt of India**

---

## 🚀 Part 1: How to Start the System (Only 2 Steps!)

You do not need to configure databases, servers, or complex cloud tools. Everything runs locally on your PC.

### Step 1: Start the Servers

- **On a Windows PC / Laptop:**
  - Open the project folder in File Explorer.
  - **Double-click on `start.bat`** (or `run.bat`).
  - *A black terminal window will open, check everything automatically, and start the system.*

- **On a Mac / Apple Laptop:**
  - Open Terminal in the project folder.
  - Type:
    ```bash
    ./start.sh
    ```
  - Press **Enter**.

---

### Step 2: Open the Website in Your Browser

Open any web browser (Google Chrome, Microsoft Edge, Safari, Brave, or Firefox) and go to this exact address:

👉 **`http://localhost:5173/`**

You will see the **AIIA Hospital OS Gateway**. That’s it! The whole hospital system is now running on your computer.

---

### 📱 Step 3 (Optional): How to Open on Your Mobile Phone or iPad

If you want to show judges that it works seamlessly on a phone or tablet:

1. Connect your phone to the **same Wi-Fi or Mobile Hotspot** as your laptop.
2. Look at the terminal window on your laptop screen.
3. It will display a line that looks like this:
   ```text
   Mobile Wi-Fi Access: http://10.241.19.238:5173
   ```
4. Open the web browser on your phone (Safari or Chrome) and type that exact address shown on your screen.

---

## 🧭 Part 2: The 6 Hospital Screens Explained in Simple Words

Once you open `http://localhost:5173/`, you can switch between screens using the buttons or by pressing keys **1 to 6** on your keyboard:

| Key | Hospital Screen | What It Is For (Simple Words) |
| :---: | :--- | :--- |
| <kbd>1</kbd> | **🖥️ Patient MediKiosk** | The ATM-style touch screen in the hospital lobby. Patients enter their name, tap the 3D body map where they feel pain, answer 3 quick questions, and receive an instant token slip with an ABHA QR code. |
| <kbd>2</kbd> | **🩺 Doctor Clinical Cockpit** | The computer screen on the doctor's desk. The doctor sees the patient in the queue, clicks to open their file, turns on the microphone for real-time speech transcription, and prescribes medicines. |
| <kbd>3</kbd> | **💊 Dispensary Pharmacy POS** | The pharmacy counter screen. The pharmacist scans the prescription barcode, verifies medicine safety, and prints dosage labels. |
| <kbd>4</kbd> | **📱 Frontline ASHA Field App** | The mobile app for rural healthcare workers (ASHA/ANM) visiting villages. Works 100% offline without internet. |
| <kbd>5</kbd> | **📊 Command & Outbreak NOC** | The hospital director’s dashboard. Shows live room traffic, doctor workload, and disease outbreak warnings. |
| <kbd>6</kbd> | **🛡️ System Defense Matrix** | The technical audit screen for judges to verify zero-cloud privacy and cryptographic security proofs. |

---

## 🎬 Part 3: The 3-Minute Live Demo to Show Judges

Follow these exact steps during your presentation:

### 1. The Patient Lobby (Press <kbd>1</kbd>)
- Go to the **Patient MediKiosk** (`http://localhost:5173/?mode=kiosk`).
- Choose a language (e.g., English or Hindi).
- Type the patient's name: **Rajesh Sharma**, Age: **45**, Gender: **Male**.
- Tap on the **Chest** on the 3D body mannequin and pick **Severe chest pain radiating to left arm**.
- Click **Generate OPD Token**.
- *Show the judges the generated token slip with the official Indian National Emblem and ABHA QR code.*

### 2. The Doctor’s Room (Press <kbd>2</kbd>)
- Switch to the **Doctor Desk** (`http://localhost:5173/?mode=doctor`).
- Notice that **Rajesh Sharma is already in the live patient queue** with a red **Urgent / Emergency** alert!
- Click on Rajesh Sharma to open his case file. All details from the kiosk are already filled in!
- Click **Start Ambient Recording** and speak a few words into your laptop microphone to show live audio transcription.

### 3. The Medicine Safety Alarm (Lethal Clash Interlock)
- In the prescription box, add an Allopathic medicine: **Warfarin** (blood thinner).
- Then add an Ayurvedic medicine: **Yogaraja Guggulu**.
- **A bright red warning box will pop up immediately!**
  - It warns: *⚠️ Severe Internal Bleeding Risk: Warfarin interacts dangerously with Guggul.*
- *Explain to the judges that our system catches lethal herb-drug interactions in under 1 millisecond.*
- Remove Yogaraja Guggulu and replace it with safe Ayurvedic medicine: **Shallaki**.

### 4. Print the Official Prescription (Press <kbd>Spacebar</kbd>)
- Click **Complete & Print Rx** (or press Spacebar).
- An official, government-formatted **AIIA Prescription Slip** appears with doctor signatures, classical Ayurvedic dosage instructions, and cryptographic verification!

### 5. The Pharmacy & Executive Dashboard (Press <kbd>3</kbd> and <kbd>5</kbd>)
- Show the **Pharmacy POS** (<kbd>3</kbd>) to demonstrate barcode dispensing.
- Show the **Command Center NOC** (<kbd>5</kbd>) to show live hospital heatmaps.

---

## ❓ Frequently Asked Questions & Quick Help

#### Q1: How do I stop the servers when I am done?
**Answer:** Go to the black terminal window and press **`Ctrl + C`**.

#### Q2: What if it says "port 8001 or 5173 is in use"?
**Answer:** The startup script (`start.sh` or `start.bat`) automatically frees these ports for you. Simply close any other terminal windows and run `start.bat` or `./start.sh` again.

#### Q3: Does this require internet during the presentation?
**Answer:** **No.** The entire system is 100% sovereign and air-gapped. It runs on a high-speed local database (SQLite WAL) directly on your laptop. You can run the entire presentation in Airplane Mode!
