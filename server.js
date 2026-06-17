const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const User = require("./models/User");
const Child = require("./models/Child");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const nodemailer = require("nodemailer");
const cron = require("node-cron");
const twilio = require("twilio");
dotenv.config();

const app = express();
const otpStore = {};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

// Email setup
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function sendEmail(to, subject, message) {
  try {
    if (!to) return;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text: message
    });

    console.log("✅ Email sent");
  } catch (error) {
    console.log("Email error:", error.message);
  }
}

// Twilio setup
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendSMS(phone, message) {
  try {
    if (!phone) return;

    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${phone}`
    });

    console.log("✅ SMS sent");
  } catch (error) {
    console.log("SMS error:", error.message);
  }
}

// Register
app.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, message: "User already exists" });
    }

    const user = new User({
      name,
      email,
      password,
      phone,
      role: role || "parent"
    });

    await user.save();

    res.json({ success: true, message: "Registration successful" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Registration failed" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    const user = await User.findOne({
      $or: [{ email: email }, { phone: phone }],
      password: password
    });

    if (!user) {
      return res.json({
        success: false,
        message: "Invalid email/phone or password"
      });
    }

    res.json({
      success: true,
      message: "Login successful",
      user
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Login failed" });
  }
});

// Add child
app.post("/children", async (req, res) => {
  try {
    const child = new Child(req.body);
    await child.save();

    res.json({
      success: true,
      message: "Child added successfully",
      child
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Failed to add child" });
  }
});

// Get children of parent
app.get("/children/:parentPhone", async (req, res) => {
  try {
    const children = await Child.find({
      parentPhone: req.params.parentPhone
    });

    res.json(children);
  } catch (error) {
    console.log("Children fetch error:", error);
    res.json([]);
  }
});

// Hospital: get all children
app.get("/hospital/children", async (req, res) => {
  try {
    const children = await Child.find();
    res.json(children);
  } catch (error) {
    console.log(error);
    res.json([]);
  }
});

// Mark vaccine as done + send email and SMS
// Mark vaccine as done + send email and SMS
app.put("/mark-done/:childId/:vaccineIndex", async (req, res) => {
  try {
    const { childId, vaccineIndex } = req.params;

    const child = await Child.findById(childId);

    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }

    const index = Number(vaccineIndex);

    if (isNaN(index) || index < 0 || index >= child.vaccines.length) {
      return res.status(400).json({ message: "Invalid vaccine index" });
    }

    const vaccine = child.vaccines[index];

    const today = new Date();
    const dueDate = new Date(vaccine.dueDate);

    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate > today) {
      return res.status(400).json({
        message: "This vaccine cannot be marked as done before due date"
      });
    }

    child.vaccines[index].status = "Done";
    child.vaccines[index].dateGiven = new Date();

    await child.save();

    const parent = await User.findOne({ phone: child.parentPhone });

    const certificateLink =
      `${process.env.APP_URL}/certificate/${childId}/${index}`;

    const message =
      `${child.childName}'s ${vaccine.vaccineName} vaccination has been completed. Certificate: ${certificateLink}`;

    if (parent && parent.email) {
      await sendEmail(parent.email, "Vaccination Completed", message);
    }

    if (parent && parent.phone) {
      await sendSMS(parent.phone, message);
    }

    res.json({ message: "Vaccine marked as done and alert sent" });

  } catch (error) {
    console.log("Mark done error:", error);
    res.status(500).json({ message: "Failed to mark vaccine as done" });
  }
});

