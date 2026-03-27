require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const OpenAI = require("openai");

// ✅ Groq client
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const orders = JSON.parse(fs.readFileSync("orders.json", "utf-8"));

// 🌦️ Weather fetch
const getWeather = async (city) => {
  try {
    const res = await axios.get(
      `http://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${city}`
    );

    return {
      city,
      weather: res.data.current.condition.text,
    };
  } catch (err) {
    console.log(`Error with city: ${city}`, err.response?.data || err.message);
    return { city, error: true };
  }
};

// 🤖 AI + Rule-based decision
const askAI = async (order, weatherData) => {
  try {
    const res = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Weather: ${weatherData.weather} in ${order.city}.
Should delivery be delayed? Answer YES or NO.
Also give a short message for ${order.customer}.`,
        },
      ],
    });

    const text = res.choices[0].message.content;

    console.log("AI Response:", text);
    console.log("Weather:", weatherData.weather);

    // 🔥 Strong rule (guaranteed working)
    const weatherText = weatherData.weather.toLowerCase();

    const isBadWeather =
      weatherText.includes("rain") ||
      weatherText.includes("snow") ||
      weatherText.includes("storm") ||
      weatherText.includes("drizzle") ||
      weatherText.includes("thunder");

    const isDelayed =
      isBadWeather || text?.toUpperCase().includes("YES");

    // ✅ Safe message (no parsing issues)
    const message = isDelayed
      ? `Hi ${order.customer}, your order to ${order.city} is delayed due to ${weatherData.weather}. We appreciate your patience!`
      : `Hi ${order.customer}, your order to ${order.city} is on time.`;

    return { isDelayed, message };
  } catch (err) {
    console.log("AI error:", err.response?.data || err.message);

    // fallback logic
    const weatherText = weatherData.weather.toLowerCase();

    const isDelayed =
      weatherText.includes("rain") ||
      weatherText.includes("snow");

    return {
      isDelayed,
      message: `Hi ${order.customer}, your order to ${order.city} ${
        isDelayed ? "is delayed" : "is on time"
      }.`,
    };
  }
};

// 🚀 Agent flow
const processOrders = async () => {
  const weatherResults = await Promise.all(
    orders.map((o) => getWeather(o.city))
  );

  for (let order of orders) {
    const data = weatherResults.find((r) => r.city === order.city);

    if (!data || data.error) continue;

    const ai = await askAI(order, data);

    if (ai.isDelayed) {
      order.status = "Delayed";
      order.message = ai.message;
    }
  }

  fs.writeFileSync("orders.json", JSON.stringify(orders, null, 2));
  console.log("Agent Completed ✅");
};

processOrders();