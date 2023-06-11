const express = require("express");
const router = express.Router();
const quotes = require("../services/quotes");

const admin = require("firebase-admin");
require("dotenv").config();

const serviceAccount = {
  type: "service_account",
  project_id: "ticket-manager-46c6d",
  private_key_id: "c0abd7c2af53c4bbb7e01f4f2a75b1632569b266",
  private_key: process.env.FIREBASE_ADMIN_KEY_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_ADMIN_KEY_CLIENT_EMAIL,
  client_id: "112449764427419483134",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-vuwg9%40ticket-manager-46c6d.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://ticket-manager-46c6d.firebaseio.com",
});

/* GET quotes listing. */
router.get("/", async function (req, res, next) {
  try {
    res.json(await quotes.getMultiple(req.query.page));
  } catch (err) {
    console.error(`Error while getting quotes `, err.message);
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

/* POST quotes */
router.post("/", async function (req, res, next) {
  try {
    res.json(await quotes.create(req.body));
  } catch (err) {
    console.error(`Error while posting quotes `, err.message);
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

module.exports = router;