// Certificate generation
app.get("/certificate/:childId/:vaccineIndex", async (req, res) => {
  try {
    const { childId, vaccineIndex } = req.params;
    const child = await Child.findById(childId);

    if (!child) return res.status(404).send("Child not found");

    const index = Number(vaccineIndex);
    const vaccine = child.vaccines[index];

    if (!vaccine || vaccine.status !== "Done") {
      return res.status(400).send("Certificate available only after vaccine is done");
    }

    const verifyUrl = `${process.env.APP_URL}/verify.html?childId=${childId}&vaccineIndex=${index}`;
    const qrImage = await QRCode.toDataURL(verifyUrl);
    const qrBuffer = Buffer.from(qrImage.split(",")[1], "base64");

    const doc = new PDFDocument({ size: "A4", margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${child.childName}-${vaccine.vaccineName}-certificate.pdf`
    );

    doc.pipe(res);

    // Border
    doc.rect(30, 30, 535, 782).lineWidth(2).stroke("#0077b6");
    doc.rect(45, 45, 505, 752).lineWidth(1).stroke("#90e0ef");

    // Header
    doc.fillColor("#0077b6")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("E-VACCINATION MANAGEMENT SYSTEM", 60, 80, {
        width: 475,
        align: "center"
      });

    doc.fillColor("#555")
      .fontSize(11)
      .font("Helvetica")
      .text("Digital Immunization Record & Verification Certificate", 60, 112, {
        width: 475,
        align: "center"
      });

    // Main title
    doc.fillColor("#000")
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("VACCINATION CERTIFICATE", 60, 160, {
        width: 475,
        align: "center"
      });

    doc.moveTo(150, 190).lineTo(445, 190).stroke("#000");

    // Certificate meta
    const certificateNo = `CERT-${child._id.toString().slice(-6).toUpperCase()}-${index}`;

    doc.fillColor("#444")
      .fontSize(10)
      .font("Helvetica")
      .text(`Certificate No: ${certificateNo}`, 75, 215);

    doc.text(`Issued Date: ${new Date().toLocaleDateString()}`, 380, 215);

    // Statement
    doc.fillColor("#222")
      .fontSize(12)
      .text(
        "This is to certify that the following child has received the vaccination recorded below as per the digital records maintained in the E-Vaccination Management System.",
        75,
        255,
        {
          width: 450,
          align: "justify",
          lineGap: 4
        }
      );

    // Details box
    doc.roundedRect(75, 340, 450, 310, 10).lineWidth(1.5).stroke("#0077b6");
    doc.fillColor("#0077b6")
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("Child Details", 95, 360);

    doc.fillColor("#000")
      .fontSize(11)
      .font("Helvetica");

    doc.text(`Child Name      : ${child.childName}`, 95, 395);
    doc.text(`Gender          : ${child.gender}`, 95, 420);
    doc.text(`Date of Birth   : ${new Date(child.dob).toLocaleDateString()}`, 95, 445);
    doc.text(`Weight          : ${child.weight} kg`, 95, 470);
    doc.text(`Parent Phone    : ${child.parentPhone}`, 95, 495);

    doc.fillColor("#0077b6")
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("Vaccination Details", 95, 525);

    doc.fillColor("#000")
      .fontSize(11)
      .font("Helvetica");

    doc.text(`Vaccine Name    : ${vaccine.vaccineName}`, 95, 550);
    doc.text(`Due Date        : ${new Date(vaccine.dueDate).toLocaleDateString()}`, 95, 575);
    doc.text(`Date Given      : ${new Date(vaccine.dateGiven).toLocaleDateString()}`, 95, 600);
    doc.text(`Status          : COMPLETED`, 95, 625);

    // QR + signature
    doc.fillColor("#0077b6")
      .fontSize(13)
      .font("Helvetica-Bold")
      .text("Scan to Verify", 110, 675);

    doc.image(qrBuffer, 105, 695, {
        fit: [100, 100]
    });

    doc.moveTo(350, 755).lineTo(505, 755).stroke("#000");
    doc.fillColor("#000")
      .fontSize(10)
      .font("Helvetica")
      .text("Authorized Hospital Signature", 360, 763);
    doc.fillColor("#777")
      .fontSize(9)
      .text(
        "This certificate is digitally generated and can be verified using the QR code.",
        75,
        785,
        { width: 450, align: "center" }
      );

    doc.end();

  } catch (error) {
    console.log("Certificate error:", error);
    res.status(500).send("Server error");
  }
});
// Test email
app.get("/test-email", async (req, res) => {
  await sendEmail(
    process.env.EMAIL_USER,
    "Test Email",
    "Your E-Vaccination email system is working successfully."
  );

  res.send("Test email executed");
});

// Test SMS
app.get("/test-single-sms", async (req, res) => {
  await sendSMS(
    "9743010470",
    "Your E-Vaccination SMS system is working successfully."
  );

  res.send("Test SMS route executed. Check terminal for SMS status.");
});

// Daily reminder cron
cron.schedule("0 9 * * *", async () => {
  try {
    console.log("⏰ Checking pending vaccines...");

    const children = await Child.find();

    for (const child of children) {

      for (const vaccine of child.vaccines) {

        if (vaccine.status !== "Done") {

          const today = new Date();

          today.setHours(0, 0, 0, 0);

          const dueDate = new Date(vaccine.dueDate);

          dueDate.setHours(0, 0, 0, 0);

          const diffDays =
            Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

          let dayText = "";

          if (diffDays === 3) {
            dayText = "in 3 days";
          } else if (diffDays === 1) {
            dayText = "tomorrow";
          } else if (diffDays === 0) {
            dayText = "today";
          } else {
            continue;
          }

          const parent = await User.findOne({
            phone: child.parentPhone
          });

          if (!parent) continue;

          const message =
            `${child.childName}'s ${vaccine.vaccineName} vaccine is due ${dayText}. Please visit the hospital.`;

          if (parent.email) {
            await sendEmail(
              parent.email,
              "Vaccination Reminder",
              message
            );
          }

          if (parent.phone) {
            await sendSMS(parent.phone, message);
          }

          console.log("Reminder sent");
        }
      }
    }

  } catch (error) {
    console.log("Cron error:", error.message);
  }
});

