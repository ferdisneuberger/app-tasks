const express = require("express");
const router = require("./routes/router");
const { notFoundHandler, errorHandler } = require("./middlewares/errorMiddleware");
const env = require("./config/env");

const app = express();

app.use(express.json());
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;

  if (requestOrigin && !env.allowedOrigins.includes(requestOrigin)) {
    res.status(403).json({ error: "Origin not allowed." });
    return;
  }

  if (requestOrigin) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none';");

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
