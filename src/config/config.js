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
if (!process.env.ZEPTOMAIL_HOST) {
  try {
    throw new Error("ZEPTOMAIL_HOST is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}
if (!process.env.ZEPTOMAIL_PORT) {
  try {
    throw new Error("ZEPTOMAIL_PORT is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}
if (!process.env.ZEPTOMAIL_USER) {
  try {
    throw new Error("ZEPTOMAIL_USER is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}
if (!process.env.ZEPTOMAIL_PASS) {
  try {
    throw new Error("ZEPTOMAIL_PASS is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}
if (!process.env.ZEPTOMAIL_FROM_EMAIL) {
  try {
    throw new Error("ZEPTOMAIL_FROM_EMAIL is not defined in environment variables");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}
if (!process.env.ZEPTOMAIL_FROM_NAME) {
  try {
    throw new Error("ZEPTOMAIL_FROM_NAME is not defined in environment variables");
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
  ZEPTOMAIL_HOST: process.env.ZEPTOMAIL_HOST,
  ZEPTOMAIL_PORT: process.env.ZEPTOMAIL_PORT,
  ZEPTOMAIL_USER: process.env.ZEPTOMAIL_USER,
  ZEPTOMAIL_PASS: process.env.ZEPTOMAIL_PASS,
  ZEPTOMAIL_FROM_EMAIL: process.env.ZEPTOMAIL_FROM_EMAIL,
  ZEPTOMAIL_FROM_NAME: process.env.ZEPTOMAIL_FROM_NAME,
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
