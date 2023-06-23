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

    const docRef = admin.firestore().collection("users").doc(userId);

    try {
      const doc = await docRef.get();
      let orders = (await doc.data()?.orders) || [];
      let lastOrder = orders[orders.length - 1];

      if (lastOrder) {
        lastOrder.publicKey = publicKey;
        lastOrder.privateKey = privateKey;
      }

      await docRef
        .update({ orders: orders })
        .then(() => {
          res.status(204).json();
        })
        .catch((error) => {
          console.error("Error saving public key:", error);
          res.status(500).json({ error: "Error saving public key" });
        });
    } catch (error) {
      console.error("Error updating orders: ", error);
      return -1;
    }
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
    let orders = (await doc.data()?.orders) || [];
    let lastOrder = orders[orders.length - 1];
    if (doc.exists) {
      const publicKey = lastOrder?.publicKey;
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
    const { userId, circuitId, uid, pin } = req.body;

    const userRef = admin.firestore().collection("users").doc(userId);
    const doc = await userRef.get();
    let privateKey = null;
    if (doc.exists) {
      const ordersRef = admin
        .firestore()
        .collection("orders")
        .doc(circuitId)
        .collection("orders");

      const orders = (await doc.data()?.orders) || [];
      orders.forEach((order) => {
        order?.cartItems.forEach((item) => {
          if (item?.uid == uid) {
            privateKey = order?.privateKey;
            return;
          }
        });
      });

      try {
        const snapshot = await ordersRef.get();
        let result = 0;
        snapshot.forEach((doc) => {
          const data = doc.data();

          if (data?.uid == uid) {
            const rsaKey = new NodeRSA();
            rsaKey.importKey(privateKey, "private");
            const decryptedKey = rsaKey.decrypt(data?.encryptedKey, "utf8");

            const decryptedData = CryptoJS.AES.decrypt(
              data?.encryptedData,
              decryptedKey
            ).toString(CryptoJS.enc.Utf8);

            const decyptedPin = decryptedData.substring(
              decryptedData.length - 6
            );

            if (decyptedPin === pin) {
              result = 1;
              res.status(200).json({ result: "success" });
            } else {
              result = -1;
            }
          }
        });
        if (result == 0 || result == -1) {
          res.status(404).json({ result: "failed" });
        }
      } catch (error) {
        console.error("Error decrypting the key:", error);
        res.status(500).json({ result: "Error checking order" });
      }
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    console.error("Error while decrypting data:", err.message);
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

module.exports = router;
