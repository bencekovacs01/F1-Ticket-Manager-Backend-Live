var express = require("express");
var router = express.Router();

const NodeRSA = require("node-rsa");
const CryptoJS = require("crypto-js");
const admin = require("firebase-admin");

/* GET home page. */
router.get("/", function (req, res, next) {
  res.json({ message: "alive!!!" });
});

// POST generateKeyPair
router.post("/generateKeyPair", async function (req, res, next) {
  try {
    const { userId } = req.body;

    const key = new NodeRSA({ b: 2048 });
    const publicKey = key.exportKey("public");
    const privateKey = key.exportKey("private");

    const userRef = admin.firestore().collection("users").doc(userId);

    await userRef
      .update({ publicKey, privateKey })
      .then(() => {
        res.status(204).json();
      })
      .catch((error) => {
        console.error("Error saving public key:", error);
        res.status(500).json({ error: "Error saving public key" });
      });
  } catch (err) {
    console.error("Error while generating key pair:", err.message);
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// POST encrypt
router.post("/encrypt", async function (req, res, next) {
  try {
    const { userId, data } = req.body;

    const userRef = admin.firestore().collection("users").doc(userId);

    const doc = await userRef.get();
    if (doc.exists) {
      const publicKey = doc.data().publicKey;
      const aesKey = CryptoJS.lib.WordArray.random(16).toString(); // 128-bit key size
      const encryptedData = CryptoJS.AES.encrypt(data, aesKey).toString();

      const rsaKey = new NodeRSA();
      rsaKey.importKey(publicKey, "public");
      const encryptedKey = rsaKey.encrypt(aesKey.toString(), "base64");

      res
        .status(200)
        .json({ encryptedData: encryptedData, encryptedKey: encryptedKey });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    console.error("Error while encrypting data:", err.message);
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// POST decrypt
router.post("/decrypt", async function (req, res, next) {
  try {
    const { userId, encryptedKey, encryptedData } = req.body;

    const userRef = admin.firestore().collection("users").doc(userId);
    const doc = await userRef.get();
    if (doc.exists) {
      const privateKey = doc.data().privateKey;

      const rsaKey = new NodeRSA();
      rsaKey.importKey(privateKey, "private");

      const decryptedKey = rsaKey.decrypt(encryptedKey, "utf8");

      const decryptedData = CryptoJS.AES.decrypt(
        encryptedData,
        decryptedKey
      ).toString(CryptoJS.enc.Utf8);

      res.status(200).json({ decryptedData });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    console.error("Error while decrypting data:", err.message);
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

module.exports = router;
