import { getUserFunctionByName } from "@/lib/user-tools";

async function getWeather({
  location,
  unit,
}: {
  location: string;
  unit: string;
}) {
  const geoRes = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json`
  );
  const geoData = await geoRes.json();

  if (!geoData.length) {
    return { error: "Invalid location" };
  }

  const { lat, lon } = geoData[0];
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&temperature_unit=${
      unit ?? "celsius"
    }`
  );

  if (!weatherRes.ok) {
    throw new Error("Failed to fetch weather data");
  }

  const weather = await weatherRes.json();
  const now = new Date();
  const currentHourISO = now.toISOString().slice(0, 13) + ":00";
  const index = weather.hourly.time.indexOf(currentHourISO);
  const currentTemperature =
    index !== -1 ? weather.hourly.temperature_2m[index] : null;

  return currentTemperature === null
    ? { error: "Temperature data unavailable" }
    : { temperature: currentTemperature };
}

async function getJoke() {
  const jokeRes = await fetch("https://v2.jokeapi.dev/joke/Programming");
  if (!jokeRes.ok) throw new Error("Failed to fetch joke");
  const jokeData = await jokeRes.json();
  const joke =
    jokeData.type === "twopart"
      ? `${jokeData.setup} - ${jokeData.delivery}`
      : jokeData.joke;
  return { joke };
}

const builtinFunctions = {
  get_weather: getWeather,
  get_joke: getJoke,
};

export type BuiltinFunctionName = keyof typeof builtinFunctions;

export async function executeUserFunction({
  userId,
  name,
  parameters,
}: {
  userId: string;
  name: string;
  parameters: any;
}) {
  const userFunction = await getUserFunctionByName(userId, name);
  if (!userFunction) {
    throw new Error(`Unknown or disabled function: ${name}`);
  }
  if (userFunction.execution_type !== "builtin") {
    throw new Error("Only builtin function execution is enabled");
  }
  const fn = builtinFunctions[name as BuiltinFunctionName];
  if (!fn) {
    throw new Error(`Unsupported builtin function: ${name}`);
  }
  return fn(parameters);
}
