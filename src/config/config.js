import dotenv from "dotenv";
dotenv.config();

if (!process.env.MONGO_URI) {
  try {
    throw new Error("MONGO_URI is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}

if (!process.env.JWT_SECRET) {
  try {
    throw new Error("JWT_SECRET is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}
if (!process.env.CLIENT_ID) {
  try {
    throw new Error("CLIENT_ID is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}
if (!process.env.CLIENT_SECRET) {
  try {
    throw new Error("CLIENT_SECRET is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}
if (!process.env.GOOGLE_REFRESH_TOKEN) {
  try {
    throw new Error(
      "GOOGLE_REFRESH_TOKEN is not defined in environment variables",
    );
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}
if (!process.env.GOOGLE_USER) {
  try {
    throw new Error("GOOGLE_USER is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}
if (!process.env.CLOUDINARY_API_KEY) {
  try {
    throw new Error(
      "CLOUDINARY_API_KEY is not defined in environment variables",
    );
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}

if (!process.env.CLOUDINARY_API_SECRET) {
  try {
    throw new Error(
      "CLOUDINARY_API_SECRET is not defined in environment variables",
    );
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}
if (!process.env.CLOUDINARY_NAME) {
  try {
    throw new Error("CLOUDINARY_NAME is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}


if (!process.env.GOOGLE_CLIENT_ID) {
  try {
    throw new Error("GOOGLE_CLIENT_ID is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}

if (!process.env.GOOGLE_CLIENT_SECRET) {
  try {
    throw new Error("GOOGLE_CLIENT_SECRET is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}

if (!process.env.GOOGLE_CALLBACK_URL) {
  try {
    throw new Error("GOOGLE_CALLBACK_URL is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}

if (!process.env.CLIENT_URL) {
  try {
    throw new Error("CLIENT_URL is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}

if( !process.env.REDIS_HOST) {
  try {
    throw new Error("REDIS_HOST is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}

if( !process.env.REDIS_PORT) {
  try {
    throw new Error("REDIS_PORT is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}

if( !process.env.REDIS_PASSWORD) {
  try {
    throw new Error("REDIS_PASSWORD is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}

const config = {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  GOOGLE_USER: process.env.GOOGLE_USER,
  CLOUDINARY_NAME: process.env.CLOUDINARY_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET:process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL:process.env.GOOGLE_CALLBACK_URL,
  CLIENT_URL:process.env.CLIENT_URL,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD
};

export default config;
