const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", app: "MyMakanRoute" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`MyMakanRoute API on port ${port}`));