function generateVaccineSchedule(dob) {
  const birthDate = new Date(dob);

  const addDays = (days) => {
    const date = new Date(birthDate);
    date.setDate(date.getDate() + days);
    return date;
  };

  const addMonths = (months) => {
    const date = new Date(birthDate);
    date.setMonth(date.getMonth() + months);
    return date;
  };

  return [
    { vaccineName: "BCG", dueDate: addDays(0), status: "Pending" },
    { vaccineName: "OPV-0", dueDate: addDays(0), status: "Pending" },
    { vaccineName: "Hepatitis B Birth Dose", dueDate: addDays(0), status: "Pending" },

    { vaccineName: "OPV-1", dueDate: addDays(42), status: "Pending" },
    { vaccineName: "Pentavalent-1", dueDate: addDays(42), status: "Pending" },
    { vaccineName: "Rotavirus-1", dueDate: addDays(42), status: "Pending" },

    { vaccineName: "OPV-2", dueDate: addDays(70), status: "Pending" },
    { vaccineName: "Pentavalent-2", dueDate: addDays(70), status: "Pending" },
    { vaccineName: "Rotavirus-2", dueDate: addDays(70), status: "Pending" },

    { vaccineName: "OPV-3", dueDate: addDays(98), status: "Pending" },
    { vaccineName: "Pentavalent-3", dueDate: addDays(98), status: "Pending" },
    { vaccineName: "Rotavirus-3", dueDate: addDays(98), status: "Pending" },

    { vaccineName: "Measles Rubella-1", dueDate: addMonths(9), status: "Pending" },
    { vaccineName: "Vitamin A-1", dueDate: addMonths(9), status: "Pending" },

    { vaccineName: "DPT Booster-1", dueDate: addMonths(16), status: "Pending" },
    { vaccineName: "OPV Booster", dueDate: addMonths(16), status: "Pending" },

    { vaccineName: "DPT Booster-2", dueDate: addMonths(60), status: "Pending" }
  ];
}

app.post("/add-child", async (req, res) => {
  try {
    const { parentPhone, childName, dob, gender, weight } = req.body;

    const vaccines = generateVaccineSchedule(dob);

    const newChild = new Child({
      parentPhone,
      childName,
      dob,
      gender,
      weight,
      vaccines
    });

    await newChild.save();

    res.status(201).json({
      message: "Child details added successfully"
    });

  } catch (error) {
    console.log("Add child error:", error);
    res.status(500).json({ message: "Server error" });
  }
});
app.post("/send-reset-otp", async (req, res) => {
  try {

    const { phone } = req.body;

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(400).json({
        message: "User not found"
      });
    }

    const otp =
      Math.floor(100000 + Math.random() * 900000).toString();

    otpStore[phone] = {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000
    };

    await sendSMS(
      phone,
      `Your OTP for password reset is ${otp}. Valid for 5 minutes.`
    );

    res.json({
      message: "OTP sent successfully"
    });

  } catch (error) {

    console.log("Send OTP error:", error);

    res.status(500).json({
      message: "Server error"
    });
  }
});

app.post("/reset-password", async (req, res) => {
  try {
    const { phone, otp, newPassword } = req.body;

    const storedOtp = otpStore[phone];

    if (!storedOtp) {
      return res.status(400).json({ message: "OTP not requested" });
    }

    if (Date.now() > storedOtp.expiresAt) {
      delete otpStore[phone];
      return res.status(400).json({ message: "OTP expired" });
    }

    if (storedOtp.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    await User.updateOne(
      { phone },
      { $set: { password: newPassword } }
    );

    delete otpStore[phone];

    res.json({ message: "Password reset successful" });

  } catch (error) {
    console.log("Reset password error:", error);
    res.status(500).json({ message: "Server error" });
  }
});
app.get("/verify-certificate/:childId/:vaccineIndex", async (req, res) => {
  try {
    const { childId, vaccineIndex } = req.params;

    const child = await Child.findById(childId);

    if (!child) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    const index = Number(vaccineIndex);

    if (isNaN(index) || index < 0 || index >= child.vaccines.length) {
      return res.status(400).json({ message: "Invalid certificate" });
    }

    const vaccine = child.vaccines[index];

    if (!vaccine || vaccine.status !== "Done") {
      return res.status(400).json({ message: "Certificate not valid yet" });
    }

    res.json({
      message: "Certificate is valid",
      childName: child.childName,
      gender: child.gender,
      dob: child.dob,
      vaccineName: vaccine.vaccineName,
      dueDate: vaccine.dueDate,
      dateGiven: vaccine.dateGiven,
      status: vaccine.status
    });

  } catch (error) {
    console.log("Verify certificate error:", error);
    res.status(500).json({ message: "Server error" });
  }
});
// Server start
app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on http://localhost:3000");
});