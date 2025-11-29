const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const http = require('http').createServer(app);

// Socket.io Setup
const io = require('socket.io')(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const uri = "mongodb+srv://atifsupermart202199:FGzi4j6kRnYTIyP9@cluster0.bfulggv.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

io.on('connection', (socket) => {
  console.log('User connected via Socket.io');
  socket.on('disconnect', () => console.log('User disconnected'));
});

async function run() {
  try {
    await client.connect();
    console.log('DB connected successfully');
    
    const db = client.db('Esp32data4');
    const EspCollection = db.collection('espdata2');
    const DeviceMetaCollection = db.collection('device_metadata'); // নাম সেভ করার নতুন কালেকশন

    // --- 1. Save Device Name API (New) ---
    app.post('/api/device-name', async (req, res) => {
      try {
        const { uid, name } = req.body;
        if (!uid || !name) return res.status(400).send({ error: "UID and Name required" });

        // নাম আপডেট বা ইনসার্ট করা (Upsert)
        const result = await DeviceMetaCollection.updateOne(
          { uid: uid },
          { $set: { uid: uid, name: name } },
          { upsert: true }
        );
        
        io.emit('name-updated', { uid, name }); // ক্লায়েন্টদের আপডেট জানানো
        res.send({ success: true, message: "Name saved" });
      } catch (err) {
        console.error("Error saving name:", err);
        res.status(500).send({ error: "Failed to save name" });
      }
    });

    // --- 2. Get Device Names API (New) ---
    app.get('/api/device-names', async (req, res) => {
      try {
        const docs = await DeviceMetaCollection.find({}).toArray();
        // Array কে Object Map এ কনভার্ট করা { "uid": "name" }
        const nameMap = {};
        docs.forEach(doc => { nameMap[doc.uid] = doc.name; });
        res.send(nameMap);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch names" });
      }
    });

    // --- 3. Sensor Data API ---
    app.post('/api/esp32p', async (req, res) => {
      try {
        const sensorData = req.body;
        const result = await EspCollection.insertOne(sensorData);
        io.emit('new-data', sensorData);
        console.log("Data received from:", sensorData.uid);
        res.send(result);
      } catch (err) {
        console.error("Error in POST:", err);
        res.status(500).send("Error saving data");
      }
    });

    app.get('/api/esp32', async(req, res) =>{
      const cursor = EspCollection.find({}).sort({_id: -1}).limit(500);
      const Data = await cursor.toArray();
      res.send(Data);
    });

    app.get("/", (req, res) => {
      res.send(`<h1 style="color:green;text-align:center;">Server Running on ${port}</h1><a href="/index.html">Go to Dashboard</a>`);
    });

  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

http.listen(port, () => {
  console.log("Server running at port : ", port);
});