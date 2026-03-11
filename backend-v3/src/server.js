const express = require("express");
const router = require("./routes/router");
const { notFoundHandler, errorHandler } = require("./middlewares/errorMiddleware");

const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use("/api", router);
app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
